import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useLanguage } from "../../i18n/LanguageContext";
import PortalTour from "./PortalTour";
import { useNeedsOutcomeCount } from "../../hooks/useNeedsOutcomeCount";
import Wordmark from "../Wordmark";

function useNavLinks(role, needsOutcome = 0) {
  const { t } = useLanguage();

  return useMemo(() => {
    const TENANT_NAV = [
      { label: t("nav.dashboard"), to: "/portal/dashboard", icon: "dashboard" },
      { label: "My Property", to: "/portal/guide", icon: "home" },
      { label: t("nav.documents"), to: "/portal/documents", icon: "folder_open" },
      { label: t("nav.billing"), to: "/portal/billing", icon: "payments" },
      { label: t("nav.issues"), to: "/portal/issues", icon: "build" },
      { label: t("nav.settings"), to: "/portal/settings", icon: "settings" },
    ];

    const HOUSE_CAPTAIN_NAV = [
      { label: t("nav.dashboard"), to: "/portal/dashboard", icon: "dashboard" },
      { label: "My Property", to: "/portal/guide", icon: "home" },
      { label: t("nav.documents"), to: "/portal/documents", icon: "folder_open" },
      { label: t("nav.billing"), to: "/portal/billing", icon: "payments" },
      { label: t("nav.issues"), to: "/portal/issues", icon: "build" },
      { label: t("nav.propertyOverview"), to: "/portal/property", icon: "apartment" },
      { label: t("nav.tickets"), to: "/portal/property/tickets", icon: "confirmation_number" },
      { label: t("nav.members"), to: "/portal/property/tenants", icon: "group" },
      { label: t("nav.settings"), to: "/portal/settings", icon: "settings" },
    ];

    // Admin tools as inline sections, no collapsible "Manage" nesting.
    const MANAGE_SECTIONS = [
      {
        section: "Today",
        children: [
          { label: "Leads", to: "/portal/admin/leads", icon: "track_changes" },
          { label: "Inbox", to: "/portal/admin/inbox", icon: "inbox" },
          { label: t("nav.announcements"), to: "/portal/admin/announcements", icon: "campaign" },
        ],
      },
      {
        section: "People",
        children: [
          { label: "Members", to: "/portal/admin/members", icon: "how_to_reg" },
          { label: "Investors", to: "/portal/admin/investors", icon: "trending_up" },
        ],
      },
      {
        section: "Money",
        children: [
          { label: "Rent", to: "/portal/admin/rent", icon: "receipt_long" },
          { label: "Invoices", to: "/portal/admin/invoices", icon: "request_quote" },
          { label: "Month Reports", to: "/portal/admin/expenses/import", icon: "account_balance_wallet" },
        ],
      },
      {
        section: "Ops",
        children: [
          // Viewings was dropped from this nav in 652ac939 because the entry
          // carried no signal. It is back only because it now carries the
          // needs-outcome count: 43 past viewings currently have no answer,
          // and a queue nobody can navigate to cannot stop them ageing.
          { label: t("nav.viewings"), to: "/portal/admin/viewings", icon: "visibility", badge: needsOutcome },
          { label: "Listings", to: "/portal/admin/listings", icon: "public" },
          { label: t("nav.tickets"), to: "/portal/admin/tickets", icon: "confirmation_number" },
          { label: "Locks", to: "/portal/admin/locks", icon: "lock" },
          { label: t("nav.devices"), to: "/portal/admin/devices", icon: "router" },
          { label: "Contract Generator", to: "/portal/admin/documents", icon: "description" },
          { label: "Owner Documents", to: "/portal/admin/owner-documents", icon: "folder_shared" },
        ],
      },
    ];

    const SUPER_ADMIN_NAV = [
      { label: t("nav.admin"), to: "/portal/admin", icon: "admin_panel_settings" },
      ...MANAGE_SECTIONS,
    ];

    const ADMIN_RESIDENT_NAV = [
      { label: t("nav.admin"), to: "/portal/admin", icon: "admin_panel_settings" },
      ...MANAGE_SECTIONS,
      { label: t("nav.settings"), to: "/portal/settings", icon: "settings" },
    ];

    if (role === "SUPER_ADMIN") return SUPER_ADMIN_NAV;
    if (role === "ADMIN") return ADMIN_RESIDENT_NAV;
    if (role === "HOUSE_CAPTAIN") return HOUSE_CAPTAIN_NAV;
    return TENANT_NAV;
  }, [role, t, needsOutcome]);
}

function NavLink({ link, location, onClick }) {
  const isActive = location.pathname === link.to;
  return (
    <Link
      to={link.to}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={`group flex items-center gap-3 border-l-2 px-4 py-2.5 text-[13px] tracking-[0.06em] transition-colors duration-200 ${
        isActive
          ? "border-accent bg-surface-container text-accent font-medium"
          : "border-transparent text-foreground-variant hover:bg-surface-container/60 hover:text-foreground"
      }`}
    >
      <span
        className="material-symbols-outlined text-[19px] shrink-0"
        style={isActive ? { fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24" } : {}}
      >
        {link.icon}
      </span>
      <span className="flex-1">{link.label}</span>
      {link.badge > 0 && (
        <span
          title={`${link.badge} past viewing${link.badge === 1 ? "" : "s"} with no outcome recorded`}
          className="shrink-0 rounded-full bg-amber-500 px-2 py-0.5 font-mono text-[10px] font-bold text-white tabular-nums"
        >
          {link.badge}
        </span>
      )}
    </Link>
  );
}

// NOTE (9 Aug 2026): currently unreachable. Every nav entry with children now
// also carries `section:`, and the renderer matches that branch first, so this
// collapsible variant never runs. Left in place rather than deleted because it
// is the fallback for any future non-sectioned group. If none appears, delete it.
function AdminDropdown({ link, location, onLinkClick }) {
  // Supports two shapes: legacy `children: [...]` flat list, OR `groups: [{label, children}]` grouped.
  const allChildren = link.groups
    ? link.groups.flatMap((g) => g.children)
    : link.children || [];
  const isChildActive = allChildren.some((c) => location.pathname === c.to);
  const [open, setOpen] = useState(isChildActive);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-200 ${
          isChildActive
            ? "text-accent font-bold"
            : "text-foreground-variant hover:bg-white/5 hover:text-foreground hover:translate-x-1"
        }`}
      >
        <span className="material-symbols-outlined text-[20px] shrink-0">{link.icon}</span>
        <span className="font-['Inter'] flex-1 text-left">{link.label}</span>
        <span className="material-symbols-outlined text-[16px] transition-transform duration-200" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
          expand_more
        </span>
      </button>
      {open && (
        <div className="ml-4 space-y-0.5 border-l border-border pl-4 mb-1">
          {link.groups
            ? link.groups.map((g) => (
                <div key={g.label} className="mb-2 last:mb-0">
                  <div className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-foreground-variant/70 font-['Inter']">
                    {g.label}
                  </div>
                  {g.children.map((child) => (
                    <NavLink key={child.to} link={child} location={location} onClick={onLinkClick} />
                  ))}
                </div>
              ))
            : (link.children || []).map((child) => (
                <NavLink key={child.to} link={child} location={location} onClick={onLinkClick} />
              ))}
        </div>
      )}
    </div>
  );
}

function LanguageToggle() {
  const { lang, setLanguage } = useLanguage();
  return (
    <div className="flex items-center gap-2 px-4 py-2">
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
  );
}

function Sidebar({ profile, navLinks, location, onLinkClick, signOut, onStartTour }) {
  const { t } = useLanguage();
  const isSuperAdmin = profile?.role === "SUPER_ADMIN";
  const isAnyAdmin = isSuperAdmin || profile?.role === "ADMIN";
  const unitCode = isAnyAdmin ? "" : (profile?.rooms?.unit_code ?? profile?.room_id ?? "");
  const propertyName = isSuperAdmin ? "Super Admin" : isAnyAdmin ? "Administrator" : (profile?.properties?.name ?? profile?.rooms?.name ?? "Lazybee");
  const displayName = profile?.tenant_details?.full_name ?? profile?.full_name ?? (isAnyAdmin ? "Admin" : null) ?? profile?.email ?? t("nav.defaultName");
  const firstName = displayName.split(" ")[0];

  return (
    <aside className="h-screen w-64 fixed left-0 top-0 bg-surface flex flex-col py-8 z-40 border-r border-border">
      {/* Logo + user profile */}
      <div className="mb-8 px-6">
        <div className="mb-8">
          <Wordmark size="md" variant="lazybee" />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border border-accent/40 bg-accent/10 flex items-center justify-center font-mono text-accent text-xs tracking-[0.08em] shrink-0">
            {firstName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-foreground text-sm truncate">
              {t("nav.welcome", { name: firstName })}
            </p>
            <p className="font-mono text-foreground-variant text-xs tracking-[0.08em] truncate mt-0.5">
              {unitCode ? `${unitCode} · ` : ""}{propertyName}
            </p>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto scrollbar-hide border-t border-border pt-4">
        {navLinks.map((link) => {
          if (link.section) {
            return (
              <div key={link.section} className="pt-3 first:pt-0">
                <div className="px-6 pb-1.5 pt-1 font-mono text-[11px] uppercase tracking-[0.22em] text-foreground-variant">
                  {link.section}
                </div>
                {link.children.map((c) => (
                  <NavLink key={c.to} link={c} location={location} onClick={onLinkClick} />
                ))}
              </div>
            );
          }
          if (link.children || link.groups) {
            return (
              <AdminDropdown
                key={link.label}
                link={link}
                location={location}
                onLinkClick={onLinkClick}
              />
            );
          }
          return (
            <NavLink key={link.to} link={link} location={location} onClick={onLinkClick} />
          );
        })}
      </nav>

      {/* CTA + footer */}
      <div className="mt-auto space-y-3 border-t border-border pt-4">
        <div className="space-y-0.5">
          <LanguageToggle />
          {onStartTour && (
            <button
              onClick={() => { localStorage.removeItem("lazybee_tour_done"); onStartTour(); }}
              className="w-full flex items-center gap-3 px-6 py-2 text-foreground-variant hover:text-accent text-[13px] transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">tour</span>
              <span>{t("nav.takeTour")}</span>
            </button>
          )}
          <Link
            to="/portal/help"
            onClick={onLinkClick}
            className="flex items-center gap-3 px-6 py-2 text-foreground-variant hover:text-accent text-[13px] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">help</span>
            <span>{t("nav.help")}</span>
          </Link>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-6 py-2 text-foreground-variant hover:text-red-400 text-[13px] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            <span>{t("nav.logout")}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

function MobileBottomNav({ navLinks, location, onOpenSidebar }) {
  // For dropdown items (e.g. "Manage"), show a button that opens the full sidebar
  // instead of flattening and losing child links
  const isDropdown = (l) => l.children || l.groups;
  const hasDropdown = navLinks.some(isDropdown);

  // Top-level links only (no children expansion)
  const topLinks = navLinks.filter((link) => !isDropdown(link));
  // Take up to 4 top-level links if there's a dropdown, otherwise up to 5
  const visibleLinks = hasDropdown ? topLinks.slice(0, 4) : topLinks.slice(0, 5);

  // Find the first dropdown for the "More" button label/icon
  const dropdownLink = navLinks.find(isDropdown);
  const dropdownChildren = dropdownLink?.groups
    ? dropdownLink.groups.flatMap((g) => g.children)
    : (dropdownLink?.children || []);
  const isDropdownChildActive = dropdownChildren.some((c) => location.pathname === c.to);

  return (
    <div className="md:hidden fixed bottom-0 w-full bg-surface border-t border-border px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] flex justify-between items-stretch z-50">
      {visibleLinks.map((link) => {
        const isActive = location.pathname === link.to;
        return (
          <Link
            key={link.to}
            to={link.to}
            aria-current={isActive ? "page" : undefined}
            className={`flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-1 ${isActive ? "text-accent" : "text-foreground-variant"}`}
          >
            <span
              className="material-symbols-outlined text-[22px]"
              style={isActive ? { fontVariationSettings: "'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 24" } : {}}
            >
              {link.icon}
            </span>
            <span className="w-full truncate text-center text-[12px] leading-tight">{link.label}</span>
          </Link>
        );
      })}
      {dropdownLink && (
        <button
          onClick={onOpenSidebar}
          className={`flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-1 ${isDropdownChildActive ? "text-accent" : "text-foreground-variant"}`}
        >
          <span
            className="material-symbols-outlined text-[22px]"
            style={isDropdownChildActive ? { fontVariationSettings: "'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 24" } : {}}
          >
            {dropdownLink.icon}
          </span>
          <span className="w-full truncate text-center text-[12px] leading-tight">{dropdownLink.label}</span>
        </button>
      )}
    </div>
  );
}

export default function PortalLayout({ children }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const needsOutcomeCount = useNeedsOutcomeCount(profile?.role);
  const navLinks = useNavLinks(profile?.role, needsOutcomeCount);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showTour, setShowTour] = useState(false);

  // Show tour on first visit (non-admin)
  useEffect(() => {
    const isAnyAdmin = profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN";
    if (profile && !isAnyAdmin && !localStorage.getItem("lazybee_tour_done")) {
      const timer = setTimeout(() => setShowTour(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [profile]);

  return (
    <div className="min-h-screen bg-background">
      {showTour && <PortalTour onComplete={() => setShowTour(false)} />}
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar
          profile={profile}
          navLinks={navLinks}
          location={location}
          onLinkClick={() => {}}
          signOut={signOut}
          onStartTour={profile?.role !== "ADMIN" && profile?.role !== "SUPER_ADMIN" ? () => setShowTour(true) : undefined}
        />
      </div>

      {/* Mobile: hamburger button */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-surface border border-border flex items-center justify-center text-accent shadow-sm"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open menu"
      >
        <span className="material-symbols-outlined text-[22px]">menu</span>
      </button>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-[#241C16]/45 z-40"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="md:hidden fixed inset-y-0 left-0 z-50 w-64">
            <Sidebar
              profile={profile}
              navLinks={navLinks}
              location={location}
              onLinkClick={() => setSidebarOpen(false)}
              signOut={() => { setSidebarOpen(false); signOut(); }}
              onStartTour={profile?.role !== "ADMIN" && profile?.role !== "SUPER_ADMIN" ? () => { setSidebarOpen(false); setShowTour(true); } : undefined}
            />
          </div>
        </>
      )}

      {/* Main content */}
      <main className="md:ml-64 min-h-screen">
        {/* pt-16 on mobile clears the fixed hamburger, which otherwise sits on
            top of the first line of every page. */}
        <div className="px-6 pt-16 pb-28 md:pt-8 md:pb-10 lg:px-12 lg:py-10 max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <MobileBottomNav navLinks={navLinks} location={location} onOpenSidebar={() => setSidebarOpen(true)} />
    </div>
  );
}
