import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { withTimeout } from "../lib/withTimeout";

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
    // Watchdog: if anything below stalls (e.g., supabase refresh-token hang),
    // release the AuthGuard splash after 8s so the user reaches /portal/login.
    const watchdog = setTimeout(() => setLoading(false), 8000);

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        const sessionUser = session?.user ?? null;
        setUser(sessionUser);
        if (sessionUser) {
          return fetchProfile(sessionUser.id)
            .then((p) => setProfile(p))
            .catch((e) => console.error("fetchProfile failed", e));
        }
      })
      .catch((e) => console.error("getSession failed", e))
      .finally(() => {
        clearTimeout(watchdog);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      if (sessionUser) {
        // Defer DB calls OUT of the auth callback. Calling supabase.from()
        // synchronously inside onAuthStateChange deadlocks the client's auth
        // lock, login succeeds but the profile query waits on the lock the
        // callback still holds, leaving the UI stuck on "Signing in…".
        // setTimeout(0) lets the callback return and release the lock first.
        setTimeout(() => {
          fetchProfile(sessionUser.id)
            .then(setProfile)
            .catch((e) => console.error("fetchProfile (onAuthStateChange) failed", e));
        }, 0);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(identifier, password) {
    // If identifier looks like an email, use directly; otherwise treat as username
    let email = identifier;
    if (!identifier.includes("@")) {
      // Construct the placeholder email directly, no DB lookup needed
      email = `${identifier.toLowerCase().trim()}@portal.lazybee.sg`;
    }

    // The auth-lock stall was patched for page load on 13 May and 30 May but
    // the sign-in click stayed unguarded, which is how Julia sat on an
    // eternal "SIGNING IN..." spinner on 15 Aug. Ten seconds, then a real
    // error the form can show.
    const { data, error } = await withTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      10_000,
      "Sign-in timed out. Check your connection and try again.",
    );
    if (error) throw error;
    if (data.user) {
      const p = await withTimeout(
        fetchProfile(data.user.id),
        10_000,
        "Signed in, but your profile did not load. Try again in a minute.",
      );
      if (!p) {
        // Auth works but no active profile: previously this "succeeded",
        // navigated to the dashboard and AuthGuard silently bounced back to
        // the login page. Fail here with words instead.
        await supabase.auth.signOut().catch(() => {});
        throw new Error(
          "Your login works but your account is not set up right. " +
            "Message us on WhatsApp 8069 5410 and we will sort it out.",
        );
      }
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
