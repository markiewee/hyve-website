import { STEPS, STEP_LABELS } from "../../hooks/useOnboarding";

const COMPLETION_FIELDS = {
  PERSONAL_DETAILS: "personal_details_completed_at",
  ID_VERIFICATION: "id_verification_completed_at",
  SIGN_TA: "ta_signed_at",
  DEPOSIT: "deposit_paid_at",
  HOUSE_RULES: "house_rules_acknowledged_at",
  MOVE_IN_CHECKLIST: "checklist_completed_at",
  ACTIVE: null,
};

// Only show steps up to ACTIVE in the timeline (not END_OF_TENANCY)
const VISIBLE_STEPS = STEPS.filter((s) => s !== "END_OF_TENANCY");

function formatDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
  });
}

export default function OnboardingTimeline({ currentStep, onboarding, onStepClick }) {
  const currentIndex = VISIBLE_STEPS.indexOf(currentStep);

  return (
    <div className="relative">
      {/* Vertical connector line */}
      <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-border" />

      <ol className="space-y-0">
        {VISIBLE_STEPS.map((step, index) => {
          const completionField = COMPLETION_FIELDS[step];
          const isDone =
            completionField && onboarding?.[completionField]
              ? true
              : index < currentIndex;
          const isCurrent = step === currentStep;
          const isFuture = index > currentIndex;

          let dotClass =
            "relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 ";
          let labelClass = "text-sm font-medium ";
          let dateClass = "text-xs mt-0.5 ";

          if (isDone) {
            dotClass += "bg-green-500 border-green-500";
            labelClass += "text-foreground";
            dateClass += "text-muted-foreground";
          } else if (isCurrent) {
            dotClass += "bg-blue-500 border-blue-500 animate-pulse";
            labelClass += "text-foreground font-semibold";
            dateClass += "text-blue-600";
          } else {
            dotClass += "bg-background border-border";
            labelClass += "text-muted-foreground";
            dateClass += "text-muted-foreground";
          }

          const completedAt =
            completionField && onboarding?.[completionField]
              ? formatDate(onboarding[completionField])
              : null;

          const canClick = isDone && onStepClick && !isCurrent;

          return (
            <li
              key={step}
              className={`flex items-start gap-3 pb-6 last:pb-0 ${canClick ? "cursor-pointer hover:bg-[#eff4ff] rounded-lg -mx-2 px-2 py-1 transition-colors" : ""}`}
              onClick={canClick ? () => onStepClick(step) : undefined}
            >
              <div className={dotClass}>
                {isDone ? (
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : isCurrent ? (
                  <div className="w-3 h-3 bg-white rounded-full" />
                ) : (
                  <div className="w-3 h-3 bg-border rounded-full" />
                )}
              </div>
              <div className="pt-1">
                <p className={labelClass}>{STEP_LABELS[step]}</p>
                {completedAt && <p className={dateClass}>{completedAt}</p>}
                {isCurrent && !completedAt && (
                  <p className="text-xs text-blue-600 mt-0.5">In progress</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
