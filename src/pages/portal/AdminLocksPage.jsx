import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import { toast } from "sonner";

export default function AdminLocksPage() {
  const [propertyData, setPropertyData] = useState([]); // [{ property, guideId, mainDoor, roomCodes, rooms }]
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // { propertyId, key } where key = "main_door" or unit_code
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      // Properties with their rooms (sorted) and tenant assigned per room
      const { data: properties, error: pErr } = await supabase
        .from("properties")
        .select("id, code, name, rooms(id, unit_code, name, tenant_profiles!tenant_profiles_room_id_fkey(id, role, is_active, tenant_details(full_name)))")
        .order("code");
      if (pErr) throw pErr;

      // Existing access_codes guides
      const { data: guides, error: gErr } = await supabase
        .from("property_guides")
        .select("id, property_id, content")
        .eq("section", "access_codes");
      if (gErr) throw gErr;

      const guideByProperty = Object.fromEntries(
        (guides || []).map((g) => {
          let parsed = { main_door: "", rooms: {} };
          try { parsed = JSON.parse(g.content); } catch {}
          return [g.property_id, { id: g.id, mainDoor: parsed.main_door || "", roomCodes: parsed.rooms || {} }];
        })
      );

      const merged = (properties || []).map((p) => {
        const g = guideByProperty[p.id] || { id: null, mainDoor: "", roomCodes: {} };
        const sortedRooms = (p.rooms || []).slice().sort((a, b) => (a.unit_code || "").localeCompare(b.unit_code || ""));
        return {
          property: p,
          guideId: g.id,
          mainDoor: g.mainDoor,
          roomCodes: g.roomCodes,
          rooms: sortedRooms,
        };
      });
      setPropertyData(merged);
    } catch (err) {
      toast.error(err.message || "Failed to load access codes.");
    }
    setLoading(false);
  }

  function startEdit(propertyId, key, currentValue) {
    setEditing({ propertyId, key });
    setEditValue(currentValue || "");
  }

  function cancelEdit() {
    setEditing(null);
    setEditValue("");
  }

  async function saveEdit(propertyId, key) {
    setSaving(true);
    try {
      const block = propertyData.find((b) => b.property.id === propertyId);
      if (!block) throw new Error("Property not found");

      const newCodes = { ...(block.roomCodes || {}) };
      let newMain = block.mainDoor;
      if (key === "main_door") {
        newMain = editValue.trim();
      } else {
        if (editValue.trim() === "") delete newCodes[key];
        else newCodes[key] = editValue.trim();
      }

      const newContent = JSON.stringify({ main_door: newMain, rooms: newCodes });

      if (block.guideId) {
        const { error } = await supabase
          .from("property_guides")
          .update({ content: newContent, updated_at: new Date().toISOString() })
          .eq("id", block.guideId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("property_guides")
          .insert({ property_id: propertyId, section: "access_codes", content: newContent })
          .select("id")
          .single();
        if (error) throw error;
        block.guideId = data.id;
      }

      setPropertyData((prev) =>
        prev.map((b) =>
          b.property.id === propertyId
            ? { ...b, mainDoor: newMain, roomCodes: newCodes, guideId: block.guideId }
            : b
        )
      );
      toast.success("Code updated.");
      cancelEdit();
    } catch (err) {
      toast.error(err.message || "Save failed.");
    }
    setSaving(false);
  }

  function copyCode(code) {
    if (!code) return;
    navigator.clipboard.writeText(code);
    toast.success(`Copied ${code}`);
  }

  function tenantNameForRoom(room) {
    const tp = (room.tenant_profiles || []).find((t) => t.is_active && t.role === "TENANT");
    return tp?.tenant_details?.full_name || tp?.tenant_details?.[0]?.full_name || null;
  }

  return (
    <PortalLayout>
      <div className="mb-10 flex items-start justify-between">
        <div>
          <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a] tracking-tight">
            Smart Locks
          </h1>
          <p className="text-[#6c7a77] font-['Manrope'] font-medium mt-1">
            Manage access codes for all property doors and rooms.
          </p>
        </div>
        <button
          onClick={loadAll}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#bbcac6]/30 text-[#121c2a] rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#eff4ff]"
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-white border border-[#bbcac6]/15 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-10">
          {propertyData.map((block) => {
            const { property, mainDoor, roomCodes, rooms } = block;
            const isEditingMain = editing?.propertyId === property.id && editing?.key === "main_door";

            return (
              <section key={property.id}>
                {/* Property header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="px-3 py-1 bg-[#006b5f] text-white rounded-full font-['Inter'] text-xs font-bold tracking-widest">
                    {property.code}
                  </div>
                  <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-xl text-[#121c2a]">{property.name}</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {/* Main door card */}
                  <LockCard
                    icon="door_front"
                    label="Main Door"
                    sublabel="Building entrance"
                    code={mainDoor}
                    accent="#006b5f"
                    isEditing={isEditingMain}
                    editValue={editValue}
                    setEditValue={setEditValue}
                    onCopy={() => copyCode(mainDoor)}
                    onEdit={() => startEdit(property.id, "main_door", mainDoor)}
                    onCancel={cancelEdit}
                    onSave={() => saveEdit(property.id, "main_door")}
                    saving={saving}
                  />

                  {/* One card per room */}
                  {rooms.map((room) => {
                    const code = roomCodes[room.unit_code] || "";
                    const tenantName = tenantNameForRoom(room);
                    const isEditingRoom = editing?.propertyId === property.id && editing?.key === room.unit_code;
                    return (
                      <LockCard
                        key={room.id}
                        icon="meeting_room"
                        label={room.unit_code}
                        sublabel={tenantName || room.name || "Unassigned"}
                        code={code}
                        accent="#3e4946"
                        isEditing={isEditingRoom}
                        editValue={editValue}
                        setEditValue={setEditValue}
                        onCopy={() => copyCode(code)}
                        onEdit={() => startEdit(property.id, room.unit_code, code)}
                        onCancel={cancelEdit}
                        onSave={() => saveEdit(property.id, room.unit_code)}
                        saving={saving}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </PortalLayout>
  );
}

function LockCard({
  icon,
  label,
  sublabel,
  code,
  accent,
  isEditing,
  editValue,
  setEditValue,
  onCopy,
  onEdit,
  onCancel,
  onSave,
  saving,
}) {
  const isEmpty = !code;

  return (
    <div className="bg-white rounded-2xl border border-[#bbcac6]/20 shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-[20px]" style={{ color: accent }}>{icon}</span>
          <div className="min-w-0">
            <p className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-[#121c2a] truncate">{label}</p>
            <p className="text-[11px] text-[#6c7a77] truncate">{sublabel}</p>
          </div>
        </div>
        {!isEditing && (
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-[#eff4ff] text-[#6c7a77] hover:text-[#006b5f] transition-colors flex-shrink-0"
            title="Edit code"
          >
            <span className="material-symbols-outlined text-[16px]">edit</span>
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder="e.g. 1234#"
            autoFocus
            className="w-full bg-[#eff4ff] border-0 rounded-xl px-3 py-2 text-base font-mono font-bold text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={onSave}
              disabled={saving}
              className="flex-1 px-3 py-2 bg-[#006b5f] text-white rounded-lg font-['Manrope'] font-bold text-xs hover:bg-[#005047] disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={onCancel}
              disabled={saving}
              className="px-3 py-2 bg-[#eff4ff] text-[#3e4946] rounded-lg font-['Manrope'] font-bold text-xs hover:bg-[#dde6e3]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={onCopy}
          disabled={isEmpty}
          className={`text-left px-3 py-2.5 rounded-xl border transition-colors ${
            isEmpty
              ? "bg-[#fff8e1] border-[#fde68a] text-[#92400e] cursor-default"
              : "bg-[#eff4ff] border-transparent hover:border-[#14b8a6]/40"
          }`}
        >
          {isEmpty ? (
            <p className="text-xs font-['Manrope'] font-semibold">No code set — click ✏️ to add</p>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono font-extrabold text-lg tracking-wider text-[#121c2a]">{code}</p>
              <span className="material-symbols-outlined text-[16px] text-[#6c7a77]">content_copy</span>
            </div>
          )}
        </button>
      )}
    </div>
  );
}
