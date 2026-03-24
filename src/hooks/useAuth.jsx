import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from("tenant_profiles")
    .select("*, rooms(name, unit_code, property_id), properties(name, code), onboarding_progress(*), tenant_details(*)")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  if (!error && data) {
    return data;
  }

  // Fallback: check if this user is an investor
  const { data: investor, error: invError } = await supabase
    .from("investors")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  if (!invError && investor) {
    return { ...investor, _type: "INVESTOR", role: "INVESTOR" };
  }

  if (error) {
    console.error("Error fetching profile:", error);
  }
  return null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      if (sessionUser) {
        fetchProfile(sessionUser.id).then((p) => {
          setProfile(p);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      if (sessionUser) {
        fetchProfile(sessionUser.id).then(setProfile);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    if (data.user) {
      const p = await fetchProfile(data.user.id);
      setProfile(p);
    }
    return data;
  }

  async function signUp(email, password, token) {
    const res = await fetch("/api/portal/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, token }),
    });

    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.error || "Signup failed");
    }

    // Auto sign-in after successful account creation
    return signIn(email, password);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ user, profile, setProfile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
