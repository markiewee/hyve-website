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
    <div className="bg-white border border-[#bbcac6]/15 rounded-2xl p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#006b5f]/10 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[#006b5f] text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>wifi</span>
        </div>
        <div>
          <h3 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-[#121c2a] mb-3">WiFi</h3>
          <div className="space-y-2">
            <div>
              <span className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">Network</span>
              <p className="font-['Manrope'] text-sm font-semibold text-[#121c2a]">{network}</p>
            </div>
            <div>
              <span className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">Password</span>
              <div className="flex items-center gap-2">
                <p className="font-['Manrope'] text-sm font-semibold text-[#121c2a] font-mono">{password}</p>
                <button onClick={copyPassword} className="text-[#006b5f] hover:text-[#005a50]">
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
    <div className="bg-white border border-[#bbcac6]/15 rounded-2xl p-6 shadow-sm">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[#006b5f]/10 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[#006b5f] text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>help</span>
        </div>
        <h3 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-[#121c2a] pt-2">FAQ</h3>
      </div>
      <div className="space-y-1 ml-14">
        {faqs.map((faq, idx) => (
          <div key={idx} className="border-b border-[#bbcac6]/10 last:border-0">
            <button
              onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
              className="w-full flex items-center justify-between py-3 text-left"
            >
              <span className="font-['Manrope'] text-sm font-semibold text-[#121c2a]">{faq.question}</span>
              <span className="material-symbols-outlined text-[16px] text-[#6c7a77] transition-transform shrink-0 ml-2" style={{ transform: openIndex === idx ? "rotate(180deg)" : "rotate(0)" }}>expand_more</span>
            </button>
            {openIndex === idx && (
              <p className="font-['Manrope'] text-sm text-[#555f6f] pb-3 leading-relaxed">{faq.answer}</p>
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
          return <h4 key={i} className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] text-sm mt-2 mb-1">{line.slice(3)}</h4>;
        }
        if (line.startsWith("# ")) {
          return <h3 key={i} className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] text-base mt-2 mb-1">{line.slice(2)}</h3>;
        }
        if (line.trim() === "") return <div key={i} className="h-1" />;
        // Bold: **text**
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i} className="font-['Manrope'] text-sm text-[#555f6f] leading-relaxed">
            {parts.map((part, j) =>
              part.startsWith("**") && part.endsWith("**")
                ? <strong key={j} className="font-semibold text-[#121c2a]">{part.slice(2, -2)}</strong>
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
    <div className="bg-white border border-[#bbcac6]/15 rounded-2xl p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#006b5f]/10 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[#006b5f] text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>{guide.icon}</span>
        </div>
        <div className="min-w-0">
          <h3 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-[#121c2a] mb-2">{guide.title}</h3>
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
    <div className="bg-white border border-[#bbcac6]/15 rounded-2xl p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#006b5f]/10 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[#006b5f] text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
        </div>
        <div>
          <h3 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-[#121c2a] mb-1">House Captain</h3>
          <p className="font-['Manrope'] text-sm font-semibold text-[#121c2a]">{name}</p>
          {phone && (
            <a href={`https://wa.me/${phone.replace(/[^0-9]/g, "")}`} className="font-['Manrope'] text-sm text-[#006b5f] hover:underline">{phone}</a>
          )}
          <p className="font-['Manrope'] text-xs text-[#6c7a77] mt-1">Your first point of contact for day-to-day questions at the apartment.</p>
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
    <div className="bg-white border border-[#bbcac6]/15 rounded-2xl p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#006b5f]/10 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[#006b5f] text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>gavel</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-[#121c2a]">House Rules</h3>
            <button onClick={() => setExpanded(!expanded)} className="text-[#006b5f] font-['Manrope'] text-xs font-semibold hover:underline">
              {expanded ? "Collapse" : "View All"}
            </button>
          </div>
          {expanded ? (
            <div className="font-['Manrope'] text-sm text-[#555f6f] whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto">{rules.content}</div>
          ) : (
            <p className="font-['Manrope'] text-sm text-[#555f6f]">
              {rules.title ?? "Community guidelines for shared living"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PropertyGuidePage() {
  const { profile } = useAuth();
  const propertyId = profile?.rooms?.property_id ?? profile?.property_id;
  const propertyName = profile?.properties?.name ?? "Hyve";
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
          <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a] tracking-tight">
            My Property
          </h1>
          <p className="font-['Manrope'] text-[#6c7a77] font-medium mt-1">
            Everything you need to know about living at {propertyName}
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {wifi && <WiFiCard guide={wifi} />}
            {propertyInfo && <GuideCard guide={propertyInfo} />}
            <HouseCaptainCard propertyId={propertyId} />
            {buildingGuide && <GuideCard guide={buildingGuide} />}
            {nearby && <GuideCard guide={nearby} />}
            <HouseRulesCard propertyId={propertyId} />
            {faq && <FAQCard guide={faq} />}

            <div className="bg-white border border-[#bbcac6]/15 rounded-2xl p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#006b5f]/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[#006b5f] text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>build</span>
                </div>
                <div>
                  <h3 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-[#121c2a] mb-1">Submit an Issue</h3>
                  <p className="font-['Manrope'] text-sm text-[#555f6f] mb-3">Maintenance, repairs, or complaints — we'll assign it to a vendor.</p>
                  <Link to="/portal/issues/new" className="inline-flex items-center gap-2 bg-[#006b5f] text-white rounded-xl px-5 py-2.5 font-['Manrope'] font-bold text-sm hover:bg-[#005a50] transition-colors">
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    New Issue
                  </Link>
                </div>
              </div>
            </div>

            <div className="bg-[#eff4ff] border border-[#bbcac6]/10 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[#006b5f] text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>support</span>
                </div>
                <div>
                  <h3 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-[#121c2a] mb-1">Contact Hyve</h3>
                  <p className="font-['Manrope'] text-xs text-[#6c7a77] mb-2">Checked the FAQ and submitted a ticket first?</p>
                  <a
                    href="https://wa.me/6580885410"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 font-['Manrope'] text-sm font-semibold text-[#006b5f] hover:underline"
                  >
                    <span className="material-symbols-outlined text-[16px]">chat</span>
                    WhatsApp +65 8088 5410
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
