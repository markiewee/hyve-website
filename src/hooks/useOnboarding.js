import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

export const STEPS = [
  "WELCOME",
  "PERSONAL_DETAILS",
  "ID_VERIFICATION",
  "SIGN_TA",
  "DEPOSIT",
  "HOUSE_RULES",
  "MOVE_IN_INSTRUCTIONS",
  "MOVE_IN_CHECKLIST",
  "ACTIVE",
  "END_OF_TENANCY",
];

export const STEP_LABELS = {
  WELCOME: "Welcome Guide",
  PERSONAL_DETAILS: "Personal Details",
  ID_VERIFICATION: "ID Verification",
  SIGN_TA: "Sign Agreement",
  DEPOSIT: "Security Deposit",
  HOUSE_RULES: "House Rules",
  MOVE_IN_INSTRUCTIONS: "Move-in Info",
  MOVE_IN_CHECKLIST: "Move-in Checklist",
  ACTIVE: "Active Tenant",
  END_OF_TENANCY: "End of Tenancy",
};

export const REGISTRATION_STEPS = ["WELCOME", "PERSONAL_DETAILS", "ID_VERIFICATION", "SIGN_TA"];
export const ONBOARDING_STEPS = ["DEPOSIT", "HOUSE_RULES", "MOVE_IN_INSTRUCTIONS", "MOVE_IN_CHECKLIST"];

// Dashboard access is granted by EITHER of two branches, and the pair is strictly
// more permissive than the step branch alone, so no tenant can ever lose access
// that they have today.
//
// The step branch is the original rule. It is retained because legacy tenants
// were onboarded before or outside this wizard and sit at current_step = ACTIVE
// with completion timestamps that were never backfilled. Dropping it would lock
// nine paying tenants out of their own dashboard.
//
// The derived branch exists so that a rewind cannot revoke access that has
// genuinely been earned. current_step moves backwards both by accident (the Back
// button writes it straight back to the row) and on purpose (an admin rewinding a
// tenant to force a re-do), and a tenant whose timestamps say they finished
// onboarding keeps their dashboard through either.
const DASHBOARD_ACCESS_STEPS = ["MOVE_IN_CHECKLIST", "ACTIVE", "END_OF_TENANCY"];

// The steps standing between a tenant and the move-in-checklist stage that
// actually record a timestamp. WELCOME and MOVE_IN_INSTRUCTIONS record none.
const DASHBOARD_ACCESS_COMPLETIONS = [
  "PERSONAL_DETAILS",
  "ID_VERIFICATION",
  "SIGN_TA",
  "DEPOSIT",
  "HOUSE_RULES",
];

export function useOnboarding(profileId) {
  const [onboarding, setOnboarding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOnboarding = useCallback(async () => {
    if (!profileId) {
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from("onboarding_progress")
      .select("*")
      .eq("tenant_profile_id", profileId)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Error fetching onboarding:", fetchError);
      setError(fetchError.message);
    } else {
      setOnboarding(data ?? null);
    }
    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    fetchOnboarding();
  }, [fetchOnboarding]);

  const currentStep = onboarding?.current_step ?? "PERSONAL_DETAILS";

  // Check which steps are completed (have a completion timestamp)
  const completionFields = {
    PERSONAL_DETAILS: "personal_details_completed_at",
    ID_VERIFICATION: "id_verification_completed_at",
    SIGN_TA: "ta_signed_at",
    DEPOSIT: "deposit_completed_at",
    HOUSE_RULES: "house_rules_acknowledged_at",
    MOVE_IN_CHECKLIST: "move_in_checklist_completed_at",
  };

  function isStepCompleted(step) {
    const field = completionFields[step];
    return field ? !!onboarding?.[field] : false;
  }

  // Additive, never subtractive: at/past the old step boundary, OR the timestamps
  // say they are onboarded. On the derived branch an unsigned agreement is an
  // absolute bar, and beyond that either having finished the move-in checklist or
  // having cleared every milestone ahead of it counts as onboarded.
  const hasDashboardAccess =
    DASHBOARD_ACCESS_STEPS.includes(currentStep) ||
    (isStepCompleted("SIGN_TA") &&
      (isStepCompleted("MOVE_IN_CHECKLIST") ||
        DASHBOARD_ACCESS_COMPLETIONS.every((step) => isStepCompleted(step))));
  const needsOnboarding = !hasDashboardAccess;

  const currentIndex = STEPS.indexOf(currentStep);
  const canGoBack = currentIndex > 0;

  async function goToStep(targetStep) {
    if (!onboarding) return;
    const targetIndex = STEPS.indexOf(targetStep);
    // Can only go back to completed steps or forward to the current step
    if (targetIndex > currentIndex) return;

    const { data, error: updateError } = await supabase
      .from("onboarding_progress")
      .update({ current_step: targetStep, updated_at: new Date().toISOString() })
      .eq("id", onboarding.id)
      .select()
      .single();

    if (updateError) {
      console.error("Error navigating step:", updateError);
      throw updateError;
    }
    setOnboarding(data);
    return data;
  }

  async function goBack() {
    if (!canGoBack) return;
    const prevStep = STEPS[currentIndex - 1];
    return goToStep(prevStep);
  }

  async function advanceStep(completionField) {
    if (!onboarding) return;

    const currentIndex = STEPS.indexOf(currentStep);
    const nextStep = STEPS[currentIndex + 1] ?? "ACTIVE";

    const isComplete = nextStep === "ACTIVE" || nextStep === "END_OF_TENANCY";

    const updates = {
      current_step: nextStep,
      status: isComplete ? "ACTIVE" : "ONBOARDING",
      updated_at: new Date().toISOString(),
    };

    if (completionField) {
      updates[completionField] = new Date().toISOString();
    }

    const { data, error: updateError } = await supabase
      .from("onboarding_progress")
      .update(updates)
      .eq("id", onboarding.id)
      .select()
      .single();

    if (updateError) {
      console.error("Error advancing step:", updateError);
      throw updateError;
    }

    setOnboarding(data);
    return data;
  }

  async function updateOnboarding(fields) {
    if (!onboarding) return;

    const { data, error: updateError } = await supabase
      .from("onboarding_progress")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", onboarding.id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating onboarding:", updateError);
      throw updateError;
    }

    setOnboarding(data);
    return data;
  }

  return {
    onboarding,
    loading,
    error,
    currentStep,
    hasDashboardAccess,
    needsOnboarding,
    advanceStep,
    updateOnboarding,
    goBack,
    goToStep,
    canGoBack,
    isStepCompleted,
    refetch: fetchOnboarding,
  };
}
