import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useOnboarding } from "../../hooks/useOnboarding";
import { notifyMember } from "../../lib/notify";
import OnboardingGuard from "../../components/portal/OnboardingGuard";
import OnboardingTimeline from "../../components/portal/OnboardingTimeline";
import PersonalDetailsForm from "../../components/portal/PersonalDetailsForm";
import IdScanForm from "../../components/portal/IdScanForm";
import AgreementViewer from "../../components/portal/AgreementViewer";
import DepositPayment from "../../components/portal/DepositPayment";
import HouseRulesView from "../../components/portal/HouseRulesView";
import MoveInInstructions from "../../components/portal/MoveInInstructions";
import RoomChecklistForm from "../../components/portal/RoomChecklistForm";
import { STEP_LABELS } from "../../hooks/useOnboarding";

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
  MOVE_IN_INSTRUCTIONS:
    "Everything you need to know for a smooth move-in day.",
  MOVE_IN_CHECKLIST:
    "Record the condition of your room at move-in for your protection.",
  ACTIVE: "You're all set! Welcome to Hyve.",
};

const STEP_ORDER = [
  "PERSONAL_DETAILS",
  "ID_VERIFICATION",
  "SIGN_TA",
  "DEPOSIT",
  "HOUSE_RULES",
  "MOVE_IN_INSTRUCTIONS",
  "MOVE_IN_CHECKLIST",
  "ACTIVE",
];

const STEP_ICONS = {
  PERSONAL_DETAILS: "person",
  ID_VERIFICATION: "badge",
  SIGN_TA: "edit_document",
  DEPOSIT: "payments",
  HOUSE_RULES: "gavel",
  MOVE_IN_INSTRUCTIONS: "info",
  MOVE_IN_CHECKLIST: "checklist",
  ACTIVE: "check_circle",
};

function ActiveStepNotifier({ onboarding, profile }) {
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (notifiedRef.current) return;
    notifiedRef.current = true;
    try {
      notifyMember(onboarding?.tenant_profile_id || profile?.id, "ONBOARDING_COMPLETE", {
        tenant_name: profile?.tenant_details?.full_name || profile?.full_name || "",
        room_code: profile?.rooms?.unit_code || "",
        property_name: profile?.properties?.name || "",
      });
    } catch (_) { /* non-blocking */ }
  }, []);
  return null;
}

function StepContent({ currentStep, onboarding, advanceStep, updateOnboarding, refetch, profile }) {
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
    case "MOVE_IN_INSTRUCTIONS":
      return (
        <MoveInInstructions
          advanceStep={advanceStep}
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
        <div className="py-8">
          <ActiveStepNotifier onboarding={onboarding} profile={profile} />
          {/* Welcome banner */}
          <div className="text-center mb-10">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[#006b5f]/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#006b5f] text-[40px]" style={{ fontVariationSettings: "'FILL' 1" }}>celebration</span>
            </div>
            <h3 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a] mb-3">
              Welcome to the Hyve Community!
            </h3>
            <p className="font-['Manrope'] text-[#555f6f] text-sm max-w-md mx-auto leading-relaxed">
              You're all set. Here's a quick guide to help you settle in and make the most of your stay.
            </p>
          </div>

          {/* Quick Start Guide */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10 max-w-2xl mx-auto">
            <div className="bg-white border border-[#bbcac6]/15 rounded-xl p-5 space-y-2">
              <span className="material-symbols-outlined text-[#006b5f] text-[24px]">dashboard</span>
              <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#121c2a]">Your Dashboard</h4>
              <p className="text-xs text-[#555f6f] font-['Manrope'] leading-relaxed">Track your AC usage, rent status, and manage everything from one place.</p>
            </div>
            <div className="bg-white border border-[#bbcac6]/15 rounded-xl p-5 space-y-2">
              <span className="material-symbols-outlined text-[#006b5f] text-[24px]">payments</span>
              <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#121c2a]">Pay Rent</h4>
              <p className="text-xs text-[#555f6f] font-['Manrope'] leading-relaxed">Rent is due on the 1st of each month. Pay via bank transfer or card in the Billing section.</p>
            </div>
            <div className="bg-white border border-[#bbcac6]/15 rounded-xl p-5 space-y-2">
              <span className="material-symbols-outlined text-[#006b5f] text-[24px]">build</span>
              <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#121c2a]">Report Issues</h4>
              <p className="text-xs text-[#555f6f] font-['Manrope'] leading-relaxed">AC not working? Leaky tap? Report maintenance issues and we'll handle it ASAP.</p>
            </div>
            <div className="bg-white border border-[#bbcac6]/15 rounded-xl p-5 space-y-2">
              <span className="material-symbols-outlined text-[#006b5f] text-[24px]">folder_open</span>
              <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#121c2a]">Your Documents</h4>
              <p className="text-xs text-[#555f6f] font-['Manrope'] leading-relaxed">View your tenancy agreement and upload documents like stamping certificates.</p>
            </div>
            <div className="bg-white border border-[#bbcac6]/15 rounded-xl p-5 space-y-2 sm:col-span-2">
              <span className="material-symbols-outlined text-[#006b5f] text-[24px]">support_agent</span>
              <h4 className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#121c2a]">Need Help?</h4>
              <p className="text-xs text-[#555f6f] font-['Manrope'] leading-relaxed">WhatsApp us anytime at <strong>+65 8088 5410</strong> or email <strong>hello@hyve.sg</strong>. We typically respond within an hour.</p>
            </div>
          </div>

          <div className="text-center">
            <Link
              to="/portal/dashboard"
              className="inline-flex items-center gap-2 bg-[#006b5f] text-white rounded-xl px-8 py-4 font-['Manrope'] font-bold text-base hover:bg-[#006a61] transition-colors shadow-lg shadow-[#006b5f]/20"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              Go to My Dashboard
            </Link>
          </div>
        </div>
      );
    default:
      return (
        <p className="font-['Manrope'] text-sm text-[#555f6f]">Unknown step.</p>
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
    goBack,
    goToStep,
    canGoBack,
    isStepCompleted,
    refetch,
  } = useOnboarding(profile?.id);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9ff]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-[#006b5f]/30 border-t-[#006b5f] animate-spin" />
          <p className="font-['Manrope'] text-[#555f6f] text-sm">
            Loading your onboarding…
          </p>
        </div>
      </div>
    );
  }

  if (!onboarding) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8f9ff] px-4">
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-[#bbcac6]/15 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[#ffdad6]/40 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#ba1a1a] text-[32px]">
              error_outline
            </span>
          </div>
          <h1 className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-[#121c2a] mb-3">
            Onboarding Not Found
          </h1>
          <p className="font-['Manrope'] text-sm text-[#555f6f] mb-8 leading-relaxed">
            Your onboarding record could not be found. Please contact Hyve
            support.
          </p>
          <Link
            to="/portal/dashboard"
            className="inline-flex items-center gap-2 bg-[#eff4ff] text-[#006b5f] rounded-xl px-5 py-2.5 font-['Manrope'] font-semibold text-sm hover:bg-[#e6eeff] transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const roomName = profile?.rooms?.name ?? "your room";
  const propertyName = profile?.properties?.name ?? "Hyve";
  const unitCode = profile?.rooms?.unit_code;

  const currentStepIndex = STEP_ORDER.indexOf(currentStep);
  const totalSteps = STEP_ORDER.length - 1; // exclude ACTIVE from count
  const progressPct = Math.round(
    (Math.min(currentStepIndex, totalSteps - 1) / (totalSteps - 1)) * 100
  );

  return (
    <div className="min-h-screen bg-[#f8f9ff] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-[#bbcac6]/10 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between gap-4">
          <Link
            to="/portal/dashboard"
            className="flex items-center gap-2 group"
          >
            <div className="w-7 h-7 rounded-lg bg-[#006b5f] flex items-center justify-center">
              <span
                className="material-symbols-outlined text-white text-[14px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                home
              </span>
            </div>
            <span className="font-['Plus_Jakarta_Sans'] font-extrabold text-[#121c2a] text-sm group-hover:text-[#006b5f] transition-colors">
              Hyve Portal
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {unitCode && (
              <span className="font-['Inter'] text-xs font-bold bg-[#eff4ff] text-[#006b5f] px-2.5 py-1 rounded-lg">
                {unitCode}
              </span>
            )}
            <span className="font-['Manrope'] text-xs text-[#6c7a77] hidden sm:block">
              {propertyName}
            </span>
          </div>
        </div>
        {/* Progress bar */}
        {currentStep !== "ACTIVE" && (
          <div className="h-0.5 bg-[#eff4ff]">
            <div
              className="h-full bg-[#006b5f] transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}
      </header>

      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-10">
          {/* Page heading */}
          <div className="mb-10">
            {profile?.full_name && (
              <p className="font-['Manrope'] text-[#006b5f] font-semibold text-sm mb-1">
                Welcome, {profile.full_name.split(" ")[0]}
              </p>
            )}
            <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a] tracking-tight">
              Welcome to Hyve
            </h1>
            <p className="font-['Manrope'] text-[#6c7a77] font-medium mt-1">
              {roomName} &mdash; {propertyName}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Timeline sidebar */}
            <aside className="lg:col-span-1">
              <div className="bg-white border border-[#bbcac6]/15 rounded-2xl p-5 shadow-sm">
                <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-5">
                  Progress
                </p>
                <div className="space-y-1">
                  {STEP_ORDER.filter((s) => s !== "ACTIVE").map((step, idx) => {
                    const stepIdx = STEP_ORDER.indexOf(step);
                    const isCurrent = step === currentStep;
                    const isCompleted = stepIdx < currentStepIndex;
                    const isPending = stepIdx > currentStepIndex;

                    return (
                      <div
                        key={step}
                        className={`flex items-start gap-3 py-2 rounded-lg px-1 transition-colors ${
                          isCompleted && !isCurrent ? "cursor-pointer hover:bg-[#eff4ff]" : ""
                        }`}
                        onClick={isCompleted && !isCurrent ? () => goToStep(step) : undefined}
                      >
                        <div className="relative flex flex-col items-center">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                              isCompleted
                                ? "bg-[#006b5f]"
                                : isCurrent
                                ? "bg-[#006b5f]/10 border-2 border-[#006b5f]"
                                : "bg-[#eff4ff] border border-[#bbcac6]/30"
                            }`}
                          >
                            {isCompleted ? (
                              <span
                                className="material-symbols-outlined text-white text-[14px]"
                                style={{ fontVariationSettings: "'FILL' 1" }}
                              >
                                check
                              </span>
                            ) : (
                              <span
                                className={`material-symbols-outlined text-[14px] ${
                                  isCurrent ? "text-[#006b5f]" : "text-[#bbcac6]"
                                }`}
                                style={
                                  isCurrent
                                    ? { fontVariationSettings: "'FILL' 1" }
                                    : undefined
                                }
                              >
                                {STEP_ICONS[step] || "circle"}
                              </span>
                            )}
                          </div>
                          {idx < STEP_ORDER.filter((s) => s !== "ACTIVE").length - 1 && (
                            <div
                              className={`w-0.5 h-4 mt-1 ${
                                isCompleted ? "bg-[#006b5f]" : "bg-[#eff4ff]"
                              }`}
                            />
                          )}
                        </div>
                        <div className="pt-0.5">
                          <p
                            className={`font-['Manrope'] text-xs font-semibold ${
                              isCurrent
                                ? "text-[#121c2a]"
                                : isCompleted
                                ? "text-[#006b5f]"
                                : "text-[#bbcac6]"
                            }`}
                          >
                            {STEP_LABELS[step] ?? step}
                          </p>
                          {isCurrent && (
                            <span className="font-['Inter'] text-[10px] font-bold uppercase tracking-widest text-[#006b5f]">
                              Current
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Overall progress */}
                {currentStep !== "ACTIVE" && (
                  <div className="mt-6 pt-5 border-t border-[#bbcac6]/10">
                    <div className="flex justify-between mb-2">
                      <span className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">
                        Overall
                      </span>
                      <span className="font-['Inter'] text-[10px] font-bold text-[#006b5f]">
                        {progressPct}%
                      </span>
                    </div>
                    <div className="h-1 bg-[#eff4ff] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#006b5f] rounded-full transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </aside>

            {/* Main step content */}
            <div className="lg:col-span-3">
              <div className="bg-white border border-[#bbcac6]/15 rounded-2xl p-8 shadow-sm">
                {currentStep !== "ACTIVE" && (
                  <div className="mb-8 pb-8 border-b border-[#bbcac6]/10">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-[#006b5f]/10 flex items-center justify-center">
                        <span
                          className="material-symbols-outlined text-[#006b5f] text-[20px]"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          {STEP_ICONS[currentStep] || "circle"}
                        </span>
                      </div>
                      <div>
                        <h2 className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-[#121c2a]">
                          {STEP_LABELS[currentStep] ?? currentStep}
                        </h2>
                        {STEP_DESCRIPTIONS[currentStep] && (
                          <p className="font-['Manrope'] text-sm text-[#555f6f] mt-0.5">
                            {STEP_DESCRIPTIONS[currentStep]}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <StepContent
                  currentStep={currentStep}
                  onboarding={onboarding}
                  advanceStep={advanceStep}
                  updateOnboarding={updateOnboarding}
                  refetch={refetch}
                  profile={profile}
                />

                {/* Back / Forward navigation */}
                {currentStep !== "ACTIVE" && (
                  <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#bbcac6]/20">
                    {canGoBack ? (
                      <button
                        onClick={goBack}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#bbcac6]/30 text-[#555f6f] font-['Manrope'] font-medium text-sm hover:bg-[#eff4ff] transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                        Back
                      </button>
                    ) : (
                      <div />
                    )}
                    <p className="text-[10px] font-['Inter'] text-[#bbcac6] uppercase tracking-widest">
                      Step {STEP_ORDER.indexOf(currentStep) + 1} of {STEP_ORDER.length - 1}
                    </p>
                  </div>
                )}
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
