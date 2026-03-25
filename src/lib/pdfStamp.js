import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

/**
 * Stamp text fields onto a PDF.
 * @param {ArrayBuffer|Uint8Array} pdfBytes - The original PDF bytes
 * @param {Array} fields - Array of { key, x, y, width, height, page, fontSize }
 * @param {Object} values - Map of key → text value to stamp
 * @returns {Uint8Array} - The stamped PDF bytes
 */
export async function stampPdf(pdfBytes, fields, values) {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  for (const field of fields) {
    const text = values[field.key] || "";
    if (!text) continue;

    const pageIndex = (field.page || 1) - 1;
    const page = pages[pageIndex];
    if (!page) continue;

    const fontSize = field.fontSize || 11;

    page.drawText(text, {
      x: field.x,
      y: field.y,
      size: fontSize,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
  }

  return pdfDoc.save();
}

/**
 * Fetch a PDF from URL and return as ArrayBuffer.
 */
export async function fetchPdfBytes(url) {
  const res = await fetch(url);
  return res.arrayBuffer();
}
