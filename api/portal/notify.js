const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Internal endpoint — verify with a shared secret
  const secret = req.headers["x-notify-secret"];
  if (secret !== process.env.NOTIFY_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { to, subject, html } = req.body;
  if (!to || !subject || !html) {
    return res.status(400).json({ error: "to, subject, and html required" });
  }

  try {
    const { data, error } = await resend.emails.send({
      from: "Hyve <noreply@hyve.sg>",
      to,
      subject,
      html,
    });
    if (error) return res.status(500).json({ error: error.message });
    res.status(200).json({ id: data.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
