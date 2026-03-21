import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

const COMPLETE_STEPS = ["ACTIVE", "MOVE_IN_CHECKLIST", "END_OF_TENANCY"];

export default function OnboardingGuard({ children }) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  const onboarding = profile?.onboarding_progress;
  const currentStep = onboarding?.current_step;

  // If onboarding is complete, redirect to dashboard
  if (onboarding && COMPLETE_STEPS.includes(currentStep)) {
    return <Navigate to="/portal/dashboard" replace />;
  }

  return children;
}
