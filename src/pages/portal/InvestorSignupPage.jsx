import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export default function InvestorSignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = searchParams.get("token");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9ff] px-4">
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-[#bbcac6]/15 w-full max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[#ffdad6]/40 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#ba1a1a] text-[32px]">
              key_off
            </span>
          </div>
          <h2 className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#121c2a] mb-3">
            Invalid Invite
          </h2>
          <p className="font-['Manrope'] text-[#555f6f] text-sm leading-relaxed mb-8">
            This investor invitation link is missing or invalid. Please contact
            Hyve for a valid invite link.
          </p>
          <a
            href="/portal/login"
            className="inline-flex items-center gap-2 bg-[#006b5f] text-white rounded-xl px-6 py-3 font-['Manrope'] font-bold text-sm hover:bg-[#006a61] transition-colors"
          >
            Back to Login
          </a>
        </div>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signUp(email, password, token);
      navigate("/portal/investor/dashboard");
    } catch (err) {
      setError(
        err.message || "Signup failed. The invite may be expired or already used."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-stretch">
      {/* Left editorial panel */}
      <section className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#006b5f] flex-col">
        <div className="absolute inset-0 opacity-30 mix-blend-overlay">
          <div className="w-full h-full bg-gradient-to-br from-[#004d44] to-[#006b5f]" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-tr from-[#006b5f] via-[#006b5f]/80 to-transparent" />
        <div className="relative z-10 flex flex-col justify-between p-16 w-full h-full">
          <div>
            <span className="font-['Plus_Jakarta_Sans'] text-[#71f8e4] font-extrabold tracking-tighter text-3xl">
              Hyve Living
            </span>
          </div>
          <div className="max-w-md">
            <h1 className="font-['Plus_Jakarta_Sans'] text-5xl font-bold text-white leading-tight tracking-tight mb-8">
              The Sanctuary of Growth
            </h1>
            <p className="text-[#71f8e4]/90 text-lg font-['Manrope'] font-medium leading-relaxed mb-12">
              Join an exclusive collective of visionaries shaping the future of
              premium living through institutional-grade architectural assets.
            </p>
            <div className="grid grid-cols-2 gap-6">
              <div className="p-6 rounded-xl bg-white/5 border border-white/10">
                <span
                  className="material-symbols-outlined text-[#71f8e4] text-[30px] mb-4 block"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  account_balance
                </span>
                <h3 className="text-white font-['Plus_Jakarta_Sans'] font-bold text-sm mb-1">
                  Secure Assets
                </h3>
                <p className="text-white/60 text-xs font-['Manrope']">
                  Fully collateralized property portfolios.
                </p>
              </div>
              <div className="p-6 rounded-xl bg-white/5 border border-white/10">
                <span
                  className="material-symbols-outlined text-[#71f8e4] text-[30px] mb-4 block"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  insights
                </span>
                <h3 className="text-white font-['Plus_Jakarta_Sans'] font-bold text-sm mb-1">
                  Real-time Data
                </h3>
                <p className="text-white/60 text-xs font-['Manrope']">
                  Direct API access to portfolio yields.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex -space-x-3">
              {["A", "B", "C"].map((l) => (
                <div
                  key={l}
                  className="w-10 h-10 rounded-full border-2 border-[#006b5f] bg-[#14b8a6] flex items-center justify-center text-white text-xs font-bold"
                >
                  {l}
                </div>
              ))}
            </div>
            <span className="text-white text-sm font-['Inter'] font-medium">
              +400 Active Members
            </span>
          </div>
        </div>
      </section>

      {/* Right form panel */}
      <section className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 md:p-16 bg-[#f8f9ff]">
        <div className="w-full max-w-md">
          <div className="mb-12">
            <div className="lg:hidden mb-8">
              <span className="font-['Plus_Jakarta_Sans'] text-[#006b5f] font-extrabold tracking-tighter text-2xl">
                Hyve Living
              </span>
            </div>
            <h2 className="font-['Plus_Jakarta_Sans'] text-3xl font-bold text-[#121c2a] mb-3 tracking-tight">
              Investor Registration
            </h2>
            <p className="text-[#555f6f] font-['Manrope'] font-medium">
              Please enter your invitation token to begin your journey.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="px-4 py-3 rounded-xl bg-[#ffdad6]/50 border border-[#ba1a1a]/20 text-[#ba1a1a] text-sm font-['Manrope']">
                {error}
              </div>
            )}

            {/* Access Token (pre-filled, read-only display) */}
            <div>
              <label className="block text-xs font-['Inter'] font-semibold text-[#6c7a77] uppercase tracking-widest mb-2 ml-1">
                Access Token
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#6c7a77]">
                  key
                </span>
                <input
                  type="text"
                  value={token}
                  readOnly
                  className="w-full pl-12 pr-4 py-4 bg-white border border-[#bbcac6]/20 rounded-xl font-['Inter'] text-[#121c2a] outline-none text-sm opacity-60"
                />
              </div>
              <p className="mt-2 text-[11px] text-[#555f6f]/70 italic px-1">
                Tokens are issued via direct invitation only.
              </p>
            </div>

            {/* Professional Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-['Inter'] font-semibold text-[#6c7a77] uppercase tracking-widest mb-2 ml-1"
              >
                Professional Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@firm.com"
                className="w-full px-4 py-4 bg-white border border-[#bbcac6]/20 rounded-xl font-['Inter'] text-[#121c2a] focus:border-[#14b8a6] outline-none transition-all text-sm"
              />
            </div>

            {/* Vault Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-['Inter'] font-semibold text-[#6c7a77] uppercase tracking-widest mb-2 ml-1"
              >
                Vault Password
              </label>
              <div className="relative group">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-4 bg-white border border-[#bbcac6]/20 rounded-xl font-['Inter'] text-[#121c2a] focus:border-[#14b8a6] outline-none transition-all text-sm pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6c7a77] hover:text-[#006b5f] transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-5 bg-[#006b5f] text-white rounded-xl font-['Plus_Jakarta_Sans'] font-bold text-lg hover:bg-[#006a61] transition-all duration-300 shadow-lg shadow-[#006b5f]/20 flex items-center justify-center gap-2 group disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[20px]">
                    progress_activity
                  </span>
                  Initializing…
                </>
              ) : (
                <>
                  Initialize Membership
                  <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </>
              )}
            </button>
          </form>

          <div className="mt-12 pt-8 border-t border-[#bbcac6]/15 text-center">
            <p className="text-[#555f6f] font-['Manrope'] font-medium text-sm">
              Already a member?{" "}
              <a
                href="/portal/login"
                className="text-[#006b5f] font-bold hover:underline"
              >
                Secure Login
              </a>
            </p>
          </div>

          <div className="mt-8 flex gap-8">
            <div className="flex items-center gap-2 opacity-40">
              <span className="material-symbols-outlined text-sm">
                verified_user
              </span>
              <span className="text-[10px] font-['Inter'] font-bold uppercase tracking-widest">
                SSL Encrypted
              </span>
            </div>
            <div className="flex items-center gap-2 opacity-40">
              <span className="material-symbols-outlined text-sm">
                gpp_good
              </span>
              <span className="text-[10px] font-['Inter'] font-bold uppercase tracking-widest">
                GDPR Compliant
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
