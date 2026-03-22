const { createClient } = require("@supabase/supabase-js");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const crypto = require("crypto");

const supabase = createClient(
  process.env.VITE_IOT_SUPABASE_URL,
  process.env.IOT_SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing authorization token" });

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) return res.status(401).json({ error: "Invalid token" });

  const { signature_image_base64, onboarding_id } = req.body || {};
  if (!signature_image_base64 || !onboarding_id) {
    return res.status(400).json({ error: "signature_image_base64 and onboarding_id required" });
  }

  // Fetch onboarding record (simple query, no nested joins)
  const { data: onboarding, error: obErr } = await supabase
    .from("onboarding_progress")
    .select("id, tenant_profile_id, room_id, ta_document_url")
    .eq("id", onboarding_id)
    .single();

  if (obErr || !onboarding) {
    return res.status(404).json({ error: "Onboarding record not found" });
  }

  // Verify ownership via tenant_profiles
  const { data: profile } = await supabase
    .from("tenant_profiles")
    .select("user_id")
    .eq("id", onboarding.tenant_profile_id)
    .single();

  if (!profile || profile.user_id !== authData.user.id) {
    return res.status(403).json({ error: "Not authorised" });
  }

  if (!onboarding.ta_document_url) {
    return res.status(400).json({ error: "No TA uploaded yet" });
  }

  const tenantProfileId = onboarding.tenant_profile_id;
  const userEmail = authData.user.email;
  const userIp = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "unknown";
  const userAgent = req.headers["user-agent"] || "unknown";
  const timestamp = new Date().toISOString();

  try {
    // Resolve storage path
    let storagePath = onboarding.ta_document_url;
    if (storagePath.includes("/tenant-documents/")) {
      storagePath = storagePath.split("/tenant-documents/")[1];
    }
    storagePath = storagePath.split("?")[0];

    // Download unsigned PDF
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("tenant-documents")
      .download(storagePath);

    if (dlErr || !fileData) {
      return res.status(500).json({ error: "Failed to download TA: " + (dlErr?.message || "unknown") });
    }

    const pdfBytes = Buffer.from(await fileData.arrayBuffer());
    const documentHash = crypto.createHash("sha256").update(pdfBytes).digest("hex");

    // Load and modify PDF
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];
    const { width, height } = lastPage.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Try to embed signature as PNG, fallback to JPEG
    const sigBytes = Buffer.from(signature_image_base64, "base64");
    let sigImage;
    try {
      sigImage = await pdfDoc.embedPng(sigBytes);
    } catch {
      try {
        sigImage = await pdfDoc.embedJpg(sigBytes);
      } catch (imgErr) {
        return res.status(400).json({ error: "Invalid signature image format. Please try again." });
      }
    }

    const sigDims = sigImage.scale(0.25);
    const sigX = 50;
    const sigY = 120;

    // Draw signature image
    lastPage.drawImage(sigImage, {
      x: sigX,
      y: sigY,
      width: Math.min(sigDims.width, 200),
      height: Math.min(sigDims.height, 80),
    });

    // Draw signing seal box
    const sealY = sigY - 15;
    lastPage.drawRectangle({
      x: sigX,
      y: sealY - 55,
      width: 350,
      height: 55,
      color: rgb(0.96, 0.97, 1),
      borderColor: rgb(0.73, 0.79, 0.77),
      borderWidth: 0.5,
    });

    // Seal content — paper trail
    lastPage.drawText("DIGITALLY SIGNED", {
      x: sigX + 8,
      y: sealY - 15,
      size: 7,
      font: fontBold,
      color: rgb(0, 0.42, 0.37),
    });

    lastPage.drawText(`Signed by: ${userEmail}`, {
      x: sigX + 8,
      y: sealY - 27,
      size: 6.5,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });

    lastPage.drawText(`Date: ${new Date(timestamp).toLocaleString("en-SG", { timeZone: "Asia/Singapore" })}  |  IP: ${userIp}`, {
      x: sigX + 8,
      y: sealY - 38,
      size: 6,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });

    lastPage.drawText(`Hash: ${documentHash.substring(0, 40)}...`, {
      x: sigX + 8,
      y: sealY - 49,
      size: 5.5,
      font,
      color: rgb(0.6, 0.6, 0.6),
    });

    // Save signed PDF
    const signedPdfBytes = await pdfDoc.save();
    const signedBuffer = Buffer.from(signedPdfBytes);

    const ts = Date.now();
    const signedPath = `tenants/${tenantProfileId}/ta-signed-${ts}.pdf`;

    const { error: uploadErr } = await supabase.storage
      .from("tenant-documents")
      .upload(signedPath, signedBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr) {
      return res.status(500).json({ error: "Failed to upload signed PDF: " + uploadErr.message });
    }

    // Insert tenant_documents record
    await supabase.from("tenant_documents").insert({
      tenant_profile_id: tenantProfileId,
      room_id: onboarding.room_id,
      doc_type: "LICENCE_AGREEMENT",
      title: "Licence Agreement (Signed)",
      status: "SIGNED",
      file_url: signedPath,
      signed_at: timestamp,
    });

    // Update onboarding_progress
    await supabase
      .from("onboarding_progress")
      .update({
        ta_signed_url: signedPath,
        ta_signed_at: timestamp,
        current_step: "DEPOSIT",
      })
      .eq("id", onboarding_id);

    return res.status(200).json({
      signed_pdf_url: signedPath,
      document_hash: documentHash,
      signed_by: userEmail,
      signed_at: timestamp,
      ip: userIp,
    });
  } catch (err) {
    console.error("Sign TA error:", err);
    return res.status(500).json({ error: "Signing failed: " + (err.message || "unknown error") });
  }
};
