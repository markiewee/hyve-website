import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Wordmark from "../../components/Wordmark";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError("Missing reset token. Use the link from your email.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/portal/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", token, new_password: password }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data.error || "Could not reset password.");
      } else {
        setDone(true);
        setTimeout(() => navigate("/portal/login"), 2500);
      }
    } catch (err) {
      setError(err.message || "Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#FAF6EC]">
      <section className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#A87813]">
        <div className="absolute inset-0 opacity-40 mix-blend-overlay">
          <img
            className="w-full h-full object-cover"
            src="https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=1200&q=80"
            alt=""
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-tr from-[#A87813] via-[#A87813]/80 to-transparent" />
        <div className="relative z-10 flex flex-col justify-between p-16 w-full">
          <Wordmark size="lg" className="!text-white [&>span]:!text-white" />
          <div className="max-w-md">
            <h1 className="font-['Plus_Jakarta_Sans'] text-5xl font-bold text-white leading-tight tracking-tight mb-6">
              Set a new password.
            </h1>
            <p className="text-[#D9A441] text-lg font-medium leading-relaxed opacity-90">
              Pick something memorable — at least 8 characters. You'll use it next time you sign in.
            </p>
          </div>
          <div />
        </div>
      </section>

      <section className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 md:p-16 bg-white">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <Wordmark size="md" />
          </div>
          <h2 className="font-['Plus_Jakarta_Sans'] text-3xl font-bold text-[#1F2937] tracking-tight mb-3">
            Reset password
          </h2>
          <p className="text-[#6B7280] font-['Manrope'] font-medium mb-10">
            Enter a new password for your portal account.
          </p>

          {done ? (
            <div className="p-5 bg-[#d7e6e2] border border-[#006b5f]/20 rounded-xl space-y-3">
              <p className="text-[#005047] font-['Manrope'] font-semibold text-sm">
                Password updated. Redirecting to login...
              </p>
              <Link
                to="/portal/login"
                className="text-xs font-['Manrope'] font-medium text-[#A87813] hover:underline"
              >
                Or click here
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-[#ffdad6] border border-[#ba1a1a]/20 rounded-xl flex items-start gap-3">
                  <span className="material-symbols-outlined text-[#ba1a1a] text-[20px] shrink-0 mt-0.5">
                    error
                  </span>
                  <p className="text-[#ba1a1a] text-sm font-['Manrope'] font-medium">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-['Inter'] font-semibold text-[#6B7280] uppercase tracking-widest mb-2 ml-1">
                  New password
                </label>
                <div className="relative">
                  <input
                    className="w-full px-4 py-4 bg-[#F2D88A] border-0 rounded-xl font-['Inter'] text-[#1F2937] focus:ring-2 focus:ring-[#D9A441] outline-none transition-all"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-[#6B7280] cursor-pointer hover:text-[#A87813] transition-colors"
                  >
                    {showPassword ? "visibility_off" : "visibility"}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-['Inter'] font-semibold text-[#6B7280] uppercase tracking-widest mb-2 ml-1">
                  Confirm new password
                </label>
                <input
                  className="w-full px-4 py-4 bg-[#F2D88A] border-0 rounded-xl font-['Inter'] text-[#1F2937] focus:ring-2 focus:ring-[#D9A441] outline-none transition-all"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-5 bg-[#A87813] text-white rounded-xl font-['Plus_Jakarta_Sans'] font-bold text-lg hover:bg-[#A87813] transition-all duration-300 shadow-lg shadow-[#A87813]/20 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? "Updating..." : "Update password"}
              </button>

              <div className="text-center">
                <Link
                  to="/portal/login"
                  className="text-xs font-['Manrope'] font-medium text-[#A87813] hover:underline"
                >
                  Back to login
                </Link>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
