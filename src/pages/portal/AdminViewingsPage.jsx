import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import PortalLayout from "../../components/portal/PortalLayout";

function generateToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(36)).join("").slice(0, 8);
}

export default function AdminViewingsPage() {
  const { user } = useAuth();
  const [viewings, setViewings] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    prospect_name: "",
    prospect_phone: "",
    prospect_email: "",
    property_id: "",
    viewing_date: "",
    viewing_time: "",
    meet_link: "",
    security_instructions: "",
    access_code: "",
    special_notes: "",
  });

  useEffect(() => {
    fetchViewings();
    supabase.from("properties").select("id, name").then(({ data }) => setProperties(data ?? []));
  }, []);

  async function fetchViewings() {
    const { data } = await supabase
      .from("property_viewings")
      .select("*, properties(name)")
      .order("viewing_date", { ascending: false });
    setViewings(data ?? []);
    setLoading(false);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.prospect_name.trim() || !form.property_id || !form.viewing_date) {
      setMessage({ type: "error", text: "Name, property, and date are required." });
      return;
    }
    setSaving(true);
    setMessage(null);

    const token = generateToken();
    const { error } = await supabase.from("property_viewings").insert({
      ...form,
      token,
      status: "SCHEDULED",
      created_by: user?.id || null,
    });

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      const url = `https://www.hyve.sg/view/${token}`;
      setMessage({ type: "success", text: `Viewing created! Link: ${url}`, url });
      setForm({ prospect_name: "", prospect_phone: "", prospect_email: "", property_id: "", viewing_date: "", viewing_time: "", meet_link: "", security_instructions: "", access_code: "", special_notes: "" });
      setShowForm(false);
      await fetchViewings();
    }
    setSaving(false);
  }

  const upcoming = viewings.filter(v => v.viewing_date >= new Date().toISOString().split("T")[0]);
  const past = viewings.filter(v => v.viewing_date < new Date().toISOString().split("T")[0]);

  return (
    <PortalLayout>
      <div className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a] tracking-tight">Viewings</h1>
          <p className="text-[#6c7a77] font-['Manrope'] font-medium mt-1">Create viewing links for prospects with directions, access codes, and video tour.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-['Manrope'] font-bold text-sm transition-colors shrink-0 ${showForm ? "bg-[#eff4ff] text-[#555f6f]" : "bg-[#006b5f] text-white hover:bg-[#006a61]"}`}>
          <span className="material-symbols-outlined text-[18px]">{showForm ? "close" : "add"}</span>
          {showForm ? "Cancel" : "New Viewing"}
        </button>
      </div>

      {message && (
        <div className={`mb-6 px-4 py-4 rounded-xl text-sm font-['Manrope'] ${message.type === "error" ? "bg-[#ffdad6]/40 text-[#ba1a1a]" : "bg-[#d1fae5] text-[#065f46]"}`}>
          <p>{message.text}</p>
          {message.url && (
            <div className="mt-2 flex items-center gap-2">
              <code className="text-xs bg-white/50 px-2 py-1 rounded">{message.url}</code>
              <button onClick={() => { navigator.clipboard.writeText(message.url); }}
                className="text-xs font-bold underline">Copy</button>
              <a href={`https://wa.me/?text=${encodeURIComponent(`Hi! Here's your viewing link: ${message.url}`)}`} target="_blank" rel="noopener noreferrer"
                className="text-xs font-bold underline">Share via WhatsApp</a>
            </div>
          )}
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm p-8 mb-8">
          <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-lg mb-6">Create Viewing</h2>
          <form onSubmit={handleCreate} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Prospect Name *</label>
                <input type="text" value={form.prospect_name} onChange={e => setForm(f => ({ ...f, prospect_name: e.target.value }))} required
                  className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] focus:ring-2 focus:ring-[#14b8a6] outline-none" placeholder="John Doe" />
              </div>
              <div className="space-y-1.5">
                <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Phone</label>
                <input type="tel" value={form.prospect_phone} onChange={e => setForm(f => ({ ...f, prospect_phone: e.target.value }))}
                  className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] focus:ring-2 focus:ring-[#14b8a6] outline-none" placeholder="+65 9123 4567" />
              </div>
              <div className="space-y-1.5">
                <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Email</label>
                <input type="email" value={form.prospect_email} onChange={e => setForm(f => ({ ...f, prospect_email: e.target.value }))}
                  className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] focus:ring-2 focus:ring-[#14b8a6] outline-none" placeholder="john@email.com" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Property *</label>
                <select value={form.property_id} onChange={e => setForm(f => ({ ...f, property_id: e.target.value }))} required
                  className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] focus:ring-2 focus:ring-[#14b8a6] outline-none">
                  <option value="">Select property</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Date *</label>
                <input type="date" value={form.viewing_date} onChange={e => setForm(f => ({ ...f, viewing_date: e.target.value }))} required
                  className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] focus:ring-2 focus:ring-[#14b8a6] outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Time</label>
                <input type="time" value={form.viewing_time} onChange={e => setForm(f => ({ ...f, viewing_time: e.target.value }))}
                  className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] focus:ring-2 focus:ring-[#14b8a6] outline-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Google Meet Link</label>
              <input type="url" value={form.meet_link} onChange={e => setForm(f => ({ ...f, meet_link: e.target.value }))}
                className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] focus:ring-2 focus:ring-[#14b8a6] outline-none" placeholder="https://meet.google.com/..." />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Security Instructions</label>
                <input type="text" value={form.security_instructions} onChange={e => setForm(f => ({ ...f, security_instructions: e.target.value }))}
                  className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] focus:ring-2 focus:ring-[#14b8a6] outline-none" placeholder="Tell guard you're visiting Hyve..." />
              </div>
              <div className="space-y-1.5">
                <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Door / Access Code</label>
                <input type="text" value={form.access_code} onChange={e => setForm(f => ({ ...f, access_code: e.target.value }))}
                  className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] focus:ring-2 focus:ring-[#14b8a6] outline-none" placeholder="1234#" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Special Notes</label>
              <textarea value={form.special_notes} onChange={e => setForm(f => ({ ...f, special_notes: e.target.value }))} rows={2}
                className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] focus:ring-2 focus:ring-[#14b8a6] outline-none resize-none" placeholder="Any additional info for the prospect..." />
            </div>

            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#006a61] disabled:opacity-40">
              <span className="material-symbols-outlined text-[18px]">{saving ? "progress_activity" : "link"}</span>
              {saving ? "Creating..." : "Create Viewing Link"}
            </button>
          </form>
        </div>
      )}

      {/* Upcoming Viewings */}
      <section className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm mb-6">
        <div className="px-8 py-5 border-b border-[#bbcac6]/15">
          <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#121c2a] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006b5f] text-[20px]">upcoming</span>
            Upcoming ({upcoming.length})
          </h2>
        </div>
        {upcoming.length === 0 ? (
          <div className="px-8 py-10 text-center text-sm text-[#6c7a77]">No upcoming viewings.</div>
        ) : (
          <div className="divide-y divide-[#bbcac6]/10">
            {upcoming.map(v => {
              const url = `https://www.hyve.sg/view/${v.token}`;
              return (
                <div key={v.id} className="px-8 py-5 flex items-center justify-between">
                  <div>
                    <p className="font-['Manrope'] font-bold text-sm text-[#121c2a]">{v.prospect_name}</p>
                    <p className="font-['Inter'] text-xs text-[#6c7a77]">
                      {v.properties?.name} · {new Date(v.viewing_date).toLocaleDateString("en-SG", { day: "numeric", month: "short" })} {v.viewing_time || ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { navigator.clipboard.writeText(url); setMessage({ type: "success", text: "Link copied!" }); }}
                      className="p-2 rounded-lg hover:bg-[#eff4ff] text-[#6c7a77] hover:text-[#006b5f] transition-colors" title="Copy link">
                      <span className="material-symbols-outlined text-[18px]">content_copy</span>
                    </button>
                    <a href={`https://wa.me/${v.prospect_phone?.replace(/\D/g, "") || ""}?text=${encodeURIComponent(`Hi ${v.prospect_name}! Here's your viewing link: ${url}`)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-green-50 text-[#6c7a77] hover:text-green-600 transition-colors" title="WhatsApp">
                      <span className="material-symbols-outlined text-[18px]">chat</span>
                    </a>
                    <a href={url} target="_blank" rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-[#eff4ff] text-[#006b5f] transition-colors" title="Preview">
                      <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Past Viewings */}
      {past.length > 0 && (
        <section className="bg-white rounded-2xl border border-[#bbcac6]/15 shadow-sm">
          <div className="px-8 py-5 border-b border-[#bbcac6]/15">
            <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#6c7a77] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#bbcac6] text-[20px]">history</span>
              Past ({past.length})
            </h2>
          </div>
          <div className="divide-y divide-[#bbcac6]/10">
            {past.map(v => (
              <div key={v.id} className="px-8 py-4 flex items-center justify-between opacity-60">
                <div>
                  <p className="font-['Manrope'] font-bold text-sm text-[#121c2a]">{v.prospect_name}</p>
                  <p className="font-['Inter'] text-xs text-[#6c7a77]">
                    {v.properties?.name} · {new Date(v.viewing_date).toLocaleDateString("en-SG", { day: "numeric", month: "short" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </PortalLayout>
  );
}
