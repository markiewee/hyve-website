import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import OnboardingTimeline from "../../components/portal/OnboardingTimeline";
import SignatureCanvas from "../../components/portal/SignatureCanvas";
import DraggableSignaturePlacer from "../../components/portal/DraggableSignaturePlacer";
import { Button } from "../../components/ui/button";
import { STEPS, STEP_LABELS } from "../../hooks/useOnboarding";
import { useAuth } from "../../hooks/useAuth";

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
  const { profile } = useAuth();

  const [onboarding, setOnboarding] = useState(null);
  const [tenantDetails, setTenantDetails] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Form state
  const [depositAmount, setDepositAmount] = useState("");
  const [overrideStep, setOverrideStep] = useState("");

  // Tenancy details form state
  const [refNumber, setRefNumber] = useState("");
  const [tenancyStartDate, setTenancyStartDate] = useState("");
  const [tenancyEndDate, setTenancyEndDate] = useState("");
  const [licencePeriod, setLicencePeriod] = useState("");
  const [tenancyDetailsSaving, setTenancyDetailsSaving] = useState(false);

  // Signature placement
  const [signaturePositions, setSignaturePositions] = useState(null);
  const [sigPlacerUrl, setSigPlacerUrl] = useState(null);
  const [sigPosSaving, setSigPosSaving] = useState(false);

  // Counter-sign mode: "saved" (use saved sig) | "draw" (draw new)
  const [sigMode, setSigMode] = useState(null); // initialised after profile loads

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
      setRefNumber(onboardingRes.data.ref_number ?? "");
      setTenancyStartDate(onboardingRes.data.tenancy_start_date ?? "");
      setTenancyEndDate(onboardingRes.data.tenancy_end_date ?? "");
      setLicencePeriod(onboardingRes.data.licence_period ?? "");

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

  // Load signature positions + signed URL for the TA when onboarding changes
  useEffect(() => {
    if (!onboarding) return;
    setSignaturePositions(onboarding.signature_positions ?? null);

    if (onboarding.ta_document_url) {
      const taUrl = onboarding.ta_document_url;
      let path = taUrl;
      if (taUrl.includes("/tenant-documents/")) {
        path = taUrl.split("/tenant-documents/")[1].split("?")[0];
      }
      supabase.storage
        .from("tenant-documents")
        .createSignedUrl(path, 3600)
        .then(({ data }) => {
          if (data?.signedUrl) setSigPlacerUrl(data.signedUrl);
        });
    }
  }, [onboarding]);

  async function handleSaveSignaturePositions() {
    if (!onboarding || !signaturePositions) return;
    setSigPosSaving(true);
    setMessage(null);
    const { error } = await supabase
      .from("onboarding_progress")
      .update({ signature_positions: signaturePositions, updated_at: new Date().toISOString() })
      .eq("id", onboarding.id);
    if (error) {
      setMessage({ type: "error", text: "Failed to save signature positions: " + error.message });
    } else {
      setMessage({ type: "success", text: "Signature positions saved." });
    }
    setSigPosSaving(false);
  }

  // Default sig mode based on whether admin has a saved signature
  useEffect(() => {
    if (profile && sigMode === null) {
      setSigMode(profile.saved_signature ? "saved" : "draw");
    }
  }, [profile, sigMode]);

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

  async function handleSaveTenancyDetails() {
    setTenancyDetailsSaving(true);
    setMessage(null);

    const updates = {
      ref_number: refNumber || null,
      tenancy_start_date: tenancyStartDate || null,
      tenancy_end_date: tenancyEndDate || null,
      licence_period: licencePeriod || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("onboarding_progress")
      .update(updates)
      .eq("id", id);

    if (error) {
      setMessage({ type: "error", text: "Failed to save tenancy details: " + error.message });
    } else {
      setMessage({ type: "success", text: "Tenancy details saved." });
      await fetchData();
    }
    setTenancyDetailsSaving(false);
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

  const adminSignatureRef = useRef(null);
  const [counterSigning, setCounterSigning] = useState(false);

  async function handleCounterSign() {
    let sigData;
    if (sigMode === "saved") {
      sigData = profile?.saved_signature ?? null;
    } else {
      sigData = adminSignatureRef.current?.getSignatureData() ?? null;
    }

    if (!sigData) {
      setMessage({ type: "error", text: "Please provide your signature before counter-signing." });
      return;
    }

    setCounterSigning(true);
    setMessage(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const res = await fetch("/api/portal/counter-sign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          signature_image_base64: sigData.split(",")[1] ?? sigData,
          onboarding_id: id,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Counter-signing failed");
      }

      setMessage({ type: "success", text: "Agreement fully executed. Tenant advanced to deposit step." });
      await fetchData();
    } catch (err) {
      console.error("Counter-sign error:", err);
      setMessage({ type: "error", text: err.message ?? "Something went wrong. Please try again." });
    } finally {
      setCounterSigning(false);
    }
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
    if (!doc.file_url) return null;

    // If it's already a full URL, extract the storage path
    let path = doc.file_url;
    const urlParts = doc.file_url.split("/tenant-documents/");
    if (urlParts.length >= 2) {
      path = urlParts[1];
    }
    // Otherwise treat file_url as a direct storage path

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
            <SectionCard title="Member Details">
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

          {/* Tenancy Details */}
          <SectionCard title="Tenancy Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Reference Number</label>
                <input
                  type="text"
                  value={refNumber}
                  onChange={(e) => setRefNumber(e.target.value)}
                  placeholder="e.g. HYV-2026-001"
                  className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Licence Period</label>
                <input
                  type="text"
                  value={licencePeriod}
                  onChange={(e) => setLicencePeriod(e.target.value)}
                  placeholder="e.g. 12 months"
                  className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Start Date</label>
                <input
                  type="date"
                  value={tenancyStartDate}
                  onChange={(e) => setTenancyStartDate(e.target.value)}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">End Date</label>
                <input
                  type="date"
                  value={tenancyEndDate}
                  onChange={(e) => setTenancyEndDate(e.target.value)}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                />
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleSaveTenancyDetails}
              disabled={tenancyDetailsSaving}
            >
              {tenancyDetailsSaving ? "Saving..." : "Save Tenancy Details"}
            </Button>
          </SectionCard>

          {/* Upload TA */}
          <SectionCard title="Upload Tenancy Agreement">
            {onboarding.ta_document_url ? (
              <div className="space-y-2">
                <p className="text-sm text-green-700">
                  TA uploaded.{" "}
                  <button
                    type="button"
                    onClick={async () => {
                      const path = onboarding.ta_document_url.includes("/tenant-documents/")
                        ? onboarding.ta_document_url.split("/tenant-documents/")[1].split("?")[0]
                        : onboarding.ta_document_url;
                      const { data } = await supabase.storage
                        .from("tenant-documents")
                        .createSignedUrl(path, 3600);
                      if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
                    }}
                    className="underline"
                  >
                    View current TA
                  </button>
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

          {/* Signature Placement — shown when a TA has been uploaded */}
          {onboarding.ta_document_url && sigPlacerUrl && (
            <SectionCard title="Signature Placement">
              <p className="text-xs text-muted-foreground mb-2">
                Drag the boxes to position where tenant and admin signatures will be stamped on the PDF.
              </p>
              <DraggableSignaturePlacer
                pdfUrl={sigPlacerUrl}
                value={signaturePositions}
                onChange={setSignaturePositions}
              />
              <Button
                size="sm"
                onClick={handleSaveSignaturePositions}
                disabled={sigPosSaving || !signaturePositions}
                className="mt-3"
              >
                {sigPosSaving ? "Saving..." : "Save Signature Positions"}
              </Button>
            </SectionCard>
          )}

          {/* Counter-Sign — shown only when tenant has signed but admin hasn't yet */}
          {onboarding.signing_status === "TENANT_SIGNED" && (
            <SectionCard title="Counter-Sign Agreement">
              <div className="space-y-4">
                {/* Status badge */}
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                  </span>
                  <p className="text-sm text-amber-700 font-medium">
                    Tenant has signed — waiting for your counter-signature
                  </p>
                </div>

                {/* Tenant-signed PDF link */}
                {onboarding.ta_signed_url && (
                  <div>
                    <button
                      type="button"
                      onClick={async () => {
                        const path = onboarding.ta_signed_url.includes("/tenant-documents/")
                          ? onboarding.ta_signed_url.split("/tenant-documents/")[1].split("?")[0]
                          : onboarding.ta_signed_url;
                        const { data } = await supabase.storage
                          .from("tenant-documents")
                          .createSignedUrl(path, 3600);
                        if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
                      }}
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      View tenant-signed document
                    </button>
                  </div>
                )}

                {/* Admin signature */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">Your Signature</p>

                  {/* Mode toggle — only shown when admin has a saved sig */}
                  {profile?.saved_signature && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSigMode("saved")}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                          sigMode === "saved"
                            ? "bg-[#006b5f] text-white border-[#006b5f]"
                            : "bg-white border-[#bbcac6]/40 text-[#6c7a77] hover:border-[#006b5f]/40"
                        }`}
                      >
                        Use Saved Signature
                      </button>
                      <button
                        type="button"
                        onClick={() => setSigMode("draw")}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                          sigMode === "draw"
                            ? "bg-[#006b5f] text-white border-[#006b5f]"
                            : "bg-white border-[#bbcac6]/40 text-[#6c7a77] hover:border-[#006b5f]/40"
                        }`}
                      >
                        Draw New Signature
                      </button>
                    </div>
                  )}

                  {/* Saved signature preview */}
                  {sigMode === "saved" && profile?.saved_signature && (
                    <div className="rounded-xl border border-[#bbcac6]/30 bg-[#f8faf9] p-3 inline-block">
                      <img
                        src={profile.saved_signature}
                        alt="Saved signature"
                        className="max-h-[80px] max-w-[320px] object-contain"
                      />
                    </div>
                  )}

                  {/* Draw / type pad */}
                  {sigMode === "draw" && (
                    <SignatureCanvas signatureRef={adminSignatureRef} />
                  )}
                </div>

                <Button
                  onClick={handleCounterSign}
                  disabled={counterSigning || actionLoading}
                  className="w-full sm:w-auto bg-[#006b5f] hover:bg-[#005a50] text-white"
                >
                  {counterSigning ? "Executing…" : "Counter-Sign & Execute"}
                </Button>
              </div>
            </SectionCard>
          )}

          {/* Fully executed — show confirmation */}
          {onboarding.signing_status === "FULLY_EXECUTED" && (
            <SectionCard title="Agreement Status">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mt-0.5">
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-800">Fully Executed</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tenant signed: {formatDateTime(onboarding.ta_signed_at)} ·
                    Admin counter-signed: {formatDateTime(onboarding.admin_signed_at)}
                  </p>
                  {onboarding.admin_signed_url && (
                    <button
                      type="button"
                      onClick={async () => {
                        const path = onboarding.admin_signed_url.includes("/tenant-documents/")
                          ? onboarding.admin_signed_url.split("/tenant-documents/")[1].split("?")[0]
                          : onboarding.admin_signed_url;
                        const { data } = await supabase.storage
                          .from("tenant-documents")
                          .createSignedUrl(path, 3600);
                        if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download fully executed agreement
                    </button>
                  )}
                </div>
              </div>
            </SectionCard>
          )}

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
                <dt className="text-muted-foreground">Signing Status</dt>
                <dd className="font-medium">
                  <span
                    className={`inline-flex px-1.5 py-0.5 rounded text-xs font-semibold ${
                      onboarding.signing_status === "FULLY_EXECUTED"
                        ? "bg-green-100 text-green-700"
                        : onboarding.signing_status === "TENANT_SIGNED"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {onboarding.signing_status ?? "UNSIGNED"}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Tenant Signed At</dt>
                <dd className="font-medium">{formatDateTime(onboarding.ta_signed_at)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Admin Counter-Signed At</dt>
                <dd className="font-medium">{formatDateTime(onboarding.admin_signed_at)}</dd>
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
