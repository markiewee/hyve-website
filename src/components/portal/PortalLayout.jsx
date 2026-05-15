import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useLanguage } from "../../i18n/LanguageContext";
import PortalTour from "./PortalTour";
import Wordmark from "../Wordmark";

function useNavLinks(role) {
  const { t } = useLanguage();

  return useMemo(() => {
    const TENANT_NAV = [
      { label: t("nav.dashboard"), to: "/portal/dashboard", icon: "dashboard" },
      { label: "My Property", to: "/portal/guide", icon: "home" },
      { label: t("nav.documents"), to: "/portal/documents", icon: "folder_open" },
      { label: t("nav.billing"), to: "/portal/billing", icon: "payments" },
      { label: t("nav.issues"), to: "/portal/issues", icon: "build" },
      { label: t("nav.maintenance"), to: "/portal/maintenance", icon: "engineering" },
      { label: t("nav.settings"), to: "/portal/settings", icon: "settings" },
    ];

    const HOUSE_CAPTAIN_NAV = [
      { label: t("nav.dashboard"), to: "/portal/dashboard", icon: "dashboard" },
      { label: "My Property", to: "/portal/guide", icon: "home" },
      { label: t("nav.documents"), to: "/portal/documents", icon: "folder_open" },
      { label: t("nav.billing"), to: "/portal/billing", icon: "payments" },
      { label: t("nav.issues"), to: "/portal/issues", icon: "build" },
      { label: t("nav.maintenance"), to: "/portal/maintenance", icon: "engineering" },
      { label: t("nav.propertyOverview"), to: "/portal/property", icon: "apartment" },
      { label: t("nav.tickets"), to: "/portal/property/tickets", icon: "confirmation_number" },
      { label: t("nav.members"), to: "/portal/property/tenants", icon: "group" },
      { label: "Viewings", to: "/portal/viewings", icon: "visibility" },
      { label: t("nav.claims"), to: "/portal/captain/claims", icon: "request_quote" },
      { label: t("nav.settings"), to: "/portal/settings", icon: "settings" },
    ];

    const ADMIN_MANAGE_SECTION = {
      label: t("nav.manage"),
      icon: "manage_accounts",
      groups: [
        {
          label: "Today",
          children: [
            { label: "Leads", to: "/portal/admin/leads", icon: "track_changes" },
            { label: "Inbox", to: "/portal/admin/inbox", icon: "inbox" },
            { label: t("nav.tasks"), to: "/portal/admin/tasks", icon: "checklist" },
            { label: t("nav.announcements"), to: "/portal/admin/announcements", icon: "campaign" },
          ],
        },
        {
          label: "People",
          children: [
            { label: t("nav.members"), to: "/portal/admin/members", icon: "group" },
            { label: t("nav.onboarding"), to: "/portal/admin/onboarding", icon: "how_to_reg" },
            { label: t("nav.investors"), to: "/portal/admin/investors", icon: "trending_up" },
          ],
        },
        {
          label: "Money",
          children: [
            { label: "Billing", to: "/portal/admin/billing", icon: "receipt_long" },
            { label: t("nav.expenses"), to: "/portal/admin/expenses", icon: "account_balance" },
            { label: t("nav.financials"), to: "/portal/admin/financials", icon: "bar_chart" },
          ],
        },
        {
          label: "Ops",
          children: [
            { label: t("nav.viewings"), to: "/portal/admin/viewings", icon: "visibility" },
            { label: t("nav.tickets"), to: "/portal/admin/tickets", icon: "confirmation_number" },
            { label: t("nav.locks"), to: "/portal/admin/locks", icon: "lock" },
            { label: t("nav.devices"), to: "/portal/admin/devices", icon: "router" },
            { label: t("nav.documents"), to: "/portal/admin/documents", icon: "description" },
          ],
        },
      ],
    };

    // Super admin: admin-only, no tenant/resident views
    const SUPER_ADMIN_NAV = [
      { label: t("nav.admin"), to: "/portal/admin", icon: "admin_panel_settings" },
      ADMIN_MANAGE_SECTION,
    ];

    // Admin who's also a resident/house captain: sees both admin AND tenant/captain nav
    const ADMIN_RESIDENT_NAV = [
      ...HOUSE_CAPTAIN_NAV.filter(l => l.to !== "/portal/settings"),
      { label: t("nav.admin"), to: "/portal/admin", icon: "admin_panel_settings" },
      ADMIN_MANAGE_SECTION,
      { label: t("nav.settings"), to: "/portal/settings", icon: "settings" },
    ];

    if (role === "SUPER_ADMIN") return SUPER_ADMIN_NAV;
    if (role === "ADMIN") return ADMIN_RESIDENT_NAV;
    if (role === "HOUSE_CAPTAIN") return HOUSE_CAPTAIN_NAV;
    return TENANT_NAV;
  }, [role, t]);
}

function NavLink({ link, location, onClick }) {
  const isActive = location.pathname === link.to;
  return (
    <Link
      to={link.to}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-200 ${
        isActive
          ? "bg-white text-[#A87813] font-bold rounded-l-full shadow-sm translate-x-0"
          : "text-[#6B7280] hover:bg-[#F2D88A] hover:translate-x-1"
      }`}
    >
      <span
        className="material-symbols-outlined text-[20px] shrink-0"
        style={isActive ? { fontVariationSettings: "'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 24" } : {}}
      >
        {link.icon}
      </span>
      <span className="font-['Manrope']">{link.label}</span>
    </Link>
  );
}

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
            ? "text-[#A87813] font-bold"
            : "text-[#6B7280] hover:bg-[#F2D88A] hover:translate-x-1"
        }`}
      >
        <span className="material-symbols-outlined text-[20px] shrink-0">{link.icon}</span>
        <span className="font-['Manrope'] flex-1 text-left">{link.label}</span>
        <span className="material-symbols-outlined text-[16px] transition-transform duration-200" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
          expand_more
        </span>
      </button>
      {open && (
        <div className="ml-4 space-y-0.5 border-l border-[#E8E0CE]/30 pl-4 mb-1">
          {link.groups
            ? link.groups.map((g) => (
                <div key={g.label} className="mb-2 last:mb-0">
                  <div className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-[#6B7280]/70 font-['Manrope']">
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
    <div className="flex items-center gap-1 px-4 py-2">
      <button
        onClick={() => setLanguage("en")}
        className={`px-2 py-1 text-xs font-['Manrope'] font-bold rounded transition-colors ${
          lang === "en"
            ? "bg-[#A87813] text-white"
            : "text-[#6B7280] hover:text-[#A87813]"
        }`}
      >
        EN
      </button>
      <span className="text-[#E8E0CE]">|</span>
      <button
        onClick={() => setLanguage("zh")}
        className={`px-2 py-1 text-xs font-['Manrope'] font-bold rounded transition-colors ${
          lang === "zh"
            ? "bg-[#A87813] text-white"
            : "text-[#6B7280] hover:text-[#A87813]"
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
  const unitCode = isSuperAdmin ? "" : (profile?.rooms?.unit_code ?? profile?.room_id ?? "");
  const propertyName = isSuperAdmin ? "Super Admin" : (profile?.properties?.name ?? profile?.rooms?.name ?? "Lazybee");
  const displayName = profile?.tenant_details?.full_name ?? profile?.full_name ?? profile?.email ?? t("nav.defaultName");
  const firstName = displayName.split(" ")[0];

  return (
    <aside className="h-screen w-64 fixed left-0 top-0 bg-slate-50 flex flex-col py-8 pl-4 z-40 border-r border-[#E8E0CE]/20">
      {/* Logo + user profile */}
      <div className="mb-10 px-4">
        <div className="mb-8">
          <Wordmark size="md" />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#FAF0CC] flex items-center justify-center text-[#A87813] font-bold text-sm shrink-0">
            {firstName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-['Manrope'] font-bold text-[#1F2937] text-sm truncate">
              {t("nav.welcome", { name: firstName })}
            </p>
            <p className="font-['Manrope'] text-[#6B7280] text-xs truncate">
              {unitCode ? `${unitCode} · ` : ""}{propertyName}
            </p>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-hide pr-0">
        {navLinks.map((link) => {
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
      <div className="mt-auto pr-4 space-y-4 pt-4">
        <Link
          to="/portal/issues/new"
          onClick={onLinkClick}
          className="w-full py-3 px-4 bg-[#A87813] text-white rounded-xl font-['Manrope'] font-bold text-sm shadow-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">support_agent</span>
          {t("nav.quickSupport")}
        </Link>
        <div className="space-y-1">
          <LanguageToggle />
          {onStartTour && (
            <button
              onClick={() => { localStorage.removeItem("lazybee_tour_done"); onStartTour(); }}
              className="w-full flex items-center gap-3 px-4 py-2 text-slate-400 hover:text-[#A87813] text-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">tour</span>
              <span className="font-['Manrope']">{t("nav.takeTour")}</span>
            </button>
          )}
          <Link
            to="/portal/help"
            onClick={onLinkClick}
            className="flex items-center gap-3 px-4 py-2 text-slate-400 hover:text-[#A87813] text-sm transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">help</span>
            <span className="font-['Manrope']">{t("nav.help")}</span>
          </Link>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-4 py-2 text-slate-400 hover:text-red-500 text-sm transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            <span className="font-['Manrope']">{t("nav.logout")}</span>
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
    <div className="md:hidden fixed bottom-0 w-full bg-white border-t border-[#E8E0CE]/20 px-6 py-3 flex justify-between items-center z-50">
      {visibleLinks.map((link) => {
        const isActive = location.pathname === link.to;
        return (
          <Link
            key={link.to}
            to={link.to}
            className={`flex flex-col items-center gap-1 ${isActive ? "text-[#A87813]" : "text-[#6B7280]"}`}
          >
            <span
              className="material-symbols-outlined text-[22px]"
              style={isActive ? { fontVariationSettings: "'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 24" } : {}}
            >
              {link.icon}
            </span>
            <span className="text-[10px] font-['Inter'] font-medium">{link.label}</span>
          </Link>
        );
      })}
      {dropdownLink && (
        <button
          onClick={onOpenSidebar}
          className={`flex flex-col items-center gap-1 ${isDropdownChildActive ? "text-[#A87813]" : "text-[#6B7280]"}`}
        >
          <span
            className="material-symbols-outlined text-[22px]"
            style={isDropdownChildActive ? { fontVariationSettings: "'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 24" } : {}}
          >
            {dropdownLink.icon}
          </span>
          <span className="text-[10px] font-['Inter'] font-medium">{dropdownLink.label}</span>
        </button>
      )}
    </div>
  );
}

export default function PortalLayout({ children }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navLinks = useNavLinks(profile?.role);
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
    <div className="min-h-screen bg-[#FAF6EC]">
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
        className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-white rounded-xl shadow-sm border border-[#E8E0CE]/20 flex items-center justify-center text-[#A87813]"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open menu"
      >
        <span className="material-symbols-outlined text-[22px]">menu</span>
      </button>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/30 z-40"
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
        <div className="px-6 py-8 lg:px-12 lg:py-10 pb-24 md:pb-10 max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <MobileBottomNav navLinks={navLinks} location={location} onOpenSidebar={() => setSidebarOpen(true)} />
    </div>
  );
}
