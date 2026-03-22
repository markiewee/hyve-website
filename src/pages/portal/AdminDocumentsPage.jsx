import { useEffect, useState, useRef, useCallback } from "react";
import html2pdf from "html2pdf.js";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import { Button } from "../../components/ui/button";

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

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        active
          ? "bg-green-100 text-green-700"
          : "bg-gray-100 text-gray-500"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function TypeBadge({ type }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
      {type?.replace(/_/g, " ")}
    </span>
  );
}

function MessageBanner({ message }) {
  if (!message) return null;
  return (
    <div
      className={`mb-4 px-4 py-3 rounded-lg text-sm ${
        message.type === "error"
          ? "bg-red-50 text-red-700 border border-red-200"
          : "bg-green-50 text-green-700 border border-green-200"
      }`}
    >
      {message.text}
    </div>
  );
}

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
  }, [fetchTemplates, fetchTenants]);

  // ── Editor helpers ───────────────────────────────────────────
  function openCreateEditor() {
    setEditingTemplate(null);
    setEditorName("");
    setEditorDocType(DOC_TYPES[0]);
    setEditorHtml("");
    setShowEditorPreview(false);
    setEditorMessage(null);
    setShowEditor(true);
  }

  function openEditEditor(tpl) {
    setEditingTemplate(tpl);
    setEditorName(tpl.name);
    setEditorDocType(tpl.doc_type);
    setEditorHtml(tpl.html_content || "");
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
      const element = document.getElementById("doc-preview");
      if (!element) throw new Error("Preview element not found. Click Preview first.");

      const opt = {
        margin: 10,
        filename: "document.pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      };
      const pdfBlob = await html2pdf().set(opt).from(element).outputPdf("blob");

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
      const { error: docError } = await supabase.from("tenant_documents").insert({
        tenant_profile_id: tpId,
        doc_type: selectedTemplate.doc_type,
        title: selectedTemplate.name,
        status: "SENT",
        file_url: fileUrl,
      });
      if (docError) throw new Error("Failed to save document record: " + docError.message);

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
      (!AUTO_FILL_KEYS.has(ph)) ||
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Document Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage templates, auto-fill from tenant data, and generate PDFs.
          </p>
        </div>
        <Button onClick={showEditor ? () => setShowEditor(false) : openCreateEditor}>
          {showEditor ? "Close Editor" : "Create Template"}
        </Button>
      </div>

      {/* ── Section A: Template List ── */}
      <section className="bg-card border border-border rounded-lg overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">All Templates</h2>
        </div>
        {templatesLoading ? (
          <div className="px-5 py-4 text-sm text-muted-foreground">Loading…</div>
        ) : templates.length === 0 ? (
          <div className="px-5 py-4 text-sm text-muted-foreground">
            No templates yet. Create one above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Placeholders
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {templates.map((tpl) => (
                  <tr key={tpl.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{tpl.name}</td>
                    <td className="px-4 py-3">
                      <TypeBadge type={tpl.doc_type} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {tpl.placeholders?.length ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge active={tpl.is_active} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditEditor(tpl)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleActive(tpl)}
                        >
                          {tpl.is_active ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Section B: Template Editor ── */}
      {showEditor && (
        <section className="bg-card border border-border rounded-lg p-5 mb-6 space-y-4">
          <h2 className="text-base font-semibold text-foreground">
            {editingTemplate ? `Edit: ${editingTemplate.name}` : "New Template"}
          </h2>

          <MessageBanner message={editorMessage} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Template Name</label>
              <input
                type="text"
                value={editorName}
                onChange={(e) => setEditorName(e.target.value)}
                placeholder="e.g. Standard Licence Agreement"
                className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Document Type</label>
              <select
                value={editorDocType}
                onChange={(e) => setEditorDocType(e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
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
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Available Placeholders{" "}
              <span className="text-muted-foreground font-normal">
                — click to insert at cursor
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_PLACEHOLDERS.map((ph) => (
                <button
                  key={ph}
                  type="button"
                  onClick={() => insertPlaceholderAtCursor(ph)}
                  className="px-2 py-1 rounded bg-secondary text-secondary-foreground text-xs font-mono hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  {`{{${ph}}}`}
                </button>
              ))}
            </div>
          </div>

          {/* HTML Textarea */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">HTML Content</label>
            <textarea
              ref={htmlTextareaRef}
              value={editorHtml}
              onChange={(e) => setEditorHtml(e.target.value)}
              rows={20}
              placeholder="<h1>Licence Agreement</h1><p>This agreement is made between {{TENANT_NAME}}...</p>"
              className="w-full border border-border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary bg-background resize-y"
              spellCheck={false}
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={handleSaveTemplate} disabled={editorSaving}>
              {editorSaving ? "Saving…" : editingTemplate ? "Update Template" : "Save Template"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowEditorPreview((p) => !p)}
            >
              {showEditorPreview ? "Hide Preview" : "Preview"}
            </Button>
          </div>

          {/* Editor inline preview */}
          {showEditorPreview && editorHtml && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Preview</p>
              <div
                className="border border-border rounded-md p-5 bg-white text-black text-sm leading-relaxed overflow-auto max-h-[500px]"
                dangerouslySetInnerHTML={{ __html: editorHtml }}
              />
            </div>
          )}
        </section>
      )}

      {/* ── Section C: Generate & Send ── */}
      <section className="bg-card border border-border rounded-lg p-5 space-y-5">
        <h2 className="text-base font-semibold text-foreground">Generate Document</h2>

        <MessageBanner message={genMessage} />

        {/* Step 1: Select template */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">
            Step 1 — Select Template
          </label>
          <select
            value={selectedTemplateId}
            onChange={(e) => {
              setSelectedTemplateId(e.target.value);
              setFilledHtml("");
              setGenMessage(null);
            }}
            className="w-full sm:w-80 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
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
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">
            Step 2 — Select Tenant
          </label>
          {tenantsLoading ? (
            <p className="text-sm text-muted-foreground">Loading tenants…</p>
          ) : (
            <select
              value={selectedTenantId}
              onChange={(e) => {
                setSelectedTenantId(e.target.value);
                setFilledHtml("");
                setGenMessage(null);
              }}
              className="w-full sm:w-80 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
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

        {/* Step 3: Fill fields */}
        {selectedTemplate && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">
              Step 3 — Fill Fields
            </p>

            {/* Auto-filled fields (read-only display) */}
            {autoFilledDisplay.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  Auto-filled from tenant
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {autoFilledDisplay.map((ph) => (
                    <div key={ph} className="space-y-0.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        {ph.replace(/_/g, " ")}
                      </label>
                      <input
                        type="text"
                        value={fieldValues[ph] || ""}
                        onChange={(e) => handleFieldChange(ph, e.target.value)}
                        className="w-full border border-border rounded-md px-3 py-2 text-sm bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder={`{{${ph}}}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Manual fields */}
            {manualPlaceholders.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  Manual input required
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {manualPlaceholders.map((ph) => (
                    <div key={ph} className="space-y-0.5">
                      <label className="text-xs font-medium text-foreground">
                        {ph.replace(/_/g, " ")}
                        {ph === "EMAIL" && (
                          <span className="ml-1 text-muted-foreground">(tenant email)</span>
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
                        className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {templatePlaceholders.length === 0 && (
              <p className="text-sm text-muted-foreground">
                This template has no placeholders.
              </p>
            )}
          </div>
        )}

        {/* Step 4: Preview */}
        {selectedTemplate && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Step 4 — Preview</p>
            <Button variant="outline" onClick={handlePreviewDoc}>
              Render Preview
            </Button>
            {filledHtml && (
              <div
                id="doc-preview"
                className="border border-border rounded-md p-6 bg-white text-black text-sm leading-relaxed overflow-auto max-h-[600px] mt-3"
                dangerouslySetInnerHTML={{ __html: filledHtml }}
              />
            )}
          </div>
        )}

        {/* Step 5: Generate & Send */}
        {selectedTemplate && selectedTenant && filledHtml && (
          <div className="space-y-2 pt-2 border-t border-border">
            <p className="text-sm font-medium text-foreground">Step 5 — Generate PDF & Send</p>
            <p className="text-xs text-muted-foreground">
              This will generate a PDF from the preview above, upload it to storage, and mark the
              document as sent to the tenant.
            </p>
            <Button onClick={handleGenerateAndSend} disabled={generating}>
              {generating ? "Generating…" : "Generate PDF & Send to Tenant"}
            </Button>
          </div>
        )}
      </section>
    </PortalLayout>
  );
}
