const { createClient } = require("@supabase/supabase-js");
const Anthropic = require("@anthropic-ai/sdk").default;

const supabase = createClient(
  process.env.VITE_IOT_SUPABASE_URL,
  process.env.IOT_SUPABASE_SERVICE_ROLE_KEY
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function buildPrompt(id_type) {
  switch (id_type) {
    case "NRIC":
      return "Extract from this Singapore NRIC: full name, NRIC number, nationality, date of birth. Return JSON with keys: name, id_number, nationality, date_of_birth";
    case "PASSPORT":
      return "Extract from this passport: full name, passport number, nationality, date of birth, expiry date. Return JSON with keys: name, id_number, nationality, date_of_birth, expiry_date";
    case "WORK_PERMIT":
      return "Extract from this work permit: full name, permit number, nationality, date of birth, expiry date. Return JSON with keys: name, id_number, nationality, date_of_birth, expiry_date";
    case "EMPLOYMENT_PASS":
      return "Extract from this employment pass: full name, pass number, nationality, date of birth, expiry date. Return JSON with keys: name, id_number, nationality, date_of_birth, expiry_date";
    default:
      return "Extract from this ID document: full name, ID number, nationality, date of birth. Return JSON with keys: name, id_number, nationality, date_of_birth";
  }
}

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

  const { image_base64, id_type } = req.body || {};

  if (!image_base64) {
    return res.status(400).json({ error: "image_base64 is required" });
  }

  try {
    const prompt = buildPrompt(id_type);

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: image_base64,
              },
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    });

    const responseText = message.content[0]?.text ?? "";

    // Extract JSON from the response text
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in Claude response:", responseText);
      return res.status(500).json({ error: "OCR failed. Please fill in manually." });
    }

    const extracted = JSON.parse(jsonMatch[0]);
    return res.status(200).json(extracted);
  } catch (err) {
    console.error("OCR error:", err);
    return res.status(500).json({ error: "OCR failed. Please fill in manually." });
  }
};
