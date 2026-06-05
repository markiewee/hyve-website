import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useLanguage } from "../../i18n/LanguageContext";
import Wordmark from "../../components/Wordmark";

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { lang, setLanguage, t } = useLanguage();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState(null);
  const [resetSubmitting, setResetSubmitting] = useState(false);

  async function handleForgotPassword() {
    setResetSent(false);
    setResetError(null);
    if (!identifier || !identifier.trim()) {
      setResetError("Enter your username first, then click Forgot password.");
      return;
    }
    setResetSubmitting(true);
    try {
      const r = await fetch("/api/portal/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", username: identifier.trim() }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setResetError(data.error || "Could not request reset. Try again.");
      } else {
        setResetSent(true);
      }
    } catch (err) {
      setResetError(err.message || "Network error. Try again.");
    } finally {
      setResetSubmitting(false);
    }
  }

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
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left editorial panel */}
      <section className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-background">
        <div className="absolute inset-0 opacity-70">
          <img
            className="w-full h-full object-cover"
            src="/photos/cp-hero.jpg"
            alt="Lazybee co-living"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-tr from-black/85 via-black/45 to-black/20" />
        <div className="relative z-10 flex flex-col justify-between p-16 w-full">
          <div>
            <Wordmark size="lg" className="!text-white [&>span]:!text-white" />
          </div>
          <div className="max-w-md">
            <h1 className="font-display text-5xl font-bold text-white leading-tight tracking-tight mb-8">
              {t("login.heroTitle")}
            </h1>
            <p className="text-white/80 text-lg font-medium leading-relaxed mb-12 opacity-90">
              {t("login.heroSubtitle")}
            </p>
            <div className="grid grid-cols-2 gap-6">
              <div className="p-6 rounded-xl bg-white/5 backdrop-blur-md border border-white/10">
                <span className="material-symbols-outlined text-white text-3xl mb-4 block">payments</span>
                <h3 className="text-white font-display font-bold text-sm mb-1">{t("login.easyBilling")}</h3>
                <p className="text-white/60 text-xs">{t("login.easyBillingDesc")}</p>
              </div>
              <div className="p-6 rounded-xl bg-white/5 backdrop-blur-md border border-white/10">
                <span className="material-symbols-outlined text-white text-3xl mb-4 block">support_agent</span>
                <h3 className="text-white font-display font-bold text-sm mb-1">{t("login.support247")}</h3>
                <p className="text-white/60 text-xs">{t("login.support247Desc")}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[16px]">verified</span>
            </div>
            <span className="text-white text-sm font-['Inter'] font-medium">{t("login.trustedAcross")}</span>
          </div>
        </div>
      </section>

      {/* Right form panel */}
      <section className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 md:p-16 bg-surface">
        <div className="w-full max-w-md">
          <div className="mb-12">
            <div className="lg:hidden mb-8">
              <Wordmark size="md" />
            </div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-3xl font-bold text-foreground tracking-tight">
                {t("login.title")}
              </h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setLanguage("en")}
                  className={`px-2 py-1 text-xs font-['Inter'] font-bold rounded transition-colors ${
                    lang === "en"
                      ? "bg-accent text-white"
                      : "text-foreground-variant hover:text-accent"
                  }`}
                >
                  EN
                </button>
                <span className="text-foreground-variant">|</span>
                <button
                  onClick={() => setLanguage("zh")}
                  className={`px-2 py-1 text-xs font-['Inter'] font-bold rounded transition-colors ${
                    lang === "zh"
                      ? "bg-accent text-white"
                      : "text-foreground-variant hover:text-accent"
                  }`}
                >
                  中文
                </button>
              </div>
            </div>
            <p className="text-foreground-variant font-['Inter'] font-medium">
              {t("login.subtitle")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/25 rounded-xl flex items-start gap-3">
                <span className="material-symbols-outlined text-red-300 text-[20px] shrink-0 mt-0.5">error</span>
                <p className="text-red-300 text-sm font-['Inter'] font-medium">{error}</p>
              </div>
            )}

            <div>
              <label
                className="block text-xs font-['Inter'] font-semibold text-foreground-variant uppercase tracking-widest mb-2 ml-1"
                htmlFor="identifier"
              >
                {t("login.username")}
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-foreground-variant group-focus-within:text-accent transition-colors">
                  person
                </span>
                <input
                  className="w-full pl-12 pr-4 py-4 bg-surface-container border border-border rounded-xl font-['Inter'] text-foreground focus:ring-2 focus:ring-accent outline-none transition-all placeholder:text-foreground-variant/50"
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={t("login.usernamePlaceholder")}
                />
              </div>
            </div>

            <div>
              <label
                className="block text-xs font-['Inter'] font-semibold text-foreground-variant uppercase tracking-widest mb-2 ml-1"
                htmlFor="password"
              >
                {t("login.password")}
              </label>
              <div className="relative group">
                <input
                  className="w-full px-4 py-4 bg-surface-container border border-border rounded-xl font-['Inter'] text-foreground focus:ring-2 focus:ring-accent outline-none transition-all"
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
                  className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-foreground-variant cursor-pointer hover:text-accent transition-colors"
                >
                  {showPassword ? "visibility_off" : "visibility"}
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetSubmitting}
                  className="text-xs font-['Inter'] font-medium text-accent hover:underline transition-colors disabled:opacity-60"
                >
                  {resetSubmitting ? "Sending..." : t("login.forgotPassword")}
                </button>
              </div>
              {resetSent && (
                <p className="text-xs font-['Inter'] text-accent mt-1">
                  If that account exists, a reset link has been emailed. Check your inbox (expires in 60 min).
                </p>
              )}
              {resetError && (
                <p className="text-xs font-['Inter'] text-red-300 mt-1">
                  {resetError}
                </p>
              )}
            </div>

            <button
              className="w-full py-5 bg-accent text-white rounded-xl font-display font-bold text-lg hover:bg-accent/90 transition-all duration-300 flex items-center justify-center gap-2 group disabled:opacity-60 disabled:cursor-not-allowed"
              type="submit"
              disabled={submitting}
            >
              {submitting ? t("login.signingIn") : t("login.signIn")}
              {!submitting && (
                <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              )}
            </button>
          </form>

          <div className="mt-12 pt-8 border-t border-border flex justify-center gap-8">
            <div className="flex items-center gap-2 opacity-40">
              <span className="material-symbols-outlined text-sm">verified_user</span>
              <span className="text-[10px] font-['Inter'] font-bold uppercase tracking-widest">{t("login.sslEncrypted")}</span>
            </div>
            <div className="flex items-center gap-2 opacity-40">
              <span className="material-symbols-outlined text-sm">gpp_good</span>
              <span className="text-[10px] font-['Inter'] font-bold uppercase tracking-widest">{t("login.gdprCompliant")}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
