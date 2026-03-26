import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "../ui/button";

const INSTRUCTIONS = [
  {
    icon: "key",
    title: "Key Collection",
    text: "Collect your keys from the property manager on your move-in date. Bring your IC/passport for verification.",
  },
  {
    icon: "door_front",
    title: "Access & Entry",
    text: "Your room key and main door access will be provided. Digital lock codes (if applicable) will be set up during key collection.",
  },
  {
    icon: "wifi",
    title: "WiFi",
    text: "WiFi password is on the sticker on the router in the common area. Connect to the network named 'Hyve-[Property]'.",
  },
  {
    icon: "local_laundry_service",
    title: "Laundry",
    text: "Washing machine is in the common area. Please use it between 8am–10pm. Detergent is not provided.",
  },
  {
    icon: "cleaning_services",
    title: "Cleaning Schedule",
    text: "Common areas are cleaned weekly. Keep shared spaces tidy after use. Cleaning supplies are under the kitchen sink.",
  },
  {
    icon: "delete",
    title: "Waste & Recycling",
    text: "Dispose of rubbish in the bins at the designated area. Separate recyclables where possible.",
  },
  {
    icon: "ac_unit",
    title: "Air Conditioning",
    text: "Your AC usage is tracked. The first 300 hours/month are included in rent. Additional usage is charged at S$0.30/hour.",
  },
  {
    icon: "payments",
    title: "Rent Payment",
    text: "Rent is due on the 1st of each month via bank transfer. Details are in your Billing page. Late fees apply after the 5th.",
  },
  {
    icon: "build",
    title: "Maintenance Issues",
    text: "Report any issues via the portal (Issues page). For emergencies, WhatsApp us at +65 8088 5410.",
  },
  {
    icon: "groups",
    title: "Community",
    text: "Be respectful of your housemates. Quiet hours are 10pm–8am. Guests are welcome but overnight stays need prior notice.",
  },
];

export default function MoveInInstructions({ advanceStep }) {
  const { profile } = useAuth();
  const [acknowledged, setAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);

  const propertyName = profile?.properties?.name || profile?.rooms?.name || "your property";

  async function handleContinue() {
    setSaving(true);
    await advanceStep(null);
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-foreground mb-1">
          Welcome to {propertyName}
        </h3>
        <p className="text-sm text-muted-foreground">
          Here's everything you need to know for a smooth move-in. Please read through before continuing.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {INSTRUCTIONS.map((item) => (
          <div
            key={item.title}
            className="flex items-start gap-3 p-4 rounded-lg border border-border bg-[#f8faf9] hover:bg-[#eff4ff] transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-[#006b5f]/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[#006b5f] text-[18px]">{item.icon}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{item.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.text}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#006b5f]/5 border border-[#006b5f]/15 rounded-lg p-4">
        <p className="text-sm text-[#006b5f] font-semibold mb-1">Need help?</p>
        <p className="text-xs text-[#006b5f]/80">
          WhatsApp us anytime at <strong>+65 8088 5410</strong> or email <strong>hello@hyve.sg</strong>.
          We typically respond within an hour.
        </p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-1 rounded border-border"
        />
        <span className="text-sm text-foreground">
          I've read the move-in instructions and understand the house guidelines.
        </span>
      </label>

      <div className="flex items-center gap-3">
        <Button
          onClick={handleContinue}
          disabled={!acknowledged || saving}
        >
          {saving ? "Saving…" : "Continue to Room Checklist"}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            const w = window.open("", "_blank");
            w.document.write(`<!DOCTYPE html><html><head><title>Move-in Instructions — Hyve</title><style>body{font-family:Arial,sans-serif;max-width:700px;margin:40px auto;padding:20px}h1{color:#006b5f;margin-bottom:20px}h3{margin:16px 0 4px}p{margin:4px 0;font-size:14px;line-height:1.6;color:#555}@media print{body{margin:20px}}</style></head><body><h1>Move-in Instructions</h1>${INSTRUCTIONS.map(i => `<h3>${i.title}</h3><p>${i.text}</p>`).join("")}</body></html>`);
            w.document.close();
            w.print();
          }}
        >
          <span className="material-symbols-outlined text-[16px] mr-1">print</span>
          Print
        </Button>
      </div>
    </div>
  );
}
