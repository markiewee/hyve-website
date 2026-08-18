import { Link, useLocation } from "react-router-dom";
import { passStatus, passLabel } from "../../lib/idDocuments";

/**
 * The thing a tenant with a stale pass sees before anything else.
 *
 * It sits above the content on every portal page rather than only on the
 * dashboard, because a tenant who lands straight on /portal/billing to pay
 * rent would otherwise never see it. It cannot be dismissed while the pass is
 * expired: dismissing is exactly what someone avoiding a renewal appointment
 * would do.
 *
 * It deliberately does not lock the portal. A tenant who cannot renew today
 * still needs to pay rent and still needs to report a burst pipe, and a
 * product that blocks both to chase a document creates a worse problem than
 * the one it solves.
 */
export default function PassExpiryBanner({ details }) {
  const location = useLocation();
  const status = passStatus(details);

  if (status.state === "NOT_APPLICABLE" || status.state === "VALID" || status.state === "IPA_PENDING")
    return null;
  // Already on the page that fixes it. Repeating the demand above the form is
  // nagging, not helping.
  if (location.pathname === "/portal/pass") return null;

  const label = passLabel(status.type);
  const expiryText = status.expiry
    ? new Date(`${status.expiry}T00:00:00+08:00`).toLocaleDateString("en-SG", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const COPY = {
    EXPIRED: {
      heading: "Your pass has expired",
      body: `Your ${label} expired on ${expiryText}. We are required to hold a valid pass for everyone living here, so please upload your renewed one.`,
      cta: "Upload new pass",
    },
    MISSING: {
      heading: "We need your pass details",
      body: `We have a ${label} on file for you but no expiry date, so we cannot tell whether it is still valid. Please upload it and confirm the dates.`,
      cta: "Add pass details",
    },
    IPA_GRACE_ELAPSED: {
      heading: "We still need your actual pass",
      body: `You moved in ${status.daysHere} days ago on an In-Principle Approval, which is the letter rather than the pass itself. Once your card has been issued we need a photo of both sides. If it is not out yet, upload the IPA again and tell us where it stands.`,
      cta: "Upload your pass",
    },
    EXPIRING_SOON: {
      heading: "Your pass expires soon",
      body: `Your ${label} expires on ${expiryText}, in ${status.daysLeft} ${status.daysLeft === 1 ? "day" : "days"}. Upload the renewed one as soon as you have it.`,
      cta: "Upload renewed pass",
    },
  }[status.state];

  const urgent = status.blocking;

  return (
    <div
      role="alert"
      className={`mb-8 rounded-lg border-2 ${
        urgent
          ? "border-destructive bg-destructive/10 p-7 sm:p-10"
          : "border-amber-500/50 bg-amber-500/10 p-6 sm:p-8"
      }`}
    >
      <div className="flex items-start gap-4">
        <span
          className={`material-symbols-outlined shrink-0 ${
            urgent ? "text-destructive text-[36px]" : "text-amber-500 text-[28px]"
          }`}
          aria-hidden="true"
        >
          {urgent ? "error" : "schedule"}
        </span>
        <div className="min-w-0">
          <h2
            className={`font-semibold tracking-tight ${
              urgent
                ? "text-destructive text-2xl sm:text-4xl"
                : "text-foreground text-xl sm:text-2xl"
            }`}
          >
            {COPY.heading}
          </h2>
          <p className={`mt-3 text-muted-foreground max-w-2xl ${urgent ? "text-base sm:text-lg" : "text-sm sm:text-base"}`}>
            {COPY.body}
          </p>
          <Link
            to="/portal/pass"
            className={`mt-6 inline-flex items-center gap-2 rounded-md font-semibold transition-colors ${
              urgent
                ? "bg-destructive text-white hover:bg-destructive/90 px-7 py-4 text-base"
                : "bg-primary text-primary-foreground hover:bg-primary/90 px-5 py-3 text-sm"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              upload
            </span>
            {COPY.cta}
          </Link>
        </div>
      </div>
    </div>
  );
}
