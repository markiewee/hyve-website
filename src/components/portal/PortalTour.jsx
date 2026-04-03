import { useState, useEffect, useCallback } from "react";

const TOUR_STEPS = [
  {
    title: "Welcome to Hyve Portal!",
    text: "Let us show you around. This quick tour will help you get familiar with everything.",
    icon: "waving_hand",
    position: "center",
  },
  {
    title: "Dashboard",
    text: "Your home base. See your AC usage, rent status, announcements, and quick stats all in one place.",
    icon: "dashboard",
    highlight: "[href='/portal/dashboard']",
    position: "right",
  },
  {
    title: "Documents",
    text: "View your tenancy agreement, upload stamping certificates, receipts, and other important documents.",
    icon: "folder_open",
    highlight: "[href='/portal/documents']",
    position: "right",
  },
  {
    title: "Billing & Payments",
    text: "Track your rent payments, see outstanding balances, and view payment history. Rent is due on the 1st of each month.",
    icon: "payments",
    highlight: "[href='/portal/billing']",
    position: "right",
  },
  {
    title: "Report Issues",
    text: "Something broken? Report maintenance issues here. We'll try to help you fix it first with our self-diagnostic tool.",
    icon: "build",
    highlight: "[href='/portal/issues']",
    position: "right",
  },
  {
    title: "Settings",
    text: "Update your personal details, change your password, or set up your email address.",
    icon: "settings",
    highlight: "[href='/portal/settings']",
    position: "right",
  },
  {
    title: "Need Help?",
    text: "WhatsApp us anytime at +65 8088 5410 or email hello@lazybee.sg. We typically respond within an hour. Enjoy your stay!",
    icon: "support_agent",
    position: "center",
  },
];

export default function PortalTour({ onComplete }) {
  const [step, setStep] = useState(0);
  const [highlightRect, setHighlightRect] = useState(null);

  const currentStep = TOUR_STEPS[step];

  const updateHighlight = useCallback(() => {
    if (!currentStep?.highlight) {
      setHighlightRect(null);
      return;
    }
    const el = document.querySelector(currentStep.highlight);
    if (el) {
      const rect = el.getBoundingClientRect();
      setHighlightRect({
        top: rect.top - 4,
        left: rect.left - 4,
        width: rect.width + 8,
        height: rect.height + 8,
      });
    } else {
      setHighlightRect(null);
    }
  }, [currentStep]);

  useEffect(() => {
    updateHighlight();
    window.addEventListener("resize", updateHighlight);
    return () => window.removeEventListener("resize", updateHighlight);
  }, [updateHighlight]);

  function handleNext() {
    if (step < TOUR_STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      localStorage.setItem("hyve_tour_done", "1");
      onComplete();
    }
  }

  function handleSkip() {
    localStorage.setItem("hyve_tour_done", "1");
    onComplete();
  }

  const isCenter = currentStep.position === "center" || !highlightRect;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 transition-opacity" onClick={handleSkip} />

      {/* Highlight cutout */}
      {highlightRect && (
        <div
          className="absolute border-2 border-[#71f8e4] rounded-lg z-[101] pointer-events-none transition-all duration-300"
          style={{
            top: highlightRect.top,
            left: highlightRect.left,
            width: highlightRect.width,
            height: highlightRect.height,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.5), 0 0 20px rgba(113,248,228,0.4)",
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className={`absolute z-[102] transition-all duration-300 ${
          isCenter
            ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            : ""
        }`}
        style={
          !isCenter && highlightRect
            ? {
                top: highlightRect.top,
                left: highlightRect.left + highlightRect.width + 16,
              }
            : undefined
        }
      >
        <div className="bg-white rounded-2xl shadow-2xl p-6 w-[340px] max-w-[90vw]">
          {/* Step indicator */}
          <div className="flex items-center gap-1.5 mb-4">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= step ? "bg-[#006b5f]" : "bg-[#eff4ff]"
                }`}
              />
            ))}
          </div>

          {/* Icon + Content */}
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#006b5f]/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[#006b5f] text-[22px]">
                {currentStep.icon}
              </span>
            </div>
            <div>
              <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] text-base">
                {currentStep.title}
              </h3>
              <p className="font-['Manrope'] text-sm text-[#555f6f] mt-1 leading-relaxed">
                {currentStep.text}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleSkip}
              className="text-xs font-['Manrope'] text-[#6c7a77] hover:text-[#121c2a] transition-colors"
            >
              Skip tour
            </button>
            <button
              onClick={handleNext}
              className="px-5 py-2 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#006a61] transition-colors flex items-center gap-1.5"
            >
              {step < TOUR_STEPS.length - 1 ? (
                <>
                  Next
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </>
              ) : (
                <>
                  Get Started
                  <span className="material-symbols-outlined text-[16px]">check</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
