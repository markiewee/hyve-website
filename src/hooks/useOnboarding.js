import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

export const STEPS = [
  "PERSONAL_DETAILS",
  "ID_VERIFICATION",
  "SIGN_TA",
  "DEPOSIT",
  "HOUSE_RULES",
  "MOVE_IN_CHECKLIST",
  "ACTIVE",
  "END_OF_TENANCY",
];

export const STEP_LABELS = {
  PERSONAL_DETAILS: "Personal Details",
  ID_VERIFICATION: "ID Verification",
  SIGN_TA: "Sign Agreement",
  DEPOSIT: "Security Deposit",
  HOUSE_RULES: "House Rules",
  MOVE_IN_CHECKLIST: "Move-in Checklist",
  ACTIVE: "Active Tenant",
  END_OF_TENANCY: "End of Tenancy",
};

const DASHBOARD_ACCESS_STEPS = ["MOVE_IN_CHECKLIST", "ACTIVE", "END_OF_TENANCY"];

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
  const hasDashboardAccess = DASHBOARD_ACCESS_STEPS.includes(currentStep);
  const needsOnboarding = !hasDashboardAccess;

  async function advanceStep(completionField) {
    if (!onboarding) return;

    const currentIndex = STEPS.indexOf(currentStep);
    const nextStep = STEPS[currentIndex + 1] ?? "ACTIVE";

    const isComplete = nextStep === "ACTIVE" || nextStep === "END_OF_TENANCY";

    const updates = {
      current_step: nextStep,
      status: isComplete ? "ACTIVE" : "IN_PROGRESS",
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
    refetch: fetchOnboarding,
  };
}
