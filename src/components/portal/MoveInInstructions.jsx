import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { usePropertyGuides } from "../../hooks/usePropertyGuides";

export default function MoveInInstructions({ advanceStep }) {
  const { profile } = useAuth();
  const propertyId = profile?.rooms?.property_id ?? null;
  const { getSection, loading } = usePropertyGuides(propertyId);

  const [copied, setCopied] = useState(false);

  const propertyName = profile?.properties?.name ?? "Lazybee";
  const unitCode = profile?.rooms?.unit_code ?? "";

  // Parse WiFi data
  const wifiSection = getSection("wifi");
  let wifiNetwork = "";
  let wifiPassword = "";
  if (wifiSection?.content) {
    try {
      const parsed = JSON.parse(wifiSection.content);
      wifiNetwork = parsed.network ?? parsed.ssid ?? "";
      wifiPassword = parsed.password ?? "";
    } catch {
      wifiNetwork = wifiSection.content;
    }
  }

  // Parse what's provided
  const providedSection = getSection("welcome_provided");
  let providedItems = null;
  if (providedSection?.content) {
    try {
      providedItems = JSON.parse(providedSection.content);
    } catch {
      // not JSON, won't render structured grid
    }
  }

  // Parse access codes, only reveal on/after tenancy start date (Singapore time)
  const accessSection = getSection("access_codes");
  let mainDoorCode = "";
  let roomCode = "";
  if (accessSection?.content) {
    try {
      const parsed = JSON.parse(accessSection.content);
      mainDoorCode = parsed.main_door ?? "";
      roomCode = parsed.rooms?.[unitCode] ?? "";
    } catch {
      // not JSON, keep both blank
    }
  }

  const rawOnboarding = profile?.onboarding_progress;
  const onboardingRecord = Array.isArray(rawOnboarding) ? rawOnboarding[0] : rawOnboarding;
  const tenancyStartDate = onboardingRecord?.tenancy_start_date ?? null;
  const todaySg = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
  const codesUnlocked = Boolean(tenancyStartDate) && todaySg >= tenancyStartDate;

  function handleCopy() {
    if (!wifiPassword) return;
    navigator.clipboard.writeText(wifiPassword).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-4 bg-surface-container animate-pulse rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Check-in Highlight */}
      <section className="bg-accent/10 rounded-2xl p-6 border border-accent/25">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-accent mb-2">
              Arrival Instruction
            </p>
            <h2 className="font-display text-2xl font-extrabold text-accent">
              Check-in from 10:00 AM
            </h2>
            <p className="text-sm text-foreground mt-1">
              Your move-in date will be confirmed by your house captain
              {unitCode ? ` • ${unitCode}` : ""}
            </p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-1 shrink-0">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-accent">
              Moving Hours
            </p>
            <div className="flex items-center gap-2 text-accent">
              <span className="material-symbols-outlined text-[20px]">schedule</span>
              <span className="font-bold text-sm font-['Inter']">10:00 AM, 5:00 PM</span>
            </div>
          </div>
        </div>
      </section>

      {/* WiFi & What's Provided */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* WiFi Card */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-accent">wifi</span>
            <h3 className="font-display font-bold text-base text-foreground">
              High-Speed WiFi
            </h3>
          </div>
          <div className="bg-surface-container rounded-2xl p-5 border border-border space-y-4">
            {wifiNetwork ? (
              <>
                <div>
                  <p className="text-[10px] uppercase font-bold text-foreground-variant tracking-widest mb-1">
                    Network Name
                  </p>
                  <p className="font-mono font-bold text-lg text-foreground">{wifiNetwork}</p>
                </div>
                {wifiPassword && (
                  <div className="pt-3 border-t border-white/10">
                    <p className="text-[10px] uppercase font-bold text-foreground-variant tracking-widest mb-1">
                      Password
                    </p>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono font-bold text-lg text-foreground break-all">
                        {wifiPassword}
                      </p>
                      <button
                        type="button"
                        onClick={handleCopy}
                        title="Copy password"
                        className="shrink-0 text-foreground-variant hover:text-accent transition-colors"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {copied ? "check" : "content_copy"}
                        </span>
                      </button>
                    </div>
                    {copied && (
                      <p className="text-[10px] text-accent font-semibold mt-1">Copied!</p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-foreground-variant font-['Inter']">
                WiFi details will be shared by your house captain before move-in.
              </p>
            )}
          </div>
        </div>

        {/* What's Provided Card */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-accent">inventory_2</span>
            <h3 className="font-display font-bold text-base text-foreground">
              What's Provided
            </h3>
          </div>
          <div className="bg-surface-container rounded-2xl p-5 border border-border">
            {providedItems && typeof providedItems === "object" && !Array.isArray(providedItems) ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                {Object.entries(providedItems).map(([category, items], idx) => (
                  <div
                    key={category}
                    className={idx >= 2 ? "pt-2 border-t border-white/10" : ""}
                  >
                    <p className="text-[9px] uppercase font-bold text-accent tracking-widest mb-1">
                      {category}
                    </p>
                    <p className="text-[11px] text-foreground leading-relaxed">
                      {Array.isArray(items) ? items.join(", ") : items}
                    </p>
                  </div>
                ))}
              </div>
            ) : providedItems && Array.isArray(providedItems) ? (
              <ul className="space-y-1">
                {providedItems.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm text-foreground">
                    <span
                      className="material-symbols-outlined text-accent text-[16px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              /* Default fallback grid matching Stitch template */
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <div>
                  <p className="text-[9px] uppercase font-bold text-accent tracking-widest mb-1">Room</p>
                  <p className="text-[11px] text-foreground leading-relaxed">Bed, Mattress,<br />Wardrobe, Desk</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase font-bold text-accent tracking-widest mb-1">Kitchen</p>
                  <p className="text-[11px] text-foreground leading-relaxed">Fridge, Stove,<br />Microwave</p>
                </div>
                <div className="pt-2 border-t border-white/10">
                  <p className="text-[9px] uppercase font-bold text-accent tracking-widest mb-1">Laundry</p>
                  <p className="text-[11px] text-foreground leading-relaxed">Washing Machine</p>
                </div>
                <div className="pt-2 border-t border-white/10">
                  <p className="text-[9px] uppercase font-bold text-accent tracking-widest mb-1">Common</p>
                  <p className="text-[11px] text-foreground leading-relaxed">WiFi, Vacuum Cleaner</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Unit Access Codes */}
      <section>
        <h3 className="font-display font-bold text-base text-foreground mb-4">
          Unit Access Codes
        </h3>
        {codesUnlocked && (mainDoorCode || roomCode) ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mainDoorCode && (
              <div className="p-5 bg-surface-container rounded-2xl border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-accent text-[18px]">door_front</span>
                  <p className="text-[10px] uppercase font-bold text-foreground-variant tracking-widest">
                    Main Door
                  </p>
                </div>
                <p className="font-mono font-bold text-xl text-foreground">{mainDoorCode}</p>
              </div>
            )}
            {roomCode && (
              <div className="p-5 bg-surface-container rounded-2xl border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-accent text-[18px]">meeting_room</span>
                  <p className="text-[10px] uppercase font-bold text-foreground-variant tracking-widest">
                    Your Room {unitCode ? `(${unitCode})` : ""}
                  </p>
                </div>
                <p className="font-mono font-bold text-xl text-foreground">{roomCode}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-5 bg-surface-container rounded-2xl border border-border flex items-start gap-3">
            <span className="material-symbols-outlined text-foreground-variant text-[20px] mt-0.5">lock</span>
            <p className="text-sm text-foreground font-['Inter'] leading-relaxed">
              Your door codes will appear here on your move-in day
              {tenancyStartDate ? ` (${tenancyStartDate})` : ""}.
            </p>
          </div>
        )}
      </section>

      {/* Need Help? */}
      <section className="pt-8 border-t border-border">
        <div className="flex items-center gap-2 mb-6">
          <span className="material-symbols-outlined text-accent">contact_support</span>
          <h3 className="font-display font-bold text-base text-foreground">
            Need Help?
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start gap-4 p-4 bg-surface border border-border rounded-xl">
            <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-xs font-bold shrink-0 font-['Inter'] text-foreground">
              1
            </div>
            <div>
              <p className="font-bold text-xs mb-1 font-display text-foreground">
                Resident Portal
              </p>
              <p className="text-[10px] text-foreground-variant leading-tight font-['Inter']">
                Visit the Help section in your dashboard.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 bg-surface border border-border rounded-xl">
            <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-xs font-bold shrink-0 font-['Inter'] text-foreground">
              2
            </div>
            <div>
              <p className="font-bold text-xs mb-1 font-display text-foreground">
                Self-Help Guides
              </p>
              <p className="text-[10px] text-foreground-variant leading-tight font-['Inter']">
                Browse common solutions and FAQs.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 bg-surface border border-border rounded-xl">
            <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-xs font-bold shrink-0 font-['Inter'] text-foreground">
              3
            </div>
            <div>
              <p className="font-bold text-xs mb-1 font-display text-foreground">
                File a Ticket
              </p>
              <p className="text-[10px] text-foreground-variant leading-tight font-['Inter']">
                Contact support for unresolved issues.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <div className="pt-4 border-t border-border text-center">
        <p className="text-xs text-foreground-variant font-medium font-['Inter']">
          Welcome to {propertyName} • Managed by Lazybee
        </p>
      </div>

      {/* Continue Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => advanceStep(null)}
          className="inline-flex items-center gap-2 bg-accent text-white rounded-full px-7 py-3 font-display font-bold text-sm hover:opacity-90 transition-colors"
        >
          Continue
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}
