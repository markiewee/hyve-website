import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

const ROLE_HIERARCHY = {
  TENANT: 0,
  HOUSE_CAPTAIN: 1,
  ADMIN: 2,
};

const ONBOARDING_COMPLETE_STEPS = ["ACTIVE", "END_OF_TENANCY", "MOVE_IN_CHECKLIST"];

function roleLevel(role) {
  return ROLE_HIERARCHY[role] ?? -1;
}

export default function AuthGuard({ children, requiredRole }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/portal/login" replace />;
  }

  // Investor routing: investors can only access /portal/investor/* paths
  if (profile._type === "INVESTOR" || profile.role === "INVESTOR") {
    if (!location.pathname.startsWith("/portal/investor")) {
      return <Navigate to="/portal/investor/dashboard" replace />;
    }
    return children;
  }

  // Redirect tenants who haven't completed onboarding
  const onboarding = profile.onboarding_progress;
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
