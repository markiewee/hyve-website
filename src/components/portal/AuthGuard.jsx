import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

// Signed in but no active profile. The old behaviour was a silent Navigate
// back to /portal/login, which reads as "the page ignored me" (Julia,
// 15 Aug 2026: two half-provisioned inactive profiles, credentials fine).
// Words and a way out instead.
function InactiveAccountScreen({ onSignOut }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md text-center space-y-4">
        <p className="text-foreground text-lg font-medium">
          You are signed in, but your account is not linked to an active tenancy yet.
        </p>
        <p className="text-muted-foreground text-sm">
          This is on us, not you. Message us on{" "}
          <a
            href="https://wa.me/6580695410"
            className="text-accent underline"
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp 8069 5410
          </a>{" "}
          and we will sort it out.
        </p>
        <button
          type="button"
          onClick={onSignOut}
          className="px-4 py-2 rounded-full text-xs font-mono uppercase tracking-[0.16em] bg-surface-container text-foreground hover:bg-white/5 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

const ROLE_HIERARCHY = {
  TENANT: 0,
  HOUSE_CAPTAIN: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

const ONBOARDING_COMPLETE_STEPS = ["ACTIVE", "END_OF_TENANCY", "MOVE_IN_CHECKLIST"];

function roleLevel(role) {
  return ROLE_HIERARCHY[role] ?? -1;
}

export default function AuthGuard({ children, requiredRole }) {
  const { user, profile, loading, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/portal/login" replace />;
  }

  if (!profile) {
    return <InactiveAccountScreen onSignOut={signOut} />;
  }

  // Investor routing: investors can only access /portal/investor/* paths
  if (profile._type === "INVESTOR" || profile.role === "INVESTOR") {
    if (!location.pathname.startsWith("/portal/investor")) {
      return <Navigate to="/portal/investor/dashboard" replace />;
    }
    return children;
  }

  // Landlord routing: landlords only see the read-only /portal/landlord roster
  if (profile.role === "LANDLORD") {
    if (!location.pathname.startsWith("/portal/landlord")) {
      return <Navigate to="/portal/landlord" replace />;
    }
    return children;
  }

  // Redirect tenants who haven't completed onboarding
  const rawOnboarding = profile.onboarding_progress;
  const onboarding = Array.isArray(rawOnboarding) ? rawOnboarding[0] : rawOnboarding;
  if (
    onboarding &&
    !ONBOARDING_COMPLETE_STEPS.includes(onboarding.current_step) &&
    !location.pathname.startsWith("/portal/onboarding")
  ) {
    return <Navigate to="/portal/onboarding" replace />;
  }

  if (requiredRole && roleLevel(profile.role) < roleLevel(requiredRole)) {
    return <Navigate to="/portal/dashboard" replace />;
  }

  return children;
}
