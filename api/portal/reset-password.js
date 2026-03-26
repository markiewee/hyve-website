import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_IOT_SUPABASE_URL,
  process.env.IOT_SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Verify caller is admin
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing authorization token" });

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) return res.status(401).json({ error: "Invalid token" });

  const { data: callerProfile } = await supabase
    .from("tenant_profiles")
    .select("role")
    .eq("user_id", authData.user.id)
    .eq("is_active", true)
    .single();

  if (!callerProfile || callerProfile.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin role required" });
  }

  const { user_id, new_password } = req.body || {};
  if (!user_id || !new_password) {
    return res.status(400).json({ error: "user_id and new_password required" });
  }

  if (new_password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(user_id, {
    password: new_password,
  });

  if (updateError) {
    return res.status(500).json({ error: updateError.message });
  }

  return res.status(200).json({ success: true });
}
