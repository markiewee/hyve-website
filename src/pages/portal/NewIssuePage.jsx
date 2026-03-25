import { useState } from "react";
import PortalLayout from "../../components/portal/PortalLayout";
import TicketForm from "../../components/portal/TicketForm";

const DIAGNOSTICS = {
  AC: {
    icon: "ac_unit",
    title: "AC Not Working",
    steps: [
      { text: "Check if the AC remote has batteries and is pointed at the unit.", action: "Replace batteries if needed." },
      { text: "Check if the AC circuit breaker (in the electrical panel near the door) is switched ON.", action: "Flip the breaker off, wait 10 seconds, then flip it back on." },
      { text: "Make sure the AC mode is set to COOL (not FAN or DRY) and temperature is below 25°C.", action: "Set to COOL mode, 23°C." },
      { text: "Check if the AC filter is dirty or blocked.", action: "Slide out the filter panel and rinse under water. Let dry before reinserting." },
    ],
  },
  PLUMBING: {
    icon: "water_drop",
    title: "Water / Plumbing Issue",
    steps: [
      { text: "If no hot water: check if the water heater switch (usually in the bathroom) is turned ON.", action: "Switch it on and wait 10-15 minutes." },
      { text: "If low water pressure: check if other taps in the unit also have low pressure.", action: "If all taps are affected, it may be a building-wide issue — check with neighbours." },
      { text: "If toilet is running: lift the toilet tank lid and check if the flapper valve is seated properly.", action: "Press the flapper down firmly. If it keeps running, jiggle the flush handle." },
      { text: "For minor sink clogs: pour boiling water down the drain and wait 5 minutes.", action: "Repeat 2-3 times. Avoid chemical drain cleaners." },
    ],
  },
  ELECTRICAL: {
    icon: "bolt",
    title: "Electrical Issue",
    steps: [
      { text: "If a specific outlet isn't working: check if the switch next to it is turned ON.", action: "Toggle the switch. Try plugging in a different device to test." },
      { text: "If a room has no power: check the circuit breaker panel — a tripped breaker will be in the middle position.", action: "Flip it fully OFF, then back ON." },
      { text: "If lights are flickering: try tightening the bulb or replacing it.", action: "Turn off the switch first, then twist the bulb to ensure it's secure." },
    ],
  },
  FURNITURE: {
    icon: "chair",
    title: "Furniture Issue",
    steps: [
      { text: "If a drawer or cabinet door is stuck: check for items blocking it from inside.", action: "Remove obstructions and try again." },
      { text: "If a chair is wobbly: check if all screws are tightened.", action: "Use a screwdriver or Allen key (check your welcome kit) to tighten." },
    ],
  },
  CLEANING: {
    icon: "cleaning_services",
    title: "Cleaning Request",
    steps: [
      { text: "Regular cleaning is scheduled weekly for common areas.", action: "Check the cleaning schedule posted in the kitchen." },
      { text: "For spills or urgent cleaning: wipe up immediately with paper towels and cleaning spray (under the kitchen sink).", action: "For stubborn stains, use the provided cleaning supplies." },
    ],
  },
  OTHER: {
    icon: "help",
    title: "Other Issue",
    steps: [
      { text: "For WiFi issues: restart the router by unplugging it, wait 30 seconds, then plug it back in.", action: "WiFi password is on the sticker on the router." },
      { text: "For noise complaints: try speaking with your housemate directly first.", action: "If unresolved, submit a ticket and management will mediate." },
      { text: "For key/lock issues: do NOT try to force the door.", action: "Contact management via WhatsApp immediately: +65 8088 5410." },
    ],
  },
};

export default function NewIssuePage() {
  const [phase, setPhase] = useState("select"); // select | diagnose | report
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [resolved, setResolved] = useState(false);

  const diagnostic = selectedCategory ? DIAGNOSTICS[selectedCategory] : null;

  function handleSelectCategory(cat) {
    setSelectedCategory(cat);
    setCurrentStep(0);
    setResolved(false);
    setPhase("diagnose");
  }

  function handleNextStep() {
    if (currentStep < diagnostic.steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      // All steps exhausted — proceed to report
      setPhase("report");
    }
  }

  return (
    <PortalLayout>
      <div className="mb-10">
        <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a] tracking-tight">
          {phase === "report" ? "Report an Issue" : "Need Help?"}
        </h1>
        <p className="text-[#6c7a77] font-['Manrope'] font-medium mt-1">
          {phase === "select" && "Let's try to fix it first. Select what's wrong."}
          {phase === "diagnose" && "Try these steps before submitting a ticket."}
          {phase === "report" && "The self-help steps didn't resolve it — let us know the details."}
        </p>
      </div>

      <div className="max-w-2xl">
        {/* Phase 1: Select Category */}
        {phase === "select" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {Object.entries(DIAGNOSTICS).map(([key, diag]) => (
              <button
                key={key}
                onClick={() => handleSelectCategory(key)}
                className="bg-white rounded-xl p-6 border border-[#bbcac6]/15 shadow-sm hover:border-[#006b5f]/40 hover:shadow-md transition-all text-center group"
              >
                <span className="material-symbols-outlined text-[32px] text-[#006b5f] mb-3 block group-hover:scale-110 transition-transform">
                  {diag.icon}
                </span>
                <p className="font-['Manrope'] font-bold text-sm text-[#121c2a]">{diag.title}</p>
              </button>
            ))}
          </div>
        )}

        {/* Phase 2: Diagnostic Steps */}
        {phase === "diagnose" && diagnostic && (
          <div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="bg-[#006b5f]/5 px-6 py-4 border-b border-[#bbcac6]/15 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#006b5f] text-[24px]">{diagnostic.icon}</span>
                <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a]">{diagnostic.title}</h2>
              </div>
              <span className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">
                Step {currentStep + 1} of {diagnostic.steps.length}
              </span>
            </div>

            <div className="p-6 space-y-5">
              {/* Progress dots */}
              <div className="flex gap-1.5">
                {diagnostic.steps.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      i <= currentStep ? "bg-[#006b5f]" : "bg-[#eff4ff]"
                    }`}
                  />
                ))}
              </div>

              {/* Current step */}
              <div className="bg-[#f8f9ff] rounded-xl p-5">
                <p className="font-['Manrope'] text-sm text-[#121c2a] font-semibold mb-2">
                  {diagnostic.steps[currentStep].text}
                </p>
                <div className="flex items-start gap-2 mt-3 bg-[#006b5f]/5 rounded-lg p-3">
                  <span className="material-symbols-outlined text-[#006b5f] text-[18px] shrink-0 mt-0.5">lightbulb</span>
                  <p className="font-['Manrope'] text-xs text-[#006b5f]">
                    {diagnostic.steps[currentStep].action}
                  </p>
                </div>
              </div>

              {/* Resolved? */}
              {resolved ? (
                <div className="bg-[#d1fae5] rounded-xl p-5 text-center">
                  <span className="material-symbols-outlined text-[#065f46] text-[32px] mb-2 block" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <p className="font-['Manrope'] font-bold text-sm text-[#065f46]">Great, glad that worked!</p>
                  <button
                    onClick={() => { setPhase("select"); setSelectedCategory(null); setResolved(false); }}
                    className="mt-3 text-xs font-['Manrope'] font-bold text-[#006b5f] hover:underline"
                  >
                    Back to home
                  </button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={() => setResolved(true)}
                    className="flex-1 py-3 bg-[#d1fae5] text-[#065f46] rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#bbf7d0] transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">check</span>
                    Fixed!
                  </button>
                  <button
                    onClick={handleNextStep}
                    className="flex-1 py-3 bg-[#eff4ff] text-[#555f6f] rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#e6eeff] transition-colors flex items-center justify-center gap-2"
                  >
                    {currentStep < diagnostic.steps.length - 1 ? (
                      <>
                        Still broken
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">support_agent</span>
                        Submit a ticket
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Skip to report */}
              {!resolved && (
                <button
                  onClick={() => setPhase("report")}
                  className="w-full text-center text-xs font-['Manrope'] text-[#6c7a77] hover:text-[#006b5f] hover:underline"
                >
                  Skip self-help — I need to report this now
                </button>
              )}
            </div>
          </div>
        )}

        {/* Phase 3: Report Form */}
        {phase === "report" && (
          <div>
            <button
              onClick={() => { setPhase("select"); setSelectedCategory(null); }}
              className="mb-4 inline-flex items-center gap-1 text-sm font-['Manrope'] font-bold text-[#006b5f] hover:underline"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Back to self-help
            </button>
            <div className="bg-white rounded-2xl p-8 border border-[#bbcac6]/15 shadow-sm">
              <TicketForm preselectedCategory={selectedCategory} />
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
