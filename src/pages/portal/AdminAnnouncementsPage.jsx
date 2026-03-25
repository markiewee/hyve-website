import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";

const PRIORITY_BADGE = {
  INFO: "bg-blue-100 text-blue-700",
  WARNING: "bg-amber-100 text-amber-700",
  URGENT: "bg-[#ffdad6] text-[#ba1a1a]",
};

const PRIORITY_CARD = {
  INFO: "border-blue-200 bg-blue-50/50",
  WARNING: "border-amber-200 bg-amber-50/50",
  URGENT: "border-[#ba1a1a]/20 bg-[#ffdad6]/30",
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
          <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a] tracking-tight">
            Announcements
          </h1>
          <p className="text-[#6c7a77] font-['Manrope'] font-medium mt-1">
            Post and manage announcements to residents.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className={`px-6 py-3 rounded-xl font-['Manrope'] font-bold text-sm transition-all flex items-center gap-2 shrink-0 ${
            showForm
              ? "bg-[#eff4ff] text-[#555f6f] hover:bg-[#d9e3f6]"
              : "bg-[#006b5f] text-white hover:opacity-90 shadow-sm"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {showForm ? "close" : "add"}
          </span>
          {showForm ? "Cancel" : "New Announcement"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: form + stats */}
        <div className="lg:col-span-7 space-y-8">
          {/* New announcement form */}
          {showForm && (
            <div className="bg-white rounded-2xl p-8 border border-[#bbcac6]/15 shadow-sm">
              <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#121c2a] mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#006b5f] text-[20px]">campaign</span>
                Post Announcement
              </h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
                    placeholder="Announcement title"
                  />
                </div>

                <div>
                  <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-2">
                    Content
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={form.content}
                    onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                    className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none resize-none"
                    placeholder="Announcement details…"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-3">
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
                            className="accent-[#006b5f]"
                          />
                          <span className="font-['Manrope'] text-sm font-medium text-[#121c2a]">
                            {p.charAt(0) + p.slice(1).toLowerCase()}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-2">
                      Property
                    </label>
                    <select
                      value={form.property_id}
                      onChange={(e) => setForm((f) => ({ ...f, property_id: e.target.value }))}
                      className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
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
                  <label className="block font-['Inter'] text-xs uppercase tracking-widest text-[#6c7a77] font-bold mb-2">
                    Expires At <span className="normal-case text-[#6c7a77]/60 font-normal">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={form.expires_at}
                    onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
                    className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                  {submitting ? "Posting…" : "Post Announcement"}
                </button>
              </form>
            </div>
          )}

          {/* Stats sub-grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm">
              <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-3">Active</p>
              <p className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#006b5f]">{activeCount}</p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-[#bbcac6]/15 shadow-sm">
              <p className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold mb-3">Total</p>
              <p className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a]">{announcements.length}</p>
            </div>
          </div>
        </div>

        {/* Right: active announcements stream */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm overflow-hidden h-full">
            <div className="px-6 py-5 border-b border-[#bbcac6]/15 flex items-center justify-between">
              <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a]">
                All Announcements
              </h2>
              <span className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold">
                {announcements.length} total
              </span>
            </div>

            {loading ? (
              <div className="divide-y divide-[#bbcac6]/10">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-6 space-y-3">
                    <div className="flex justify-between">
                      <div className="h-4 w-32 bg-[#eff4ff] animate-pulse rounded" />
                      <div className="h-5 w-14 bg-[#eff4ff] animate-pulse rounded-full" />
                    </div>
                    <div className="h-3 w-full bg-[#eff4ff] animate-pulse rounded" />
                  </div>
                ))}
              </div>
            ) : announcements.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-[#6c7a77] font-['Manrope'] text-sm">No announcements yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#bbcac6]/10 max-h-[600px] overflow-y-auto">
                {announcements.map((a) => {
                  const expired = isExpired(a.expires_at);
                  const active = a.is_active && !expired;
                  const cardStyle = PRIORITY_CARD[a.priority] ?? "";

                  return (
                    <div key={a.id} className={`p-6 ${active ? cardStyle : "opacity-50"}`}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="font-['Manrope'] font-bold text-[#121c2a] text-sm leading-snug flex-1">
                          {a.title}
                        </p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest shrink-0 ${PRIORITY_BADGE[a.priority] ?? "bg-[#eff4ff] text-[#555f6f]"}`}>
                          {a.priority}
                        </span>
                      </div>
                      <p className="font-['Manrope'] text-[#6c7a77] text-xs mb-3 line-clamp-2">
                        {a.content}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-['Inter'] text-[10px] text-[#6c7a77]">
                            {a.properties?.name ?? "All Properties"}
                          </span>
                          <span className="text-[#bbcac6]">·</span>
                          <span className="font-['Inter'] text-[10px] text-[#6c7a77]">
                            {formatDate(a.created_at)}
                          </span>
                        </div>
                        {active && (
                          <button
                            onClick={() => handleDeactivate(a.id)}
                            className="font-['Inter'] text-[10px] font-bold text-[#6c7a77] hover:text-[#ba1a1a] transition-colors uppercase tracking-widest"
                          >
                            Deactivate
                          </button>
                        )}
                        {!active && (
                          <span className="font-['Inter'] text-[10px] text-[#bbcac6] uppercase tracking-widest">
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
