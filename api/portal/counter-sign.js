import { createClient } from "@supabase/supabase-js";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import crypto from "crypto";

const sb = createClient(
  process.env.VITE_IOT_SUPABASE_URL,
  process.env.IOT_SUPABASE_SERVICE_ROLE_KEY
);

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing authorization token" });

  const { data: authData, error: authError } = await sb.auth.getUser(token);
  if (authError || !authData?.user) return res.status(401).json({ error: "Invalid token" });

  // ── Role check: must be ADMIN ─────────────────────────────────────────────
  const { data: adminProfile } = await sb
    .from("tenant_profiles")
    .select("role")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (!adminProfile || adminProfile.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }

  // ── Inputs ────────────────────────────────────────────────────────────────
  const { signature_image_base64, onboarding_id } = req.body || {};
  if (!signature_image_base64 || !onboarding_id) {
    return res.status(400).json({ error: "signature_image_base64 and onboarding_id required" });
  }

  // ── Load onboarding record ────────────────────────────────────────────────
  const { data: onboarding, error: obErr } = await sb
    .from("onboarding_progress")
    .select("id, tenant_profile_id, room_id, ta_signed_url, signing_status")
    .eq("id", onboarding_id)
    .single();

  if (obErr || !onboarding) {
    return res.status(404).json({ error: "Onboarding record not found" });
  }

  if (onboarding.signing_status !== "TENANT_SIGNED") {
    return res.status(400).json({
      error: `Cannot counter-sign: current status is ${onboarding.signing_status ?? "UNSIGNED"}. Tenant must sign first.`,
    });
  }

  if (!onboarding.ta_signed_url) {
    return res.status(400).json({ error: "No tenant-signed PDF found" });
  }

  const adminEmail = authData.user.email;
  const adminIp = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "unknown";
  const timestamp = new Date().toISOString();
  const tenantProfileId = onboarding.tenant_profile_id;

  try {
    // ── Download the tenant-signed PDF ───────────────────────────────────────
    let storagePath = onboarding.ta_signed_url;
    if (storagePath.includes("/tenant-documents/")) {
      storagePath = storagePath.split("/tenant-documents/")[1];
    }
    storagePath = storagePath.split("?")[0];

    const { data: fileData, error: dlErr } = await sb.storage
      .from("tenant-documents")
      .download(storagePath);

    if (dlErr || !fileData) {
      return res.status(500).json({ error: "Failed to download tenant-signed PDF: " + (dlErr?.message || "unknown") });
    }

    const pdfBytes = Buffer.from(await fileData.arrayBuffer());
    const documentHash = crypto.createHash("sha256").update(pdfBytes).digest("hex");

    // ── Stamp admin signature ─────────────────────────────────────────────────
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Embed admin signature image (positioned to the right of tenant signature at x=250)
    const sigBytes = Buffer.from(signature_image_base64, "base64");
    let sigImage;
    try {
      sigImage = await pdfDoc.embedPng(sigBytes);
    } catch {
      try {
        sigImage = await pdfDoc.embedJpg(sigBytes);
      } catch {
        return res.status(400).json({ error: "Invalid signature image format" });
      }
    }

    const sigDims = sigImage.scale(0.25);

    lastPage.drawImage(sigImage, {
      x: 250,
      y: 120,
      width: Math.min(sigDims.width, 200),
      height: Math.min(sigDims.height, 80),
    });

    // Admin signing seal (positioned to the right of tenant seal)
    lastPage.drawRectangle({
      x: 250, y: 50, width: 280, height: 55,
      color: rgb(0.96, 1.0, 0.97),
      borderColor: rgb(0, 0.42, 0.37),
      borderWidth: 0.75,
    });

    lastPage.drawText("COUNTER-SIGNED BY LICENSOR", {
      x: 258, y: 90, size: 7, font: fontBold, color: rgb(0, 0.42, 0.37),
    });

    lastPage.drawText(`Signed by: ${adminEmail}`, {
      x: 258, y: 78, size: 6.5, font, color: rgb(0.3, 0.3, 0.3),
    });

    const dateStr = new Date(timestamp).toLocaleString("en-SG", { timeZone: "Asia/Singapore" });
    lastPage.drawText(`Date: ${dateStr}  |  IP: ${adminIp}`, {
      x: 258, y: 67, size: 6, font, color: rgb(0.5, 0.5, 0.5),
    });

    lastPage.drawText(`Hash: ${documentHash.substring(0, 38)}...`, {
      x: 258, y: 57, size: 5.5, font, color: rgb(0.6, 0.6, 0.6),
    });

    // ── Upload fully-executed PDF ─────────────────────────────────────────────
    const executedPdfBytes = await pdfDoc.save();
    const executedBuffer = Buffer.from(executedPdfBytes);
    const ts = Date.now();
    const executedPath = `tenants/${tenantProfileId}/ta-executed-${ts}.pdf`;

    const { error: uploadErr } = await sb.storage
      .from("tenant-documents")
      .upload(executedPath, executedBuffer, { contentType: "application/pdf", upsert: true });

    if (uploadErr) {
      return res.status(500).json({ error: "Upload failed: " + uploadErr.message });
    }

    // ── Update onboarding_progress ────────────────────────────────────────────
    const { error: updateErr } = await sb
      .from("onboarding_progress")
      .update({
        admin_signed_url: executedPath,
        admin_signed_at: timestamp,
        signing_status: "FULLY_EXECUTED",
        current_step: "DEPOSIT",
        updated_at: timestamp,
      })
      .eq("id", onboarding_id);

    if (updateErr) {
      return res.status(500).json({ error: "Failed to update onboarding record: " + updateErr.message });
    }

    // ── Insert document record ────────────────────────────────────────────────
    await sb.from("tenant_documents").insert({
      tenant_profile_id: tenantProfileId,
      room_id: onboarding.room_id,
      doc_type: "LICENCE_AGREEMENT",
      title: "Licence Agreement (Fully Executed)",
      status: "SIGNED",
      file_url: executedPath,
      signed_at: timestamp,
    });

    // ── Notify tenant via edge function ───────────────────────────────────────
    try {
      await fetch(
        `${process.env.VITE_IOT_SUPABASE_URL}/functions/v1/notify-tenant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.IOT_SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            event_type: "DEPOSIT_VERIFIED",
            tenant_profile_id: tenantProfileId,
            details: {},
          }),
        }
      );
    } catch (notifyErr) {
      // Non-fatal — log but don't fail the counter-sign
      console.warn("Failed to send tenant notification:", notifyErr?.message);
    }

    return res.status(200).json({
      executed_pdf_url: executedPath,
      document_hash: documentHash,
      counter_signed_by: adminEmail,
      counter_signed_at: timestamp,
      ip: adminIp,
    });
  } catch (err) {
    console.error("Counter-sign error:", err);
    return res.status(500).json({ error: "Counter-signing failed: " + (err.message || "unknown") });
  }
}
