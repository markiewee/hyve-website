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

  // Property-owner passwordless flow: email in, magic link out.
  const [ownerMode, setOwnerMode] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerSent, setOwnerSent] = useState(false);
  const [ownerSubmitting, setOwnerSubmitting] = useState(false);

  async function handleOwnerLink(e) {
    e.preventDefault();
    if (!ownerEmail.trim()) return;
    setOwnerSubmitting(true);
    try {
      await fetch("/api/portal/admin-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "owner_link_request", email: ownerEmail.trim() }),
      });
    } catch {
      // Deliberately silent: response is identical whether or not the account exists.
    } finally {
      setOwnerSent(true);
      setOwnerSubmitting(false);
    }
  }

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
            <Wordmark size="lg" variant="lazybee" className="!text-white" />
          </div>
          <div className="max-w-md">
            <h1 className="font-display text-[52px] text-white leading-[1.05] mb-8">
              {t("login.heroTitle")}
            </h1>
            <p className="text-white/85 text-[17px] leading-relaxed mb-12 max-w-[46ch]">
              {t("login.heroSubtitle")}
            </p>
            <div className="grid grid-cols-2 gap-6">
              <div className="p-6 bg-white/10 backdrop-blur-md border border-white/25">
                <span className="material-symbols-outlined text-white text-3xl mb-4 block">payments</span>
                <h3 className="font-mono text-white text-[12px] uppercase tracking-[0.16em] mb-1.5">{t("login.easyBilling")}</h3>
                <p className="text-white/75 text-[13px] leading-relaxed">{t("login.easyBillingDesc")}</p>
              </div>
              <div className="p-6 bg-white/10 backdrop-blur-md border border-white/25">
                <span className="material-symbols-outlined text-white text-3xl mb-4 block">support_agent</span>
                <h3 className="font-mono text-white text-[12px] uppercase tracking-[0.16em] mb-1.5">{t("login.support247")}</h3>
                <p className="text-white/75 text-[13px] leading-relaxed">{t("login.support247Desc")}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[16px]">verified</span>
            </div>
            <span className="text-white text-sm">{t("login.trustedAcross")}</span>
          </div>
        </div>
      </section>

      {/* Right form panel */}
      <section className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 md:p-16 bg-surface">
        <div className="w-full max-w-md">
          <div className="mb-12">
            <div className="lg:hidden mb-8">
              <Wordmark size="md" variant="lazybee" />
            </div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-[32px] leading-tight text-foreground">
                {t("login.title")}
              </h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setLanguage("en")}
                  className={`font-mono px-2 py-1 text-xs tracking-[0.14em] border transition-colors ${
                    lang === "en"
                      ? "border-accent text-accent"
                      : "border-transparent text-foreground-variant hover:text-accent"
                  }`}
                >
                  EN
                </button>
                <span className="text-foreground-variant">|</span>
                <button
                  onClick={() => setLanguage("zh")}
                  className={`font-mono px-2 py-1 text-xs tracking-[0.14em] border transition-colors ${
                    lang === "zh"
                      ? "border-accent text-accent"
                      : "border-transparent text-foreground-variant hover:text-accent"
                  }`}
                >
                  中文
                </button>
              </div>
            </div>
            <p className="text-foreground-variant">
              {t("login.subtitle")}
            </p>
          </div>

          {ownerMode ? (
            <form onSubmit={handleOwnerLink} className="space-y-6">
              <div>
                <label
                  className="block font-mono text-[11px] text-foreground-variant uppercase tracking-[0.22em] mb-2"
                  htmlFor="ownerEmail"
                >
                  Owner email
                </label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-foreground-variant group-focus-within:text-accent transition-colors">
                    mail
                  </span>
                  <input
                    className="w-full pl-12 pr-4 py-3.5 bg-surface-container border border-border text-foreground focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
                    id="ownerEmail"
                    type="email"
                    autoComplete="email"
                    required
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <p className="text-xs text-foreground-variant mt-2">
                  No password needed. We'll email you a secure sign-in link.
                </p>
              </div>

              {ownerSent && (
                <div className="p-4 bg-accent/10 border-l-2 border-accent">
                  <p className="text-accent text-sm">
                    If that email belongs to a property owner account, a sign-in
                    link is on its way. Check your inbox (valid for 24 hours).
                  </p>
                </div>
              )}

              <button
                className="w-full py-4 bg-primary text-primary-foreground rounded-full font-mono text-xs uppercase tracking-[0.16em] hover:opacity-90 transition-opacity duration-200 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                type="submit"
                disabled={ownerSubmitting}
              >
                {ownerSubmitting ? "Sending..." : "Email me a sign-in link"}
                {!ownerSubmitting && (
                  <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
                    mail
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setOwnerMode(false)}
                className="w-full text-center text-xs text-accent hover:underline transition-colors"
              >
                Back to member sign in
              </button>
            </form>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-500/10 border-l-2 border-red-500 flex items-start gap-3">
                <span className="material-symbols-outlined text-red-300 text-[20px] shrink-0 mt-0.5">error</span>
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <div>
              <label
                className="block font-mono text-[11px] text-foreground-variant uppercase tracking-[0.22em] mb-2"
                htmlFor="identifier"
              >
                {t("login.username")}
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-foreground-variant group-focus-within:text-accent transition-colors">
                  person
                </span>
                <input
                  className="w-full pl-12 pr-4 py-3.5 bg-surface-container border border-border text-foreground focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
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
                className="block font-mono text-[11px] text-foreground-variant uppercase tracking-[0.22em] mb-2"
                htmlFor="password"
              >
                {t("login.password")}
              </label>
              <div className="relative group">
                <input
                  className="w-full px-4 py-3.5 bg-surface-container border border-border text-foreground focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
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
                  className="text-xs text-accent hover:underline transition-colors disabled:opacity-60"
                >
                  {resetSubmitting ? "Sending..." : t("login.forgotPassword")}
                </button>
              </div>
              {resetSent && (
                <p className="text-xs text-accent mt-1">
                  If that account exists, a reset link has been emailed. Check your inbox (expires in 60 min).
                </p>
              )}
              {resetError && (
                <p className="text-xs text-red-300 mt-1">
                  {resetError}
                </p>
              )}
            </div>

            <button
              className="w-full py-4 bg-primary text-primary-foreground rounded-full font-mono text-xs uppercase tracking-[0.16em] hover:opacity-90 transition-opacity duration-200 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
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

            <button
              type="button"
              onClick={() => setOwnerMode(true)}
              className="w-full text-center text-xs text-accent hover:underline transition-colors"
            >
              Property owner? Sign in with an email link
            </button>
          </form>
          )}

          <div className="mt-12 pt-8 border-t border-border flex justify-center gap-8">
            <div className="flex items-center gap-2 text-foreground-variant">
              <span className="material-symbols-outlined text-sm">verified_user</span>
              <span className="font-mono text-[11px] uppercase tracking-[0.2em]">{t("login.sslEncrypted")}</span>
            </div>
            <div className="flex items-center gap-2 text-foreground-variant">
              <span className="material-symbols-outlined text-sm">gpp_good</span>
              <span className="font-mono text-[11px] uppercase tracking-[0.2em]">{t("login.gdprCompliant")}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
