import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import DraggableSignaturePlacer from "../../components/portal/DraggableSignaturePlacer";

const DOC_TYPES = ["LICENCE_AGREEMENT", "NOTICE_OF_TERMINATION", "MOVE_IN_CHECKLIST", "MOVE_OUT_CHECKLIST", "HOUSE_RULES", "OTHER"];
const DOC_TYPE_LABELS = { LICENCE_AGREEMENT: "Licence Agreement", NOTICE_OF_TERMINATION: "Notice of Termination", MOVE_IN_CHECKLIST: "Move-in Checklist", MOVE_OUT_CHECKLIST: "Move-out Checklist", HOUSE_RULES: "House Rules", OTHER: "Other" };

const DEFAULT_SIG_CONFIG = {
  tenant: { page: 1, x: 50, y: 120, width: 200, height: 80, label: "Member Signature" },
  admin: { page: 1, x: 350, y: 120, width: 200, height: 80, label: "Licensor Signature" },
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
      supabase.from("tenant_profiles").select("id, role, username, rooms(unit_code, name), tenant_details(full_name), onboarding_progress(id)")
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
    setShowEditor(true);
  }

  function openEditTemplate(tpl) {
    setEditingTemplate(tpl);
    setEditorName(tpl.name);
    setEditorDocType(tpl.doc_type);
    setEditorPdfFile(null);
    setSigConfig(tpl.signature_config ?? DEFAULT_SIG_CONFIG);
    // Load existing PDF URL
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
      let fileUrl;

      if (sendPdfFile) {
        // Upload the custom PDF
        const path = `tenants/${sendTenantId}/ta-${Date.now()}.pdf`;
        const { error: upErr } = await supabase.storage.from("tenant-documents").upload(path, sendPdfFile, { contentType: "application/pdf" });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("tenant-documents").getPublicUrl(path);
        fileUrl = urlData.publicUrl;
      } else {
        // Use template PDF URL directly (copy it to tenant's folder)
        const tpl = templates.find(t => t.id === sendTemplateId);
        fileUrl = tpl?.pdf_url;
      }

      // Update onboarding_progress
      const onbId = tenant?.onboarding_progress?.id;
      if (onbId) {
        await supabase.from("onboarding_progress").update({
          ta_document_url: fileUrl,
          signature_positions: sendSigConfig,
          updated_at: new Date().toISOString(),
        }).eq("id", onbId);
      }

      // Create document record
      const tpl = templates.find(t => t.id === sendTemplateId);
      await supabase.from("tenant_documents").insert({
        tenant_profile_id: sendTenantId,
        doc_type: tpl?.doc_type || "LICENCE_AGREEMENT",
        title: tpl?.name || "Document",
        status: "SENT",
        file_url: fileUrl,
      });

      setMessage({ type: "success", text: `Document sent to ${tenant?.tenant_details?.full_name || "member"}.` });
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
        <div className="flex gap-2">
          <button onClick={openCreateEditor} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#eff4ff] text-[#006b5f] rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#e6eeff]">
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Template
          </button>
          <button onClick={openSendDoc} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#006a61]">
            <span className="material-symbols-outlined text-[18px]">send</span>
            Send to Member
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-6 px-4 py-3 rounded-xl text-sm font-['Manrope'] ${message.type === "error" ? "bg-[#ffdad6]/40 text-[#ba1a1a]" : "bg-[#d1fae5] text-[#065f46]"}`}>
          {message.text}
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

              {/* Signature Placement on PDF */}
              {editorPdfUrl && (
                <div className="space-y-2">
                  <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#006b5f] font-bold">
                    Drag signature boxes to position them
                  </p>
                  <DraggableSignaturePlacer pdfUrl={editorPdfUrl} value={sigConfig} onChange={setSigConfig} />
                </div>
              )}

              {/* Signature labels */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "tenant", label: "Member Signature", accent: "#3b82f6" },
                  { key: "admin", label: "Licensor Signature", accent: "#006b5f" },
                ].map(({ key, label, accent }) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm border-2 shrink-0" style={{ borderColor: accent, backgroundColor: `${accent}15` }} />
                    <input type="text" value={sigConfig[key]?.label ?? label}
                      onChange={e => setSigConfig(prev => ({ ...prev, [key]: { ...prev[key], label: e.target.value } }))}
                      className="flex-1 bg-[#eff4ff] border-0 rounded-lg px-3 py-1.5 text-sm font-['Manrope'] focus:ring-2 focus:ring-[#14b8a6] outline-none" />
                  </div>
                ))}
              </div>

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

              {/* Preview + signature placement */}
              {sendPdfUrl && (
                <div className="space-y-2">
                  <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#006b5f] font-bold">
                    Preview — adjust signature positions if needed
                  </p>
                  <DraggableSignaturePlacer pdfUrl={sendPdfUrl} value={sendSigConfig} onChange={setSendSigConfig} />
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
