import { useState } from "react";
import { Link } from "react-router-dom";
import PortalLayout from "../../components/portal/PortalLayout";
import TicketForm from "../../components/portal/TicketForm";

const DIAGNOSTICS = {
  AC: {
    icon: "ac_unit",
    title: "AC Not Working",
    steps: [
      { text: "Check if the AC remote has batteries and is pointed at the unit.", action: "Replace batteries if needed. Point remote directly at the AC indoor unit." },
      { text: "Check if the AC circuit breaker (in the electrical panel near the door) is switched ON.", action: "Flip the breaker fully OFF, wait 10 seconds, then flip it back ON." },
      { text: "Make sure the AC mode is set to COOL (not FAN or DRY) and temperature is below 25°C.", action: "Set to COOL mode, 23°C. Wait 3 minutes for compressor to start." },
      { text: "Check if the AC filter is dirty or blocked.", action: "Slide out the filter panel on the front of the indoor unit and rinse under running water. Let dry completely before reinserting." },
      { text: "Is the AC blowing warm air? The outdoor unit may be blocked or overheating.", action: "Check if anything is blocking the outdoor compressor unit (clothes, boxes). Clear the area around it." },
      { text: "Is there water dripping from the indoor unit?", action: "This usually means a blocked drain pipe. Place a towel underneath and submit a ticket — this needs a technician." },
      { text: "AC turns on but shuts off after a few minutes?", action: "This could be a refrigerant issue. Turn off the AC completely and submit a ticket." },
    ],
  },
  PLUMBING: {
    icon: "water_drop",
    title: "Water / Plumbing Issue",
    steps: [
      { text: "If no hot water: check if the water heater switch (usually in the bathroom) is turned ON.", action: "Switch it on and wait 10-15 minutes for the water to heat up." },
      { text: "If low water pressure: check if other taps in the unit also have low pressure.", action: "If all taps are affected, it may be a building-wide issue. Check with neighbours first." },
      { text: "If toilet is running: lift the toilet tank lid and check if the flapper valve is seated properly.", action: "Press the flapper down firmly. If it keeps running, jiggle the flush handle or adjust the float." },
      { text: "For minor sink clogs: pour boiling water down the drain and wait 5 minutes.", action: "Repeat 2-3 times. Avoid chemical drain cleaners as they damage pipes." },
      { text: "Shower head has weak flow? It might be clogged with mineral deposits.", action: "Unscrew the shower head, soak it in white vinegar for 30 minutes, then rinse and reattach." },
      { text: "Water stains on ceiling or walls?", action: "This could indicate a leak from upstairs. Take photos, place a bucket underneath, and submit a ticket immediately." },
    ],
  },
  ELECTRICAL: {
    icon: "bolt",
    title: "Electrical Issue",
    steps: [
      { text: "If a specific outlet isn't working: check if the switch next to it is turned ON.", action: "Toggle the switch. Try plugging in a different device to test if the outlet works." },
      { text: "If a room has no power: check the circuit breaker panel — a tripped breaker will be in the middle position.", action: "Flip it fully OFF, then back ON. If it trips again immediately, unplug all devices in that room and try again." },
      { text: "If lights are flickering: try tightening the bulb or replacing it.", action: "Turn off the switch first, then twist the bulb to ensure it's secure. Spare bulbs are in the utility cabinet." },
      { text: "Multiple rooms have no power?", action: "Check the main breaker (largest switch at the top of the panel). If the whole unit is out, check if neighbours are affected too." },
      { text: "Outlet sparks when plugging something in?", action: "STOP using that outlet immediately. This is a safety concern — submit a ticket right away." },
    ],
  },
  WIFI: {
    icon: "wifi",
    title: "WiFi / Internet",
    steps: [
      { text: "Can you see the WiFi network 'Hyve WiFi' in your device's WiFi list?", action: "If not visible, the router may need a restart. Find the router (usually in the living room) and check if it's powered on." },
      { text: "Restart the router: unplug the power cable, wait 30 seconds, then plug it back in.", action: "Wait 2-3 minutes for the router to fully restart. The lights should turn solid green." },
      { text: "Connected but no internet? Try forgetting the network and reconnecting.", action: "Go to WiFi settings → Forget 'Hyve WiFi' → Reconnect. Password: check the sticker on the router." },
      { text: "Slow speeds? Check how many devices are connected and try moving closer to the router.", action: "Walls and distance reduce signal. For best speed, stay within 2 rooms of the router." },
      { text: "Still not working? Try connecting to the 5GHz network if available (usually named 'Hyve WiFi_5G').", action: "5GHz is faster but shorter range. Use regular 'Hyve WiFi' (2.4GHz) if you're far from the router." },
    ],
  },
  LOCK: {
    icon: "lock",
    title: "Lock / Access Issue",
    steps: [
      { text: "Smart lock not responding? Check if the battery indicator is showing low.", action: "If the lock panel is blank, the batteries may be dead. Hold a 9V battery to the emergency contacts below the keypad to temporarily power it." },
      { text: "Passcode not working? Make sure you're entering the correct code followed by #.", action: "Try pressing the lock button first to wake it up, then enter your code + #." },
      { text: "Door won't lock when you close it? Check if the door is fully closed and aligned.", action: "Push the door firmly shut. If the bolt doesn't engage, the door may be misaligned — try lifting the handle while closing." },
      { text: "Locked yourself out?", action: "Do NOT try to force the door. Contact management via WhatsApp immediately: +65 8088 5410." },
    ],
  },
  APPLIANCE: {
    icon: "kitchen",
    title: "Appliance Issue",
    steps: [
      { text: "Washing machine not starting? Check if the door is fully closed and the power switch is ON.", action: "Push the door firmly until you hear a click. Check the outlet switch is turned on." },
      { text: "Washing machine vibrating excessively?", action: "Check if the load is balanced — redistribute clothes evenly. Make sure the machine is on a level surface." },
      { text: "Fridge not cooling? Check the temperature dial inside.", action: "Set to 3-4 (medium). Make sure the fridge isn't overpacked — air needs to circulate." },
      { text: "Microwave/oven not heating?", action: "Check the power switch and try a different outlet. If it turns on but doesn't heat, submit a ticket." },
      { text: "Induction stove not working?", action: "Induction only works with magnetic pots/pans. Try a different pan. Make sure the cooktop switch is on." },
    ],
  },
  PEST: {
    icon: "pest_control",
    title: "Pest Issue",
    steps: [
      { text: "Seeing ants? Check for exposed food or sugary spills.", action: "Clean the area thoroughly. Store food in sealed containers. Wipe down surfaces with vinegar solution." },
      { text: "Cockroaches spotted?", action: "Keep kitchen clean and dry. Don't leave dishes in the sink overnight. Check under the sink for leaks — roaches love moisture." },
      { text: "Mosquitoes inside? Check for stagnant water anywhere in the unit.", action: "Empty any standing water (plant saucers, containers). Keep windows closed or use the mesh screens." },
      { text: "Issue persists after cleaning?", action: "Submit a ticket. We do regular pest control servicing — we can arrange an ad-hoc treatment." },
    ],
  },
  FURNITURE: {
    icon: "chair",
    title: "Furniture Issue",
    steps: [
      { text: "If a drawer or cabinet door is stuck: check for items blocking it from inside.", action: "Remove obstructions and try again. For sliding drawers, check if the rail is off-track." },
      { text: "If a chair is wobbly: check if all screws are tightened.", action: "Use a screwdriver or Allen key (check your welcome kit) to tighten all visible screws." },
      { text: "Wardrobe door hinge loose?", action: "Tighten the hinge screws with a Phillips screwdriver. If the screw hole is stripped, submit a ticket." },
      { text: "Mattress sagging or uncomfortable?", action: "Try rotating the mattress 180°. If it's still uncomfortable, submit a ticket for a replacement assessment." },
    ],
  },
  CLEANING: {
    icon: "cleaning_services",
    title: "Cleaning Request",
    steps: [
      { text: "Regular cleaning is scheduled weekly for common areas.", action: "Check the cleaning schedule posted in the kitchen or on the noticeboard." },
      { text: "For spills or urgent cleaning: wipe up immediately with paper towels and cleaning spray (under the kitchen sink).", action: "For stubborn stains, use the provided cleaning supplies in the utility area." },
      { text: "Bins full? Take them out to the rubbish chute (usually at the end of the corridor).", action: "Separate recyclables. Replace the bin liner from the supply under the kitchen sink." },
    ],
  },
  OTHER: {
    icon: "help",
    title: "Other Issue",
    steps: [
      { text: "For noise complaints: try speaking with your housemate directly first.", action: "Quiet hours are 10 PM – 8 AM. If unresolved, submit a ticket and management will mediate." },
      { text: "Mail / parcel delivered to the wrong unit?", action: "Leave it at the door or hand it to the concierge. If you're missing a parcel, check with your neighbours." },
      { text: "Need extra supplies (toilet paper, cleaning products)?", action: "Check the utility cabinet first. If supplies are out, submit a ticket and we'll restock." },
      { text: "Smell coming from drains?", action: "Pour water down all drains (sinks, floor traps) to refill the water seal. This prevents sewer gas from entering." },
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Object.entries(DIAGNOSTICS).map(([key, diag]) => (
              <button
                key={key}
                onClick={() => handleSelectCategory(key)}
                className="bg-white rounded-xl p-5 border border-[#bbcac6]/15 shadow-sm hover:border-[#006b5f]/40 hover:shadow-md transition-all text-center group"
              >
                <span className="material-symbols-outlined text-[28px] text-[#006b5f] mb-2 block group-hover:scale-110 transition-transform">
                  {diag.icon}
                </span>
                <p className="font-['Manrope'] font-bold text-xs text-[#121c2a]">{diag.title}</p>
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
