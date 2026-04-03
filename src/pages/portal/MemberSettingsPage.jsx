import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import PortalLayout from "../../components/portal/PortalLayout";
import { toast } from "sonner";

export default function MemberSettingsPage() {
  const { profile, user, setProfile } = useAuth();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [nationality, setNationality] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [saving, setSaving] = useState(false);

  // Email change
  const [newEmail, setNewEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    if (profile?.tenant_details) {
      const td = profile.tenant_details;
      setFullName(td.full_name || "");
      setPhone(td.phone || "");
      setNationality(td.nationality || "");
      setEmergencyName(td.emergency_contact_name || "");
      setEmergencyPhone(td.emergency_contact_phone || "");
    }
    if (user?.email && !user.email.endsWith("@portal.lazybee.sg")) {
      setNewEmail(user.email);
    }
  }, [profile, user]);

  async function handleSaveDetails(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase
        .from("tenant_details")
        .upsert({
          tenant_profile_id: profile.id,
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
          nationality: nationality || null,
          emergency_contact_name: emergencyName.trim() || null,
          emergency_contact_phone: emergencyPhone.trim() || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "tenant_profile_id" });
      if (error) throw error;
      toast.success("Details updated.");
    } catch (err) {
      toast.error(err.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateEmail(e) {
    e.preventDefault();
    if (!newEmail.trim() || !newEmail.includes("@")) {
      toast.error("Please enter a valid email.");
      return;
    }
    setEmailSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) throw error;
      toast.success("Verification email sent to your new address. Please check your inbox.");
    } catch (err) {
      toast.error(err.message || "Failed to update email.");
    } finally {
      setEmailSaving(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setPwSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err.message || "Failed to change password.");
    } finally {
      setPwSaving(false);
    }
  }

  const currentEmail = user?.email || "";
  const isPlaceholderEmail = currentEmail.endsWith("@portal.lazybee.sg");

  return (
    <PortalLayout>
      <header className="mb-8">
        <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold text-[#121c2a] tracking-tight">
          Settings
        </h1>
        <p className="text-[#555f6f] font-['Manrope'] mt-1">
          Manage your personal details, email, and password.
        </p>
      </header>

      <div className="space-y-6 max-w-2xl">
        {/* Personal Details */}
        <section className="bg-white rounded-xl p-6 border border-[#bbcac6]/15 shadow-sm">
          <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-lg mb-4 flex items-center gap-2 text-[#121c2a]">
            <span className="material-symbols-outlined text-[#006b5f] text-[20px]">person</span>
            Personal Details
          </h2>
          <form onSubmit={handleSaveDetails} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Nationality</label>
                <select
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
                >
                  <option value="">Select</option>
                  {["Singaporean", "Singapore PR", "Malaysian", "Indonesian", "Filipino", "Thai", "Vietnamese", "Indian", "Chinese", "Japanese", "Korean", "Myanmar", "British", "American", "Australian", "French", "German", "Other"].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Emergency Contact Name</label>
                <input
                  type="text"
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Emergency Contact Phone</label>
                <input
                  type="text"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#006a61] disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </section>

        {/* Email */}
        <section className="bg-white rounded-xl p-6 border border-[#bbcac6]/15 shadow-sm">
          <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-lg mb-4 flex items-center gap-2 text-[#121c2a]">
            <span className="material-symbols-outlined text-[#006b5f] text-[20px]">mail</span>
            Email Address
          </h2>
          {isPlaceholderEmail && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
              <strong>Set up your email.</strong> You're currently using a temporary login. Add your real email to receive important notifications.
            </div>
          )}
          <form onSubmit={handleUpdateEmail} className="space-y-4">
            <div className="space-y-1.5">
              <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">
                {isPlaceholderEmail ? "Your Email" : "Current Email"}
              </label>
              {!isPlaceholderEmail && (
                <p className="text-sm text-[#121c2a] font-['Manrope'] mb-2">{currentEmail}</p>
              )}
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={emailSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#006a61] disabled:opacity-50"
            >
              {emailSaving ? "Sending..." : isPlaceholderEmail ? "Set Email" : "Update Email"}
            </button>
          </form>
        </section>

        {/* Password */}
        <section className="bg-white rounded-xl p-6 border border-[#bbcac6]/15 shadow-sm">
          <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-lg mb-4 flex items-center gap-2 text-[#121c2a]">
            <span className="material-symbols-outlined text-[#006b5f] text-[20px]">lock</span>
            Change Password
          </h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 characters"
                minLength={8}
                className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-['Inter'] text-[10px] uppercase tracking-widest text-[#6c7a77] font-bold block">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full bg-[#eff4ff] border-0 rounded-xl px-4 py-3 text-sm font-['Manrope'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={pwSaving || !newPassword}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm hover:bg-[#006a61] disabled:opacity-50"
            >
              {pwSaving ? "Updating..." : "Change Password"}
            </button>
          </form>
        </section>
      </div>
    </PortalLayout>
  );
}
