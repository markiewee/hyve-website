import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useOnboarding } from "../../hooks/useOnboarding";
import OnboardingGuard from "../../components/portal/OnboardingGuard";
import OnboardingTimeline from "../../components/portal/OnboardingTimeline";
import PersonalDetailsForm from "../../components/portal/PersonalDetailsForm";
import IdScanForm from "../../components/portal/IdScanForm";
import AgreementViewer from "../../components/portal/AgreementViewer";
import DepositPayment from "../../components/portal/DepositPayment";
import HouseRulesView from "../../components/portal/HouseRulesView";
import RoomChecklistForm from "../../components/portal/RoomChecklistForm";
import { STEP_LABELS } from "../../hooks/useOnboarding";
import { Button } from "../../components/ui/button";

const STEP_DESCRIPTIONS = {
  PERSONAL_DETAILS:
    "Tell us a bit about yourself so we can set up your tenancy profile.",
  ID_VERIFICATION:
    "We need to verify your identity. Scan your ID or upload a photo.",
  SIGN_TA:
    "Review and sign your Tenancy Agreement to confirm your room booking.",
  DEPOSIT:
    "Pay your security deposit to secure your room at Hyve.",
  HOUSE_RULES:
    "Read and acknowledge our community house rules before moving in.",
  MOVE_IN_CHECKLIST:
    "Record the condition of your room at move-in for your protection.",
  ACTIVE: "You're all set! Welcome to Hyve.",
};

function StepContent({ currentStep, onboarding, advanceStep, updateOnboarding, refetch }) {
  switch (currentStep) {
    case "PERSONAL_DETAILS":
      return (
        <PersonalDetailsForm
          onboarding={onboarding}
          advanceStep={advanceStep}
        />
      );
    case "ID_VERIFICATION":
      return (
        <IdScanForm
          onboarding={onboarding}
          advanceStep={advanceStep}
        />
      );
    case "SIGN_TA":
      return (
        <AgreementViewer
          onboarding={onboarding}
          advanceStep={advanceStep}
          refetch={refetch}
        />
      );
    case "DEPOSIT":
      return (
        <DepositPayment
          onboarding={onboarding}
          advanceStep={advanceStep}
          refetch={refetch}
        />
      );
    case "HOUSE_RULES":
      return (
        <HouseRulesView
          onboarding={onboarding}
          advanceStep={advanceStep}
          updateOnboarding={updateOnboarding}
        />
      );
    case "MOVE_IN_CHECKLIST":
      return (
        <RoomChecklistForm
          onboarding={onboarding}
          advanceStep={advanceStep}
        />
      );
    case "ACTIVE":
      return (
        <div className="text-center py-10">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Onboarding Complete!
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            Welcome to Hyve. Your room is ready for you.
          </p>
          <Button asChild>
            <Link to="/portal/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      );
    default:
      return (
        <p className="text-sm text-muted-foreground">Unknown step.</p>
      );
  }
}

function OnboardingContent() {
  const { profile, loading: authLoading } = useAuth();
  const {
    onboarding,
    loading,
    currentStep,
    advanceStep,
    updateOnboarding,
    refetch,
  } = useOnboarding(profile?.id);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  if (!onboarding) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Onboarding Not Found
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Your onboarding record could not be found. Please contact Hyve
            support.
          </p>
          <Button variant="outline" asChild>
            <Link to="/portal/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  const roomName = profile?.rooms?.name ?? "your room";
  const propertyName = profile?.properties?.name ?? "Hyve";
  const unitCode = profile?.rooms?.unit_code;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link
            to="/portal/dashboard"
            className="text-base font-semibold text-foreground hover:text-primary transition-colors"
          >
            Hyve Portal
          </Link>
          <div className="flex items-center gap-3 shrink-0">
            {unitCode && (
              <span className="text-xs font-mono bg-secondary text-secondary-foreground px-2 py-1 rounded">
                {unitCode}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 py-8">
          {/* Page heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground">
              Welcome to Hyve
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {roomName} &mdash; {propertyName}
            </p>
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Timeline sidebar */}
            <aside className="lg:col-span-1">
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
                  Progress
                </p>
                <OnboardingTimeline
                  currentStep={currentStep}
                  onboarding={onboarding}
                />
              </div>
            </aside>

            {/* Main step content */}
            <div className="lg:col-span-3">
              <div className="bg-card border border-border rounded-lg p-6">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-foreground">
                    {STEP_LABELS[currentStep] ?? currentStep}
                  </h2>
                  {STEP_DESCRIPTIONS[currentStep] && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {STEP_DESCRIPTIONS[currentStep]}
                    </p>
                  )}
                </div>

                <StepContent
                  currentStep={currentStep}
                  onboarding={onboarding}
                  advanceStep={advanceStep}
                  updateOnboarding={updateOnboarding}
                  refetch={refetch}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <OnboardingGuard>
      <OnboardingContent />
    </OnboardingGuard>
  );
}
