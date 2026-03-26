import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import OnboardingTimeline from "../../components/portal/OnboardingTimeline";
import SignatureCanvas from "../../components/portal/SignatureCanvas";
import DraggableSignaturePlacer from "../../components/portal/DraggableSignaturePlacer";
import { Button } from "../../components/ui/button";
import { STEPS, STEP_LABELS } from "../../hooks/useOnboarding";
import { useAuth } from "../../hooks/useAuth";
import { notifyMember } from "../../lib/notify";

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
  const navigate = useNavigate();
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

  // Ad-hoc charges state
  const CHARGE_CATEGORIES = ["STAMPING", "KEY_REPLACEMENT", "DAMAGE", "CLEANING", "LATE_CHECKOUT", "AC_OVERAGE", "OTHER"];
  const [chargeDesc, setChargeDesc] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeDueDate, setChargeDueDate] = useState("");
  const [chargeCategory, setChargeCategory] = useState("OTHER");
  const [chargeSaving, setChargeSaving] = useState(false);
  const [charges, setCharges] = useState([]);
  const [chargesLoading, setChargesLoading] = useState(true);
  const [chargeActionLoading, setChargeActionLoading] = useState(null);

  // Admin doc upload refs
  const adminDocFileRef = useRef(null);
  const adminDocTypeRef = useRef(null);
  const adminDocTitleRef = useRef(null);

  // Move-out state
  const MOVEOUT_ITEMS = ["Bed & Mattress", "Wardrobe", "Desk & Chair", "AC Unit", "Walls & Ceiling", "Flooring", "Door & Lock", "Window & Curtains", "Bathroom", "Keys Returned"];
  const [moveOutChecklist, setMoveOutChecklist] = useState(() => MOVEOUT_ITEMS.map(name => ({ name, condition: "Good", notes: "", deduction: 0 })));
  const [paymentsCleared, setPaymentsCleared] = useState(false);
  const [depositRefundAmount, setDepositRefundAmount] = useState("");
  const [moveOutDate, setMoveOutDate] = useState("");
  const [moveOutSaving, setMoveOutSaving] = useState(false);
  const totalDeductions = moveOutChecklist.reduce((sum, item) => sum + (Number(item.deduction) || 0), 0);

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
        .select("*, tenant_profiles(id, user_id, role, username, monthly_rent, rooms(unit_code, name), properties(name))")
        .eq("id", id)
        .single(),
      // tenant_details fetched after we know tenant_profile_id
      Promise.resolve({ data: null }),
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

      const tpId = onboardingRes.data.tenant_profile_id;

      // Fetch tenant details by tenant_profile_id
      if (tpId) {
        const { data: td } = await supabase
          .from("tenant_details")
          .select("*")
          .eq("tenant_profile_id", tpId)
          .maybeSingle();
        if (td) setTenantDetails(td);
      }

      // Refetch documents using actual tenant_profile_id
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

  // Fetch charges for this member
  const fetchCharges = useCallback(async () => {
    if (!onboarding?.tenant_profile_id) return;
    const { data, error } = await supabase
      .from("member_charges")
      .select("*")
      .eq("tenant_profile_id", onboarding.tenant_profile_id)
      .order("created_at", { ascending: false });
    if (!error) setCharges(data ?? []);
    setChargesLoading(false);
  }, [onboarding?.tenant_profile_id]);

  useEffect(() => {
    if (onboarding?.tenant_profile_id) fetchCharges();
  }, [onboarding?.tenant_profile_id, fetchCharges]);

  async function handleCreateCharge() {
    if (!chargeDesc.trim()) { setMessage({ type: "error", text: "Description is required." }); return; }
    if (!chargeAmount || isNaN(Number(chargeAmount)) || Number(chargeAmount) <= 0) { setMessage({ type: "error", text: "Enter a valid amount." }); return; }
    setChargeSaving(true);
    setMessage(null);
    const { error } = await supabase.from("member_charges").insert({
      tenant_profile_id: onboarding.tenant_profile_id,
      description: chargeDesc.trim(),
      amount: Number(chargeAmount),
      due_date: chargeDueDate || new Date().toISOString().split("T")[0],
      category: chargeCategory,
      status: "PENDING",
      created_by: profile?.id ?? null,
    });
    if (error) {
      setMessage({ type: "error", text: "Failed to create charge: " + error.message });
    } else {
      setMessage({ type: "success", text: "Charge created." });
      setChargeDesc(""); setChargeAmount(""); setChargeDueDate(""); setChargeCategory("OTHER");
      await fetchCharges();
    }
    setChargeSaving(false);
  }

  async function handleMarkChargePaid(chargeId) {
    if (!confirm("Mark this charge as paid?")) return;
    setChargeActionLoading(chargeId);
    const { error } = await supabase.from("member_charges").update({ status: "PAID", paid_at: new Date().toISOString() }).eq("id", chargeId);
    if (error) {
      setMessage({ type: "error", text: "Failed: " + error.message });
    } else {
      setCharges(prev => prev.map(c => c.id === chargeId ? { ...c, status: "PAID", paid_at: new Date().toISOString() } : c));
    }
    setChargeActionLoading(null);
  }

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
      // Notify member that their deposit has been verified
      try {
        await notifyMember(onboarding.tenant_profile_id, "DEPOSIT_VERIFIED", {});
      } catch (_) { /* non-blocking */ }

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
          {/* Member Profile — editable with save button */}
          {tenantDetails && (
            <SectionCard title="Member Profile">
              <form onSubmit={async (e) => {
                e.preventDefault();
                setActionLoading(true);
                setMessage(null);
                const form = e.target;
                const updates = {};
                for (const input of form.querySelectorAll("[data-field]")) {
                  updates[input.dataset.field] = input.value.trim() || null;
                }
                updates.updated_at = new Date().toISOString();
                const { error } = await supabase.from("tenant_details").update(updates).eq("tenant_profile_id", onboarding.tenant_profile_id);
                if (error) {
                  setMessage({ type: "error", text: "Save failed: " + error.message });
                } else {
                  setMessage({ type: "success", text: "Profile updated." });
                  await fetchData();
                }
                setActionLoading(false);
              }} className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: "Full Name", field: "full_name", value: tenantDetails.full_name },
                    { label: "Phone", field: "phone", value: tenantDetails.phone },
                    { label: "Nationality", field: "nationality", value: tenantDetails.nationality },
                    { label: "Date of Birth", field: "date_of_birth", value: tenantDetails.date_of_birth, type: "date" },
                    { label: "Emergency Contact", field: "emergency_contact_name", value: tenantDetails.emergency_contact_name },
                    { label: "Emergency Phone", field: "emergency_contact_phone", value: tenantDetails.emergency_contact_phone },
                  ].map(({ label, field, value, type }) => (
                    <div key={field} className="space-y-1">
                      <label className="text-muted-foreground text-xs block">{label}</label>
                      <input type={type || "text"} data-field={field} defaultValue={value ?? ""}
                        className="w-full border border-border rounded-md px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary bg-background" />
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-border">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Identification</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                    {[
                      { label: "ID Type", field: "id_type", value: tenantDetails.id_type },
                      { label: "ID Number", field: "id_number", value: tenantDetails.id_number },
                      { label: "ID Expiry", field: "id_expiry", value: tenantDetails.id_expiry, type: "date" },
                    ].map(({ label, field, value, type }) => (
                      <div key={field} className="space-y-1">
                        <label className="text-muted-foreground text-xs block">{label}</label>
                        <input type={type || "text"} data-field={field} defaultValue={value ?? ""}
                          className="w-full border border-border rounded-md px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary bg-background" />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    {[
                      { url: tenantDetails.id_front_url, alt: "ID Front" },
                      { url: tenantDetails.id_back_url, alt: "ID Back" },
                    ].map(({ url, alt }) => url ? (
                      <button key={alt} type="button" onClick={async () => {
                        let path = url;
                        if (url.includes("/tenant-documents/")) path = url.split("/tenant-documents/")[1].split("?")[0];
                        const { data } = await supabase.storage.from("tenant-documents").createSignedUrl(path, 3600);
                        if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                      }} className="text-left">
                        <div className="h-24 w-32 rounded border border-border bg-muted flex items-center justify-center hover:bg-accent transition-colors">
                          <span className="material-symbols-outlined text-muted-foreground">image</span>
                        </div>
                        <p className="text-[10px] text-primary mt-1 hover:underline">{alt} — click to view</p>
                      </button>
                    ) : null)}
                  </div>
                </div>

                {tenantDetails.pass_type && (
                  <div className="pt-3 border-t border-border">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Work Pass</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                      {[
                        { label: "Pass Type", field: "pass_type", value: tenantDetails.pass_type },
                        { label: "Pass Number", field: "pass_number", value: tenantDetails.pass_number },
                        { label: "Pass Expiry", field: "pass_expiry", value: tenantDetails.pass_expiry, type: "date" },
                      ].map(({ label, field, value, type }) => (
                        <div key={field} className="space-y-1">
                          <label className="text-muted-foreground text-xs block">{label}</label>
                          <input type={type || "text"} data-field={field} defaultValue={value ?? ""}
                            className="w-full border border-border rounded-md px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary bg-background" />
                        </div>
                      ))}
                    </div>
                    {tenantDetails.pass_url && (
                      <button type="button" onClick={async () => {
                        let path = tenantDetails.pass_url;
                        if (path.includes("/tenant-documents/")) path = path.split("/tenant-documents/")[1].split("?")[0];
                        const { data } = await supabase.storage.from("tenant-documents").createSignedUrl(path, 3600);
                        if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                      }} className="text-left">
                        <div className="h-24 w-32 rounded border border-border bg-muted flex items-center justify-center hover:bg-accent transition-colors">
                          <span className="material-symbols-outlined text-muted-foreground">badge</span>
                        </div>
                        <p className="text-[10px] text-primary mt-1 hover:underline">Work Pass — click to view</p>
                      </button>
                    )}
                  </div>
                )}

                <Button type="submit" size="sm" disabled={actionLoading}>
                  {actionLoading ? "Saving..." : "Save Profile Changes"}
                </Button>
              </form>
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

          {/* Upload Document to Member */}
          <SectionCard title="Upload Document">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
                  <select
                    ref={adminDocTypeRef}
                    defaultValue="STAMPING"
                    className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                  >
                    <option value="STAMPING">Stamping Certificate</option>
                    <option value="RECEIPT">Receipt</option>
                    <option value="ID_DOCUMENT">ID Document</option>
                    <option value="LICENCE_AGREEMENT">Licence Agreement</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Title</label>
                  <input
                    ref={adminDocTitleRef}
                    type="text"
                    placeholder="e.g. Stamping cert March 2026"
                    className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                  />
                </div>
              </div>
              <input
                type="file"
                ref={adminDocFileRef}
                accept="image/*,application/pdf,.doc,.docx"
                className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-primary file:text-primary-foreground cursor-pointer"
              />
              <Button
                size="sm"
                onClick={async () => {
                  const file = adminDocFileRef.current?.files?.[0];
                  if (!file) { setMessage({ type: "error", text: "Select a file first." }); return; }
                  setActionLoading(true);
                  setMessage(null);
                  try {
                    const tpId = onboarding.tenant_profile_id;
                    const ext = file.name.split(".").pop() || "pdf";
                    const path = `tenants/${tpId}/uploads/admin-${Date.now()}.${ext}`;
                    const { error: upErr } = await supabase.storage.from("tenant-documents").upload(path, file, { upsert: false });
                    if (upErr) throw upErr;
                    const { data: urlData } = supabase.storage.from("tenant-documents").getPublicUrl(path);
                    const docType = adminDocTypeRef.current?.value || "OTHER";
                    const docTitle = adminDocTitleRef.current?.value || docType.replace(/_/g, " ");
                    await supabase.from("tenant_documents").insert({
                      tenant_profile_id: tpId,
                      doc_type: docType,
                      title: docTitle,
                      status: "UPLOADED",
                      file_url: urlData.publicUrl,
                    });
                    setMessage({ type: "success", text: "Document uploaded." });
                    adminDocFileRef.current.value = "";
                    await fetchData();
                  } catch (err) {
                    setMessage({ type: "error", text: err.message });
                  }
                  setActionLoading(false);
                }}
                disabled={actionLoading}
              >
                Upload
              </Button>
            </div>
          </SectionCard>

          {/* Credentials */}
          {onboarding.tenant_profiles && (
            <SectionCard title="Login Credentials">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#006b5f]/10 flex items-center justify-center text-[#006b5f] font-bold text-lg shrink-0">
                    {(tenantDetails?.full_name || onboarding.tenant_profiles.username || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{tenantDetails?.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{onboarding.tenant_profiles?.rooms?.unit_code} · {onboarding.tenant_profiles?.properties?.name}</p>
                  </div>
                </div>
                <div className="bg-[#f8faf9] rounded-lg p-4 space-y-3 text-sm">
                  <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                    <span className="text-muted-foreground text-xs font-medium">Username</span>
                    <input
                      type="text"
                      defaultValue={onboarding.tenant_profiles.username || ""}
                      readOnly
                      className="font-mono font-semibold text-foreground bg-transparent border-0 p-0 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                    <span className="text-muted-foreground text-xs font-medium">Email</span>
                    <input
                      type="text"
                      defaultValue={`${onboarding.tenant_profiles.username || ""}@portal.hyve.sg`}
                      readOnly
                      className="font-mono text-foreground bg-transparent border-0 p-0 focus:outline-none text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-[100px_1fr_auto] gap-2 items-center">
                    <span className="text-muted-foreground text-xs font-medium">Password</span>
                    <span className="font-mono font-semibold text-foreground">••••••••</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={async () => {
                        const newPw = prompt("Enter new password (min 8 chars):");
                        if (!newPw || newPw.length < 8) { setMessage({ type: "error", text: "Password must be at least 8 characters." }); return; }
                        setActionLoading(true);
                        try {
                          const userId = onboarding.tenant_profiles.user_id;
                          const { data: sess } = await supabase.auth.getSession();
                          const resp = await fetch("/api/portal/admin-actions", {
                            method: "POST",
                            headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess?.session?.access_token}` },
                            body: JSON.stringify({ action: "reset_password", user_id: userId, new_password: newPw }),
                          });
                          const respBody = await resp.json();
                          if (!resp.ok) throw new Error(respBody.error || "Reset failed");
                          setMessage({ type: "success", text: `Password reset to "${newPw}".` });
                        } catch (err) {
                          setMessage({ type: "error", text: "Reset failed: " + err.message });
                        }
                        setActionLoading(false);
                      }}
                      disabled={actionLoading}
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => {
                  navigator.clipboard.writeText(`Username: ${onboarding.tenant_profiles.username}\nLogin: hyve.sg/portal/login`);
                  setMessage({ type: "success", text: "Credentials copied to clipboard." });
                }}
              >
                Copy Credentials
              </Button>
            </SectionCard>
          )}

          {/* Move-Out Process — shown when offboarding */}
          {(onboarding.status === "END_OF_TENANCY" || onboarding.current_step === "END_OF_TENANCY") && (
            <SectionCard title="Move-Out Process">
              <div className="space-y-5">
                {/* Move-out date */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-muted-foreground">Move-Out Date</label>
                  <input
                    type="date"
                    value={moveOutDate}
                    onChange={(e) => setMoveOutDate(e.target.value)}
                    className="w-48 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                  />
                </div>

                {/* Room inspection checklist */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Room Inspection</p>
                  <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                    {moveOutChecklist.map((item, i) => (
                      <div key={item.name} className="flex items-center gap-3 px-4 py-3">
                        <span className="text-sm font-medium text-foreground min-w-[140px]">{item.name}</span>
                        <div className="flex gap-1.5">
                          {["Good", "Fair", "Damaged"].map(cond => (
                            <button
                              key={cond}
                              type="button"
                              onClick={() => setMoveOutChecklist(prev => {
                                const next = [...prev];
                                next[i] = { ...next[i], condition: cond };
                                return next;
                              })}
                              className={`py-0.5 px-2 rounded text-[10px] font-bold border transition-colors ${
                                item.condition === cond
                                  ? cond === "Good" ? "bg-green-500 text-white border-green-500"
                                    : cond === "Fair" ? "bg-amber-500 text-white border-amber-500"
                                    : "bg-red-500 text-white border-red-500"
                                  : "bg-background text-foreground border-border"
                              }`}
                            >
                              {cond}
                            </button>
                          ))}
                        </div>
                        {item.condition !== "Good" && (
                          <>
                            <input
                              type="text"
                              value={item.notes}
                              onChange={(e) => setMoveOutChecklist(prev => {
                                const next = [...prev];
                                next[i] = { ...next[i], notes: e.target.value };
                                return next;
                              })}
                              placeholder="Notes..."
                              className="flex-1 border border-border rounded px-2 py-1 text-xs bg-background"
                            />
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-muted-foreground">SGD</span>
                              <input
                                type="number"
                                min="0"
                                value={item.deduction || ""}
                                onChange={(e) => setMoveOutChecklist(prev => {
                                  const next = [...prev];
                                  next[i] = { ...next[i], deduction: Number(e.target.value) || 0 };
                                  return next;
                                })}
                                placeholder="0"
                                className="w-16 border border-border rounded px-2 py-1 text-xs bg-background"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Deposit refund calculation */}
                <div className="bg-[#f8f9ff] rounded-lg p-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Deposit Settlement</p>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground block">Deposit Paid</span>
                      <strong>SGD {Number(onboarding.deposit_amount || 0).toLocaleString("en-SG", { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Deductions</span>
                      <strong className={totalDeductions > 0 ? "text-red-600" : ""}>SGD {totalDeductions.toLocaleString("en-SG", { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Refund Due</span>
                      <strong className="text-[#006b5f]">SGD {Math.max(0, (Number(onboarding.deposit_amount || 0) - totalDeductions)).toLocaleString("en-SG", { minimumFractionDigits: 2 })}</strong>
                    </div>
                  </div>
                </div>

                {/* Payments cleared */}
                <label className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-accent/50">
                  <input
                    type="checkbox"
                    checked={paymentsCleared}
                    onChange={(e) => setPaymentsCleared(e.target.checked)}
                    className="rounded border-border"
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">All outstanding payments cleared</p>
                    <p className="text-xs text-muted-foreground">Confirm rent, utilities, and any other charges are settled.</p>
                  </div>
                </label>

                {/* Complete offboarding */}
                <Button
                  onClick={async () => {
                    if (!paymentsCleared) {
                      setMessage({ type: "error", text: "Please confirm all payments are cleared first." });
                      return;
                    }
                    if (!confirm("Complete offboarding and archive this member?")) return;
                    setMoveOutSaving(true);
                    setMessage(null);
                    try {
                      // Save move-out checklist
                      await supabase.from("room_checklists").insert({
                        tenant_profile_id: onboarding.tenant_profile_id,
                        room_id: onboarding.room_id,
                        checklist_type: "MOVE_OUT",
                        areas: [{ name: "Move-Out Inspection", items: moveOutChecklist }],
                        completed_at: new Date().toISOString(),
                      });

                      // Archive the member
                      await supabase.from("onboarding_progress").update({
                        status: "ARCHIVED",
                        move_out_date: moveOutDate || new Date().toISOString().split("T")[0],
                        deposit_refund_amount: Math.max(0, Number(onboarding.deposit_amount || 0) - totalDeductions),
                      }).eq("id", id);
                      await supabase.from("tenant_profiles").update({ is_active: false }).eq("id", onboarding.tenant_profile_id);

                      setMessage({ type: "success", text: "Offboarding complete. Member archived." });
                      await fetchData();
                    } catch (err) {
                      setMessage({ type: "error", text: err.message });
                    }
                    setMoveOutSaving(false);
                  }}
                  disabled={moveOutSaving || !paymentsCleared}
                  className="w-full"
                >
                  {moveOutSaving ? "Processing..." : "Complete Offboarding & Archive"}
                </Button>
              </div>
            </SectionCard>
          )}

          {/* Create Charge */}
          <SectionCard title="Create Charge">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Description *</label>
                <input
                  type="text"
                  value={chargeDesc}
                  onChange={(e) => setChargeDesc(e.target.value)}
                  placeholder="e.g. Stamping fee, Key replacement"
                  className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Amount SGD *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={chargeAmount}
                  onChange={(e) => setChargeAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
                <select
                  value={chargeCategory}
                  onChange={(e) => setChargeCategory(e.target.value)}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                >
                  {CHARGE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Due Date</label>
                <input
                  type="date"
                  value={chargeDueDate}
                  onChange={(e) => setChargeDueDate(e.target.value)}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                />
              </div>
            </div>
            <Button size="sm" onClick={handleCreateCharge} disabled={chargeSaving}>
              {chargeSaving ? "Creating..." : "Create Charge"}
            </Button>
          </SectionCard>

          {/* Pending Charges */}
          <SectionCard title="Ad-hoc Charges">
            {chargesLoading ? (
              <p className="text-sm text-muted-foreground">Loading charges...</p>
            ) : charges.length === 0 ? (
              <p className="text-sm text-muted-foreground">No charges yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {charges.map((c) => (
                  <li key={c.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground flex items-center gap-2">
                        {c.description}
                        <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-[#eff4ff] text-[#6c7a77]">
                          {c.category?.replace(/_/g, " ")}
                        </span>
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${c.status === "PAID" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                          {c.status}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        SGD {Number(c.amount).toFixed(2)} &mdash; Due: {c.due_date ?? "—"} &mdash; Created: {formatDateTime(c.created_at)}
                      </p>
                    </div>
                    {c.status === "PENDING" && (
                      <Button
                        size="sm"
                        onClick={() => handleMarkChargePaid(c.id)}
                        disabled={chargeActionLoading === c.id}
                      >
                        {chargeActionLoading === c.id ? "..." : "Mark Paid"}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Actions: Offboard / Archive / Delete */}
          <SectionCard title="Member Actions">
            <div className="space-y-4">
              {/* Offboard — for active or onboarding members */}
              {onboarding.status !== "END_OF_TENANCY" && onboarding.status !== "ARCHIVED" && (
                <div className="flex items-center justify-between p-3 rounded-lg border border-[#bbcac6]/15">
                  <div>
                    <p className="text-sm font-medium text-foreground">Start Offboarding</p>
                    <p className="text-xs text-muted-foreground">Mark as end of tenancy when moving out.</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      if (!confirm("Start offboarding for this member?")) return;
                      setActionLoading(true);
                      await supabase.from("onboarding_progress").update({ status: "END_OF_TENANCY", current_step: "END_OF_TENANCY" }).eq("id", id);
                      setMessage({ type: "success", text: "Member marked for offboarding." });
                      await fetchData();
                      setActionLoading(false);
                    }}
                    disabled={actionLoading}
                  >
                    <span className="material-symbols-outlined text-[16px] mr-1">logout</span>
                    Offboard
                  </Button>
                </div>
              )}

              {/* Archive — available for all statuses */}
              {onboarding.status !== "ARCHIVED" && (
                <div className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-amber-50/50">
                  <div>
                    <p className="text-sm font-medium text-foreground">Archive Member</p>
                    <p className="text-xs text-muted-foreground">Deactivate account. Can be restored later.</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-300 text-amber-700 hover:bg-amber-100"
                    onClick={async () => {
                      if (!confirm("Archive this member? Their login will be deactivated.")) return;
                      setActionLoading(true);
                      await supabase.from("onboarding_progress").update({ status: "ARCHIVED" }).eq("id", id);
                      await supabase.from("tenant_profiles").update({ is_active: false }).eq("id", onboarding.tenant_profile_id);
                      setMessage({ type: "success", text: "Member archived." });
                      await fetchData();
                      setActionLoading(false);
                    }}
                    disabled={actionLoading}
                  >
                    <span className="material-symbols-outlined text-[16px] mr-1">archive</span>
                    Archive
                  </Button>
                </div>
              )}

              {/* Delete — available for all statuses */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-red-200 bg-red-50/50">
                <div>
                  <p className="text-sm font-medium text-red-800">Delete Permanently</p>
                  <p className="text-xs text-red-600">Remove all data. Cannot be undone.</p>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={async () => {
                    if (!confirm("DELETE this member permanently?\n\nThis removes their account, documents, and all data. Cannot be undone.")) return;
                    const confirmText = prompt("Type 'delete' to confirm:");
                    if (confirmText?.toLowerCase() !== "delete") { setMessage({ type: "error", text: "Cancelled." }); return; }
                    setActionLoading(true);
                    try {
                      const tpId = onboarding.tenant_profile_id;
                      const userId = onboarding.tenant_profiles?.user_id;
                      await supabase.from("room_checklists").delete().eq("tenant_profile_id", tpId);
                      await supabase.from("tenant_documents").delete().eq("tenant_profile_id", tpId);
                      await supabase.from("tenant_details").delete().eq("tenant_profile_id", tpId);
                      await supabase.from("onboarding_progress").delete().eq("id", id);
                      await supabase.from("tenant_profiles").delete().eq("id", tpId);
                      // Auth admin delete may fail from client — that's OK, DB records are gone
                      if (userId) {
                        try { await supabase.auth.admin.deleteUser(userId); } catch {}
                      }
                      navigate("/portal/admin/onboarding");
                    } catch (err) {
                      setMessage({ type: "error", text: "Delete failed: " + err.message });
                      setActionLoading(false);
                    }
                  }}
                  disabled={actionLoading}
                >
                  <span className="material-symbols-outlined text-[16px] mr-1">delete_forever</span>
                  Delete
                </Button>
              </div>
            </div>
          </SectionCard>

          {/* Set Current Step */}
          <SectionCard title="Onboarding Progress">
            <p className="text-xs text-muted-foreground mb-3">
              Click any step to set it as the current step. Use this to onboard existing members or fix progress.
            </p>
            <div className="space-y-1">
              {STEPS.map((step, i) => {
                const isCurrent = currentStep === step;
                const stepIndex = STEPS.indexOf(currentStep);
                const isCompleted = i < stepIndex;
                return (
                  <button
                    key={step}
                    onClick={async () => {
                      if (isCurrent) return;
                      setActionLoading(true);
                      setMessage(null);
                      const isComplete = step === "ACTIVE" || step === "END_OF_TENANCY";
                      const { error } = await supabase.from("onboarding_progress").update({
                        current_step: step,
                        status: isComplete ? "ACTIVE" : "ONBOARDING",
                        updated_at: new Date().toISOString(),
                      }).eq("id", id);
                      if (error) {
                        setMessage({ type: "error", text: error.message });
                      } else {
                        setMessage({ type: "success", text: `Step set to ${STEP_LABELS[step] ?? step}.` });
                        await fetchData();
                      }
                      setActionLoading(false);
                    }}
                    disabled={actionLoading}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left text-sm transition-all ${
                      isCurrent
                        ? "bg-[#006b5f] text-white font-bold"
                        : isCompleted
                        ? "bg-[#d1fae5] text-[#065f46] hover:bg-[#bbf7d0]"
                        : "bg-[#f8f9ff] text-[#6c7a77] hover:bg-[#eff4ff]"
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      isCurrent ? "bg-white text-[#006b5f]"
                      : isCompleted ? "bg-[#065f46] text-white"
                      : "bg-[#bbcac6]/20 text-[#6c7a77]"
                    }`}>
                      {isCompleted ? (
                        <span className="material-symbols-outlined text-[14px]">check</span>
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span>{STEP_LABELS[step] ?? step}</span>
                    {isCurrent && <span className="ml-auto text-xs opacity-80">Current</span>}
                  </button>
                );
              })}
            </div>
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
                <dt className="text-muted-foreground">Member Signed At</dt>
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
