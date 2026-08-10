import { useState } from "react";
import { usePropertyGuides } from "../../hooks/usePropertyGuides";

export default function AccessCodesCard({ profile }) {
  const propertyId = profile?.rooms?.property_id ?? null;
  const unitCode = profile?.rooms?.unit_code ?? "";
  const { getSection, loading } = usePropertyGuides(propertyId);
  const [copied, setCopied] = useState("");

  const accessSection = getSection("access_codes");
  let mainDoorCode = "";
  let roomCode = "";
  if (accessSection?.content) {
    try {
      const parsed = JSON.parse(accessSection.content);
      mainDoorCode = parsed.main_door ?? "";
      roomCode = parsed.rooms?.[unitCode] ?? "";
    } catch {
      // not JSON, keep blank
    }
  }

  const rawOnboarding = profile?.onboarding_progress;
  const onboardingRecord = Array.isArray(rawOnboarding) ? rawOnboarding[0] : rawOnboarding;
  const tenancyStartDate = onboardingRecord?.tenancy_start_date ?? null;
  const todaySg = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
  const codesUnlocked = Boolean(tenancyStartDate) && todaySg >= tenancyStartDate;

  if (loading) return null;
  if (!codesUnlocked) return null;
  if (!mainDoorCode && !roomCode) return null;

  function handleCopy(value, label) {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(""), 2000);
    });
  }

  return (
    <section className="md:col-span-12 bg-surface rounded-xl p-8 border border-border">
      <h3 className="font-display text-2xl mb-6 flex items-center gap-2 text-foreground">
        <span className="material-symbols-outlined text-accent text-[22px]">lock</span>
        Unit Access Codes
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mainDoorCode && (
          <button
            type="button"
            onClick={() => handleCopy(mainDoorCode, "main")}
            className="text-left p-5 bg-surface-container rounded-2xl border border-border hover:border-accent/40 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-accent text-[18px]">door_front</span>
                <p className="text-[10px] uppercase font-bold text-foreground-variant tracking-widest">Main Door</p>
              </div>
              <span className="material-symbols-outlined text-foreground-variant text-[18px]">
                {copied === "main" ? "check" : "content_copy"}
              </span>
            </div>
            <p className="font-mono font-bold text-2xl text-foreground">{mainDoorCode}</p>
            {copied === "main" && (
              <p className="text-[10px] text-accent font-semibold mt-1">Copied!</p>
            )}
          </button>
        )}
        {roomCode && (
          <button
            type="button"
            onClick={() => handleCopy(roomCode, "room")}
            className="text-left p-5 bg-surface-container rounded-2xl border border-border hover:border-accent/40 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-accent text-[18px]">meeting_room</span>
                <p className="text-[10px] uppercase font-bold text-foreground-variant tracking-widest">
                  Your Room {unitCode ? `(${unitCode})` : ""}
                </p>
              </div>
              <span className="material-symbols-outlined text-foreground-variant text-[18px]">
                {copied === "room" ? "check" : "content_copy"}
              </span>
            </div>
            <p className="font-mono font-bold text-2xl text-foreground">{roomCode}</p>
            {copied === "room" && (
              <p className="text-[10px] text-accent font-semibold mt-1">Copied!</p>
            )}
          </button>
        )}
      </div>
    </section>
  );
}
