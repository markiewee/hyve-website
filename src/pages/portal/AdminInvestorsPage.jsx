import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Alert, AlertDescription } from "../../components/ui/alert";

function formatSGD(amount) {
  if (amount == null) return "—";
  return `$${Number(amount).toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const STATUS_BADGE = {
  true: "bg-green-100 text-green-700",
  false: "bg-gray-100 text-gray-500",
};

const INVITE_BASE_URL =
  typeof window !== "undefined"
    ? `${window.location.origin}/portal/investor/signup`
    : "https://hyve.sg/portal/investor/signup";

export default function AdminInvestorsPage() {
  const [investors, setInvestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [investorInvestments, setInvestorInvestments] = useState({});

  // Invite form
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [inviteUrl, setInviteUrl] = useState(null);

  // Add investment form
  const [addInvForm, setAddInvForm] = useState({}); // keyed by investor id

  const fetchInvestors = useCallback(async () => {
    const { data, error } = await supabase
      .from("investors")
      .select("*, investments(id, property_id, capital_contributed, share_percentage, properties(name, code))")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching investors:", error);
      return;
    }
    setInvestors(data ?? []);
    setLoading(false);
  }, []);

  const fetchProperties = useCallback(async () => {
    const { data } = await supabase
      .from("properties")
      .select("id, name, code")
      .order("name");
    setProperties(data ?? []);
  }, []);

  useEffect(() => {
    fetchInvestors();
    fetchProperties();
  }, [fetchInvestors, fetchProperties]);

  async function handleInvite(e) {
    e.preventDefault();
    setInviting(true);
    setInviteError(null);
    setInviteUrl(null);

    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { error } = await supabase.from("investors").insert({
      full_name: inviteName,
      email: inviteEmail,
      invite_token: token,
      invite_expires_at: expiresAt.toISOString(),
      is_active: false,
    });

    if (error) {
      setInviteError(error.message);
      setInviting(false);
      return;
    }

    setInviteUrl(`${INVITE_BASE_URL}?token=${token}`);
    setInviteName("");
    setInviteEmail("");
    setInviting(false);
    fetchInvestors();
  }

  async function handleToggleExpand(investorId) {
    if (expandedId === investorId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(investorId);
  }

  async function handleAddInvestment(investorId) {
    const form = addInvForm[investorId] ?? {};
    const { propertyId, capital } = form;
    if (!propertyId || !capital) return;

    const capitalNum = Number(capital);

    // Get all existing investors for this property
    const { data: existing } = await supabase
      .from("investments")
      .select("id, investor_id, capital_contributed")
      .eq("property_id", propertyId);

    const existingList = existing ?? [];
    const totalCapital = existingList.reduce(
      (sum, i) => sum + Number(i.capital_contributed ?? 0),
      0
    ) + capitalNum;

    // Insert new investment
    const { error: insertError } = await supabase.from("investments").insert({
      investor_id: investorId,
      property_id: propertyId,
      capital_contributed: capitalNum,
      share_percentage: totalCapital > 0 ? (capitalNum / totalCapital) * 100 : 0,
    });

    if (insertError) {
      console.error("Insert investment error:", insertError);
      return;
    }

    // Recalculate share_percentage for all investors in this property
    const updatedList = [
      ...existingList,
      { investor_id: investorId, capital_contributed: capitalNum },
    ];

    for (const inv of updatedList) {
      const share =
        totalCapital > 0
          ? (Number(inv.capital_contributed) / totalCapital) * 100
          : 0;
      if (inv.id) {
        await supabase
          .from("investments")
          .update({ share_percentage: share })
          .eq("id", inv.id);
      }
    }

    // Reset form and refetch
    setAddInvForm((prev) => ({ ...prev, [investorId]: {} }));
    fetchInvestors();
  }

  return (
    <PortalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Investors</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage investor profiles, track capital, and send invitations.
        </p>
      </div>

      {/* Invite Investor */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Invite Investor</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex flex-col gap-1.5">
              <Label htmlFor="inv-name">Full Name</Label>
              <Input
                id="inv-name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Jane Tan"
                required
              />
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <Label htmlFor="inv-email">Email</Label>
              <Input
                id="inv-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="jane@example.com"
                required
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={inviting}>
                {inviting ? "Sending…" : "Send Invite"}
              </Button>
            </div>
          </form>

          {inviteError && (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription>{inviteError}</AlertDescription>
            </Alert>
          )}

          {inviteUrl && (
            <div className="mt-3 p-3 rounded-md bg-green-50 border border-green-200">
              <p className="text-sm font-medium text-green-800 mb-1">Invite link created (expires in 30 days):</p>
              <p className="text-xs font-mono text-green-700 break-all">{inviteUrl}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  navigator.clipboard.writeText(inviteUrl);
                }}
              >
                Copy Link
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Investor List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Investors</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-gray-100 animate-pulse rounded" />
              ))}
            </div>
          ) : investors.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">No investors yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {investors.map((inv) => {
                const totalCapital = (inv.investments ?? []).reduce(
                  (sum, i) => sum + Number(i.capital_contributed ?? 0),
                  0
                );
                const propBadges = (inv.investments ?? [])
                  .map((i) => i.properties?.code)
                  .filter(Boolean);
                const isExpanded = expandedId === inv.id;
                const form = addInvForm[inv.id] ?? {};

                return (
                  <div key={inv.id}>
                    {/* Row */}
                    <button
                      onClick={() => handleToggleExpand(inv.id)}
                      className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {inv.full_name ?? inv.name ?? "—"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {inv.email}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap shrink-0">
                          {propBadges.map((code) => (
                            <span
                              key={code}
                              className="text-xs font-mono bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded"
                            >
                              {code}
                            </span>
                          ))}
                          <span className="text-sm tabular-nums font-semibold">
                            SGD {formatSGD(totalCapital)}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded font-medium ${
                              STATUS_BADGE[String(inv.is_active)]
                            }`}
                          >
                            {inv.is_active ? "Active" : "Pending"}
                          </span>
                        </div>
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="bg-muted/20 border-t border-border px-4 py-4">
                        <h4 className="text-sm font-semibold mb-3">
                          Investments
                        </h4>

                        {(inv.investments ?? []).length === 0 ? (
                          <p className="text-xs text-muted-foreground mb-3">
                            No investments yet.
                          </p>
                        ) : (
                          <div className="overflow-x-auto mb-4">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-xs text-muted-foreground">
                                  <th className="py-1 pr-4 font-medium">Property</th>
                                  <th className="py-1 pr-4 font-medium text-right">Capital</th>
                                  <th className="py-1 font-medium text-right">Share %</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {(inv.investments ?? []).map((i) => (
                                  <tr key={i.id}>
                                    <td className="py-2 pr-4">
                                      {i.properties?.name ?? "—"}
                                    </td>
                                    <td className="py-2 pr-4 text-right tabular-nums">
                                      SGD {formatSGD(i.capital_contributed)}
                                    </td>
                                    <td className="py-2 text-right tabular-nums">
                                      {Number(i.share_percentage ?? 0).toFixed(1)}%
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Add Investment form */}
                        <h4 className="text-sm font-semibold mb-2">Add Investment</h4>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="flex-1">
                            <Label className="text-xs mb-1 block">Property</Label>
                            <select
                              className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background"
                              value={form.propertyId ?? ""}
                              onChange={(e) =>
                                setAddInvForm((prev) => ({
                                  ...prev,
                                  [inv.id]: { ...form, propertyId: e.target.value },
                                }))
                              }
                            >
                              <option value="">Select property…</option>
                              {properties.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.code})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex-1">
                            <Label className="text-xs mb-1 block">Capital (SGD)</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="e.g. 50000"
                              value={form.capital ?? ""}
                              onChange={(e) =>
                                setAddInvForm((prev) => ({
                                  ...prev,
                                  [inv.id]: { ...form, capital: e.target.value },
                                }))
                              }
                            />
                          </div>
                          <div className="flex items-end">
                            <Button
                              size="sm"
                              onClick={() => handleAddInvestment(inv.id)}
                              disabled={!form.propertyId || !form.capital}
                            >
                              Add
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </PortalLayout>
  );
}
