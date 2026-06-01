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
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="bg-surface rounded-2xl p-12 border border-border w-full max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-500/15 flex items-center justify-center">
            <span className="material-symbols-outlined text-red-400 text-[32px]">
              key_off
            </span>
          </div>
          <h2 className="font-display text-2xl font-bold text-foreground mb-3">
            Invalid Invite
          </h2>
          <p className="font-['Inter'] text-foreground-variant text-sm leading-relaxed mb-8">
            This investor invitation link is missing or invalid. Please contact
            Lazybee for a valid invite link.
          </p>
          <a
            href="/portal/login"
            className="inline-flex items-center gap-2 bg-accent text-white rounded-full px-6 py-3 font-['Inter'] font-bold text-sm hover:bg-accent transition-colors"
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
      <section className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-accent flex-col">
        <div className="absolute inset-0 opacity-30 mix-blend-overlay">
          <div className="w-full h-full bg-gradient-to-br from-accent to-accent" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-tr from-accent via-accent/80 to-transparent" />
        <div className="relative z-10 flex flex-col justify-between p-16 w-full h-full">
          <div>
            <span className="font-display text-[#D9A441] font-extrabold tracking-tighter text-3xl">
              Lazybee Living
            </span>
          </div>
          <div className="max-w-md">
            <h1 className="font-display text-5xl font-bold text-white leading-tight tracking-tight mb-8">
              The Sanctuary of Growth
            </h1>
            <p className="text-[#D9A441]/90 text-lg font-['Inter'] font-medium leading-relaxed mb-12">
              Join an exclusive collective of visionaries shaping the future of
              premium living through institutional-grade architectural assets.
            </p>
            <div className="grid grid-cols-2 gap-6">
              <div className="p-6 rounded-xl bg-white/5 border border-white/10">
                <span
                  className="material-symbols-outlined text-[#D9A441] text-[30px] mb-4 block"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  account_balance
                </span>
                <h3 className="text-white font-display font-bold text-sm mb-1">
                  Secure Assets
                </h3>
                <p className="text-white/60 text-xs font-['Inter']">
                  Fully collateralized property portfolios.
                </p>
              </div>
              <div className="p-6 rounded-xl bg-white/5 border border-white/10">
                <span
                  className="material-symbols-outlined text-[#D9A441] text-[30px] mb-4 block"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  insights
                </span>
                <h3 className="text-white font-display font-bold text-sm mb-1">
                  Real-time Data
                </h3>
                <p className="text-white/60 text-xs font-['Inter']">
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
                  className="w-10 h-10 rounded-full border-2 border-accent bg-[#D9A441] flex items-center justify-center text-white text-xs font-bold"
                >
                  {l}
                </div>
              ))}
            </div>
            <span className="text-white text-sm font-['Inter'] font-medium">
              Active across Singapore & Malaysia
            </span>
          </div>
        </div>
      </section>

      {/* Right form panel */}
      <section className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 md:p-16 bg-background">
        <div className="w-full max-w-md">
          <div className="mb-12">
            <div className="lg:hidden mb-8">
              <span className="font-display text-accent font-extrabold tracking-tighter text-2xl">
                Lazybee Living
              </span>
            </div>
            <h2 className="font-display text-3xl font-bold text-foreground mb-3 tracking-tight">
              Investor Registration
            </h2>
            <p className="text-foreground-variant font-['Inter'] font-medium">
              Please enter your invitation token to begin your journey.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-sm font-['Inter']">
                {error}
              </div>
            )}

            {/* Access Token (pre-filled, read-only display) */}
            <div>
              <label className="block text-xs font-['Inter'] font-semibold text-foreground-variant uppercase tracking-widest mb-2 ml-1">
                Access Token
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-foreground-variant">
                  key
                </span>
                <input
                  type="text"
                  value={token}
                  readOnly
                  className="w-full pl-12 pr-4 py-4 bg-surface border border-border rounded-xl font-['Inter'] text-foreground outline-none text-sm opacity-60"
                />
              </div>
              <p className="mt-2 text-[11px] text-foreground-variant/70 italic px-1">
                Tokens are issued via direct invitation only.
              </p>
            </div>

            {/* Professional Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-['Inter'] font-semibold text-foreground-variant uppercase tracking-widest mb-2 ml-1"
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
                className="w-full px-4 py-4 bg-surface border border-border rounded-xl font-['Inter'] text-foreground focus:border-accent outline-none transition-all text-sm"
              />
            </div>

            {/* Vault Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-['Inter'] font-semibold text-foreground-variant uppercase tracking-widest mb-2 ml-1"
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
                  className="w-full px-4 py-4 bg-surface border border-border rounded-xl font-['Inter'] text-foreground focus:border-accent outline-none transition-all text-sm pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground-variant hover:text-accent transition-colors"
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
              className="w-full py-5 bg-accent text-white rounded-xl font-display font-bold text-lg hover:bg-accent transition-all duration-300 flex items-center justify-center gap-2 group disabled:opacity-60 disabled:cursor-not-allowed"
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

          <div className="mt-12 pt-8 border-t border-border text-center">
            <p className="text-foreground-variant font-['Inter'] font-medium text-sm">
              Already a member?{" "}
              <a
                href="/portal/login"
                className="text-accent font-bold hover:underline"
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
