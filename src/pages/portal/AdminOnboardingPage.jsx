import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import PortalLayout from "../../components/portal/PortalLayout";
import { STEP_LABELS } from "../../hooks/useOnboarding";

const STEP_BADGE_COLORS = {
  PERSONAL_DETAILS: "bg-[#e6eeff] text-[#555f6f]",
  ID_VERIFICATION: "bg-blue-100 text-blue-700",
  SIGN_TA: "bg-purple-100 text-purple-700",
  DEPOSIT: "bg-amber-100 text-amber-700",
  HOUSE_RULES: "bg-orange-100 text-orange-700",
  MOVE_IN_CHECKLIST: "bg-indigo-100 text-indigo-700",
  ACTIVE: "bg-[#d1fae5] text-[#065f46]",
  END_OF_TENANCY: "bg-[#ffdad6] text-[#ba1a1a]",
};

const STATUS_BADGE_COLORS = {
  ONBOARDING: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  ACTIVE: "bg-[#d1fae5] text-[#065f46]",
  COMPLETE: "bg-[#d1fae5] text-[#065f46]",
  END_OF_TENANCY: "bg-amber-100 text-amber-700",
  MOVED_OUT: "bg-gray-100 text-gray-600",
  BLOCKED: "bg-[#ffdad6] text-[#ba1a1a]",
};

const STEP_ORDER = [
  "PERSONAL_DETAILS",
  "ID_VERIFICATION",
  "SIGN_TA",
  "DEPOSIT",
  "HOUSE_RULES",
  "MOVE_IN_CHECKLIST",
  "ACTIVE",
];

const LIFECYCLE_FILTERS = ["ALL", "ONBOARDING", "ACTIVE", "END_OF_TENANCY"];

function getStepProgress(currentStep) {
  const idx = STEP_ORDER.indexOf(currentStep);
  if (idx === -1) return 0;
  return Math.round(((idx + 1) / STEP_ORDER.length) * 100);
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminOnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Invite wizard state
  const [showInvite, setShowInvite] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteRoomId, setInviteRoomId] = useState("");
  const [inviteDeposit, setInviteDeposit] = useState("2400");
  const [inviteRent, setInviteRent] = useState("1200");
  const [inviteStartDate, setInviteStartDate] = useState("");
  const [inviteLicencePeriod, setInviteLicencePeriod] = useState("12");
  const [inviteRefNumber, setInviteRefNumber] = useState("");
  const [rooms, setRooms] = useState([]);
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);

  // TA preview state
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [taPreviewHtml, setTaPreviewHtml] = useState("");

  // Auto-calculate end date
  const inviteEndDate = (() => {
    if (!inviteStartDate || !inviteLicencePeriod) return "";
    const start = new Date(inviteStartDate + "T00:00:00");
    if (isNaN(start.getTime())) return "";
    const end = new Date(start);
    end.setMonth(end.getMonth() + Number(inviteLicencePeriod));
    end.setDate(end.getDate() - 1);
    return end.toISOString().split("T")[0];
  })();

  const selectedRoom = rooms.find(r => r.id === inviteRoomId);

  useEffect(() => {
    supabase.from("rooms").select("id, unit_code, name, property_id, rent_amount, properties(name, address, common_areas)")
      .order("unit_code").then(({ data }) => setRooms(data ?? []));
    supabase.from("document_templates").select("id, name, doc_type, html_content, placeholders, signature_config")
      .eq("is_active", true).eq("doc_type", "LICENCE_AGREEMENT")
      .then(({ data }) => {
        setTemplates(data ?? []);
        if (data?.length > 0) setSelectedTemplateId(data[0].id);
      });
  }, []);

  // Auto-generate ref number when room changes
  useEffect(() => {
    if (!inviteRoomId) return;
    const room = rooms.find(r => r.id === inviteRoomId);
    if (!room) return;
    const prefix = room.unit_code?.split("-")[0] || "HYV";
    const year = new Date().getFullYear();
    const seq = String(rows.length + 1).padStart(3, "0");
    setInviteRefNumber(`${prefix}-${year}-${seq}`);
    // Pre-fill rent from room
    if (room.rent_amount) setInviteRent(String(room.rent_amount));
  }, [inviteRoomId, rooms, rows.length]);

  function fillTemplate(html, values) {
    return html.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => values[key] || `{{${key}}}`);
  }

  function generateTaPreview() {
    const tpl = templates.find(t => t.id === selectedTemplateId);
    if (!tpl) return;
    const room = rooms.find(r => r.id === inviteRoomId);
    const fmtDate = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" }) : "";
    const values = {
      TENANT_NAME: inviteUsername,
      ROOM_CODE: room?.unit_code || "",
      ROOM_NAME: room?.name || "",
      PROPERTY_NAME: room?.properties?.name || "",
      PROPERTY_ADDRESS: room?.properties?.address || "",
      COMMON_AREAS: room?.properties?.common_areas || "All common areas",
      REF_NUMBER: inviteRefNumber,
      MONTHLY_RENT: inviteRent ? Number(inviteRent).toLocaleString("en-SG") : "",
      DEPOSIT_AMOUNT: inviteDeposit ? Number(inviteDeposit).toLocaleString("en-SG") : "",
      LICENCE_PERIOD: `${inviteLicencePeriod} months`,
      START_DATE: fmtDate(inviteStartDate),
      END_DATE: fmtDate(inviteEndDate),
      DATE: new Date().toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" }),
    };
    setTaPreviewHtml(fillTemplate(tpl.html_content || "", values));
  }

  async function handleInvite() {
    setInviting(true);
    setInviteResult(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const jwt = sessionData?.session?.access_token;
      const res = await fetch("/api/portal/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({
          username: inviteUsername.trim(),
          room_id: inviteRoomId,
          property_id: selectedRoom?.property_id,
          deposit_amount: inviteDeposit ? Number(inviteDeposit) : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Invite failed");

      const tpId = body.profile_id;

      // Save tenancy details + signature config to onboarding_progress
      if (tpId) {
        const { data: onbData } = await supabase
          .from("onboarding_progress")
          .select("id")
          .eq("tenant_profile_id", tpId)
          .maybeSingle();

        const tpl = templates.find(t => t.id === selectedTemplateId);

        if (onbData?.id) {
          await supabase.from("onboarding_progress").update({
            ref_number: inviteRefNumber || null,
            tenancy_start_date: inviteStartDate || null,
            tenancy_end_date: inviteEndDate || null,
            licence_period: inviteLicencePeriod ? `${inviteLicencePeriod} months` : null,
            signature_positions: tpl?.signature_config || null,
          }).eq("id", onbData.id);
        }

        // Update room rent amount
        if (inviteRent) {
          await supabase.from("rooms").update({ rent_amount: Number(inviteRent) }).eq("id", inviteRoomId);
        }

        // Generate and upload the TA PDF
        if (taPreviewHtml) {
          try {
            const { default: html2pdf } = await import(/* @vite-ignore */ "html2pdf.js");
            const iframe = document.createElement("iframe");
            iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:800px;height:1200px;border:none;";
            document.body.appendChild(iframe);
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write(`<!DOCTYPE html><html><head><style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #000; background: #fff; padding: 40px; width: 700px; }
              h1, h2, h3, h4 { margin: 1em 0 0.5em; }
              p { margin: 0.5em 0; }
              table { border-collapse: collapse; width: 100%; }
              td, th { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
            </style></head><body>${taPreviewHtml}</body></html>`);
            iframeDoc.close();

            const pdfBlob = await html2pdf().set({
              margin: 10, filename: "ta.pdf",
              image: { type: "jpeg", quality: 0.98 },
              html2canvas: { scale: 2, useCORS: true },
              jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
            }).from(iframeDoc.body).outputPdf("blob");
            document.body.removeChild(iframe);

            const storagePath = `tenants/${tpId}/ta-generated-${Date.now()}.pdf`;
            await supabase.storage.from("tenant-documents").upload(storagePath, pdfBlob, { contentType: "application/pdf" });
            const { data: urlData } = supabase.storage.from("tenant-documents").getPublicUrl(storagePath);

            if (onbData?.id) {
              await supabase.from("onboarding_progress").update({ ta_document_url: urlData.publicUrl }).eq("id", onbData.id);
            }
            await supabase.from("tenant_documents").insert({
              tenant_profile_id: tpId,
              doc_type: "LICENCE_AGREEMENT",
              title: tpl?.name || "Licence Agreement",
              status: "SENT",
              file_url: urlData.publicUrl,
            });
          } catch (pdfErr) {
            console.error("TA PDF generation failed:", pdfErr);
          }
        }
      }

      setInviteResult({ type: "success", ...body });
      setWizardStep(4);
      fetchOnboarding();
    } catch (err) {
      setInviteResult({ type: "error", message: err.message });
    } finally {
      setInviting(false);
    }
  }

  async function fetchOnboarding() {
    const { data, error } = await supabase
      .from("onboarding_progress")
      .select(
        "id, current_step, status, created_at, tenant_profile_id, tenancy_start_date, tenancy_end_date, tenant_profiles(id, role, username, rooms(unit_code, name), tenant_details(full_name, phone))"
      )
      .order("created_at", { ascending: false });

    if (error) console.error("Error fetching onboarding progress:", error);
    setRows(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    async function fetchOnboardingInit() {
      const { data, error } = await supabase
        .from("onboarding_progress")
        .select(
          "id, current_step, status, created_at, tenant_profile_id, tenancy_start_date, tenancy_end_date, tenant_profiles(id, role, username, rooms(unit_code, name), tenant_details(full_name, phone))"
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching onboarding progress:", error);
      }
      setRows(data ?? []);
      setLoading(false);
    }

    fetchOnboardingInit();
  }, []);

  const [lifecycleFilter, setLifecycleFilter] = useState("ALL");

  const onboardingCount = rows.filter((r) => ["ONBOARDING", "IN_PROGRESS"].includes(r.status)).length;
  const activeCount = rows.filter((r) => r.status === "ACTIVE").length;
  const archivedCount = rows.filter((r) => r.status === "ARCHIVED" || r.status === "MOVED_OUT").length;

  const filteredRows = lifecycleFilter === "ALL" ? rows.filter(r => r.status !== "ARCHIVED" && r.status !== "MOVED_OUT")
    : lifecycleFilter === "ONBOARDING" ? rows.filter(r => ["ONBOARDING", "IN_PROGRESS"].includes(r.status))
    : lifecycleFilter === "ACTIVE" ? rows.filter(r => r.status === "ACTIVE")
    : lifecycleFilter === "ARCHIVED" ? rows.filter(r => ["ARCHIVED", "MOVED_OUT", "END_OF_TENANCY"].includes(r.status))
    : rows;

  return (
    <PortalLayout>
      {/* Page header */}
      <div className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a] tracking-tight">
            Member Management
          </h1>
          <p className="text-[#6c7a77] font-['Manrope'] font-medium mt-1">
            Full lifecycle — onboarding, active members, and move-outs.
          </p>
        </div>
        <button
          onClick={() => { setShowInvite(true); setInviteResult(null); setInviteUsername(""); setWizardStep(1); }}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#006a61] transition-colors shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          New Member
        </button>
      </div>

      {/* Invite Wizard Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowInvite(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Wizard header */}
            <div className="px-8 pt-6 pb-4 border-b border-[#bbcac6]/15">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-[#121c2a]">New Member Setup</h2>
                <button onClick={() => setShowInvite(false)} className="text-[#6c7a77] hover:text-[#121c2a]">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              {/* Step indicator */}
              <div className="flex gap-1">
                {["Account", "Tenancy", "Review TA", "Done"].map((label, i) => (
                  <div key={label} className="flex items-center gap-1.5 flex-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      wizardStep > i + 1 ? "bg-[#006b5f] text-white" : wizardStep === i + 1 ? "bg-[#006b5f] text-white" : "bg-[#eff4ff] text-[#6c7a77]"
                    }`}>
                      {wizardStep > i + 1 ? <span className="material-symbols-outlined text-[14px]">check</span> : i + 1}
                    </div>
                    <span className={`font-['Inter'] text-[9px] uppercase tracking-widest font-bold hidden sm:inline ${wizardStep >= i + 1 ? "text-[#121c2a]" : "text-[#bbcac6]"}`}>{label}</span>
                    {i < 3 && <div className={`flex-1 h-0.5 rounded ${wizardStep > i + 1 ? "bg-[#006b5f]" : "bg-[#eff4ff]"}`} />}
                  </div>
                ))}
              </div>
            </div>

            <div className="px-8 py-6">
              {/* Step 1: Account */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Username *</label>
                    <input
                      type="text"
                      value={inviteUsername}
                      onChange={(e) => setInviteUsername(e.target.value)}
                      placeholder="e.g. john-doe"
                      className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
                    />
                    <p className="text-[10px] text-[#6c7a77]">Letters, numbers, hyphens, underscores. Min 3 chars. Password will be auto-generated.</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Room *</label>
                    <select
                      value={inviteRoomId}
                      onChange={(e) => setInviteRoomId(e.target.value)}
                      className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
                    >
                      <option value="">Select room</option>
                      {rooms.map(r => (
                        <option key={r.id} value={r.id}>{r.unit_code} — {r.name} ({r.properties?.name})</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => setWizardStep(2)}
                    disabled={!inviteUsername.trim() || inviteUsername.trim().length < 3 || !inviteRoomId}
                    className="w-full py-3 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#006a61] disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    Next: Tenancy Details
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </div>
              )}

              {/* Step 2: Tenancy Details */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Monthly Rent (SGD) *</label>
                      <input
                        type="number" min="0" step="50"
                        value={inviteRent}
                        onChange={(e) => setInviteRent(e.target.value)}
                        placeholder="1200"
                        className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Deposit (SGD) *</label>
                      <input
                        type="number" min="0" step="50"
                        value={inviteDeposit}
                        onChange={(e) => setInviteDeposit(e.target.value)}
                        placeholder="2400"
                        className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Start Date *</label>
                      <input
                        type="date"
                        value={inviteStartDate}
                        onChange={(e) => setInviteStartDate(e.target.value)}
                        className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Licence Period *</label>
                      <select
                        value={inviteLicencePeriod}
                        onChange={(e) => setInviteLicencePeriod(e.target.value)}
                        className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
                      >
                        {[3, 6, 9, 12, 18, 24].map(m => (
                          <option key={m} value={m}>{m} months</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {inviteEndDate && (
                    <p className="text-xs text-[#006b5f] font-['Manrope'] bg-[#006b5f]/5 rounded-lg px-3 py-2">
                      End date: <strong>{new Date(inviteEndDate + "T00:00:00").toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" })}</strong>
                    </p>
                  )}
                  <div className="space-y-1.5">
                    <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Reference Number</label>
                    <input
                      type="text"
                      value={inviteRefNumber}
                      onChange={(e) => setInviteRefNumber(e.target.value)}
                      placeholder="e.g. HYV-2026-005"
                      className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
                    />
                  </div>

                  {inviteResult?.type === "error" && (
                    <p className="text-sm text-[#ba1a1a] bg-[#ffdad6]/40 rounded-lg px-3 py-2">{inviteResult.message}</p>
                  )}

                  {/* Review summary */}
                  <div className="bg-[#f8f9ff] rounded-xl p-4 space-y-1.5 text-xs font-['Manrope']">
                    <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-2">Summary</p>
                    <p><span className="text-[#6c7a77]">Username:</span> <strong>{inviteUsername}</strong></p>
                    <p><span className="text-[#6c7a77]">Room:</span> <strong>{selectedRoom?.unit_code} — {selectedRoom?.name}</strong></p>
                    <p><span className="text-[#6c7a77]">Rent:</span> <strong>SGD {Number(inviteRent || 0).toLocaleString()}/mo</strong> · <span className="text-[#6c7a77]">Deposit:</span> <strong>SGD {Number(inviteDeposit || 0).toLocaleString()}</strong></p>
                    <p><span className="text-[#6c7a77]">Period:</span> <strong>{inviteLicencePeriod} months</strong> from <strong>{inviteStartDate || "TBD"}</strong></p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setWizardStep(1)}
                      className="flex-1 py-3 bg-[#eff4ff] text-[#555f6f] rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#e6eeff]"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => { generateTaPreview(); setWizardStep(3); }}
                      disabled={!inviteRent || !inviteDeposit || !inviteStartDate}
                      className="flex-[2] py-3 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#006a61] disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      Next: Review Agreement
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Review TA */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  {templates.length > 1 && (
                    <div className="space-y-1.5">
                      <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Template</label>
                      <select
                        value={selectedTemplateId}
                        onChange={(e) => { setSelectedTemplateId(e.target.value); setTimeout(generateTaPreview, 100); }}
                        className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
                      >
                        {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  )}

                  {taPreviewHtml ? (
                    <div className="border border-[#bbcac6]/15 rounded-xl overflow-auto max-h-[400px]">
                      <div
                        style={{ all: "initial", fontFamily: "Arial, Helvetica, sans-serif", fontSize: "12px", lineHeight: "1.5", color: "#000", background: "#fff", padding: "24px", display: "block" }}
                        dangerouslySetInnerHTML={{ __html: taPreviewHtml }}
                      />
                    </div>
                  ) : (
                    <div className="border border-dashed border-[#bbcac6] rounded-xl p-8 text-center">
                      <p className="text-sm text-[#6c7a77]">No licence agreement template found. Create one in Documents first.</p>
                    </div>
                  )}

                  <div className="bg-[#eff4ff] rounded-xl p-3 text-xs text-[#6c7a77] font-['Manrope']">
                    <strong className="text-[#121c2a]">Ref: {inviteRefNumber}</strong> — This agreement will be sent to the member for signing. You will counter-sign after them as a final check.
                  </div>

                  {inviteResult?.type === "error" && (
                    <p className="text-sm text-[#ba1a1a] bg-[#ffdad6]/40 rounded-lg px-3 py-2">{inviteResult.message}</p>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setWizardStep(2)}
                      className="flex-1 py-3 bg-[#eff4ff] text-[#555f6f] rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#e6eeff]"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleInvite}
                      disabled={inviting || !taPreviewHtml}
                      className="flex-[2] py-3 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#006a61] disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      {inviting ? (
                        <>
                          <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                          Creating account & generating TA...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[18px]">check_circle</span>
                          Approve & Create Member
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Success */}
              {wizardStep === 4 && inviteResult?.type === "success" && (
                <div className="space-y-5 text-center">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-[#d1fae5] flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#065f46] text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  </div>
                  <div>
                    <h3 className="font-['Plus_Jakarta_Sans'] text-lg font-bold text-[#121c2a] mb-1">Member Created!</h3>
                    <p className="text-xs text-[#555f6f]">Share these login credentials with the new member.</p>
                  </div>
                  <div className="bg-[#f8f9ff] rounded-xl p-5 text-left space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#6c7a77]">Username</span>
                      <code className="text-sm font-bold text-[#121c2a] bg-white px-2 py-0.5 rounded">{inviteResult.username}</code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#6c7a77]">Password</span>
                      <code className="text-sm font-bold text-[#121c2a] bg-white px-2 py-0.5 rounded">{inviteResult.default_password}</code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#6c7a77]">Login URL</span>
                      <code className="text-xs text-[#006b5f] bg-white px-2 py-0.5 rounded">hyve.sg/portal/login</code>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`Username: ${inviteResult.username}\nPassword: ${inviteResult.default_password}\nLogin: hyve.sg/portal/login`);
                    }}
                    className="w-full py-2.5 bg-[#eff4ff] text-[#006b5f] rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#e6eeff] flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[16px]">content_copy</span>
                    Copy Credentials
                  </button>
                  <button
                    onClick={() => setShowInvite(false)}
                    className="w-full py-3 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#006a61]"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stat cards — clickable to filter */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-6">
        {[
          { label: "Total", count: rows.length, filter: "ALL", color: "text-[#121c2a]", bg: "bg-white" },
          { label: "Onboarding", count: onboardingCount, filter: "ONBOARDING", color: "text-blue-600", bg: "bg-white" },
          { label: "Active", count: activeCount, filter: "ACTIVE", color: "text-[#006b5f]", bg: "bg-white" },
          { label: "Archived", count: archivedCount, filter: "ARCHIVED", color: "text-gray-500", bg: "bg-white" },
        ].map(({ label, count, filter, color, bg }) => (
          <button
            key={filter}
            onClick={() => setLifecycleFilter(filter)}
            className={`${bg} rounded-2xl p-6 border-2 shadow-sm text-left transition-all ${
              lifecycleFilter === filter ? "border-[#006b5f] ring-1 ring-[#006b5f]/20" : "border-[#bbcac6]/15 hover:border-[#006b5f]/30"
            }`}
          >
            <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-3">{label}</p>
            {loading ? (
              <div className="h-8 w-10 bg-[#eff4ff] animate-pulse rounded" />
            ) : (
              <p className={`font-['Plus_Jakarta_Sans'] text-3xl font-extrabold ${color}`}>{count}</p>
            )}
          </button>
        ))}
      </div>

      {/* Active filter indicator */}
      {lifecycleFilter !== "ALL" && (
        <div className="mb-4 flex items-center gap-2">
          <span className="font-['Inter'] text-xs text-[#6c7a77]">
            Showing: <strong className="text-[#121c2a]">{lifecycleFilter.replace(/_/g, " ")}</strong>
          </span>
          <button onClick={() => setLifecycleFilter("ALL")} className="text-xs text-[#006b5f] font-bold hover:underline">
            Clear filter
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm overflow-hidden">
          <div className="divide-y divide-[#bbcac6]/10">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-8 py-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#eff4ff] animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-4 w-24 bg-[#eff4ff] animate-pulse rounded" />
                    <div className="h-3 w-32 bg-[#eff4ff] animate-pulse rounded" />
                  </div>
                </div>
                <div className="h-5 w-20 bg-[#eff4ff] animate-pulse rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-[#bbcac6]/15 shadow-sm text-center">
          <p className="text-[#6c7a77] font-['Manrope'] text-sm">No onboarding records found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#eff4ff]">
              <tr>
                <th className="text-left px-8 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">
                  Tenant
                </th>
                <th className="text-left px-6 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">
                  Status
                </th>
                <th className="text-left px-6 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">
                  Current Step
                </th>
                <th className="text-left px-6 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold hidden md:table-cell">
                  Lease
                </th>
                <th className="text-right px-6 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#bbcac6]/10">
              {filteredRows.map((row) => {
                const unitCode = row.tenant_profiles?.rooms?.unit_code ?? "—";
                const roomName = row.tenant_profiles?.rooms?.name ?? "";
                const tenantName = row.tenant_profiles?.tenant_details?.full_name ?? row.tenant_profiles?.username ?? "";
                const stepLabel = STEP_LABELS[row.current_step] ?? row.current_step;
                const stepColor = STEP_BADGE_COLORS[row.current_step] ?? "bg-[#e6eeff] text-[#555f6f]";
                const statusColor = STATUS_BADGE_COLORS[row.status] ?? "bg-[#e6eeff] text-[#555f6f]";
                const progress = getStepProgress(row.current_step);
                const initials = tenantName ? tenantName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : unitCode.slice(0, 2).toUpperCase();

                return (
                  <tr
                    key={row.id}
                    className="hover:bg-[#f8f9ff] cursor-pointer transition-colors"
                    onClick={() => navigate(`/portal/admin/onboarding/${row.id}`)}
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#d9e3f6] flex items-center justify-center text-[#006b5f] font-bold text-xs shrink-0">
                          {initials}
                        </div>
                        <div>
                          <p className="font-['Manrope'] font-bold text-[#121c2a] text-sm">
                            {tenantName || unitCode}
                          </p>
                          <p className="font-['Manrope'] text-[#6c7a77] text-xs">
                            {unitCode}{roomName ? ` — ${roomName}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${statusColor}`}>
                        {row.status ?? "—"}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${stepColor}`}>
                        {stepLabel}
                      </span>
                    </td>
                    <td className="px-6 py-5 hidden md:table-cell">
                      {row.tenancy_start_date ? (
                        <div className="font-['Manrope'] text-xs text-[#6c7a77]">
                          <p>{formatDate(row.tenancy_start_date)}</p>
                          <p className="text-[#bbcac6]">to {formatDate(row.tenancy_end_date)}</p>
                        </div>
                      ) : (
                        <span className="font-['Manrope'] text-xs text-[#bbcac6]">—</span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        {row.tenant_profiles?.username && (
                          <button
                            title={`Username: ${row.tenant_profiles.username}\nPassword: Welcome1!`}
                            onClick={() => {
                              navigator.clipboard.writeText(row.tenant_profiles.username);
                              alert(`Username: ${row.tenant_profiles.username}\nPassword: Welcome1!\n\nUsername copied to clipboard.`);
                            }}
                            className="p-1.5 rounded-lg hover:bg-[#eff4ff] text-[#6c7a77] hover:text-[#006b5f] transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">key</span>
                          </button>
                        )}
                        {row.status === "ACTIVE" && (
                          <button
                            onClick={async () => {
                              if (!confirm("Start offboarding for this tenant?")) return;
                              await supabase.from("onboarding_progress").update({ status: "END_OF_TENANCY", current_step: "END_OF_TENANCY" }).eq("id", row.id);
                              fetchOnboarding();
                            }}
                            className="p-1.5 rounded-lg hover:bg-amber-50 text-[#6c7a77] hover:text-amber-600 transition-colors"
                            title="Start offboarding"
                          >
                            <span className="material-symbols-outlined text-[18px]">logout</span>
                          </button>
                        )}
                        {["END_OF_TENANCY", "ACTIVE"].includes(row.status) && (
                          <button
                            onClick={async () => {
                              if (!confirm("Archive this tenant? They will be deactivated.")) return;
                              await supabase.from("onboarding_progress").update({ status: "ARCHIVED" }).eq("id", row.id);
                              await supabase.from("tenant_profiles").update({ is_active: false }).eq("id", row.tenant_profile_id);
                              fetchOnboarding();
                            }}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-[#6c7a77] hover:text-gray-900 transition-colors"
                            title="Archive tenant"
                          >
                            <span className="material-symbols-outlined text-[18px]">archive</span>
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/portal/admin/onboarding/${row.id}`)}
                          className="p-1.5 rounded-lg hover:bg-[#eff4ff] text-[#006b5f] transition-colors"
                          title="View details"
                        >
                          <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PortalLayout>
  );
}
