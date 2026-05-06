// GET /api/book/slots?property=IH&date=YYYY-MM-DD[&room=PR1]
// Public — returns free 30-min slots for the chosen property + date.

import { getAvailableSlots } from "../../src/lib/googleCalendar.js";
import { normalizePropertyCode } from "../../src/lib/bookingHelpers.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const property = normalizePropertyCode(req.query?.property);
    const date = req.query?.date;
    if (!property) return res.status(400).json({ error: "property required" });
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "date required (YYYY-MM-DD)" });
    }

    const slots = await getAvailableSlots(date, property);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ slots });
  } catch (err) {
    console.error("[/api/book/slots] error:", err);
    return res.status(500).json({ error: err.message || "Failed to load slots" });
  }
}
