import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

const PRIORITY_BADGE = {
  INFO: "bg-blue-100 text-blue-700",
  WARNING: "bg-yellow-100 text-yellow-700",
  URGENT: "bg-red-100 text-red-700",
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
  const { profile } = useAuth();

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
      created_by: profile?.id ?? null,
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

  return (
    <PortalLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Announcements</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {showForm ? "Cancel" : "New Announcement"}
        </button>
      </div>

      {/* New announcement form */}
      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Post Announcement</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
                  placeholder="Announcement title"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Content
                </label>
                <textarea
                  required
                  rows={3}
                  value={form.content}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, content: e.target.value }))
                  }
                  className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background resize-none"
                  placeholder="Announcement details"
                />
              </div>

              {/* Priority + Property row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Priority
                  </label>
                  <div className="flex items-center gap-4">
                    {["INFO", "WARNING", "URGENT"].map((p) => (
                      <label key={p} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="priority"
                          value={p}
                          checked={form.priority === p}
                          onChange={() =>
                            setForm((f) => ({ ...f, priority: p }))
                          }
                          className="accent-primary"
                        />
                        <span className="text-sm capitalize">
                          {p.charAt(0) + p.slice(1).toLowerCase()}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Property */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Property
                  </label>
                  <select
                    value={form.property_id}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, property_id: e.target.value }))
                    }
                    className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
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

              {/* Expires at */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Expires at{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </label>
                <input
                  type="date"
                  value={form.expires_at}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, expires_at: e.target.value }))
                  }
                  className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {submitting ? "Posting…" : "Post"}
              </button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Announcements list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div className="h-5 w-40 bg-gray-100 animate-pulse rounded" />
                <div className="h-5 w-16 bg-gray-100 animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <p className="text-sm text-muted-foreground">No announcements yet.</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Title
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Priority
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Property
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Created
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {announcements.map((a) => {
                const expired = isExpired(a.expires_at);
                const active = a.is_active && !expired;

                return (
                  <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium max-w-[220px] truncate">
                      {a.title}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          PRIORITY_BADGE[a.priority] ?? "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {a.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {a.properties?.name ?? "All Properties"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(a.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          active
                            ? "bg-green-100 text-green-700"
                            : expired
                            ? "bg-gray-100 text-gray-500"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {active ? "Active" : expired ? "Expired" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {a.is_active && !expired && (
                        <button
                          onClick={() => handleDeactivate(a.id)}
                          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                        >
                          Deactivate
                        </button>
                      )}
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
