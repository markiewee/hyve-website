import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(identifier, password);
      navigate("/portal/dashboard");
    } catch (err) {
      setError(err.message || "Invalid username or password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#f8f9ff]">
      {/* Left editorial panel */}
      <section className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#006b5f]">
        <div className="absolute inset-0 opacity-40 mix-blend-overlay">
          <img
            className="w-full h-full object-cover"
            src="https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=1200&q=80"
            alt="Modern architecture"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-tr from-[#006b5f] via-[#006b5f]/80 to-transparent" />
        <div className="relative z-10 flex flex-col justify-between p-16 w-full">
          <div>
            <img src="/hyve-logo.png" alt="Hyve" className="h-10 brightness-0 invert" />
          </div>
          <div className="max-w-md">
            <h1 className="font-['Plus_Jakarta_Sans'] text-5xl font-bold text-white leading-tight tracking-tight mb-8">
              Your Sanctuary Awaits
            </h1>
            <p className="text-[#71f8e4] text-lg font-medium leading-relaxed mb-12 opacity-90">
              Welcome back to your co-living portal. Manage payments, report issues, and stay connected with your community.
            </p>
            <div className="grid grid-cols-2 gap-6">
              <div className="p-6 rounded-xl bg-white/5 backdrop-blur-md border border-white/10">
                <span className="material-symbols-outlined text-[#71f8e4] text-3xl mb-4 block">payments</span>
                <h3 className="text-white font-['Plus_Jakarta_Sans'] font-bold text-sm mb-1">Easy Billing</h3>
                <p className="text-white/60 text-xs">Pay rent and track invoices seamlessly.</p>
              </div>
              <div className="p-6 rounded-xl bg-white/5 backdrop-blur-md border border-white/10">
                <span className="material-symbols-outlined text-[#71f8e4] text-3xl mb-4 block">support_agent</span>
                <h3 className="text-white font-['Plus_Jakarta_Sans'] font-bold text-sm mb-1">24/7 Support</h3>
                <p className="text-white/60 text-xs">Report issues and track resolutions.</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#71f8e4]/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#71f8e4] text-[16px]">verified</span>
            </div>
            <span className="text-white text-sm font-['Manrope'] font-medium">Trusted across Singapore & Malaysia</span>
          </div>
        </div>
      </section>

      {/* Right form panel */}
      <section className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 md:p-16 bg-white">
        <div className="w-full max-w-md">
          <div className="mb-12">
            <div className="lg:hidden mb-8">
              <img src="/hyve-logo.png" alt="Hyve" className="h-8" />
            </div>
            <h2 className="font-['Plus_Jakarta_Sans'] text-3xl font-bold text-[#121c2a] mb-3 tracking-tight">
              Welcome Back
            </h2>
            <p className="text-[#555f6f] font-['Manrope'] font-medium">
              Sign in to access your member portal.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-[#ffdad6] border border-[#ba1a1a]/20 rounded-xl flex items-start gap-3">
                <span className="material-symbols-outlined text-[#ba1a1a] text-[20px] shrink-0 mt-0.5">error</span>
                <p className="text-[#ba1a1a] text-sm font-['Manrope'] font-medium">{error}</p>
              </div>
            )}

            <div>
              <label
                className="block text-xs font-['Inter'] font-semibold text-[#6c7a77] uppercase tracking-widest mb-2 ml-1"
                htmlFor="identifier"
              >
                Username or Email
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#6c7a77] group-focus-within:text-[#006b5f] transition-colors">
                  person
                </span>
                <input
                  className="w-full pl-12 pr-4 py-4 bg-[#eff4ff] border-0 rounded-xl font-['Inter'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none transition-all placeholder:text-[#6c7a77]/50"
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="username or email"
                />
              </div>
            </div>

            <div>
              <label
                className="block text-xs font-['Inter'] font-semibold text-[#6c7a77] uppercase tracking-widest mb-2 ml-1"
                htmlFor="password"
              >
                Password
              </label>
              <div className="relative group">
                <input
                  className="w-full px-4 py-4 bg-[#eff4ff] border-0 rounded-xl font-['Inter'] text-[#121c2a] focus:ring-2 focus:ring-[#14b8a6] outline-none transition-all"
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-[#6c7a77] cursor-pointer hover:text-[#006b5f] transition-colors"
                >
                  {showPassword ? "visibility_off" : "visibility"}
                </button>
              </div>
            </div>

            <button
              className="w-full py-5 bg-[#006b5f] text-white rounded-xl font-['Plus_Jakarta_Sans'] font-bold text-lg hover:bg-[#006a61] transition-all duration-300 shadow-lg shadow-[#006b5f]/20 flex items-center justify-center gap-2 group disabled:opacity-60 disabled:cursor-not-allowed"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Signing in…" : "Sign In"}
              {!submitting && (
                <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              )}
            </button>
          </form>

          <div className="mt-12 pt-8 border-t border-[#bbcac6]/20 flex justify-center gap-8">
            <div className="flex items-center gap-2 opacity-40">
              <span className="material-symbols-outlined text-sm">verified_user</span>
              <span className="text-[10px] font-['Inter'] font-bold uppercase tracking-widest">SSL Encrypted</span>
            </div>
            <div className="flex items-center gap-2 opacity-40">
              <span className="material-symbols-outlined text-sm">gpp_good</span>
              <span className="text-[10px] font-['Inter'] font-bold uppercase tracking-widest">GDPR Compliant</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
