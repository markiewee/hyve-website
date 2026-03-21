import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import { STEP_LABELS } from "../../hooks/useOnboarding";

const STEP_BADGE_COLORS = {
  PERSONAL_DETAILS: "bg-gray-100 text-gray-700",
  ID_VERIFICATION: "bg-blue-100 text-blue-700",
  SIGN_TA: "bg-purple-100 text-purple-700",
  DEPOSIT: "bg-yellow-100 text-yellow-700",
  HOUSE_RULES: "bg-orange-100 text-orange-700",
  MOVE_IN_CHECKLIST: "bg-indigo-100 text-indigo-700",
  ACTIVE: "bg-green-100 text-green-700",
  END_OF_TENANCY: "bg-red-100 text-red-700",
};

const STATUS_BADGE_COLORS = {
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  ACTIVE: "bg-green-100 text-green-700",
  COMPLETE: "bg-green-100 text-green-700",
  BLOCKED: "bg-red-100 text-red-700",
};

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminOnboardingPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOnboarding() {
      const { data, error } = await supabase
        .from("onboarding_progress")
        .select(
          "id, current_step, status, created_at, tenant_profile_id, tenant_profiles(id, role, rooms(unit_code, name))"
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching onboarding progress:", error);
      }
      setRows(data ?? []);
      setLoading(false);
    }

    fetchOnboarding();
  }, []);

  return (
    <PortalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Tenant Onboarding</h1>
        {!loading && (
          <p className="text-muted-foreground text-sm mt-1">
            {rows.length} onboarding record{rows.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div className="h-5 w-24 bg-gray-100 animate-pulse rounded" />
                <div className="h-5 w-20 bg-gray-100 animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No onboarding records found.</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Room</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Current Step</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                const unitCode =
                  row.tenant_profiles?.rooms?.unit_code ?? "—";
                const stepLabel = STEP_LABELS[row.current_step] ?? row.current_step;
                const stepColor =
                  STEP_BADGE_COLORS[row.current_step] ?? "bg-gray-100 text-gray-700";
                const statusColor =
                  STATUS_BADGE_COLORS[row.status] ?? "bg-gray-100 text-gray-700";

                return (
                  <tr
                    key={row.id}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => navigate(`/portal/admin/onboarding/${row.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-medium">
                      {unitCode}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColor}`}
                      >
                        {row.status ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${stepColor}`}
                      >
                        {stepLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(row.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PortalLayout>
  );
}
