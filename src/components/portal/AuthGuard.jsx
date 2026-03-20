import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

const ROLE_HIERARCHY = {
  TENANT: 0,
  HOUSE_CAPTAIN: 1,
  ADMIN: 2,
};

function roleLevel(role) {
  return ROLE_HIERARCHY[role] ?? -1;
}

export default function AuthGuard({ children, requiredRole }) {
  const { user, profile, loading } = useAuth();

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

  if (requiredRole && roleLevel(profile.role) < roleLevel(requiredRole)) {
    return <Navigate to="/portal/dashboard" replace />;
  }

  return children;
}
