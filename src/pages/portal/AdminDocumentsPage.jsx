import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import PdfFieldPlacer from "../../components/portal/PdfFieldPlacer";
import { stampPdf, fetchPdfBytes } from "../../lib/pdfStamp";
import { notifyMember } from "../../lib/notify";
import { generateFeeScheduleHtml } from "../../lib/feeSchedule";

const DOC_TYPES = ["LICENCE_AGREEMENT", "NOTICE_OF_TERMINATION", "MOVE_IN_CHECKLIST", "MOVE_OUT_CHECKLIST", "HOUSE_RULES", "OTHER"];
const DOC_TYPE_LABELS = { LICENCE_AGREEMENT: "Licence Agreement", NOTICE_OF_TERMINATION: "Notice of Termination", MOVE_IN_CHECKLIST: "Move-in Checklist", MOVE_OUT_CHECKLIST: "Move-out Checklist", HOUSE_RULES: "House Rules", OTHER: "Other" };

const DEFAULT_SIG_CONFIG = {
  tenant: { page: "last", x: 50, y: 120, width: 200, height: 80, label: "Member Signature" },
  admin: { page: "last", x: 350, y: 120, width: 200, height: 80, label: "Licensor Signature" },
};

export default function AdminDocumentsPage() {
  const [templates, setTemplates] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  // Template editor
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editorName, setEditorName] = useState("");
  const [editorDocType, setEditorDocType] = useState(DOC_TYPES[0]);
  const [editorPdfFile, setEditorPdfFile] = useState(null);
  const [editorPdfUrl, setEditorPdfUrl] = useState(null);
  const [sigConfig, setSigConfig] = useState(DEFAULT_SIG_CONFIG);
  const [textFields, setTextFields] = useState([]);
  const [saving, setSaving] = useState(false);

  // Send to member
  const [showSend, setShowSend] = useState(false);
  const [sendTemplateId, setSendTemplateId] = useState("");
  const [sendTenantId, setSendTenantId] = useState("");
  const [sendPdfFile, setSendPdfFile] = useState(null);
  const [sendPdfUrl, setSendPdfUrl] = useState(null);
  const [sendSigConfig, setSendSigConfig] = useState(DEFAULT_SIG_CONFIG);
  const [sending, setSending] = useState(false);

  const fetchData = useCallback(async () => {
    const [tplRes, tenantRes] = await Promise.all([
      supabase.from("document_templates").select("*").order("created_at", { ascending: false }),
      supabase.from("tenant_profiles").select("id, role, username, monthly_rent, room_id, property_id, rooms(unit_code, name), properties(name, address, common_areas), tenant_details(full_name, id_number, phone), onboarding_progress(id, deposit_amount, licence_period, tenancy_start_date, tenancy_end_date, ref_number)")
        .eq("role", "TENANT").eq("is_active", true),
    ]);
    setTemplates(tplRes.data ?? []);
    setTenants(tenantRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Template: Upload PDF + Place Signatures ──────────────────
  function openCreateEditor() {
    setEditingTemplate(null);
    setEditorName("");
    setEditorDocType(DOC_TYPES[0]);
    setEditorPdfFile(null);
    setEditorPdfUrl(null);
    setSigConfig(DEFAULT_SIG_CONFIG);
    setTextFields([]);
    setShowEditor(true);
  }

  function openEditTemplate(tpl) {
    setEditingTemplate(tpl);
    setEditorName(tpl.name);
    setEditorDocType(tpl.doc_type);
    setEditorPdfFile(null);
    setSigConfig(tpl.signature_config ?? DEFAULT_SIG_CONFIG);
    setTextFields(tpl.text_fields ?? []);
    if (tpl.pdf_url) {
      const path = tpl.pdf_url.includes("/tenant-documents/") ? tpl.pdf_url.split("/tenant-documents/")[1].split("?")[0] : tpl.pdf_url;
      supabase.storage.from("tenant-documents").createSignedUrl(path, 3600).then(({ data }) => {
        setEditorPdfUrl(data?.signedUrl || null);
      });
    } else {
      setEditorPdfUrl(null);
    }
    setShowEditor(true);
  }

  function handleEditorPdfSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditorPdfFile(file);
    setEditorPdfUrl(URL.createObjectURL(file));
  }

  async function handleSaveTemplate() {
    if (!editorName.trim()) { setMessage({ type: "error", text: "Template name is required." }); return; }
    setSaving(true);
    setMessage(null);

    try {
      let pdfUrl = editingTemplate?.pdf_url || null;

      // Upload new PDF if selected
      if (editorPdfFile) {
        const path = `templates/${Date.now()}-${editorPdfFile.name}`;
        const { error: upErr } = await supabase.storage.from("tenant-documents").upload(path, editorPdfFile, { contentType: "application/pdf" });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("tenant-documents").getPublicUrl(path);
        pdfUrl = urlData.publicUrl;
      }

      const payload = {
        name: editorName.trim(),
        doc_type: editorDocType,
        pdf_url: pdfUrl,
        signature_config: sigConfig,
        text_fields: textFields,
        is_active: true,
      };

      if (editingTemplate) {
        await supabase.from("document_templates").update(payload).eq("id", editingTemplate.id);
      } else {
        await supabase.from("document_templates").insert(payload);
      }

      setMessage({ type: "success", text: editingTemplate ? "Template updated." : "Template created." });
      setShowEditor(false);
      await fetchData();
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    }
    setSaving(false);
  }

  // ── Generate from HTML Template ─────────────────────────────
  const [showGenerate, setShowGenerate] = useState(false);
  const [genTenantId, setGenTenantId] = useState("");

  async function handleGenerate() {
    const tenant = tenants.find(t => t.id === genTenantId);
    if (!tenant) return;

    const ob = tenant?.onboarding_progress;
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" }) : "";
    // Auto-generate fee schedule with prorated first/last months
    const feeDates = {};
    const feeScheduleRows = generateFeeScheduleHtml(ob?.tenancy_start_date, ob?.tenancy_end_date, tenant?.monthly_rent);
    const rent = tenant?.monthly_rent ? Number(tenant.monthly_rent).toLocaleString() : "—";

    const values = {
      TENANT_NAME: tenant?.tenant_details?.full_name || "",
      ID_NUMBER: tenant?.tenant_details?.id_number || "",
      PHONE: tenant?.tenant_details?.phone || "",
      EMAIL: "",
      ROOM_CODE: tenant?.rooms?.unit_code || "",
      ROOM_NAME: tenant?.rooms?.name || "",
      PROPERTY_NAME: tenant?.properties?.name || "",
      PROPERTY_ADDRESS: tenant?.properties?.address || "",
      COMMON_AREAS: tenant?.properties?.common_areas || "All other areas not defined as private dwellings",
      MONTHLY_RENT: rent,
      DEPOSIT_AMOUNT: ob?.deposit_amount ? Number(ob.deposit_amount).toLocaleString() : "",
      LICENCE_PERIOD: ob?.licence_period || "",
      START_DATE: fmtDate(ob?.tenancy_start_date),
      END_DATE: fmtDate(ob?.tenancy_end_date),
      REF_NUMBER: ob?.ref_number || "",
      DATE: new Date().toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" }),
      FEE_SCHEDULE_ROWS: feeScheduleRows,
      ...feeDates,
    };

    try {
      // Fetch HTML template
      const res = await fetch("/templates/licence-agreement.html");
      let html = await res.text();

      // Fill placeholders
      for (const [key, val] of Object.entries(values)) {
        html = html.replaceAll(`{{${key}}}`, val || `[${key}]`);
      }
      // Clear remaining unfilled FEE_DATE placeholders
      html = html.replace(/\{\{FEE_DATE_\d+\}\}/g, "—");

      // Open in new window — user prints to PDF
      const w = window.open("", "_blank");
      w.document.write(html);
      w.document.close();

      setShowGenerate(false);
      setMessage({ type: "success", text: "Document opened in new tab. Use Cmd+P (or Ctrl+P) → Save as PDF, then upload the PDF here to send for signing." });
    } catch (err) {
      setMessage({ type: "error", text: "Failed to generate: " + err.message });
    }
  }

  // ── Send Document to Member ──────────────────────────────────
  function openSendDoc() {
    setSendTemplateId("");
    setSendTenantId("");
    setSendPdfFile(null);
    setSendPdfUrl(null);
    setSendSigConfig(DEFAULT_SIG_CONFIG);
    setShowSend(true);
  }

  function handleSendTemplateChange(tplId) {
    setSendTemplateId(tplId);
    const tpl = templates.find(t => t.id === tplId);
    if (tpl?.signature_config) setSendSigConfig(tpl.signature_config);
    if (tpl?.pdf_url) {
      const path = tpl.pdf_url.includes("/tenant-documents/") ? tpl.pdf_url.split("/tenant-documents/")[1].split("?")[0] : tpl.pdf_url;
      supabase.storage.from("tenant-documents").createSignedUrl(path, 3600).then(({ data }) => {
        setSendPdfUrl(data?.signedUrl || null);
      });
    }
  }

  function handleSendPdfUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSendPdfFile(file);
    setSendPdfUrl(URL.createObjectURL(file));
    setSendTemplateId(""); // custom upload, not from template
  }

  async function handleSendToMember() {
    if (!sendTenantId) { setMessage({ type: "error", text: "Select a member." }); return; }
    if (!sendPdfUrl && !sendPdfFile) { setMessage({ type: "error", text: "Upload a PDF or select a template." }); return; }

    setSending(true);
    setMessage(null);

    try {
      const tenant = tenants.find(t => t.id === sendTenantId);
      const tpl = templates.find(t => t.id === sendTemplateId);
      const ob = tenant?.onboarding_progress;

      // Build auto-fill values from member data
      const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" }) : "";
      const autoValues = {
        TENANT_NAME: tenant?.tenant_details?.full_name || "",
        ID_NUMBER: tenant?.tenant_details?.id_number || "",
        PHONE: tenant?.tenant_details?.phone || "",
        ROOM_CODE: tenant?.rooms?.unit_code || "",
        PROPERTY_NAME: tenant?.properties?.name || "",
        PROPERTY_ADDRESS: tenant?.properties?.address || "",
        MONTHLY_RENT: tenant?.monthly_rent ? `SGD ${Number(tenant.monthly_rent).toLocaleString()}` : "",
        DEPOSIT_AMOUNT: ob?.deposit_amount ? `SGD ${Number(ob.deposit_amount).toLocaleString()}` : "",
        LICENCE_PERIOD: ob?.licence_period || "",
        START_DATE: fmtDate(ob?.tenancy_start_date),
        END_DATE: fmtDate(ob?.tenancy_end_date),
        REF_NUMBER: ob?.ref_number || "",
        DATE: new Date().toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" }),
      };

      let pdfBlob;
      const tplFields = tpl?.text_fields || [];

      if (sendPdfFile) {
        // Custom upload — stamp text if template has text fields
        if (tplFields.length > 0) {
          const bytes = await sendPdfFile.arrayBuffer();
          const stamped = await stampPdf(bytes, tplFields, autoValues);
          pdfBlob = new Blob([stamped], { type: "application/pdf" });
        } else {
          pdfBlob = sendPdfFile;
        }
      } else if (tpl?.pdf_url) {
        // From template — fetch PDF, stamp text fields with member data
        const pdfBytes = await fetchPdfBytes(sendPdfUrl);
        if (tplFields.length > 0) {
          const stamped = await stampPdf(pdfBytes, tplFields, autoValues);
          pdfBlob = new Blob([stamped], { type: "application/pdf" });
        } else {
          pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
        }
      }

      // Upload stamped PDF
      if (!pdfBlob) {
        throw new Error("No PDF to upload. Please upload a PDF file or select a template with a PDF.");
      }
      const path = `tenants/${sendTenantId}/ta-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage.from("tenant-documents").upload(path, pdfBlob, { contentType: "application/pdf" });
      if (upErr) throw new Error("Upload failed: " + upErr.message);
      const { data: urlData } = supabase.storage.from("tenant-documents").getPublicUrl(path);
      const fileUrl = urlData.publicUrl;

      // Update onboarding_progress
      const onbId = ob?.id;
      if (onbId) {
        await supabase.from("onboarding_progress").update({
          ta_document_url: fileUrl,
          signature_positions: sendSigConfig,
          updated_at: new Date().toISOString(),
        }).eq("id", onbId);
      }

      // Create document record
      await supabase.from("tenant_documents").insert({
        tenant_profile_id: sendTenantId,
        doc_type: tpl?.doc_type || "LICENCE_AGREEMENT",
        title: tpl?.name || "Document",
        status: "SENT",
        file_url: fileUrl,
      });

      // Notify member that their TA is ready to sign
      try {
        await notifyMember(sendTenantId, "TA_READY", {});
      } catch (_) { /* non-blocking */ }

      setMessage({ type: "success", text: `Document generated and sent to ${tenant?.tenant_details?.full_name || "member"}.` });
      setShowSend(false);
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    }
    setSending(false);
  }

  return (
    <PortalLayout>
      <div className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a] tracking-tight">Documents</h1>
          <p className="text-[#6c7a77] font-['Manrope'] font-medium mt-1">Upload PDF templates, place signature boxes, and send to members.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowGenerate(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#006a61]">
            <span className="material-symbols-outlined text-[18px]">description</span>
            Generate Agreement
          </button>
          <button onClick={openSendDoc} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#eff4ff] text-[#006b5f] rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#e6eeff]">
            <span className="material-symbols-outlined text-[18px]">send</span>
            Send PDF to Member
          </button>
          <button onClick={openCreateEditor} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-[#6c7a77] border border-[#bbcac6]/30 rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#f8f9ff]">
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Template
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-6 px-4 py-3 rounded-xl text-sm font-['Manrope'] ${message.type === "error" ? "bg-[#ffdad6]/40 text-[#ba1a1a]" : "bg-[#d1fae5] text-[#065f46]"}`}>
          {message.text}
        </div>
      )}

      {/* ── Generate Agreement Modal ── */}
      {showGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowGenerate(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-8 pt-6 pb-4 border-b border-[#bbcac6]/15 flex items-center justify-between">
              <h2 className="font-['Plus_Jakarta_Sans'] text-xl font-bold">Generate Licence Agreement</h2>
              <button onClick={() => setShowGenerate(false)} className="text-[#6c7a77] hover:text-[#121c2a]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-8 space-y-5">
              <p className="text-sm text-[#555f6f] font-['Manrope']">
                Select a member — the agreement will be auto-filled with their details and opened in a new tab for you to review and save as PDF.
              </p>
              <div className="space-y-1.5">
                <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Member *</label>
                <select value={genTenantId} onChange={e => setGenTenantId(e.target.value)}
                  className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none">
                  <option value="">Select member</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.tenant_details?.full_name || t.username || "Unnamed"} — {t.rooms?.unit_code}
                    </option>
                  ))}
                </select>
              </div>

              {genTenantId && (() => {
                const t = tenants.find(x => x.id === genTenantId);
                const ob = t?.onboarding_progress;
                return (
                  <div className="bg-[#f8f9ff] rounded-xl p-4 text-xs font-['Manrope'] space-y-1">
                    <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-2">Will auto-fill</p>
                    <p><span className="text-[#6c7a77]">Name:</span> <strong>{t?.tenant_details?.full_name || "—"}</strong></p>
                    <p><span className="text-[#6c7a77]">Room:</span> <strong>{t?.rooms?.unit_code} — {t?.rooms?.name}</strong></p>
                    <p><span className="text-[#6c7a77]">Rent:</span> <strong>SGD {t?.monthly_rent || "—"}</strong> · <span className="text-[#6c7a77]">Deposit:</span> <strong>SGD {ob?.deposit_amount || "—"}</strong></p>
                    <p><span className="text-[#6c7a77]">Period:</span> <strong>{ob?.licence_period || "—"}</strong></p>
                    <p><span className="text-[#6c7a77]">Ref:</span> <strong>{ob?.ref_number || "—"}</strong></p>
                  </div>
                );
              })()}

              <div className="flex gap-3">
                <button onClick={() => setShowGenerate(false)}
                  className="flex-1 py-3 bg-[#eff4ff] text-[#555f6f] rounded-xl font-['Manrope'] font-bold text-sm">
                  Cancel
                </button>
                <button onClick={handleGenerate} disabled={!genTenantId}
                  className="flex-[2] py-3 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#006a61] disabled:opacity-40 flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                  Generate & Preview
                </button>
              </div>

              <p className="text-[10px] text-[#bbcac6] text-center">
                Opens in new tab → review → Cmd+P → Save as PDF → upload via "Send PDF to Member"
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Template Editor Modal ── */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowEditor(false)}>
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-8 pt-6 pb-4 border-b border-[#bbcac6]/15 flex items-center justify-between">
              <h2 className="font-['Plus_Jakarta_Sans'] text-xl font-bold">{editingTemplate ? `Edit: ${editingTemplate.name}` : "New Template"}</h2>
              <button onClick={() => setShowEditor(false)} className="text-[#6c7a77] hover:text-[#121c2a]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-8 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Template Name *</label>
                  <input type="text" value={editorName} onChange={e => setEditorName(e.target.value)}
                    className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Document Type</label>
                  <select value={editorDocType} onChange={e => setEditorDocType(e.target.value)}
                    className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none">
                    {DOC_TYPES.map(t => <option key={t} value={t}>{DOC_TYPE_LABELS[t] || t}</option>)}
                  </select>
                </div>
              </div>

              {/* PDF Upload */}
              <div className="space-y-1.5">
                <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">
                  Upload PDF Template
                </label>
                <p className="text-xs text-[#6c7a77] font-['Manrope']">
                  Create your document in Word or Pages, export as PDF, then upload here.
                </p>
                <input type="file" accept="application/pdf" onChange={handleEditorPdfSelect}
                  className="w-full text-sm text-[#555f6f] file:mr-3 file:px-4 file:py-2 file:rounded-xl file:border-0 file:bg-[#006b5f] file:text-white file:text-xs file:font-bold file:cursor-pointer" />
              </div>

              {/* Place text fields + signatures on PDF */}
              {editorPdfUrl && (
                <PdfFieldPlacer
                  pdfUrl={editorPdfUrl}
                  fields={textFields}
                  signatures={sigConfig}
                  onFieldsChange={setTextFields}
                  onSignaturesChange={setSigConfig}
                />
              )}

              <div className="flex gap-3 pt-4 border-t border-[#bbcac6]/15">
                <button onClick={() => setShowEditor(false)} className="flex-1 py-3 bg-[#eff4ff] text-[#555f6f] rounded-xl font-['Manrope'] font-bold text-sm">Cancel</button>
                <button onClick={handleSaveTemplate} disabled={saving}
                  className="flex-[2] py-3 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#006a61] disabled:opacity-40">
                  {saving ? "Saving..." : "Save Template"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Send Document Modal ── */}
      {showSend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowSend(false)}>
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-8 pt-6 pb-4 border-b border-[#bbcac6]/15 flex items-center justify-between">
              <h2 className="font-['Plus_Jakarta_Sans'] text-xl font-bold">Send Document to Member</h2>
              <button onClick={() => setShowSend(false)} className="text-[#6c7a77] hover:text-[#121c2a]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-8 space-y-5">
              {/* Select member */}
              <div className="space-y-1.5">
                <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Member *</label>
                <select value={sendTenantId} onChange={e => setSendTenantId(e.target.value)}
                  className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none">
                  <option value="">Select member</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.tenant_details?.full_name || t.username || "Unnamed"} — {t.rooms?.unit_code}
                    </option>
                  ))}
                </select>
              </div>

              {/* Choose: template or upload */}
              <div className="space-y-1.5">
                <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Document Source</label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-[#121c2a]">From Template</p>
                    <select value={sendTemplateId} onChange={e => handleSendTemplateChange(e.target.value)}
                      className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none">
                      <option value="">Select template</option>
                      {templates.filter(t => t.is_active && t.pdf_url).map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-[#121c2a]">Or Upload PDF</p>
                    <input type="file" accept="application/pdf" onChange={handleSendPdfUpload}
                      className="w-full text-sm text-[#555f6f] file:mr-3 file:px-3 file:py-2 file:rounded-xl file:border-0 file:bg-[#eff4ff] file:text-[#006b5f] file:text-xs file:font-bold" />
                  </div>
                </div>
              </div>

              {/* Preview + field placement */}
              {sendPdfUrl && (
                <div className="space-y-2">
                  <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#006b5f] font-bold">
                    Preview — data fields will be auto-filled from member profile
                  </p>
                  <PdfFieldPlacer
                    pdfUrl={sendPdfUrl}
                    fields={templates.find(t => t.id === sendTemplateId)?.text_fields || []}
                    signatures={sendSigConfig}
                    onFieldsChange={() => {}}
                    onSignaturesChange={setSendSigConfig}
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-[#bbcac6]/15">
                <button onClick={() => setShowSend(false)} className="flex-1 py-3 bg-[#eff4ff] text-[#555f6f] rounded-xl font-['Manrope'] font-bold text-sm">Cancel</button>
                <button onClick={handleSendToMember} disabled={sending || !sendTenantId || (!sendPdfUrl)}
                  className="flex-[2] py-3 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#006a61] disabled:opacity-40 flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">{sending ? "progress_activity" : "send"}</span>
                  {sending ? "Sending..." : "Send to Member"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Templates List ── */}
      <section className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm">
        <div className="px-8 py-6 border-b border-[#bbcac6]/15 flex items-center justify-between">
          <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#121c2a] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006b5f] text-[20px]">description</span>
            Templates
          </h2>
          <span className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">
            {templates.length} template{templates.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-14 bg-[#eff4ff] animate-pulse rounded-xl" />)}
          </div>
        ) : templates.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-[#bbcac6] mb-3 block">description</span>
            <p className="text-sm text-[#6c7a77]">No templates yet. Upload a PDF to create your first template.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#bbcac6]/10">
            {templates.map(tpl => (
              <div key={tpl.id} className="px-8 py-5 flex items-center justify-between hover:bg-[#f8f9ff] transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#eff4ff] flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#006b5f] text-[20px]">
                      {tpl.pdf_url ? "picture_as_pdf" : "code"}
                    </span>
                  </div>
                  <div>
                    <p className="font-['Manrope'] font-bold text-sm text-[#121c2a]">{tpl.name}</p>
                    <p className="font-['Inter'] text-xs text-[#6c7a77]">
                      {DOC_TYPE_LABELS[tpl.doc_type] || tpl.doc_type}
                      {tpl.pdf_url ? " — PDF" : " — HTML (legacy)"}
                      {!tpl.is_active && " — Inactive"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEditTemplate(tpl)}
                    className="p-2 rounded-lg hover:bg-[#eff4ff] text-[#6c7a77] hover:text-[#006b5f] transition-colors">
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                  <button onClick={async () => {
                    await supabase.from("document_templates").update({ is_active: !tpl.is_active }).eq("id", tpl.id);
                    fetchData();
                  }} className={`p-2 rounded-lg transition-colors ${tpl.is_active ? "hover:bg-red-50 text-[#6c7a77] hover:text-red-600" : "hover:bg-green-50 text-[#6c7a77] hover:text-green-600"}`}>
                    <span className="material-symbols-outlined text-[18px]">{tpl.is_active ? "visibility_off" : "visibility"}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </PortalLayout>
  );
}
