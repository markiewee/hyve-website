import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import OnboardingTimeline from "../../components/portal/OnboardingTimeline";
import { Button } from "../../components/ui/button";
import { STEPS, STEP_LABELS } from "../../hooks/useOnboarding";

function formatDateTime(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SectionCard({ title, children }) {
  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {children}
    </div>
  );
}

export default function AdminOnboardingDetailPage() {
  const { id } = useParams();

  const [onboarding, setOnboarding] = useState(null);
  const [tenantDetails, setTenantDetails] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Form state
  const [depositAmount, setDepositAmount] = useState("");
  const [overrideStep, setOverrideStep] = useState("");

  const fetchData = useCallback(async () => {
    const [onboardingRes, detailsRes, docsRes] = await Promise.all([
      supabase
        .from("onboarding_progress")
        .select("*, tenant_profiles(id, user_id, role, rooms(unit_code, name), properties(name))")
        .eq("id", id)
        .single(),
      supabase
        .from("tenant_details")
        .select("*")
        .eq("onboarding_progress_id", id)
        .maybeSingle(),
      supabase
        .from("tenant_documents")
        .select("*")
        .eq("tenant_profile_id", id) // will refine after we have tenant_profile_id
        .order("created_at", { ascending: false }),
    ]);

    if (onboardingRes.data) {
      setOnboarding(onboardingRes.data);
      setDepositAmount(onboardingRes.data.deposit_amount ?? "");
      setOverrideStep(onboardingRes.data.current_step ?? STEPS[0]);

      // Refetch documents using actual tenant_profile_id
      const tpId = onboardingRes.data.tenant_profile_id;
      if (tpId) {
        const { data: docs } = await supabase
          .from("tenant_documents")
          .select("*")
          .eq("tenant_profile_id", tpId)
          .order("created_at", { ascending: false });
        setDocuments(docs ?? []);
      }
    }

    if (detailsRes.data) {
      setTenantDetails(detailsRes.data);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleUploadTA(e) {
    const file = e.target.files?.[0];
    if (!file || !onboarding) return;

    setActionLoading(true);
    setMessage(null);

    const tpId = onboarding.tenant_profile_id;
    const ts = Date.now();
    const path = `tenants/${tpId}/ta-unsigned-${ts}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("tenant-documents")
      .upload(path, file, { contentType: "application/pdf", upsert: false });

    if (uploadError) {
      setMessage({ type: "error", text: "Upload failed: " + uploadError.message });
      setActionLoading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("tenant-documents")
      .getPublicUrl(path);

    const { error: updateError } = await supabase
      .from("onboarding_progress")
      .update({ ta_document_url: urlData.publicUrl, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) {
      setMessage({ type: "error", text: "Failed to update record: " + updateError.message });
    } else {
      setMessage({ type: "success", text: "TA uploaded successfully." });
      await fetchData();
    }
    setActionLoading(false);
  }

  async function handleSetDeposit() {
    if (!depositAmount || isNaN(Number(depositAmount))) {
      setMessage({ type: "error", text: "Please enter a valid deposit amount." });
      return;
    }
    setActionLoading(true);
    setMessage(null);

    const { error } = await supabase
      .from("onboarding_progress")
      .update({ deposit_amount: Number(depositAmount), updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      setMessage({ type: "error", text: "Failed to set deposit: " + error.message });
    } else {
      setMessage({ type: "success", text: "Deposit amount updated." });
      await fetchData();
    }
    setActionLoading(false);
  }

  async function handleApproveDeposit() {
    setActionLoading(true);
    setMessage(null);

    const { error } = await supabase
      .from("onboarding_progress")
      .update({
        deposit_verified: true,
        deposit_completed_at: new Date().toISOString(),
        current_step: "HOUSE_RULES",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      setMessage({ type: "error", text: "Failed to approve deposit: " + error.message });
    } else {
      setMessage({ type: "success", text: "Deposit approved. Tenant advanced to House Rules." });
      await fetchData();
    }
    setActionLoading(false);
  }

  async function handleRejectDeposit() {
    setActionLoading(true);
    setMessage(null);

    const { error } = await supabase
      .from("onboarding_progress")
      .update({
        deposit_verified: false,
        deposit_completed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      setMessage({ type: "error", text: "Failed to reject deposit: " + error.message });
    } else {
      setMessage({ type: "success", text: "Deposit rejected." });
      await fetchData();
    }
    setActionLoading(false);
  }

  async function handleOverrideStep() {
    if (!overrideStep) return;
    setActionLoading(true);
    setMessage(null);

    const stepIndex = STEPS.indexOf(overrideStep);
    const isComplete = overrideStep === "ACTIVE" || overrideStep === "END_OF_TENANCY";

    const { error } = await supabase
      .from("onboarding_progress")
      .update({
        current_step: overrideStep,
        status: isComplete ? "ACTIVE" : "IN_PROGRESS",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      setMessage({ type: "error", text: "Failed to override step: " + error.message });
    } else {
      setMessage({ type: "success", text: `Step set to ${STEP_LABELS[overrideStep] ?? overrideStep}.` });
      await fetchData();
    }
    setActionLoading(false);
  }

  async function getDocumentViewUrl(doc) {
    // Extract storage path from file_url
    const urlParts = doc.file_url?.split("/tenant-documents/");
    if (!urlParts || urlParts.length < 2) return doc.file_url;
    const path = urlParts[1];

    const { data, error } = await supabase.storage
      .from("tenant-documents")
      .createSignedUrl(path, 3600);

    if (error) {
      console.error("Failed to get signed URL:", error);
      return doc.file_url;
    }
    return data.signedUrl;
  }

  async function handleViewDocument(doc) {
    const url = await getDocumentViewUrl(doc);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (loading) {
    return (
      <PortalLayout>
        <div className="text-muted-foreground text-sm">Loading…</div>
      </PortalLayout>
    );
  }

  if (!onboarding) {
    return (
      <PortalLayout>
        <p className="text-sm text-muted-foreground">Onboarding record not found.</p>
      </PortalLayout>
    );
  }

  const currentStep = onboarding.current_step ?? "PERSONAL_DETAILS";
  const unitCode = onboarding.tenant_profiles?.rooms?.unit_code ?? "—";
  const propertyName = onboarding.tenant_profiles?.properties?.name ?? "—";
  const showBankTransferApproval =
    onboarding.deposit_method === "BANK_TRANSFER" && !onboarding.deposit_verified;

  return (
    <PortalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          Onboarding: {unitCode}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{propertyName}</p>
      </div>

      {message && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            message.type === "error"
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-green-50 text-green-700 border border-green-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Timeline sidebar */}
        <aside className="lg:col-span-1">
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
              Progress
            </p>
            <OnboardingTimeline
              currentStep={currentStep}
              onboarding={onboarding}
            />
          </div>
        </aside>

        {/* Main actions */}
        <div className="lg:col-span-3 space-y-4">
          {/* Tenant Details */}
          {tenantDetails && (
            <SectionCard title="Tenant Details">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Name</dt>
                  <dd className="font-medium">{tenantDetails.full_name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">ID Number</dt>
                  <dd className="font-medium">{tenantDetails.id_number ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Nationality</dt>
                  <dd className="font-medium">{tenantDetails.nationality ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Date of Birth</dt>
                  <dd className="font-medium">{tenantDetails.date_of_birth ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd className="font-medium">{tenantDetails.phone ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Emergency Contact</dt>
                  <dd className="font-medium">{tenantDetails.emergency_contact ?? "—"}</dd>
                </div>
              </dl>
            </SectionCard>
          )}

          {/* Upload TA */}
          <SectionCard title="Upload Tenancy Agreement">
            {onboarding.ta_document_url ? (
              <div className="space-y-2">
                <p className="text-sm text-green-700">
                  TA uploaded.{" "}
                  <a
                    href={onboarding.ta_document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    View current TA
                  </a>
                </p>
                <p className="text-xs text-muted-foreground">
                  Upload again to replace:
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No TA uploaded yet.</p>
            )}
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="application/pdf"
                disabled={actionLoading}
                onChange={handleUploadTA}
                className="text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-primary file:text-primary-foreground file:text-xs file:font-medium cursor-pointer"
              />
            </div>
          </SectionCard>

          {/* Set Deposit Amount */}
          <SectionCard title="Deposit Amount">
            <div className="flex items-center gap-3">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  SGD
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0.00"
                  disabled={actionLoading}
                  className="pl-12 pr-3 py-2 border border-border rounded-md text-sm w-40 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <Button
                size="sm"
                onClick={handleSetDeposit}
                disabled={actionLoading}
              >
                Save
              </Button>
            </div>
            {onboarding.deposit_amount && (
              <p className="text-xs text-muted-foreground">
                Current: SGD {Number(onboarding.deposit_amount).toFixed(2)} &rarr; SGD{" "}
                {(Number(onboarding.deposit_amount) * 1.04).toFixed(2)} with 4% fee
              </p>
            )}
          </SectionCard>

          {/* Verify Deposit (bank transfer only) */}
          {showBankTransferApproval && (
            <SectionCard title="Verify Bank Transfer Deposit">
              {onboarding.deposit_proof_url ? (
                <div className="space-y-3">
                  <img
                    src={onboarding.deposit_proof_url}
                    alt="Deposit proof"
                    className="max-w-sm rounded border border-border"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleApproveDeposit}
                      disabled={actionLoading}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleRejectDeposit}
                      disabled={actionLoading}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Bank transfer selected — no proof image uploaded yet.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleApproveDeposit}
                      disabled={actionLoading}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRejectDeposit}
                      disabled={actionLoading}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              )}
            </SectionCard>
          )}

          {/* Override Step */}
          <SectionCard title="Override Step">
            <div className="flex items-center gap-3">
              <select
                value={overrideStep}
                onChange={(e) => setOverrideStep(e.target.value)}
                disabled={actionLoading}
                className="border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              >
                {STEPS.map((step) => (
                  <option key={step} value={step}>
                    {STEP_LABELS[step] ?? step}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="outline"
                onClick={handleOverrideStep}
                disabled={actionLoading}
              >
                Set Step
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use this to manually advance or reset a tenant's onboarding step.
            </p>
          </SectionCard>

          {/* Documents */}
          <SectionCard title="Documents">
            {documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {documents.map((doc) => (
                  <li key={doc.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {doc.doc_type?.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {doc.status} &mdash; {formatDateTime(doc.created_at)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewDocument(doc)}
                    >
                      View
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Onboarding Metadata */}
          <SectionCard title="Record Details">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Deposit Method</dt>
                <dd className="font-medium">{onboarding.deposit_method ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Deposit Verified</dt>
                <dd className="font-medium">
                  {onboarding.deposit_verified ? "Yes" : "No"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">TA Signed At</dt>
                <dd className="font-medium">{formatDateTime(onboarding.ta_signed_at)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Deposit Paid At</dt>
                <dd className="font-medium">
                  {formatDateTime(onboarding.deposit_completed_at)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">House Rules Ack.</dt>
                <dd className="font-medium">
                  {formatDateTime(onboarding.house_rules_acknowledged_at)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last Updated</dt>
                <dd className="font-medium">{formatDateTime(onboarding.updated_at)}</dd>
              </div>
            </dl>
          </SectionCard>
        </div>
      </div>
    </PortalLayout>
  );
}
