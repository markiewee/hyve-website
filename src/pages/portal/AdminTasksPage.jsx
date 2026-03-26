import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import PortalLayout from "../../components/portal/PortalLayout";
import { supabase } from "../../lib/supabase";

const CATEGORIES = ["MOVE_OUT", "MOVE_IN", "MAINTENANCE", "DOCUMENT", "BILLING", "ONBOARDING", "OTHER"];
const STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const PRIORITIES = ["URGENT", "HIGH", "MEDIUM", "LOW"];

const CAT_COLORS = {
  MOVE_OUT: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  MOVE_IN: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  MAINTENANCE: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  DOCUMENT: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  BILLING: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  ONBOARDING: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
  OTHER: { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" },
};

const PRIORITY_COLORS = {
  URGENT: "text-red-600",
  HIGH: "text-orange-600",
  MEDIUM: "text-yellow-600",
  LOW: "text-gray-500",
};

const STATUS_ICONS = {
  PENDING: "schedule",
  IN_PROGRESS: "pending",
  COMPLETED: "check_circle",
  CANCELLED: "cancel",
};

function TaskCard({ task, onUpdate, onDelete }) {
  const cat = CAT_COLORS[task.category] || CAT_COLORS.OTHER;
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "COMPLETED" && task.status !== "CANCELLED";

  return (
    <div className={`bg-white rounded-xl border ${isOverdue ? "border-red-300" : "border-[#bbcac6]/20"} p-5 hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${cat.bg} ${cat.text} border ${cat.border}`}>
              {task.category.replace("_", " ")}
            </span>
            <span className={`text-xs font-semibold ${PRIORITY_COLORS[task.priority]}`}>
              {task.priority === "URGENT" ? "🔴" : task.priority === "HIGH" ? "🟠" : task.priority === "MEDIUM" ? "🟡" : "⚪"} {task.priority}
            </span>
          </div>
          <h3 className="font-['Manrope'] font-bold text-[#121c2a] text-sm truncate">{task.title}</h3>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <select
            value={task.status}
            onChange={(e) => {
              if (!confirm(`Are you sure you want to change status to ${e.target.value.replace("_", " ")}?`)) return;
              onUpdate(task.id, { status: e.target.value, completed_at: e.target.value === "COMPLETED" ? new Date().toISOString() : null });
            }}
            className="text-xs bg-transparent border border-[#bbcac6]/30 rounded-lg px-2 py-1 font-['Inter'] text-[#6c7a77] focus:ring-1 focus:ring-[#006b5f] outline-none"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </select>
        </div>
      </div>

      {task.description && (
        <p className="text-xs text-[#6c7a77] font-['Inter'] leading-relaxed mb-3 line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center gap-4 text-xs text-[#6c7a77] font-['Inter']">
        {task.tenant_name && (
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">person</span>
            {task.tenant_name}
          </span>
        )}
        {task.assigned_to && (
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">assignment_ind</span>
            {task.assigned_to}
          </span>
        )}
        {task.due_date && (
          <span className={`flex items-center gap-1 ${isOverdue ? "text-red-500 font-semibold" : ""}`}>
            <span className="material-symbols-outlined text-[14px]">event</span>
            {new Date(task.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            {isOverdue && " (overdue)"}
          </span>
        )}
      </div>
    </div>
  );
}

function NewTaskModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "OTHER",
    priority: "MEDIUM",
    assigned_to: "",
    due_date: "",
    tenant_name: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    await onSave({
      ...form,
      due_date: form.due_date || null,
      assigned_to: form.assigned_to || null,
      tenant_name: form.tenant_name || null,
    });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-[#bbcac6]/10">
          <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#121c2a]">New Task</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-['Inter'] font-semibold text-[#6c7a77] uppercase tracking-wider mb-1">Title *</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2.5 bg-[#f8f9ff] border-0 rounded-lg text-sm font-['Inter'] text-[#121c2a] focus:ring-2 focus:ring-[#006b5f] outline-none"
              placeholder="e.g. Bryan move-out paperwork"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-['Inter'] font-semibold text-[#6c7a77] uppercase tracking-wider mb-1">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2.5 bg-[#f8f9ff] border-0 rounded-lg text-sm font-['Inter'] focus:ring-2 focus:ring-[#006b5f] outline-none">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-['Inter'] font-semibold text-[#6c7a77] uppercase tracking-wider mb-1">Priority</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full px-3 py-2.5 bg-[#f8f9ff] border-0 rounded-lg text-sm font-['Inter'] focus:ring-2 focus:ring-[#006b5f] outline-none">
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-['Inter'] font-semibold text-[#6c7a77] uppercase tracking-wider mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2.5 bg-[#f8f9ff] border-0 rounded-lg text-sm font-['Inter'] text-[#121c2a] focus:ring-2 focus:ring-[#006b5f] outline-none resize-none"
              placeholder="Details, context, steps..."
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-['Inter'] font-semibold text-[#6c7a77] uppercase tracking-wider mb-1">Assigned To</label>
              <input value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                className="w-full px-3 py-2.5 bg-[#f8f9ff] border-0 rounded-lg text-sm font-['Inter'] focus:ring-2 focus:ring-[#006b5f] outline-none"
                placeholder="Momo, Mark..." />
            </div>
            <div>
              <label className="block text-xs font-['Inter'] font-semibold text-[#6c7a77] uppercase tracking-wider mb-1">Tenant</label>
              <input value={form.tenant_name} onChange={(e) => setForm({ ...form, tenant_name: e.target.value })}
                className="w-full px-3 py-2.5 bg-[#f8f9ff] border-0 rounded-lg text-sm font-['Inter'] focus:ring-2 focus:ring-[#006b5f] outline-none"
                placeholder="Bryan..." />
            </div>
            <div>
              <label className="block text-xs font-['Inter'] font-semibold text-[#6c7a77] uppercase tracking-wider mb-1">Due Date</label>
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="w-full px-3 py-2.5 bg-[#f8f9ff] border-0 rounded-lg text-sm font-['Inter'] focus:ring-2 focus:ring-[#006b5f] outline-none" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-['Manrope'] font-semibold text-[#6c7a77] hover:text-[#121c2a] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-6 py-2.5 bg-[#006b5f] text-white rounded-lg text-sm font-['Manrope'] font-bold hover:bg-[#005a50] transition-colors disabled:opacity-50">
              {saving ? "Creating..." : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [filterStatus, setFilterStatus] = useState("ACTIVE"); // ACTIVE = PENDING + IN_PROGRESS
  const [filterCategory, setFilterCategory] = useState("ALL");

  async function fetchTasks() {
    const { data } = await supabase
      .from("admin_tasks")
      .select("*")
      .order("created_at", { ascending: false });
    setTasks(data || []);
    setLoading(false);
  }

  useEffect(() => { fetchTasks(); }, []);

  async function handleUpdate(id, updates) {
    await supabase.from("admin_tasks").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
    fetchTasks();
  }

  async function handleCreate(task) {
    await supabase.from("admin_tasks").insert(task);
    setShowNew(false);
    fetchTasks();
  }

  const filtered = tasks.filter((t) => {
    if (filterStatus === "ACTIVE" && (t.status === "COMPLETED" || t.status === "CANCELLED")) return false;
    if (filterStatus !== "ACTIVE" && filterStatus !== "ALL" && t.status !== filterStatus) return false;
    if (filterCategory !== "ALL" && t.category !== filterCategory) return false;
    return true;
  });

  const counts = {
    total: tasks.length,
    active: tasks.filter((t) => t.status === "PENDING" || t.status === "IN_PROGRESS").length,
    overdue: tasks.filter((t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== "COMPLETED" && t.status !== "CANCELLED").length,
    completed: tasks.filter((t) => t.status === "COMPLETED").length,
  };

  return (
    <PortalLayout>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#121c2a] tracking-tight">Tasks</h1>
            <p className="text-[#6c7a77] text-sm font-['Manrope'] mt-1">Track move-outs, paperwork, maintenance, and ops tasks</p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#006b5f] text-white rounded-xl text-sm font-['Manrope'] font-bold hover:bg-[#005a50] transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Task
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: "Active", value: counts.active, icon: "pending_actions", color: "text-[#006b5f]" },
            { label: "Overdue", value: counts.overdue, icon: "warning", color: "text-red-500" },
            { label: "Completed", value: counts.completed, icon: "task_alt", color: "text-green-600" },
            { label: "Total", value: counts.total, icon: "list", color: "text-[#6c7a77]" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-[#bbcac6]/15 p-4">
              <div className="flex items-center gap-3">
                <span className={`material-symbols-outlined text-[24px] ${s.color}`}>{s.icon}</span>
                <div>
                  <p className="font-['Plus_Jakarta_Sans'] font-bold text-xl text-[#121c2a]">{s.value}</p>
                  <p className="text-[10px] font-['Inter'] font-bold uppercase tracking-widest text-[#6c7a77]">{s.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex bg-white rounded-lg border border-[#bbcac6]/20 overflow-hidden">
            {["ACTIVE", "COMPLETED", "ALL"].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-4 py-2 text-xs font-['Manrope'] font-semibold transition-colors ${
                  filterStatus === s ? "bg-[#006b5f] text-white" : "text-[#6c7a77] hover:bg-[#f8f9ff]"
                }`}
              >
                {s === "ACTIVE" ? "Active" : s === "COMPLETED" ? "Done" : "All"}
              </button>
            ))}
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 bg-white border border-[#bbcac6]/20 rounded-lg text-xs font-['Inter'] text-[#6c7a77] focus:ring-1 focus:ring-[#006b5f] outline-none"
          >
            <option value="ALL">All Categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
          </select>
        </div>

        {/* Task list */}
        {loading ? (
          <div className="text-center py-12 text-[#6c7a77]">Loading tasks...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-[48px] text-[#bbcac6]">task_alt</span>
            <p className="text-[#6c7a77] font-['Manrope'] mt-2">No tasks found</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((task) => (
              <TaskCard key={task.id} task={task} onUpdate={handleUpdate} />
            ))}
          </div>
        )}
      </div>

      {showNew && <NewTaskModal onClose={() => setShowNew(false)} onSave={handleCreate} />}
    </PortalLayout>
  );
}
