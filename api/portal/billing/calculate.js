const { createClient } = require("@supabase/supabase-js");

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

  // Check the caller has ADMIN role
  const { data: callerProfile, error: profileError } = await supabase
    .from("tenant_profiles")
    .select("role")
    .eq("user_id", authData.user.id)
    .eq("is_active", true)
    .single();

  if (profileError || !callerProfile || callerProfile.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin role required" });
  }

  // Call the calculate-usage edge function
  const supabaseUrl = process.env.VITE_IOT_SUPABASE_URL;
  const serviceRoleKey = process.env.IOT_SUPABASE_SERVICE_ROLE_KEY;

  let edgeResponse;
  try {
    edgeResponse = await fetch(
      `${supabaseUrl}/functions/v1/calculate-usage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }
    );
  } catch (fetchError) {
    console.error("Failed to call calculate-usage edge function:", fetchError);
    return res.status(502).json({ error: "Failed to reach edge function" });
  }

  let result;
  try {
    result = await edgeResponse.json();
  } catch {
    return res
      .status(502)
      .json({ error: "Invalid response from edge function" });
  }

  if (!edgeResponse.ok) {
    return res
      .status(edgeResponse.status)
      .json({ error: "Edge function error", detail: result });
  }

  return res.status(200).json(result);
};
