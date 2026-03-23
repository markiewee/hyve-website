import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";

const DOC_TYPES = [
  "LICENCE_AGREEMENT",
  "MOVE_IN_CHECKLIST",
  "MOVE_OUT_CHECKLIST",
  "HOUSE_RULES",
  "OTHER",
];

const AVAILABLE_PLACEHOLDERS = [
  "TENANT_NAME",
  "ID_NUMBER",
  "PHONE",
  "EMAIL",
  "ROOM_CODE",
  "ROOM_NAME",
  "PROPERTY_NAME",
  "PROPERTY_ADDRESS",
  "COMMON_AREAS",
  "REF_NUMBER",
  "MONTHLY_RENT",
  "DEPOSIT_AMOUNT",
  "LICENCE_PERIOD",
  "START_DATE",
  "END_DATE",
  "DATE",
];

const AUTO_FILL_KEYS = new Set([
  "TENANT_NAME",
  "ID_NUMBER",
  "PHONE",
  "ROOM_CODE",
  "ROOM_NAME",
  "PROPERTY_NAME",
  "MONTHLY_RENT",
  "DEPOSIT_AMOUNT",
  "DATE",
]);

// Placeholders that always need manual input
const MANUAL_KEYS = ["LICENCE_PERIOD", "START_DATE", "END_DATE"];
// EMAIL is not auto-fillable client-side (no auth.users access), so always manual
const ALWAYS_MANUAL_KEYS = new Set([...MANUAL_KEYS, "EMAIL"]);

function autoFillFromTenant(tenant) {
  return {
    TENANT_NAME: tenant.tenant_details?.full_name || "",
    ID_NUMBER: tenant.tenant_details?.id_number || "",
    PHONE: tenant.tenant_details?.phone || "",
    EMAIL: "",
    ROOM_CODE: tenant.rooms?.unit_code || "",
    ROOM_NAME: tenant.rooms?.name || "",
    PROPERTY_NAME: tenant.properties?.name || "",
    MONTHLY_RENT: tenant.monthly_rent?.toString() || "",
    DEPOSIT_AMOUNT:
      tenant.onboarding_progress?.deposit_amount?.toString() || "",
    DATE: new Date().toLocaleDateString("en-SG", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  };
}

function extractPlaceholders(html) {
  const matches = html.matchAll(/\{\{([A-Z_]+)\}\}/g);
  return [...new Set([...matches].map((m) => m[1]))];
}

function fillTemplate(html, values) {
  let filled = html;
  for (const [key, val] of Object.entries(values)) {
    filled = filled.replaceAll(`{{${key}}}`, val || `{{${key}}}`);
  }
  return filled;
}

const DOC_TYPE_COLORS = {
  LICENCE_AGREEMENT: "bg-blue-100 text-blue-700",
  MOVE_IN_CHECKLIST: "bg-[#eff4ff] text-[#006b5f]",
  MOVE_OUT_CHECKLIST: "bg-[#ffdad6]/50 text-[#ba1a1a]",
  HOUSE_RULES: "bg-amber-100 text-amber-700",
  OTHER: "bg-[#e6eeff] text-[#555f6f]",
};

export default function AdminDocumentsPage() {
  // ── Templates ───────────────────────────────────────────────
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  // ── Editor ──────────────────────────────────────────────────
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null); // null = create new
  const [editorName, setEditorName] = useState("");
  const [editorDocType, setEditorDocType] = useState(DOC_TYPES[0]);
  const [editorHtml, setEditorHtml] = useState("");
  const [showEditorPreview, setShowEditorPreview] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorMessage, setEditorMessage] = useState(null);
  const htmlTextareaRef = useRef(null);

  // ── Signature config ─────────────────────────────────────────
  const DEFAULT_SIG_CONFIG = {
    tenant: { page: "last", x: 50, y: 120, width: 200, height: 80, label: "Tenant Signature" },
    admin: { page: "last", x: 350, y: 120, width: 200, height: 80, label: "Licensor Signature" },
  };
  const [sigConfig, setSigConfig] = useState(DEFAULT_SIG_CONFIG);

  // ── Generate & Send ─────────────────────────────────────────
  const [tenants, setTenants] = useState([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [fieldValues, setFieldValues] = useState({});
  const [filledHtml, setFilledHtml] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genMessage, setGenMessage] = useState(null);

  // ── Fetch templates ─────────────────────────────────────────
  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    const { data } = await supabase
      .from("document_templates")
      .select("*")
      .order("created_at", { ascending: false });
    setTemplates(data ?? []);
    setTemplatesLoading(false);
  }, []);

  // ── Fetch tenants ────────────────────────────────────────────
  const fetchTenants = useCallback(async () => {
    setTenantsLoading(true);
    const { data } = await supabase
      .from("tenant_profiles")
      .select(
        `id, monthly_rent, rooms(unit_code, name), properties(name), tenant_details(full_name, id_number, phone), onboarding_progress(deposit_amount)`
      )
      .eq("role", "TENANT");
    setTenants(data ?? []);
    setTenantsLoading(false);
  }, []);

  useEffect(() => {
    fetchTemplates();
    fetchTenants();

    // Suppress oklch CSS parse warnings from html2pdf/html2canvas
    const origConsoleError = console.error;
    console.error = (...args) => {
      if (typeof args[0] === "string" && args[0].includes("oklch")) return;
      origConsoleError.apply(console, args);
    };
    return () => {
      console.error = origConsoleError;
    };
  }, [fetchTemplates, fetchTenants]);

  // ── Editor helpers ───────────────────────────────────────────
  function openCreateEditor() {
    setEditingTemplate(null);
    setEditorName("");
    setEditorDocType(DOC_TYPES[0]);
    setEditorHtml("");
    setSigConfig(DEFAULT_SIG_CONFIG);
    setShowEditorPreview(false);
    setEditorMessage(null);
    setShowEditor(true);
  }

  function openEditEditor(tpl) {
    setEditingTemplate(tpl);
    setEditorName(tpl.name);
    setEditorDocType(tpl.doc_type);
    setEditorHtml(tpl.html_content || "");
    setSigConfig(tpl.signature_config ?? DEFAULT_SIG_CONFIG);
    setShowEditorPreview(false);
    setEditorMessage(null);
    setShowEditor(true);
  }

  function insertPlaceholderAtCursor(placeholder) {
    const el = htmlTextareaRef.current;
    if (!el) {
      setEditorHtml((prev) => prev + `{{${placeholder}}}`);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = editorHtml;
    const inserted = `{{${placeholder}}}`;
    const next = text.slice(0, start) + inserted + text.slice(end);
    setEditorHtml(next);
    // Restore cursor after inserted text
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + inserted.length, start + inserted.length);
    });
  }

  async function handleSaveTemplate() {
    if (!editorName.trim()) {
      setEditorMessage({ type: "error", text: "Template name is required." });
      return;
    }
    if (!editorHtml.trim()) {
      setEditorMessage({ type: "error", text: "HTML content is required." });
      return;
    }

    setEditorSaving(true);
    setEditorMessage(null);

    const placeholders = extractPlaceholders(editorHtml);

    const payload = {
      name: editorName.trim(),
      doc_type: editorDocType,
      html_content: editorHtml,
      placeholders,
      signature_config: sigConfig,
      is_active: true,
    };

    let error;
    if (editingTemplate) {
      ({ error } = await supabase
        .from("document_templates")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", editingTemplate.id));
    } else {
      ({ error } = await supabase.from("document_templates").insert(payload));
    }

    if (error) {
      setEditorMessage({ type: "error", text: "Save failed: " + error.message });
    } else {
      setEditorMessage({
        type: "success",
        text: editingTemplate ? "Template updated." : "Template created.",
      });
      await fetchTemplates();
      if (!editingTemplate) {
        // Reset for next create
        setEditorName("");
        setEditorHtml("");
        setEditorDocType(DOC_TYPES[0]);
      }
    }
    setEditorSaving(false);
  }

  async function handleToggleActive(tpl) {
    await supabase
      .from("document_templates")
      .update({ is_active: !tpl.is_active })
      .eq("id", tpl.id);
    await fetchTemplates();
  }

  // ── Generate & Send helpers ───────────────────────────────────
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const selectedTenant = tenants.find((t) => t.id === selectedTenantId);

  // When template or tenant changes, rebuild fieldValues
  useEffect(() => {
    if (!selectedTemplate) {
      setFieldValues({});
      setFilledHtml("");
      return;
    }

    const placeholders = extractPlaceholders(selectedTemplate.html_content || "");
    const autoFilled = selectedTenant ? autoFillFromTenant(selectedTenant) : {};

    const newValues = {};
    for (const ph of placeholders) {
      if (AUTO_FILL_KEYS.has(ph) && !ALWAYS_MANUAL_KEYS.has(ph) && autoFilled[ph]) {
        newValues[ph] = autoFilled[ph];
      } else if (ph === "DATE") {
        newValues[ph] =
          autoFilled[ph] ||
          new Date().toLocaleDateString("en-SG", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });
      } else {
        // Keep existing manual value or empty
        newValues[ph] = fieldValues[ph] || "";
      }
    }
    setFieldValues(newValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId, selectedTenantId]);

  function handleFieldChange(key, value) {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  }

  function handlePreviewDoc() {
    if (!selectedTemplate) return;
    setFilledHtml(fillTemplate(selectedTemplate.html_content || "", fieldValues));
  }

  async function handleGenerateAndSend() {
    if (!selectedTemplate || !selectedTenant) {
      setGenMessage({ type: "error", text: "Select a template and a tenant first." });
      return;
    }

    setGenerating(true);
    setGenMessage(null);

    // Re-render filled HTML
    const html = fillTemplate(selectedTemplate.html_content || "", fieldValues);
    setFilledHtml(html);

    // Small delay to let React update the DOM
    await new Promise((r) => setTimeout(r, 100));

    try {
      // 1. Generate PDF blob via html2pdf
      // Clone the preview into an isolated container to avoid oklch CSS errors
      const source = document.getElementById("doc-preview");
      if (!source)
        throw new Error(
          "Preview element not found. Click Render Preview first."
        );

      // Lazy-load html2pdf to avoid oklch CSS parsing errors on page load
      const html2pdfModule = await import("html2pdf.js");
      const html2pdf = html2pdfModule.default;

      const isolated = document.createElement("div");
      isolated.style.cssText =
        "position:fixed;top:-9999px;left:-9999px;width:700px;background:white;color:black;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;padding:40px;";
      isolated.innerHTML = source.innerHTML;
      document.body.appendChild(isolated);

      const opt = {
        margin: 10,
        filename: "document.pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      };
      const pdfBlob = await html2pdf().set(opt).from(isolated).outputPdf("blob");
      document.body.removeChild(isolated);

      // 2. Upload to Supabase Storage
      const tpId = selectedTenant.id;
      const ts = Date.now();
      const storagePath = `tenants/${tpId}/ta-generated-${ts}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("tenant-documents")
        .upload(storagePath, pdfBlob, {
          contentType: "application/pdf",
          upsert: false,
        });
      if (uploadError) throw new Error("Upload failed: " + uploadError.message);

      const { data: urlData } = supabase.storage
        .from("tenant-documents")
        .getPublicUrl(storagePath);
      const fileUrl = urlData.publicUrl;

      // 3. Update onboarding_progress.ta_document_url
      const { data: opData } = await supabase
        .from("onboarding_progress")
        .select("id")
        .eq("tenant_profile_id", tpId)
        .maybeSingle();

      if (opData?.id) {
        await supabase
          .from("onboarding_progress")
          .update({
            ta_document_url: fileUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("id", opData.id);
      }

      // 4. Insert into tenant_documents
      const { error: docError } = await supabase
        .from("tenant_documents")
        .insert({
          tenant_profile_id: tpId,
          doc_type: selectedTemplate.doc_type,
          title: selectedTemplate.name,
          status: "SENT",
          file_url: fileUrl,
        });
      if (docError)
        throw new Error("Failed to save document record: " + docError.message);

      setGenMessage({
        type: "success",
        text: "Document generated and sent to tenant for signing.",
      });
    } catch (err) {
      setGenMessage({ type: "error", text: err.message });
    }

    setGenerating(false);
  }

  // Determine which placeholders need manual input in the Generate section
  const templatePlaceholders = selectedTemplate
    ? extractPlaceholders(selectedTemplate.html_content || "")
    : [];

  const manualPlaceholders = templatePlaceholders.filter(
    (ph) =>
      ALWAYS_MANUAL_KEYS.has(ph) ||
      !AUTO_FILL_KEYS.has(ph) ||
      (selectedTenant && !autoFillFromTenant(selectedTenant)[ph])
  );

  const autoFilledDisplay = templatePlaceholders.filter(
    (ph) =>
      !ALWAYS_MANUAL_KEYS.has(ph) &&
      AUTO_FILL_KEYS.has(ph) &&
      selectedTenant &&
      autoFillFromTenant(selectedTenant)[ph]
  );

  return (
    <PortalLayout>
      {/* Page header */}
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a] tracking-tight">
            Document Templates
          </h1>
          <p className="text-[#6c7a77] font-['Manrope'] font-medium mt-1">
            Manage templates, auto-fill from tenant data, and generate PDFs.
          </p>
        </div>
        <button
          onClick={showEditor ? () => setShowEditor(false) : openCreateEditor}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-['Manrope'] font-bold text-sm transition-colors ${
            showEditor
              ? "bg-[#eff4ff] text-[#555f6f] hover:bg-[#e6eeff]"
              : "bg-[#006b5f] text-white hover:bg-[#006a61]"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {showEditor ? "close" : "add"}
          </span>
          {showEditor ? "Close Editor" : "Create Template"}
        </button>
      </div>

      {/* ── Section A: Template List ── */}
      <section className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm overflow-hidden mb-8">
        <div className="px-8 py-5 border-b border-[#bbcac6]/10 flex items-center justify-between">
          <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a]">
            All Templates
          </h2>
          {!templatesLoading && (
            <span className="font-['Inter'] text-xs font-bold bg-[#eff4ff] text-[#006b5f] px-2.5 py-1 rounded-lg">
              {templates.length} templates
            </span>
          )}
        </div>

        {templatesLoading ? (
          <div className="divide-y divide-[#bbcac6]/10">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-8 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#eff4ff] animate-pulse rounded-xl" />
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-[#eff4ff] animate-pulse rounded" />
                    <div className="h-3 w-20 bg-[#eff4ff] animate-pulse rounded" />
                  </div>
                </div>
                <div className="h-6 w-20 bg-[#eff4ff] animate-pulse rounded-full" />
              </div>
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="px-8 py-12 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#eff4ff] flex items-center justify-center">
              <span className="material-symbols-outlined text-[#006b5f] text-[28px]">
                description
              </span>
            </div>
            <p className="font-['Manrope'] text-sm text-[#555f6f]">
              No templates yet. Create one above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#eff4ff]">
                <tr>
                  <th className="text-left px-8 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">
                    Template
                  </th>
                  <th className="text-left px-6 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold hidden sm:table-cell">
                    Type
                  </th>
                  <th className="text-left px-6 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold hidden md:table-cell">
                    Fields
                  </th>
                  <th className="text-left px-6 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">
                    Status
                  </th>
                  <th className="text-left px-6 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#bbcac6]/10">
                {templates.map((tpl) => {
                  const typeColor =
                    DOC_TYPE_COLORS[tpl.doc_type] ?? "bg-[#e6eeff] text-[#555f6f]";
                  return (
                    <tr
                      key={tpl.id}
                      className="hover:bg-[#f8f9ff] transition-colors"
                    >
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#eff4ff] flex items-center justify-center shrink-0">
                            <span
                              className="material-symbols-outlined text-[#006b5f] text-[18px]"
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                              description
                            </span>
                          </div>
                          <span className="font-['Manrope'] font-semibold text-sm text-[#121c2a]">
                            {tpl.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 hidden sm:table-cell">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${typeColor}`}
                        >
                          {tpl.doc_type?.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-6 py-5 hidden md:table-cell">
                        <span className="font-['Inter'] text-sm font-bold text-[#121c2a]">
                          {tpl.placeholders?.length ?? 0}
                        </span>
                        <span className="font-['Manrope'] text-xs text-[#6c7a77] ml-1">
                          placeholders
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                            tpl.is_active
                              ? "bg-[#eff4ff] text-[#006b5f]"
                              : "bg-[#e6eeff] text-[#555f6f]"
                          }`}
                        >
                          {tpl.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditEditor(tpl)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#eff4ff] text-[#006b5f] text-xs font-['Manrope'] font-bold hover:bg-[#e6eeff] transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              edit
                            </span>
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleActive(tpl)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-['Manrope'] font-bold transition-colors ${
                              tpl.is_active
                                ? "bg-[#ffdad6]/40 text-[#ba1a1a] hover:bg-[#ffdad6]/60"
                                : "bg-[#eff4ff] text-[#555f6f] hover:bg-[#e6eeff]"
                            }`}
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {tpl.is_active ? "toggle_off" : "toggle_on"}
                            </span>
                            {tpl.is_active ? "Deactivate" : "Activate"}
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
      </section>

      {/* ── Section B: Template Editor ── */}
      {showEditor && (
        <section className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm p-8 mb-8">
          <div className="flex items-center justify-between mb-6 pb-6 border-b border-[#bbcac6]/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#006b5f]/10 flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-[#006b5f] text-[20px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {editingTemplate ? "edit" : "add_circle"}
                </span>
              </div>
              <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a]">
                {editingTemplate ? `Edit: ${editingTemplate.name}` : "New Template"}
              </h2>
            </div>
          </div>

          {/* Editor message */}
          {editorMessage && (
            <div
              className={`mb-6 px-4 py-3 rounded-xl text-sm font-['Manrope'] ${
                editorMessage.type === "error"
                  ? "bg-[#ffdad6]/40 text-[#ba1a1a] border border-[#ba1a1a]/15"
                  : "bg-[#eff4ff] text-[#006b5f] border border-[#006b5f]/15"
              }`}
            >
              {editorMessage.text}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            <div className="space-y-2">
              <label className="font-['Inter'] text-xs font-bold uppercase tracking-widest text-[#6c7a77]">
                Template Name
              </label>
              <input
                type="text"
                value={editorName}
                onChange={(e) => setEditorName(e.target.value)}
                placeholder="e.g. Standard Licence Agreement"
                className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="font-['Inter'] text-xs font-bold uppercase tracking-widest text-[#6c7a77]">
                Document Type
              </label>
              <select
                value={editorDocType}
                onChange={(e) => setEditorDocType(e.target.value)}
                className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
              >
                {DOC_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Placeholder chips */}
          <div className="mb-6 space-y-3">
            <p className="font-['Inter'] text-xs font-bold uppercase tracking-widest text-[#6c7a77]">
              Available Placeholders{" "}
              <span className="text-[#bbcac6] font-normal normal-case tracking-normal">
                — click to insert at cursor
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_PLACEHOLDERS.map((ph) => (
                <button
                  key={ph}
                  type="button"
                  onClick={() => insertPlaceholderAtCursor(ph)}
                  className="px-2.5 py-1 rounded-lg bg-[#eff4ff] text-[#006b5f] text-xs font-mono font-bold hover:bg-[#006b5f] hover:text-white transition-colors"
                >
                  {`{{${ph}}}`}
                </button>
              ))}
            </div>
          </div>

          {/* HTML Textarea */}
          <div className="mb-6 space-y-2">
            <label className="font-['Inter'] text-xs font-bold uppercase tracking-widest text-[#6c7a77]">
              HTML Content
            </label>
            <textarea
              ref={htmlTextareaRef}
              value={editorHtml}
              onChange={(e) => setEditorHtml(e.target.value)}
              rows={20}
              placeholder="<h1>Licence Agreement</h1><p>This agreement is made between {{TENANT_NAME}}...</p>"
              className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-mono text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none resize-y"
              spellCheck={false}
            />
          </div>

          {/* Signature Placement */}
          <div className="mb-6 space-y-4">
            <div>
              <p className="font-['Inter'] text-xs font-bold uppercase tracking-widest text-[#6c7a77]">
                Signature Placement
              </p>
              <p className="font-['Manrope'] text-xs text-[#6c7a77] mt-1">
                Configure where signatures are stamped on the PDF (coordinates in PDF points from bottom-left).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tenant signature config */}
              {[
                { key: "tenant", label: "Tenant Signature", accentColor: "#3b82f6", bgColor: "#eff6ff" },
                { key: "admin", label: "Licensor Signature", accentColor: "#006b5f", bgColor: "#eff4ff" },
              ].map(({ key, label, accentColor, bgColor }) => (
                <div
                  key={key}
                  className="p-5 rounded-2xl border"
                  style={{ borderColor: `${accentColor}22`, backgroundColor: bgColor }}
                >
                  <p
                    className="font-['Inter'] text-[10px] font-bold uppercase tracking-widest mb-4"
                    style={{ color: accentColor }}
                  >
                    {label}
                  </p>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">
                        Label
                      </label>
                      <input
                        type="text"
                        value={sigConfig[key]?.label ?? label}
                        onChange={(e) =>
                          setSigConfig((prev) => ({
                            ...prev,
                            [key]: { ...prev[key], label: e.target.value },
                          }))
                        }
                        className="w-full bg-white border-0 rounded-xl px-3 py-2.5 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">
                        Page
                      </label>
                      <select
                        value={sigConfig[key]?.page ?? "last"}
                        onChange={(e) =>
                          setSigConfig((prev) => ({
                            ...prev,
                            [key]: { ...prev[key], page: e.target.value },
                          }))
                        }
                        className="w-full bg-white border-0 rounded-xl px-3 py-2.5 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
                      >
                        <option value="last">Last Page</option>
                        <option value="first">First Page</option>
                        <option value="1">Page 1</option>
                        <option value="2">Page 2</option>
                        <option value="3">Page 3</option>
                        <option value="4">Page 4</option>
                        <option value="5">Page 5</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { field: "x", label: "X (left)", max: 600 },
                        { field: "y", label: "Y (bottom)", max: 800 },
                        { field: "width", label: "Width", max: 600 },
                        { field: "height", label: "Height", max: 400 },
                      ].map(({ field, label: fieldLabel, max }) => (
                        <div key={field} className="space-y-1.5">
                          <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">
                            {fieldLabel}
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={max}
                            value={sigConfig[key]?.[field] ?? 0}
                            onChange={(e) =>
                              setSigConfig((prev) => ({
                                ...prev,
                                [key]: {
                                  ...prev[key],
                                  [field]: Number(e.target.value),
                                },
                              }))
                            }
                            className="w-full bg-white border-0 rounded-xl px-3 py-2.5 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Visual preview */}
            <div className="space-y-2">
              <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">
                Position Preview{" "}
                <span className="text-[#bbcac6] font-normal normal-case tracking-normal">
                  — A4 page (595 × 842 pt), showing last page placement
                </span>
              </p>
              {/* Scale: A4 = 595x842pt rendered as 238x337px (scale=0.4) */}
              <div className="relative" style={{ width: 238, height: 337 }}>
                {/* A4 outline */}
                <div
                  className="absolute inset-0 border-2 border-[#bbcac6]/50 rounded bg-white shadow-sm"
                  style={{ overflow: "hidden" }}
                >
                  {/* Page label */}
                  <div className="absolute bottom-1 right-2 font-['Inter'] text-[8px] text-[#bbcac6]">
                    A4 — 595 × 842 pt
                  </div>
                  {/* Tenant signature box (blue) — y is from bottom in PDF; flip for CSS */}
                  {(() => {
                    const sc = 0.4;
                    const tc = sigConfig.tenant;
                    const cssTop = 337 - (tc.y + tc.height) * sc;
                    const cssLeft = tc.x * sc;
                    const cssW = tc.width * sc;
                    const cssH = tc.height * sc;
                    return (
                      <div
                        className="absolute flex items-center justify-center"
                        style={{
                          top: cssTop,
                          left: cssLeft,
                          width: cssW,
                          height: cssH,
                          backgroundColor: "rgba(59,130,246,0.15)",
                          border: "1.5px solid #3b82f6",
                          borderRadius: 3,
                        }}
                      >
                        <span className="font-['Inter'] text-[7px] text-[#3b82f6] font-bold leading-tight text-center px-0.5">
                          {sigConfig.tenant.label || "Tenant"}
                        </span>
                      </div>
                    );
                  })()}
                  {/* Admin signature box (green) */}
                  {(() => {
                    const sc = 0.4;
                    const ac = sigConfig.admin;
                    const cssTop = 337 - (ac.y + ac.height) * sc;
                    const cssLeft = ac.x * sc;
                    const cssW = ac.width * sc;
                    const cssH = ac.height * sc;
                    return (
                      <div
                        className="absolute flex items-center justify-center"
                        style={{
                          top: cssTop,
                          left: cssLeft,
                          width: cssW,
                          height: cssH,
                          backgroundColor: "rgba(0,107,95,0.12)",
                          border: "1.5px solid #006b5f",
                          borderRadius: 3,
                        }}
                      >
                        <span className="font-['Inter'] text-[7px] text-[#006b5f] font-bold leading-tight text-center px-0.5">
                          {sigConfig.admin.label || "Licensor"}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 font-['Inter'] text-[10px] text-[#555f6f]">
                  <span className="w-3 h-3 rounded-sm border-2 border-[#3b82f6] bg-[#3b82f6]/15 inline-block" />
                  Tenant
                </span>
                <span className="flex items-center gap-1.5 font-['Inter'] text-[10px] text-[#555f6f]">
                  <span className="w-3 h-3 rounded-sm border-2 border-[#006b5f] bg-[#006b5f]/12 inline-block" />
                  Licensor
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleSaveTemplate}
              disabled={editorSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#006a61] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">
                {editorSaving ? "progress_activity" : "save"}
              </span>
              {editorSaving
                ? "Saving…"
                : editingTemplate
                ? "Update Template"
                : "Save Template"}
            </button>
            <button
              onClick={() => setShowEditorPreview((p) => !p)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#eff4ff] text-[#555f6f] rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#e6eeff] transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">
                {showEditorPreview ? "visibility_off" : "visibility"}
              </span>
              {showEditorPreview ? "Hide Preview" : "Preview"}
            </button>
          </div>

          {/* Editor inline preview */}
          {showEditorPreview && editorHtml && (
            <div className="mt-6 space-y-2">
              <p className="font-['Inter'] text-xs font-bold uppercase tracking-widest text-[#6c7a77]">
                Preview
              </p>
              <div
                className="border border-[#bbcac6]/15 rounded-2xl p-8 bg-white text-black text-sm leading-relaxed overflow-auto max-h-[500px]"
                dangerouslySetInnerHTML={{ __html: editorHtml }}
              />
            </div>
          )}
        </section>
      )}

      {/* ── Section C: Generate & Send ── */}
      <section className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm p-8">
        <div className="flex items-center gap-3 mb-8 pb-6 border-b border-[#bbcac6]/10">
          <div className="w-10 h-10 rounded-xl bg-[#14b8a6]/10 flex items-center justify-center">
            <span
              className="material-symbols-outlined text-[#006b5f] text-[20px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              send
            </span>
          </div>
          <div>
            <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a]">
              Generate Document
            </h2>
            <p className="font-['Manrope'] text-xs text-[#555f6f] mt-0.5">
              Fill template fields and generate a PDF for a tenant.
            </p>
          </div>
        </div>

        {/* Gen message */}
        {genMessage && (
          <div
            className={`mb-6 px-4 py-3 rounded-xl text-sm font-['Manrope'] ${
              genMessage.type === "error"
                ? "bg-[#ffdad6]/40 text-[#ba1a1a] border border-[#ba1a1a]/15"
                : "bg-[#eff4ff] text-[#006b5f] border border-[#006b5f]/15"
            }`}
          >
            {genMessage.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Step 1: Select template */}
          <div className="space-y-2">
            <label className="font-['Inter'] text-xs font-bold uppercase tracking-widest text-[#6c7a77] block">
              Step 1 — Select Template
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => {
                setSelectedTemplateId(e.target.value);
                setFilledHtml("");
                setGenMessage(null);
              }}
              className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
            >
              <option value="">— Select a template —</option>
              {templates
                .filter((t) => t.is_active)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.doc_type?.replace(/_/g, " ")})
                  </option>
                ))}
            </select>
          </div>

          {/* Step 2: Select tenant */}
          <div className="space-y-2">
            <label className="font-['Inter'] text-xs font-bold uppercase tracking-widest text-[#6c7a77] block">
              Step 2 — Select Tenant
            </label>
            {tenantsLoading ? (
              <div className="h-12 bg-[#eff4ff] animate-pulse rounded-xl" />
            ) : (
              <select
                value={selectedTenantId}
                onChange={(e) => {
                  setSelectedTenantId(e.target.value);
                  setFilledHtml("");
                  setGenMessage(null);
                }}
                className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
              >
                <option value="">— Select a tenant —</option>
                {tenants.map((t) => {
                  const name = t.tenant_details?.full_name || "Unnamed";
                  const unit = t.rooms?.unit_code || "No unit";
                  return (
                    <option key={t.id} value={t.id}>
                      {name} — {unit}
                    </option>
                  );
                })}
              </select>
            )}
          </div>
        </div>

        {/* Step 3: Fill fields */}
        {selectedTemplate && (
          <div className="mb-8 p-6 bg-[#f8f9ff] rounded-2xl border border-[#bbcac6]/10">
            <p className="font-['Inter'] text-xs font-bold uppercase tracking-widest text-[#6c7a77] mb-5">
              Step 3 — Fill Fields
            </p>

            {/* Auto-filled fields */}
            {autoFilledDisplay.length > 0 && (
              <div className="mb-5 space-y-3">
                <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#006b5f] font-bold flex items-center gap-1.5">
                  <span
                    className="material-symbols-outlined text-[14px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    auto_awesome
                  </span>
                  Auto-filled from tenant
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {autoFilledDisplay.map((ph) => (
                    <div key={ph} className="space-y-1.5">
                      <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">
                        {ph.replace(/_/g, " ")}
                      </label>
                      <input
                        type="text"
                        value={fieldValues[ph] || ""}
                        onChange={(e) => handleFieldChange(ph, e.target.value)}
                        className="w-full bg-[#006b5f]/5 border border-[#006b5f]/15 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
                        placeholder={`{{${ph}}}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Manual fields */}
            {manualPlaceholders.length > 0 && (
              <div className="space-y-3">
                <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#ba1a1a] font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">
                    edit
                  </span>
                  Manual input required
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {manualPlaceholders.map((ph) => (
                    <div key={ph} className="space-y-1.5">
                      <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">
                        {ph.replace(/_/g, " ")}
                        {ph === "EMAIL" && (
                          <span className="ml-1 text-[#bbcac6] normal-case tracking-normal">
                            (tenant email)
                          </span>
                        )}
                      </label>
                      <input
                        type={ph === "EMAIL" ? "email" : "text"}
                        value={fieldValues[ph] || ""}
                        onChange={(e) => handleFieldChange(ph, e.target.value)}
                        placeholder={
                          ph === "LICENCE_PERIOD"
                            ? "e.g. 12 months"
                            : ph === "START_DATE" || ph === "END_DATE"
                            ? "e.g. 1 April 2026"
                            : ph === "DATE"
                            ? new Date().toLocaleDateString("en-SG", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })
                            : `Enter ${ph.replace(/_/g, " ").toLowerCase()}`
                        }
                        className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {templatePlaceholders.length === 0 && (
              <p className="font-['Manrope'] text-sm text-[#555f6f]">
                This template has no placeholders.
              </p>
            )}
          </div>
        )}

        {/* Step 4: Preview */}
        {selectedTemplate && (
          <div className="mb-8 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-['Inter'] text-xs font-bold uppercase tracking-widest text-[#6c7a77]">
                Step 4 — Preview
              </p>
              <button
                onClick={handlePreviewDoc}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#eff4ff] text-[#006b5f] rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#e6eeff] transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">
                  visibility
                </span>
                Render Preview
              </button>
            </div>
            {filledHtml && (
              <div
                id="doc-preview"
                className="border border-[#bbcac6]/15 rounded-2xl p-8 bg-white text-black text-sm leading-relaxed overflow-auto max-h-[600px]"
                dangerouslySetInnerHTML={{ __html: filledHtml }}
              />
            )}
          </div>
        )}

        {/* Step 5: Generate & Send */}
        {selectedTemplate && selectedTenant && filledHtml && (
          <div className="pt-6 border-t border-[#bbcac6]/10 space-y-4">
            <div>
              <p className="font-['Inter'] text-xs font-bold uppercase tracking-widest text-[#6c7a77]">
                Step 5 — Generate PDF & Send
              </p>
              <p className="font-['Manrope'] text-xs text-[#555f6f] mt-1">
                This will generate a PDF from the preview above, upload it to
                storage, and mark the document as sent to the tenant.
              </p>
            </div>
            <button
              onClick={handleGenerateAndSend}
              disabled={generating}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold hover:bg-[#006a61] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">
                {generating ? "progress_activity" : "picture_as_pdf"}
              </span>
              {generating ? "Generating…" : "Generate PDF & Send to Tenant"}
            </button>
          </div>
        )}
      </section>
    </PortalLayout>
  );
}
