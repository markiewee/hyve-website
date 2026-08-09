import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { usePropertyGuides } from "../../hooks/usePropertyGuides";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";

function WiFiCard({ guide }) {
  const [copied, setCopied] = useState(false);
  let network = "", password = "";
  try {
    const parsed = JSON.parse(guide.content);
    network = parsed.network;
    password = parsed.password;
  } catch {
    return null;
  }

  function copyPassword() {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-accent text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>wifi</span>
        </div>
        <div>
          <h3 className="font-mono text-[12px] uppercase tracking-[0.18em] text-foreground mb-3">WiFi</h3>
          <div className="space-y-2">
            <div>
              <span className="font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold">Network</span>
              <p className="font-['Inter'] text-sm font-semibold text-foreground">{network}</p>
            </div>
            <div>
              <span className="font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold">Password</span>
              <div className="flex items-center gap-2">
                <p className="font-['Inter'] text-sm font-semibold text-foreground font-mono">{password}</p>
                <button onClick={copyPassword} className="text-accent hover:text-accent">
                  <span className="material-symbols-outlined text-[16px]">{copied ? "check" : "content_copy"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FAQCard({ guide }) {
  const [openIndex, setOpenIndex] = useState(null);
  let faqs = [];
  try { faqs = JSON.parse(guide.content); } catch { return null; }

  return (
    <div className="bg-surface border border-border rounded-2xl p-6">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-accent text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>help</span>
        </div>
        <h3 className="font-mono text-[12px] uppercase tracking-[0.18em] text-foreground pt-2">FAQ</h3>
      </div>
      <div className="space-y-1 ml-14">
        {faqs.map((faq, idx) => (
          <div key={idx} className="border-b border-border last:border-0">
            <button
              onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
              className="w-full flex items-center justify-between py-3 text-left"
            >
              <span className="font-['Inter'] text-sm font-semibold text-foreground">{faq.question}</span>
              <span className="material-symbols-outlined text-[16px] text-foreground-variant transition-transform shrink-0 ml-2" style={{ transform: openIndex === idx ? "rotate(180deg)" : "rotate(0)" }}>expand_more</span>
            </button>
            {openIndex === idx && (
              <p className="font-['Inter'] text-sm text-foreground-variant pb-3 leading-relaxed">{faq.answer}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SimpleMarkdown({ text }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return <h4 key={i} className="font-mono text-[12px] uppercase tracking-[0.18em] text-foreground mt-3 mb-1">{line.slice(3)}</h4>;
        }
        if (line.startsWith("# ")) {
          return <h3 key={i} className="font-display text-lg text-foreground mt-4 mb-1">{line.slice(2)}</h3>;
        }
        if (line.trim() === "") return <div key={i} className="h-1" />;
        // Bold: **text**
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i} className="font-['Inter'] text-sm text-foreground-variant leading-relaxed">
            {parts.map((part, j) =>
              part.startsWith("**") && part.endsWith("**")
                ? <strong key={j} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
                : part
            )}
          </p>
        );
      })}
    </div>
  );
}

function GuideCard({ guide }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-accent text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>{guide.icon}</span>
        </div>
        <div className="min-w-0">
          <h3 className="font-mono text-[12px] uppercase tracking-[0.18em] text-foreground mb-2">{guide.title}</h3>
          <SimpleMarkdown text={guide.content} />
        </div>
      </div>
    </div>
  );
}

function HouseCaptainCard({ propertyId }) {
  const [captain, setCaptain] = useState(null);

  useEffect(() => {
    async function fetchCaptain() {
      const { data } = await supabase
        .from("tenant_profiles")
        .select("*, rooms(name, unit_code), tenant_details:tenant_details(full_name, phone)")
        .eq("property_id", propertyId)
        .eq("role", "HOUSE_CAPTAIN")
        .eq("is_active", true)
        .maybeSingle();
      setCaptain(data);
    }
    if (propertyId) fetchCaptain();
  }, [propertyId]);

  if (!captain) return null;

  const name = captain.tenant_details?.[0]?.full_name ?? captain.tenant_details?.full_name ?? "House Captain";
  const phone = captain.tenant_details?.[0]?.phone ?? captain.tenant_details?.phone ?? "";

  return (
    <div className="bg-surface border border-border rounded-2xl p-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-accent text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
        </div>
        <div>
          <h3 className="font-mono text-[12px] uppercase tracking-[0.18em] text-foreground mb-1">House Captain</h3>
          <p className="font-['Inter'] text-sm font-semibold text-foreground">{name}</p>
          {phone && (
            <a href={`https://wa.me/${phone.replace(/[^0-9]/g, "")}`} className="font-['Inter'] text-sm text-accent hover:underline">{phone}</a>
          )}
          <p className="font-['Inter'] text-xs text-foreground-variant mt-1">Your first point of contact for day-to-day questions at the apartment.</p>
        </div>
      </div>
    </div>
  );
}

function HouseRulesCard({ propertyId }) {
  const [rules, setRules] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function fetchRules() {
      const { data } = await supabase
        .from("house_rules")
        .select("*")
        .eq("property_id", propertyId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) {
        const { data: global } = await supabase
          .from("house_rules")
          .select("*")
          .is("property_id", null)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setRules(global);
      } else {
        setRules(data);
      }
    }
    if (propertyId) fetchRules();
  }, [propertyId]);

  if (!rules) return null;

  return (
    <div className="bg-surface border border-border rounded-2xl p-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-accent text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>gavel</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-mono text-[12px] uppercase tracking-[0.18em] text-foreground">House Rules</h3>
            <button onClick={() => setExpanded(!expanded)} className="text-accent font-['Inter'] text-xs font-semibold hover:underline">
              {expanded ? "Collapse" : "View All"}
            </button>
          </div>
          {expanded ? (
            <div className="font-['Inter'] text-sm text-foreground-variant whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto">{rules.content}</div>
          ) : (
            <p className="font-['Inter'] text-sm text-foreground-variant">
              {rules.title ?? "Community guidelines for shared living"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const ACCESS_CARD_ITEMS = [
  { label: "Passport-size photo" },
  { label: "Tenancy agreement", note: "You already have this in your portal.", link: "/portal/documents" },
  { label: "Stamping certificate" },
  { label: "Passport" },
  { label: "Valid visa or work pass for Singapore" },
  { label: "Letter of acknowledgement from owner", note: "We provide this one. Just ask us." },
];

function AccessCardCard() {
  return (
    <div className="bg-surface border border-border rounded-2xl p-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-accent text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>badge</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-mono text-[12px] uppercase tracking-[0.18em] text-foreground mb-1">Access Card Application</h3>
          <p className="font-['Inter'] text-sm text-foreground-variant mb-4">
            To apply for your unit access card, you'll need these 6 documents:
          </p>
          <ol className="space-y-3">
            {ACCESS_CARD_ITEMS.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-accent/15 text-accent text-[11px] font-bold font-['Inter'] flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div>
                  <p className="font-['Inter'] text-sm font-semibold text-foreground">{item.label}</p>
                  {item.note && (
                    <p className="font-['Inter'] text-xs text-foreground-variant mt-0.5">
                      {item.note}{" "}
                      {item.link && (
                        <Link to={item.link} className="text-accent hover:underline">View in Documents</Link>
                      )}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

export default function PropertyGuidePage() {
  const { profile } = useAuth();
  const propertyId = profile?.rooms?.property_id ?? profile?.property_id;
  const propertyName = profile?.properties?.name ?? "Lazybee";
  const isIvoryHeights = profile?.properties?.code === "IH";
  const { guides, loading, getSection } = usePropertyGuides(propertyId);

  const wifi = getSection("wifi");
  const propertyInfo = getSection("property_info");
  const buildingGuide = getSection("building_guide");
  const nearby = getSection("nearby");
  const faq = getSection("faq");

  return (
    <PortalLayout>
      <div className="max-w-4xl">
        <div className="mb-8">
          <span className="block font-mono text-[11px] uppercase tracking-[0.28em] text-accent mb-3">Your home</span>
          <h1 className="font-['Hanken_Grotesk'] text-3xl font-extrabold text-foreground tracking-tight">
            My Property
          </h1>
          <p className="font-['Inter'] text-foreground-variant font-medium mt-1">
            Everything you need to know about living at {propertyName}
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-surface-container animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {wifi && <WiFiCard guide={wifi} />}
            {propertyInfo && <GuideCard guide={propertyInfo} />}
            <HouseCaptainCard propertyId={propertyId} />
            {buildingGuide && <GuideCard guide={buildingGuide} />}
            {isIvoryHeights && <AccessCardCard />}
            {nearby && <GuideCard guide={nearby} />}
            <HouseRulesCard propertyId={propertyId} />
            {faq && <FAQCard guide={faq} />}

            <div className="bg-accent/10 border border-accent/25 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-accent text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>support</span>
                </div>
                <div>
                  <h3 className="font-mono text-[12px] uppercase tracking-[0.18em] text-foreground mb-1">Contact Lazybee</h3>
                  <p className="font-['Inter'] text-xs text-foreground-variant mb-2">Checked the FAQ and submitted a ticket first?</p>
                  <a
                    href="https://wa.me/6580695410"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 font-['Inter'] text-sm font-semibold text-accent hover:underline"
                  >
                    <span className="material-symbols-outlined text-[16px]">chat</span>
                    WhatsApp +65 8069 5410
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
