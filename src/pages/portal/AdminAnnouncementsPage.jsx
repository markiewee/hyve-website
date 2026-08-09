import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import { confirm } from "../../lib/confirm";
import { notifyMember } from "../../lib/notify";

const PRIORITY_BADGE = {
  INFO: "bg-blue-500/15 text-blue-300",
  WARNING: "bg-amber-500/15 text-amber-300",
  URGENT: "bg-red-500/15 text-red-300",
};

const PRIORITY_CARD = {
  INFO: "border-blue-500/25 bg-blue-500/10",
  WARNING: "border-amber-500/25 bg-amber-500/10",
  URGENT: "border-red-500/25 bg-red-500/10",
};

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isExpired(expiresAt) {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

export default function AdminAnnouncementsPage() {
  const { user, profile } = useAuth();

  const [announcements, setAnnouncements] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    title: "",
    content: "",
    priority: "INFO",
    property_id: "",
    expires_at: "",
  });

  useEffect(() => {
    async function fetchData() {
      // Auto-deactivate any active announcements past their expiry. Cheap one-shot
      // sweep — runs whenever an admin opens this page, no cron needed.
      await supabase
        .from("announcements")
        .update({ is_active: false })
        .eq("is_active", true)
        .lt("expires_at", new Date().toISOString());

      const [announcementsRes, propertiesRes] = await Promise.all([
        supabase
          .from("announcements")
          .select(
            "id, title, content, priority, property_id, is_active, expires_at, created_at, properties(name)"
          )
          .order("created_at", { ascending: false }),
        supabase.from("properties").select("id, name").order("name"),
      ]);

      if (announcementsRes.error) {
        console.error("Error fetching announcements:", announcementsRes.error);
      }
      if (propertiesRes.error) {
        console.error("Error fetching properties:", propertiesRes.error);
      }

      setAnnouncements(announcementsRes.data ?? []);
      setProperties(propertiesRes.data ?? []);
      setLoading(false);
    }

    fetchData();
  }, []);

  async function handleDeactivate(id) {
    if (!await confirm({ title: "Are you sure?" })) return;
    const { error } = await supabase
      .from("announcements")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      console.error("Error deactivating announcement:", error);
      return;
    }

    setAnnouncements((prev) =>
      prev.map((a) => (a.id === id ? { ...a, is_active: false } : a))
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;

    setSubmitting(true);

    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      priority: form.priority,
      property_id: form.property_id || null,
      expires_at: form.expires_at || null,
      is_active: true,
      created_by: user?.id ?? null,
    };

    const { data, error } = await supabase
      .from("announcements")
      .insert(payload)
      .select(
        "id, title, content, priority, property_id, is_active, expires_at, created_at, properties(name)"
      )
      .single();

    setSubmitting(false);

    if (error) {
      console.error("Error posting announcement:", error);
      return;
    }

    // Email active members about the new announcement (non-blocking).
    // Scope to the announcement's property, or every property if global.
    try {
      let recipientQuery = supabase
        .from("tenant_profiles")
        .select("id")
        .eq("is_active", true)
        .in("role", ["TENANT", "HOUSE_CAPTAIN"]);
      if (payload.property_id) {
        recipientQuery = recipientQuery.eq("property_id", payload.property_id);
      }
      const { data: recipients, error: recipientError } = await recipientQuery;
      if (recipientError) throw recipientError;
      await Promise.all(
        (recipients ?? []).map((r) =>
          notifyMember(r.id, "ANNOUNCEMENT", {
            title: data.title,
            content: data.content,
            priority: data.priority,
          })
        )
      );
    } catch (notifyErr) {
      console.error("Announcement notify failed (non-blocking):", notifyErr);
    }

    setAnnouncements((prev) => [data, ...prev]);
    setForm({ title: "", content: "", priority: "INFO", property_id: "", expires_at: "" });
    setShowForm(false);
  }

  const activeCount = announcements.filter((a) => a.is_active && !isExpired(a.expires_at)).length;

  return (
    <PortalLayout>
      {/* Page header */}
      <div className="mb-10 flex items-start justify-between gap-4">
        <div>
          <span className="block font-mono text-[11px] uppercase tracking-[0.28em] text-accent mb-3">Property</span>
          <h1 className="font-display text-[34px] leading-[1.05] text-foreground">
            Announcements
          </h1>
          <p className="text-foreground-variant font-['Inter'] font-medium mt-1">
            Post and manage announcements to residents.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className={`px-3 sm:px-6 py-3 rounded-xl font-['Inter'] font-bold text-sm transition-all flex items-center gap-2 shrink-0 ${
            showForm
              ? "bg-surface-container text-foreground-variant hover:bg-white/5"
              : "bg-accent text-white hover:opacity-90"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {showForm ? "close" : "add"}
          </span>
          <span className="hidden sm:inline">{showForm ? "Cancel" : "New Announcement"}</span>
          <span className="sm:hidden">{showForm ? "" : "New"}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: form + stats */}
        <div className="lg:col-span-7 space-y-8">
          {/* New announcement form */}
          {showForm && (
            <div className="bg-surface rounded-2xl p-8 border border-border">
              <h2 className="font-display text-xl text-foreground mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-accent text-[20px]">campaign</span>
                Post Announcement
              </h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block font-['Inter'] text-xs uppercase tracking-widest text-foreground-variant font-bold mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full bg-surface-container border border-border rounded-xl px-4 py-3 font-['Inter'] text-foreground focus:ring-2 focus:ring-accent outline-none"
                    placeholder="Announcement title"
                  />
                </div>

                <div>
                  <label className="block font-['Inter'] text-xs uppercase tracking-widest text-foreground-variant font-bold mb-2">
                    Content
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={form.content}
                    onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                    className="w-full bg-surface-container border border-border rounded-xl px-4 py-3 font-['Inter'] text-foreground focus:ring-2 focus:ring-accent outline-none resize-none"
                    placeholder="Announcement details…"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block font-['Inter'] text-xs uppercase tracking-widest text-foreground-variant font-bold mb-3">
                      Priority
                    </label>
                    <div className="flex items-center gap-3">
                      {["INFO", "WARNING", "URGENT"].map((p) => (
                        <label key={p} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="priority"
                            value={p}
                            checked={form.priority === p}
                            onChange={() => setForm((f) => ({ ...f, priority: p }))}
                            className="accent-accent"
                          />
                          <span className="font-['Inter'] text-sm font-medium text-foreground">
                            {p.charAt(0) + p.slice(1).toLowerCase()}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-['Inter'] text-xs uppercase tracking-widest text-foreground-variant font-bold mb-2">
                      Property
                    </label>
                    <select
                      value={form.property_id}
                      onChange={(e) => setForm((f) => ({ ...f, property_id: e.target.value }))}
                      className="w-full bg-surface-container border border-border rounded-xl px-4 py-3 font-['Inter'] text-foreground focus:ring-2 focus:ring-accent outline-none"
                    >
                      <option value="">All Properties</option>
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-['Inter'] text-xs uppercase tracking-widest text-foreground-variant font-bold mb-2">
                    Expires At <span className="normal-case text-foreground-variant/60 font-normal">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={form.expires_at}
                    onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
                    className="w-full bg-surface-container border border-border rounded-xl px-4 py-3 font-['Inter'] text-foreground focus:ring-2 focus:ring-accent outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 bg-accent text-white rounded-xl font-['Inter'] font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                  {submitting ? "Posting…" : "Post Announcement"}
                </button>
              </form>
            </div>
          )}

          {/* Stats sub-grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface rounded-2xl p-6 border border-border">
              <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold mb-3">Active</p>
              <p className="font-display text-3xl font-extrabold text-accent">{activeCount}</p>
            </div>
            <div className="bg-surface rounded-2xl p-6 border border-border">
              <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold mb-3">Total</p>
              <p className="font-display text-3xl font-extrabold text-foreground">{announcements.length}</p>
            </div>
          </div>
        </div>

        {/* Right: active announcements stream */}
        <div className="lg:col-span-5">
          <div className="bg-surface rounded-2xl border border-border overflow-hidden h-full">
            <div className="px-6 py-5 border-b border-border flex items-center justify-between">
              <h2 className="font-display font-bold text-foreground">
                All Announcements
              </h2>
              <span className="font-['Inter'] text-[10px] uppercase tracking-widest text-foreground-variant font-bold">
                {announcements.length} total
              </span>
            </div>

            {loading ? (
              <div className="divide-y divide-white/10">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-6 space-y-3">
                    <div className="flex justify-between">
                      <div className="h-4 w-32 bg-surface-container animate-pulse rounded" />
                      <div className="h-5 w-14 bg-surface-container animate-pulse rounded-full" />
                    </div>
                    <div className="h-3 w-full bg-surface-container animate-pulse rounded" />
                  </div>
                ))}
              </div>
            ) : announcements.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-foreground-variant font-['Inter'] text-sm">No announcements yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/10 max-h-[600px] overflow-y-auto">
                {announcements.map((a) => {
                  const expired = isExpired(a.expires_at);
                  const active = a.is_active && !expired;
                  const cardStyle = PRIORITY_CARD[a.priority] ?? "";

                  return (
                    <div key={a.id} className={`p-6 ${active ? cardStyle : "opacity-50"}`}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="font-['Inter'] font-bold text-foreground text-sm leading-snug flex-1">
                          {a.title}
                        </p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest shrink-0 ${PRIORITY_BADGE[a.priority] ?? "bg-surface-container text-foreground-variant"}`}>
                          {a.priority}
                        </span>
                      </div>
                      <p className="font-['Inter'] text-foreground-variant text-xs mb-3 line-clamp-2">
                        {a.content}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-['Inter'] text-[10px] text-foreground-variant">
                            {a.properties?.name ?? "All Properties"}
                          </span>
                          <span className="text-foreground-variant/50">·</span>
                          <span className="font-['Inter'] text-[10px] text-foreground-variant">
                            {formatDate(a.created_at)}
                          </span>
                        </div>
                        {active && (
                          <button
                            onClick={() => handleDeactivate(a.id)}
                            className="font-['Inter'] text-[10px] font-bold text-foreground-variant hover:text-red-300 transition-colors uppercase tracking-widest"
                          >
                            Deactivate
                          </button>
                        )}
                        {!active && (
                          <span className="font-['Inter'] text-[10px] text-foreground-variant/50 uppercase tracking-widest">
                            {expired ? "Expired" : "Inactive"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
