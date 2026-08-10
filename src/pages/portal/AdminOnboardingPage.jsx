import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { generateFeeScheduleHtml } from "../../lib/feeSchedule";
import PortalLayout from "../../components/portal/PortalLayout";
import { STEP_LABELS, REGISTRATION_STEPS, ONBOARDING_STEPS } from "../../hooks/useOnboarding";
import { notifyMember } from "../../lib/notify";
import { confirm } from "../../lib/confirm";
import { PORTAL_HOST, PORTAL_URL } from "../../lib/portal";

const STEP_BADGE_COLORS = {
  PERSONAL_DETAILS: "bg-surface-container text-foreground-variant",
  ID_VERIFICATION: "bg-blue-500/15 text-blue-300",
  SIGN_TA: "bg-purple-500/15 text-purple-300",
  DEPOSIT: "bg-amber-500/15 text-amber-300",
  HOUSE_RULES: "bg-amber-500/15 text-amber-300",
  MOVE_IN_CHECKLIST: "bg-blue-500/15 text-blue-300",
  ACTIVE: "bg-emerald-500/15 text-emerald-300",
  END_OF_TENANCY: "bg-red-500/15 text-red-300",
};

const STATUS_BADGE_COLORS = {
  ONBOARDING: "bg-blue-500/15 text-blue-300",
  IN_PROGRESS: "bg-blue-500/15 text-blue-300",
  ACTIVE: "bg-emerald-500/15 text-emerald-300",
  COMPLETE: "bg-emerald-500/15 text-emerald-300",
  END_OF_TENANCY: "bg-amber-500/15 text-amber-300",
  MOVED_OUT: "bg-surface-container text-foreground-variant",
  BLOCKED: "bg-red-500/15 text-red-300",
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
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Lifecycle tracker + New Member wizard. Rendered standalone (wrapped in
// PortalLayout by the default export) AND embedded as the "Lifecycle" tab of
// the merged Members page (embedded=true hides the duplicate page header).
export function OnboardingLifecycle({ embedded = false }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [inviteEndMode, setInviteEndMode] = useState("months"); // "months" | "date"
  const [inviteLicencePeriod, setInviteLicencePeriod] = useState("12");
  const [inviteEndDateManual, setInviteEndDateManual] = useState("");
  const [inviteRefNumber, setInviteRefNumber] = useState("");
  const [rooms, setRooms] = useState([]);
  const [occupiedRoomMap, setOccupiedRoomMap] = useState({}); // room_id -> tenant username
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [wizardErrors, setWizardErrors] = useState({});

  // TA preview state
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [taPreviewHtml, setTaPreviewHtml] = useState("");

  // Auto-calculate end date + licence period based on mode
  const inviteEndDate = (() => {
    if (inviteEndMode === "date") return inviteEndDateManual;
    if (!inviteStartDate || !inviteLicencePeriod) return "";
    const start = new Date(inviteStartDate + "T00:00:00");
    if (isNaN(start.getTime())) return "";
    const end = new Date(start);
    end.setMonth(end.getMonth() + Number(inviteLicencePeriod));
    end.setDate(end.getDate() - 1);
    return end.toISOString().split("T")[0];
  })();

  // When using end date mode, auto-calc licence period in months
  const calcLicencePeriod = (() => {
    if (inviteEndMode === "months") return inviteLicencePeriod;
    if (!inviteStartDate || !inviteEndDateManual) return "";
    const s = new Date(inviteStartDate);
    const e = new Date(inviteEndDateManual);
    const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
    return String(months > 0 ? months : 1);
  })();

  const selectedRoom = rooms.find(r => r.id === inviteRoomId);

  useEffect(() => {
    supabase.from("rooms").select("id, unit_code, name, property_id, properties(name, address, common_areas)")
      .not("room_type", "is", null) // only lettable bedrooms can be assigned to a tenant
      .order("unit_code").then(({ data }) => setRooms(data ?? []));
    supabase.from("document_templates").select("id, name, doc_type, html_content, placeholders, signature_config")
      .eq("is_active", true).eq("doc_type", "LICENCE_AGREEMENT")
      .then(({ data }) => {
        setTemplates(data ?? []);
        if (data?.length > 0) setSelectedTemplateId(data[0].id);
      });
    // Fetch which rooms are occupied by active/onboarding tenants
    supabase.from("onboarding_progress")
      .select("status, tenant_profiles(room_id, username)")
      .in("status", ["ACTIVE", "ONBOARDING", "IN_PROGRESS"])
      .then(({ data }) => {
        const map = {};
        (data ?? []).forEach(row => {
          const tp = row.tenant_profiles;
          if (tp?.room_id) {
            map[tp.room_id] = tp.username || "Tenant";
          }
        });
        setOccupiedRoomMap(map);
      });
  }, []);

  // Auto-open invite wizard with prefill when ?invite=1&name=...&room_id=...
  // (e.g. from "Convert to Member" on AdminViewingDetailPage)
  useEffect(() => {
    if (searchParams.get("invite") !== "1") return;
    const name = searchParams.get("name");
    const roomId = searchParams.get("room_id");
    setShowInvite(true);
    setWizardStep(1);
    setInviteResult(null);
    setWizardErrors({});
    if (name) setInviteUsername(name);
    if (roomId) setInviteRoomId(roomId);
    // Strip the params so a refresh doesn't reopen the wizard
    const sp = new URLSearchParams(searchParams);
    ["invite", "name", "email", "phone", "room_id"].forEach((k) => sp.delete(k));
    setSearchParams(sp, { replace: true });
  }, [searchParams, setSearchParams]);

  // Auto-generate ref number when room changes
  useEffect(() => {
    if (!inviteRoomId) return;
    const room = rooms.find(r => r.id === inviteRoomId);
    if (!room) return;
    const prefix = room.unit_code?.split("-")[0] || "HYV";
    const year = new Date().getFullYear();
    const seq = String(rows.length + 1).padStart(3, "0");
    setInviteRefNumber(`${prefix}-${year}-${seq}`);
    // Default rent (admin can change in the form)
  }, [inviteRoomId, rooms, rows.length]);

  async function generateTaPreview() {
    const room = rooms.find(r => r.id === inviteRoomId);
    const fmtDate = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" }) : "";

    // Auto-generate fee schedule with prorated first/last months
    const feeScheduleRows = generateFeeScheduleHtml(inviteStartDate, inviteEndDate, inviteRent);
    const feeDates = {};

    const values = {
      TENANT_NAME: inviteUsername,
      ID_NUMBER: "[To be filled after ID verification]",
      PHONE: "[To be filled after onboarding]",
      EMAIL: "[To be filled after onboarding]",
      ROOM_CODE: room?.unit_code || "",
      ROOM_NAME: room?.name || "",
      PROPERTY_NAME: room?.properties?.name || "",
      PROPERTY_ADDRESS: room?.properties?.address || "",
      COMMON_AREAS: room?.properties?.common_areas || "All common areas",
      REF_NUMBER: inviteRefNumber,
      MONTHLY_RENT: inviteRent ? Number(inviteRent).toLocaleString("en-SG") : "",
      DEPOSIT_AMOUNT: inviteDeposit ? Number(inviteDeposit).toLocaleString("en-SG") : "",
      LICENCE_PERIOD: `${calcLicencePeriod} months`,
      START_DATE: fmtDate(inviteStartDate),
      END_DATE: fmtDate(inviteEndDate),
      DATE: new Date().toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" }),
      FEE_SCHEDULE_ROWS: feeScheduleRows,
      ...feeDates,
    };

    try {
      const res = await fetch("/templates/licence-agreement.html");
      let html = await res.text();
      for (const [key, val] of Object.entries(values)) {
        html = html.replaceAll(`{{${key}}}`, val || `[${key}]`);
      }
      // Clear any remaining unfilled FEE_DATE placeholders
      html = html.replace(/\{\{FEE_DATE_\d+\}\}/g, "-");
      setTaPreviewHtml(html);
    } catch (err) {
      console.error("Failed to load template:", err);
      setTaPreviewHtml("");
    }
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
            licence_period: calcLicencePeriod ? `${calcLicencePeriod} months` : null,
            signature_positions: tpl?.signature_config || null,
          }).eq("id", onbData.id);
        }

        // Update room rent amount
        if (inviteRent) {
          // Save monthly_rent to the tenant profile after creation
          if (inviteRent) {
            await supabase.from("tenant_profiles").update({ monthly_rent: Number(inviteRent) }).eq("id", tpId);
          }
        }

        // TA is NOT generated here, admin generates it later via
        // Documents → Generate Agreement → Save as PDF → Send to Member
        // This avoids the broken html2pdf conversion entirely.
      }

      // Send welcome email with login credentials
      try {
        await notifyMember(body.profile_id, "MEMBER_CREATED", {
          username: inviteUsername,
          password: body.default_password,
          login_url: `${PORTAL_URL}/portal/login`,
        });
      } catch (_) { /* non-blocking */ }

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

    // Refresh occupied room map
    const { data: occData } = await supabase.from("onboarding_progress")
      .select("status, tenant_profiles(room_id, username)")
      .in("status", ["ACTIVE", "ONBOARDING", "IN_PROGRESS"]);
    const map = {};
    (occData ?? []).forEach(row => {
      const tp = row.tenant_profiles;
      if (tp?.room_id) map[tp.room_id] = tp.username || "Tenant";
    });
    setOccupiedRoomMap(map);
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
  const [search, setSearch] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("created_newest");

  const isInProgress = (r) => ["ONBOARDING", "IN_PROGRESS"].includes(r.status);
  const isRegistrationStep = (r) => REGISTRATION_STEPS.includes(r.current_step);
  const isOnboardingStep = (r) => ONBOARDING_STEPS.includes(r.current_step);

  const registrationCount = rows.filter(r => isInProgress(r) && isRegistrationStep(r)).length;
  const onboardingCount = rows.filter(r => isInProgress(r) && isOnboardingStep(r)).length;
  const activeCount = rows.filter((r) => r.status === "ACTIVE").length;
  const archivedCount = rows.filter((r) => r.status === "ARCHIVED" || r.status === "MOVED_OUT").length;

  const lifecycleRows = lifecycleFilter === "ALL" ? rows.filter(r => r.status !== "ARCHIVED" && r.status !== "MOVED_OUT")
    : lifecycleFilter === "REGISTRATION" ? rows.filter(r => isInProgress(r) && isRegistrationStep(r))
    : lifecycleFilter === "ONBOARDING" ? rows.filter(r => isInProgress(r) && isOnboardingStep(r))
    : lifecycleFilter === "ACTIVE" ? rows.filter(r => r.status === "ACTIVE")
    : lifecycleFilter === "ARCHIVED" ? rows.filter(r => ["ARCHIVED", "MOVED_OUT", "END_OF_TENANCY"].includes(r.status))
    : rows;

  // Helpers for sort/filter
  const rowName = (r) => (r.tenant_profiles?.tenant_details?.full_name || r.tenant_profiles?.username || "").toLowerCase();
  const rowUnit = (r) => r.tenant_profiles?.rooms?.unit_code || "";
  const rowProperty = (r) => (rowUnit(r).split("-")[0] || "").toUpperCase();
  // Nulls always sort to the bottom regardless of direction.
  const nullSort = (a, b, dir = "asc") => {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    if (a < b) return dir === "asc" ? -1 : 1;
    if (a > b) return dir === "asc" ? 1 : -1;
    return 0;
  };

  const SORTERS = {
    created_newest: (a, b) => nullSort(a.created_at, b.created_at, "desc"),
    created_oldest: (a, b) => nullSort(a.created_at, b.created_at, "asc"),
    name_asc: (a, b) => rowName(a).localeCompare(rowName(b)),
    name_desc: (a, b) => rowName(b).localeCompare(rowName(a)),
    unit_asc: (a, b) => rowUnit(a).localeCompare(rowUnit(b)),
    move_in_newest: (a, b) => nullSort(a.tenancy_start_date, b.tenancy_start_date, "desc"),
    move_in_oldest: (a, b) => nullSort(a.tenancy_start_date, b.tenancy_start_date, "asc"),
    move_out_soonest: (a, b) => nullSort(a.tenancy_end_date, b.tenancy_end_date, "asc"),
    step: (a, b) => nullSort(STEP_ORDER.indexOf(a.current_step), STEP_ORDER.indexOf(b.current_step), "asc"),
    status: (a, b) => (a.status || "").localeCompare(b.status || ""),
  };

  const q = search.trim().toLowerCase();
  const filteredRows = lifecycleRows
    .filter((r) => propertyFilter === "ALL" || rowProperty(r) === propertyFilter)
    .filter((r) => !q || rowName(r).includes(q) || rowUnit(r).toLowerCase().includes(q))
    .slice()
    .sort(SORTERS[sortBy] || SORTERS.created_newest);

  const SORT_OPTIONS = [
    { value: "created_newest", label: "Date added (newest)" },
    { value: "created_oldest", label: "Date added (oldest)" },
    { value: "move_in_newest", label: "Move-in (newest)" },
    { value: "move_in_oldest", label: "Move-in (oldest)" },
    { value: "move_out_soonest", label: "Move-out (soonest)" },
    { value: "name_asc", label: "Name (A-Z)" },
    { value: "name_desc", label: "Name (Z-A)" },
    { value: "unit_asc", label: "Unit (A-Z)" },
    { value: "step", label: "Onboarding stage" },
    { value: "status", label: "Status" },
  ];

  return (
    <>
      {/* Page header */}
      <div className={`flex flex-col sm:flex-row sm:items-end gap-4 ${embedded ? "justify-end mb-4" : "justify-between mb-10"}`}>
        {!embedded && (
        <div>
          <span className="block font-mono text-[11px] uppercase tracking-[0.28em] text-accent mb-3">Admin</span>
          <h1 className="font-['Hanken_Grotesk'] text-3xl font-extrabold text-foreground tracking-tight">
            Members
          </h1>
          <p className="text-foreground-variant font-['Inter'] font-medium mt-1">
            Full lifecycle, onboarding, active members, and move-outs.
          </p>
        </div>
        )}
        <button
          onClick={() => { setShowInvite(true); setInviteResult(null); setInviteUsername(""); setWizardStep(1); setWizardErrors({}); }}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-full font-['Inter'] font-bold text-sm hover:bg-accent/90 transition-colors shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          New Member
        </button>
      </div>

      {/* Invite Wizard Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowInvite(false)}>
          <div className="bg-surface rounded-2xl w-full max-w-lg border border-border overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Wizard header */}
            <div className="px-8 pt-6 pb-4 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-['Hanken_Grotesk'] text-xl font-bold text-foreground">New Member Setup</h2>
                <button onClick={() => setShowInvite(false)} className="text-foreground-variant hover:text-foreground">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              {/* Step indicator */}
              <div className="flex gap-1">
                {["Account", "Tenancy", "Review TA", "Done"].map((label, i) => (
                  <div key={label} className="flex items-center gap-1.5 flex-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      wizardStep > i + 1 ? "bg-accent text-white" : wizardStep === i + 1 ? "bg-accent text-white" : "bg-white/5 text-foreground-variant"
                    }`}>
                      {wizardStep > i + 1 ? <span className="material-symbols-outlined text-[14px]">check</span> : i + 1}
                    </div>
                    <span className={`font-['Inter'] text-[9px] uppercase tracking-widest font-bold hidden sm:inline ${wizardStep >= i + 1 ? "text-foreground" : "text-foreground-variant"}`}>{label}</span>
                    {i < 3 && <div className={`flex-1 h-0.5 rounded ${wizardStep > i + 1 ? "bg-accent" : "bg-white/10"}`} />}
                  </div>
                ))}
              </div>
            </div>

            <div className="px-8 py-6">
              {/* Step 1: Account */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold block">Username *</label>
                    <input
                      type="text"
                      value={inviteUsername}
                      onChange={(e) => setInviteUsername(e.target.value)}
                      placeholder="e.g. john-doe"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-['Inter'] text-foreground focus:ring-2 focus:ring-accent outline-none"
                    />
                    <p className="text-[10px] text-foreground-variant">Letters, numbers, hyphens, underscores. Min 3 chars. Password will be auto-generated.</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold block">Room *</label>
                    <select
                      value={inviteRoomId}
                      onChange={(e) => setInviteRoomId(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-['Inter'] text-foreground focus:ring-2 focus:ring-accent outline-none"
                    >
                      <option value="">Select room</option>
                      {[...rooms].sort((a, b) => {
                        const aOcc = !!occupiedRoomMap[a.id];
                        const bOcc = !!occupiedRoomMap[b.id];
                        if (aOcc !== bOcc) return aOcc ? 1 : -1;
                        return (a.unit_code || "").localeCompare(b.unit_code || "");
                      }).map(r => {
                        const occupant = occupiedRoomMap[r.id];
                        return (
                          <option key={r.id} value={r.id} disabled={!!occupant}>
                            {r.unit_code}, {r.name} ({r.properties?.name}){occupant ? ` (Occupied, ${occupant})` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  {wizardErrors.step1 && (
                    <p className="text-sm text-red-300 bg-red-500/15 rounded-lg px-3 py-2">{wizardErrors.step1}</p>
                  )}
                  <button
                    onClick={() => {
                      const errors = [];
                      if (!inviteUsername.trim() || inviteUsername.trim().length < 3) errors.push("Username is required (min 3 characters)");
                      if (!inviteRoomId) errors.push("Room is required");
                      if (errors.length > 0) {
                        setWizardErrors({ step1: errors.join(". ") + "." });
                        return;
                      }
                      setWizardErrors({});
                      setWizardStep(2);
                    }}
                    className="w-full py-3 bg-accent text-white rounded-xl font-['Inter'] font-bold text-sm hover:bg-accent/90 flex items-center justify-center gap-2"
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
                      <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold block">Monthly Rent (SGD) *</label>
                      <input
                        type="number" min="0" step="50"
                        value={inviteRent}
                        onChange={(e) => setInviteRent(e.target.value)}
                        placeholder="1200"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-['Inter'] text-foreground focus:ring-2 focus:ring-accent outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold block">Deposit (SGD) *</label>
                      <input
                        type="number" min="0" step="50"
                        value={inviteDeposit}
                        onChange={(e) => setInviteDeposit(e.target.value)}
                        placeholder="2400"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-['Inter'] text-foreground focus:ring-2 focus:ring-accent outline-none"
                      />
                    </div>
                  </div>
                  {/* Start date */}
                  <div className="space-y-1.5">
                    <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold block">Start Date *</label>
                    <input
                      type="date"
                      value={inviteStartDate}
                      onChange={(e) => setInviteStartDate(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-['Inter'] text-foreground focus:ring-2 focus:ring-accent outline-none"
                    />
                  </div>

                  {/* End date mode toggle */}
                  <div className="space-y-2">
                    <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold block">Tenancy End *</label>
                    <div className="flex gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => setInviteEndMode("months")}
                        className={`flex-1 py-2 rounded-lg text-xs font-['Inter'] font-bold border-2 transition-all ${
                          inviteEndMode === "months" ? "bg-accent text-white border-accent" : "bg-surface text-foreground-variant border-border"
                        }`}
                      >
                        By number of months
                      </button>
                      <button
                        type="button"
                        onClick={() => setInviteEndMode("date")}
                        className={`flex-1 py-2 rounded-lg text-xs font-['Inter'] font-bold border-2 transition-all ${
                          inviteEndMode === "date" ? "bg-accent text-white border-accent" : "bg-surface text-foreground-variant border-border"
                        }`}
                      >
                        By specific date
                      </button>
                    </div>

                    {inviteEndMode === "months" ? (
                      <select
                        value={inviteLicencePeriod}
                        onChange={(e) => setInviteLicencePeriod(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-['Inter'] text-foreground focus:ring-2 focus:ring-accent outline-none"
                      >
                        {Array.from({ length: 36 }, (_, i) => i + 1).map(m => (
                          <option key={m} value={m}>{m} month{m > 1 ? "s" : ""}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="date"
                        value={inviteEndDateManual}
                        onChange={(e) => setInviteEndDateManual(e.target.value)}
                        min={inviteStartDate || undefined}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-['Inter'] text-foreground focus:ring-2 focus:ring-accent outline-none"
                      />
                    )}
                  </div>

                  {/* Computed end date / period display */}
                  {inviteEndDate && inviteStartDate && (
                    <div className="bg-[#c47a35]/5 rounded-lg px-3 py-2 text-xs font-['Inter'] text-[#c47a35] flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">event</span>
                      <span>
                        {new Date(inviteStartDate + "T00:00:00").toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })}
                        {" → "}
                        <strong>{new Date(inviteEndDate + "T00:00:00").toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" })}</strong>
                        {" "}({calcLicencePeriod} months)
                      </span>
                    </div>
                  )}

                  {/* Reference Number, auto-generated, editable */}
                  <div className="space-y-1.5">
                    <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold block">
                      Reference Number <span className="normal-case tracking-normal text-foreground-variant">(auto-generated)</span>
                    </label>
                    <input
                      type="text"
                      value={inviteRefNumber}
                      onChange={(e) => setInviteRefNumber(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-['Inter'] text-foreground focus:ring-2 focus:ring-accent outline-none"
                    />
                  </div>

                  {inviteResult?.type === "error" && (
                    <p className="text-sm text-red-300 bg-red-500/15 rounded-lg px-3 py-2">{inviteResult.message}</p>
                  )}

                  {/* Review summary */}
                  <div className="bg-surface-container rounded-xl p-4 space-y-1.5 text-xs font-['Inter']">
                    <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold mb-2">Summary</p>
                    <p><span className="text-foreground-variant">Username:</span> <strong>{inviteUsername}</strong></p>
                    <p><span className="text-foreground-variant">Room:</span> <strong>{selectedRoom?.unit_code}, {selectedRoom?.name}</strong></p>
                    <p><span className="text-foreground-variant">Rent:</span> <strong>SGD {Number(inviteRent || 0).toLocaleString()}/mo</strong> · <span className="text-foreground-variant">Deposit:</span> <strong>SGD {Number(inviteDeposit || 0).toLocaleString()}</strong></p>
                    <p><span className="text-foreground-variant">Period:</span> <strong>{calcLicencePeriod} months</strong> from <strong>{inviteStartDate || "TBD"}</strong>{inviteEndDate ? ` to ${inviteEndDate}` : ""}</p>
                  </div>

                  {wizardErrors.step2 && (
                    <p className="text-sm text-red-300 bg-red-500/15 rounded-lg px-3 py-2">{wizardErrors.step2}</p>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setWizardStep(1)}
                      className="flex-1 py-3 bg-surface-container text-foreground-variant rounded-xl font-['Inter'] font-bold text-sm hover:bg-white/5"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => {
                        const errors = [];
                        if (!inviteRent) errors.push("Monthly rent is required");
                        if (!inviteDeposit) errors.push("Deposit is required");
                        if (!inviteStartDate) errors.push("Start date is required");
                        if (errors.length > 0) {
                          setWizardErrors({ step2: errors.join(". ") + "." });
                          return;
                        }
                        setWizardErrors({});
                        generateTaPreview();
                        setWizardStep(3);
                      }}
                      className="flex-[2] py-3 bg-accent text-white rounded-xl font-['Inter'] font-bold text-sm hover:bg-accent/90 flex items-center justify-center gap-2"
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
                  {taPreviewHtml ? (
                    <div className="space-y-3">
                      <div className="bg-emerald-500/15 rounded-xl p-4 flex items-start gap-3">
                        <span className="material-symbols-outlined text-emerald-300 text-[20px] shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                        <div>
                          <p className="text-sm font-bold text-emerald-300">Agreement generated</p>
                          <p className="text-xs text-emerald-300/80 mt-0.5">Auto-filled with member details. Click below to review the full document.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const w = window.open("", "_blank");
                          w.document.write(taPreviewHtml);
                          w.document.close();
                        }}
                        className="w-full py-3 bg-surface border-2 border-accent/20 text-accent rounded-xl font-['Inter'] font-bold text-sm hover:bg-accent/5 flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                        Preview Full Agreement in New Tab
                      </button>
                    </div>
                  ) : (
                    <div className="border border-dashed border-border rounded-xl p-8 text-center">
                      <div className="animate-pulse text-foreground-variant">
                        <span className="material-symbols-outlined text-[32px] mb-2 block">progress_activity</span>
                        <p className="text-sm">Loading agreement template...</p>
                      </div>
                    </div>
                  )}

                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-foreground-variant font-['Inter'] space-y-1">
                    <p><strong className="text-foreground">Ref: {inviteRefNumber}</strong></p>
                    <p>The TA will be finalised after the member completes onboarding (personal details + ID verification). You will counter-sign as a final check.</p>
                  </div>

                  {inviteResult?.type === "error" && (
                    <p className="text-sm text-red-300 bg-red-500/15 rounded-lg px-3 py-2">{inviteResult.message}</p>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setWizardStep(2)}
                      className="flex-1 py-3 bg-surface-container text-foreground-variant rounded-xl font-['Inter'] font-bold text-sm hover:bg-white/5"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleInvite}
                      disabled={inviting || !taPreviewHtml}
                      className="flex-[2] py-3 bg-accent text-white rounded-xl font-['Inter'] font-bold text-sm hover:bg-accent/90 disabled:opacity-40 flex items-center justify-center gap-2"
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
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/15 flex items-center justify-center">
                    <span className="material-symbols-outlined text-emerald-300 text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  </div>
                  <div>
                    <h3 className="font-['Hanken_Grotesk'] text-lg font-bold text-foreground mb-1">Member Created!</h3>
                    <p className="text-xs text-foreground-variant">Share these login credentials with the new member.</p>
                  </div>
                  <div className="bg-surface-container rounded-xl p-5 text-left space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-foreground-variant">Username</span>
                      <code className="text-sm font-bold text-foreground bg-white/5 px-2 py-0.5 rounded">{inviteResult.username}</code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-foreground-variant">Password</span>
                      <code className="text-sm font-bold text-foreground bg-white/5 px-2 py-0.5 rounded">{inviteResult.default_password}</code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-foreground-variant">Login URL</span>
                      <code className="text-xs text-accent bg-white/5 px-2 py-0.5 rounded">{PORTAL_HOST}/portal/login</code>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`Username: ${inviteResult.username}\nPassword: ${inviteResult.default_password}\nLogin: ${PORTAL_HOST}/portal/login`);
                    }}
                    className="w-full py-2.5 bg-accent/15 text-accent rounded-xl font-['Inter'] font-bold text-sm hover:bg-accent/25 flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[16px]">content_copy</span>
                    Copy Credentials
                  </button>

                  {/* TA options */}
                  <div className="border-t border-border pt-4 space-y-2">
                    <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold">Tenancy Agreement</p>
                    {taPreviewHtml ? (
                      <p className="text-xs text-emerald-300 bg-emerald-500/15 rounded-lg px-3 py-2">
                        <span className="material-symbols-outlined text-[14px] align-middle mr-1">check</span>
                        TA generated and sent to member for signing.
                      </p>
                    ) : (
                      <p className="text-xs text-foreground-variant">No TA template was available, you can generate it later from the member's profile.</p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowInvite(false);
                        // Navigate to member detail to review/manage TA
                        if (inviteResult.profile_id) {
                          // Find the onboarding ID
                          const row = rows.find(r => r.tenant_profile_id === inviteResult.profile_id);
                          if (row) navigate(`/portal/admin/onboarding/${row.id}`);
                        }
                      }}
                      className="flex-1 py-3 bg-accent text-white rounded-xl font-['Inter'] font-bold text-sm hover:bg-accent/90 flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                      View Member Profile
                    </button>
                    <button
                      onClick={() => setShowInvite(false)}
                      className="flex-1 py-3 bg-surface-container text-foreground-variant rounded-xl font-['Inter'] font-bold text-sm hover:bg-white/5"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stat cards, clickable to filter */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-6 mb-6">
        {[
          { label: "Total", count: rows.length, filter: "ALL", color: "text-foreground", bg: "bg-surface" },
          { label: "Registration", count: registrationCount, filter: "REGISTRATION", color: "text-purple-300", bg: "bg-surface" },
          { label: "Onboarding", count: onboardingCount, filter: "ONBOARDING", color: "text-blue-300", bg: "bg-surface" },
          { label: "Active", count: activeCount, filter: "ACTIVE", color: "text-accent", bg: "bg-surface" },
          { label: "Archived", count: archivedCount, filter: "ARCHIVED", color: "text-foreground-variant", bg: "bg-surface" },
        ].map(({ label, count, filter, color, bg }) => (
          <button
            key={filter}
            onClick={() => setLifecycleFilter(filter)}
            className={`${bg} rounded-2xl p-6 border-2 text-left transition-all ${
              lifecycleFilter === filter ? "border-accent ring-1 ring-accent/20" : "border-border hover:border-accent/30"
            }`}
          >
            <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold mb-3">{label}</p>
            {loading ? (
              <div className="h-8 w-10 bg-white/5 animate-pulse rounded" />
            ) : (
              <p className={`font-['Hanken_Grotesk'] text-3xl font-extrabold ${color}`}>{count}</p>
            )}
          </button>
        ))}
      </div>

      {/* Sort + filter controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-foreground-variant">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or unit…"
            className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 py-2 text-sm font-['Inter'] text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold">Property</span>
          <select
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
            className="bg-surface border border-border rounded-xl px-3 py-2 text-sm font-['Inter'] text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="ALL">All</option>
            <option value="CP">CP, Chiltern Park</option>
            <option value="IH">IH, Ivory Heights</option>
            <option value="TG">TG, Thomson Grove</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold">Sort</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-surface border border-border rounded-xl px-3 py-2 text-sm font-['Inter'] text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {!loading && (
          <span className="font-['Inter'] text-xs text-foreground-variant ml-auto">
            {filteredRows.length} shown
          </span>
        )}
      </div>

      {/* Active filter indicator */}
      {lifecycleFilter !== "ALL" && (
        <div className="mb-4 flex items-center gap-2">
          <span className="font-['Inter'] text-xs text-foreground-variant">
            Showing: <strong className="text-foreground">{lifecycleFilter.replace(/_/g, " ")}</strong>
          </span>
          <button onClick={() => setLifecycleFilter("ALL")} className="text-xs text-accent font-bold hover:underline">
            Clear filter
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          <div className="divide-y divide-white/10">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-8 py-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/5 animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-4 w-24 bg-white/5 animate-pulse rounded" />
                    <div className="h-3 w-32 bg-white/5 animate-pulse rounded" />
                  </div>
                </div>
                <div className="h-5 w-20 bg-white/5 animate-pulse rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-surface rounded-2xl p-12 border border-border text-center">
          <p className="text-foreground-variant font-['Inter'] text-sm">No onboarding records found.</p>
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-border relative">
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-surface to-transparent z-10 sm:hidden rounded-r-2xl"></div>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-surface-container">
              <tr>
                <th className="text-left px-8 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold">
                  Tenant
                </th>
                <th className="text-left px-6 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold">
                  Status
                </th>
                <th className="text-left px-6 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold">
                  Current Step
                </th>
                <th className="text-left px-6 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold hidden md:table-cell">
                  Lease
                </th>
                <th className="text-right px-6 py-4 font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredRows.map((row) => {
                const unitCode = row.tenant_profiles?.rooms?.unit_code ?? "-";
                const roomName = row.tenant_profiles?.rooms?.name ?? "";
                const tenantName = row.tenant_profiles?.tenant_details?.full_name ?? row.tenant_profiles?.username ?? "";
                const stepLabel = STEP_LABELS[row.current_step] ?? row.current_step;
                const stepColor = STEP_BADGE_COLORS[row.current_step] ?? "bg-surface-container text-foreground-variant";
                const statusColor = STATUS_BADGE_COLORS[row.status] ?? "bg-surface-container text-foreground-variant";
                const progress = getStepProgress(row.current_step);
                const initials = tenantName ? tenantName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : unitCode.slice(0, 2).toUpperCase();

                return (
                  <tr
                    key={row.id}
                    className="hover:bg-white/5 cursor-pointer transition-colors"
                    onClick={() => navigate(`/portal/admin/onboarding/${row.id}`)}
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center text-accent font-bold text-xs shrink-0">
                          {initials}
                        </div>
                        <div>
                          <p className="font-['Inter'] font-bold text-foreground text-sm capitalize">
                            {tenantName || unitCode}
                          </p>
                          <p className="font-['Inter'] text-foreground-variant text-xs">
                            {unitCode}{roomName ? `${roomName}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {isInProgress(row) && isRegistrationStep(row) ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-purple-500/15 text-purple-300">
                          REGISTRATION
                        </span>
                      ) : (
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${statusColor}`}>
                          {row.status ?? "-"}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${stepColor}`}>
                        {stepLabel}
                      </span>
                    </td>
                    <td className="px-6 py-5 hidden md:table-cell">
                      {row.tenancy_start_date ? (
                        <div className="font-['Inter'] text-xs text-foreground-variant">
                          <p>{formatDate(row.tenancy_start_date)}</p>
                          <p className="text-foreground-variant">to {formatDate(row.tenancy_end_date)}</p>
                        </div>
                      ) : (
                        <span className="font-['Inter'] text-xs text-foreground-variant">-</span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        {row.tenant_profiles?.username && (
                          <button
                            title={`Username: ${row.tenant_profiles.username}`}
                            onClick={() => {
                              navigator.clipboard.writeText(`Username: ${row.tenant_profiles.username}\nLogin: ${PORTAL_HOST}/portal/login`);
                              alert(`Username copied to clipboard.\n\nLogin: ${PORTAL_HOST}/portal/login`);
                            }}
                            className="p-1.5 rounded-lg hover:bg-white/5 text-foreground-variant hover:text-accent transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">key</span>
                          </button>
                        )}
                        {row.status === "ACTIVE" && (
                          <button
                            onClick={async () => {
                              if (!await confirm({ title: "Start offboarding for this tenant?" })) return;
                              await supabase.from("onboarding_progress").update({ status: "END_OF_TENANCY", current_step: "END_OF_TENANCY" }).eq("id", row.id);
                              fetchOnboarding();
                            }}
                            className="p-1.5 rounded-lg hover:bg-amber-500/15 text-foreground-variant hover:text-amber-300 transition-colors"
                            title="Start offboarding"
                          >
                            <span className="material-symbols-outlined text-[18px]">logout</span>
                          </button>
                        )}
                        {row.status !== "ARCHIVED" && row.status !== "MOVED_OUT" && (
                          <button
                            onClick={async () => {
                              if (!await confirm({ title: "Archive this tenant? They will be deactivated." })) return;
                              const { error: e1 } = await supabase.from("onboarding_progress").update({ status: "ARCHIVED" }).eq("id", row.id);
                              if (e1) { alert("Archive failed: " + e1.message); return; }
                              const { error: e2 } = await supabase.from("tenant_profiles").update({ is_active: false }).eq("id", row.tenant_profile_id);
                              if (e2) { alert("Profile deactivation failed: " + e2.message); return; }
                              fetchOnboarding();
                            }}
                            className="p-1.5 rounded-lg hover:bg-white/5 text-foreground-variant hover:text-foreground transition-colors"
                            title="Archive tenant"
                          >
                            <span className="material-symbols-outlined text-[18px]">archive</span>
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/portal/admin/onboarding/${row.id}`)}
                          className="p-1.5 rounded-lg hover:bg-white/5 text-accent transition-colors"
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
        </div>
      )}
    </>
  );
}

export default function AdminOnboardingPage() {
  return (
    <PortalLayout>
      <OnboardingLifecycle />
    </PortalLayout>
  );
}
