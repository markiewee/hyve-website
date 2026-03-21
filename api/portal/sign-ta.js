const { createClient } = require("@supabase/supabase-js");
const { PDFDocument, rgb } = require("pdf-lib");
const crypto = require("crypto");

const supabase = createClient(
  process.env.VITE_IOT_SUPABASE_URL,
  process.env.IOT_SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verify bearer token
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const { signature_image_base64, onboarding_id } = req.body || {};

  if (!signature_image_base64 || !onboarding_id) {
    return res.status(400).json({ error: "signature_image_base64 and onboarding_id are required" });
  }

  // Fetch onboarding record
  const { data: onboarding, error: onboardingError } = await supabase
    .from("onboarding_progress")
    .select("*, tenant_profiles(id, user_id, email:user_id(email))")
    .eq("id", onboarding_id)
    .single();

  if (onboardingError || !onboarding) {
    return res.status(404).json({ error: "Onboarding record not found" });
  }

  // Verify ownership
  if (onboarding.tenant_profiles?.user_id !== authData.user.id) {
    return res.status(403).json({ error: "Not authorised" });
  }

  if (!onboarding.ta_document_url) {
    return res.status(400).json({ error: "No TA uploaded" });
  }

  const tenantProfileId = onboarding.tenant_profile_id;
  const userEmail = authData.user.email;
  const timestamp = new Date().toISOString();

  try {
    // Extract storage path from ta_document_url
    // URL format: .../storage/v1/object/public/tenant-documents/{path}
    const urlParts = onboarding.ta_document_url.split("/tenant-documents/");
    const storagePath = urlParts[1];

    if (!storagePath) {
      return res.status(400).json({ error: "Could not parse TA document URL" });
    }

    // Download the unsigned PDF
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("tenant-documents")
      .download(storagePath);

    if (downloadError || !fileData) {
      console.error("Failed to download TA:", downloadError);
      return res.status(500).json({ error: "Failed to download TA document" });
    }

    const pdfBytes = await fileData.arrayBuffer();

    // Calculate SHA-256 hash of original PDF
    const documentHash = crypto
      .createHash("sha256")
      .update(Buffer.from(pdfBytes))
      .digest("hex");

    // Load PDF with pdf-lib
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];

    // Embed signature PNG
    const signatureImageBytes = Buffer.from(signature_image_base64, "base64");
    const signatureImage = await pdfDoc.embedPng(signatureImageBytes);
    const sigDims = signatureImage.scale(0.3);

    lastPage.drawImage(signatureImage, {
      x: 50,
      y: 80,
      width: sigDims.width,
      height: sigDims.height,
    });

    // Add signing text
    const signText = `Digitally signed by ${userEmail} on ${timestamp}`;
    const hashText = `Document hash: ${documentHash}`;

    lastPage.drawText(signText, {
      x: 50,
      y: 60,
      size: 8,
      color: rgb(0.3, 0.3, 0.3),
    });

    lastPage.drawText(hashText, {
      x: 50,
      y: 50,
      size: 7,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Serialize signed PDF
    const signedPdfBytes = await pdfDoc.save();

    // Upload signed PDF
    const ts = Date.now();
    const signedPath = `tenants/${tenantProfileId}/ta-signed-${ts}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("tenant-documents")
      .upload(signedPath, signedPdfBytes, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Failed to upload signed PDF:", uploadError);
      return res.status(500).json({ error: "Failed to upload signed PDF" });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("tenant-documents")
      .getPublicUrl(signedPath);

    const signedPdfUrl = urlData.publicUrl;

    // Insert tenant_documents record
    await supabase.from("tenant_documents").insert({
      tenant_profile_id: tenantProfileId,
      doc_type: "LICENCE_AGREEMENT",
      status: "SIGNED",
      file_url: signedPdfUrl,
      document_hash: documentHash,
    });

    // Update onboarding_progress
    await supabase
      .from("onboarding_progress")
      .update({
        ta_signed_url: signedPdfUrl,
        ta_signed_at: timestamp,
        current_step: "DEPOSIT",
        updated_at: timestamp,
      })
      .eq("id", onboarding_id);

    return res.status(200).json({
      signed_pdf_url: signedPdfUrl,
      document_hash: documentHash,
    });
  } catch (err) {
    console.error("Sign TA error:", err);
    return res.status(500).json({ error: "Failed to sign TA" });
  }
};
