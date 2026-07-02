import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import Wordmark from "../../components/Wordmark";

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return "—";
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function LandlordPage() {
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase.rpc("get_landlord_roster");
      if (!active) return;
      if (error) setError(error.message);
      else setRows(data || []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }
  if (!user || !profile) return <Navigate to="/portal/login" replace />;
  if (profile.role !== "LANDLORD") return <Navigate to="/portal/dashboard" replace />;

  const propertyName = profile.properties?.name || "Your Property";
  const occupied = rows.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-surface">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Wordmark size="md" />
            <span className="hidden sm:inline text-xs font-['Inter'] font-bold uppercase tracking-widest text-accent border border-accent/30 rounded-full px-3 py-1">
              Landlord View
            </span>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-sm font-['Inter'] font-medium text-foreground-variant hover:text-accent transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">{propertyName}</h1>
          <p className="text-foreground-variant font-['Inter'] mt-1">
            Who's in each unit — move-in and move-out dates.
          </p>
        </div>

        {loading ? (
          <div className="text-foreground-variant text-sm py-16 text-center">Loading residents…</div>
        ) : error ? (
          <div className="p-4 bg-red-500/10 border border-red-500/25 rounded-xl text-red-300 text-sm font-['Inter']">
            Couldn't load residents: {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-foreground-variant text-sm py-16 text-center">No residents on record.</div>
        ) : (
          <>
            <div className="mb-4 text-sm font-['Inter'] text-foreground-variant">
              {occupied} {occupied === 1 ? "resident" : "residents"}
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-surface">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-surface-container">
                    {["Unit", "Resident", "Move-in", "Move-out", ""].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-[11px] font-['Inter'] font-bold uppercase tracking-widest text-foreground-variant"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-5 py-4 font-['Inter'] font-semibold text-foreground whitespace-nowrap">
                        {r.unit_code}
                      </td>
                      <td className="px-5 py-4 font-['Inter'] text-foreground">{r.full_name}</td>
                      <td className="px-5 py-4 font-['Inter'] text-foreground-variant whitespace-nowrap">
                        {fmtDate(r.move_in)}
                      </td>
                      <td className="px-5 py-4 font-['Inter'] text-foreground-variant whitespace-nowrap">
                        {fmtDate(r.move_out)}
                      </td>
                      <td className="px-5 py-4">
                        {r.status === "Upcoming" && (
                          <span className="text-[11px] font-['Inter'] font-bold uppercase tracking-wider text-amber-600 bg-amber-500/10 rounded-full px-2.5 py-1">
                            Upcoming
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
