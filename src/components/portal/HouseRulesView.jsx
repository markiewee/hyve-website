import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { Button } from "../ui/button";

export default function HouseRulesView({ onboarding, advanceStep, updateOnboarding }) {
  const { profile } = useAuth();
  const [rules, setRules] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchRules() {
      const propertyId = profile?.rooms?.property_id ?? null;

      // Try property-specific rules first, then fall back to global
      let data = null;

      if (propertyId) {
        const { data: specific } = await supabase
          .from("house_rules")
          .select("*")
          .eq("property_id", propertyId)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        data = specific;
      }

      if (!data) {
        const { data: global } = await supabase
          .from("house_rules")
          .select("*")
          .is("property_id", null)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        data = global;
      }

      setRules(data);
      setLoading(false);
    }

    fetchRules();
  }, [profile]);

  async function handleAcknowledge() {
    setAcknowledging(true);
    setError(null);
    try {
      await updateOnboarding({
        house_rules_acknowledged_at: new Date().toISOString(),
        house_rules_version_id: rules?.id ?? null,
      });
      await advanceStep("house_rules_acknowledged_at");
    } catch (err) {
      console.error("Error acknowledging house rules:", err);
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setAcknowledging(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-4 bg-gray-100 animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (!rules) {
    return (
      <div className="rounded-md border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">
          House rules are being finalised. Please check back shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Rules content */}
      <div className="border border-border rounded-md overflow-auto max-h-[440px]">
        <div className="p-5">
          {rules.title && (
            <h3 className="text-base font-semibold text-foreground mb-4">
              {rules.title}
            </h3>
          )}
          <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {rules.content}
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button
        type="button"
        onClick={handleAcknowledge}
        disabled={acknowledging}
        className="w-full sm:w-auto"
      >
        {acknowledging
          ? "Saving…"
          : "I acknowledge and agree to the house rules"}
      </Button>
    </div>
  );
}
