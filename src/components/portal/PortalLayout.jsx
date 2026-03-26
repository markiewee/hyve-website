import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import PortalTour from "./PortalTour";

const TENANT_NAV = [
  { label: "Dashboard", to: "/portal/dashboard", icon: "dashboard" },
  { label: "Documents", to: "/portal/documents", icon: "folder_open" },
  { label: "Billing", to: "/portal/billing", icon: "payments" },
  { label: "Issues", to: "/portal/issues", icon: "build" },
  { label: "Settings", to: "/portal/settings", icon: "settings" },
];

const HOUSE_CAPTAIN_NAV = [
  { label: "Dashboard", to: "/portal/dashboard", icon: "dashboard" },
  { label: "Documents", to: "/portal/documents", icon: "folder_open" },
  { label: "Billing", to: "/portal/billing", icon: "payments" },
  { label: "Issues", to: "/portal/issues", icon: "build" },
  { label: "Property Overview", to: "/portal/property", icon: "apartment" },
  { label: "Tickets", to: "/portal/property/tickets", icon: "confirmation_number" },
  { label: "Members", to: "/portal/property/tenants", icon: "group" },
  { label: "Settings", to: "/portal/settings", icon: "settings" },
];

const ADMIN_NAV = [
  { label: "Billing", to: "/portal/billing", icon: "payments" },
  { label: "Issues", to: "/portal/issues", icon: "build" },
  { label: "Admin", to: "/portal/admin", icon: "admin_panel_settings" },
  {
    label: "Manage",
    icon: "manage_accounts",
    children: [
      { label: "Tasks", to: "/portal/admin/tasks", icon: "checklist" },
      { label: "Members", to: "/portal/admin/onboarding", icon: "how_to_reg" },
      { label: "Rent", to: "/portal/admin/rent", icon: "receipt_long" },
      { label: "Documents", to: "/portal/admin/documents", icon: "description" },
      { label: "Announcements", to: "/portal/admin/announcements", icon: "campaign" },
      { label: "Smart Locks", to: "/portal/admin/locks", icon: "lock" },
      { label: "Devices", to: "/portal/admin/devices", icon: "router" },
      { label: "Investors", to: "/portal/admin/investors", icon: "trending_up" },
      { label: "Expenses", to: "/portal/admin/expenses", icon: "account_balance" },
      { label: "Financials", to: "/portal/admin/financials", icon: "bar_chart" },
    ],
  },
];

function getNavLinks(role) {
  if (role === "ADMIN") return ADMIN_NAV;
  if (role === "HOUSE_CAPTAIN") return HOUSE_CAPTAIN_NAV;
  return TENANT_NAV;
}

function NavLink({ link, location, onClick }) {
  const isActive = location.pathname === link.to;
  return (
    <Link
      to={link.to}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-200 ${
        isActive
          ? "bg-white text-[#006b5f] font-bold rounded-l-full shadow-sm translate-x-0"
          : "text-[#6c7a77] hover:bg-[#eff4ff] hover:translate-x-1"
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
  const isChildActive = link.children.some((c) => location.pathname === c.to);
  const [open, setOpen] = useState(isChildActive);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-200 ${
          isChildActive
            ? "text-[#006b5f] font-bold"
            : "text-[#6c7a77] hover:bg-[#eff4ff] hover:translate-x-1"
        }`}
      >
        <span className="material-symbols-outlined text-[20px] shrink-0">{link.icon}</span>
        <span className="font-['Manrope'] flex-1 text-left">{link.label}</span>
        <span className="material-symbols-outlined text-[16px] transition-transform duration-200" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
          expand_more
        </span>
      </button>
      {open && (
        <div className="ml-4 space-y-0.5 border-l border-[#bbcac6]/30 pl-4 mb-1">
          {link.children.map((child) => (
            <NavLink key={child.to} link={child} location={location} onClick={onLinkClick} />
          ))}
        </div>
      )}
    </div>
  );
}

function Sidebar({ profile, navLinks, location, onLinkClick, signOut, onStartTour }) {
  const isAdmin = profile?.role === "ADMIN";
  const unitCode = isAdmin ? "" : (profile?.rooms?.unit_code ?? profile?.room_id ?? "");
  const propertyName = isAdmin ? "Admin" : (profile?.properties?.name ?? profile?.rooms?.name ?? "Hyve");
  const displayName = profile?.tenant_details?.full_name ?? profile?.full_name ?? profile?.email ?? "Member";
  const firstName = displayName.split(" ")[0];

  return (
    <aside className="h-screen w-64 fixed left-0 top-0 bg-slate-50 flex flex-col py-8 pl-4 z-40 border-r border-[#bbcac6]/20">
      {/* Logo + user profile */}
      <div className="mb-10 px-4">
        <div className="mb-8">
          <img src="/hyve-logo.png" alt="Hyve" className="h-8" />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#d9e3f6] flex items-center justify-center text-[#006b5f] font-bold text-sm shrink-0">
            {firstName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-['Manrope'] font-bold text-[#121c2a] text-sm truncate">
              Welcome, {firstName}
            </p>
            <p className="font-['Manrope'] text-[#6c7a77] text-xs truncate">
              {unitCode ? `${unitCode} · ` : ""}{propertyName}
            </p>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-hide pr-0">
        {navLinks.map((link) => {
          if (link.children) {
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
          className="w-full py-3 px-4 bg-[#006b5f] text-white rounded-xl font-['Manrope'] font-bold text-sm shadow-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">support_agent</span>
          Quick Support
        </Link>
        <div className="space-y-1">
          {onStartTour && (
            <button
              onClick={() => { localStorage.removeItem("hyve_tour_done"); onStartTour(); }}
              className="w-full flex items-center gap-3 px-4 py-2 text-slate-400 hover:text-[#006b5f] text-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">tour</span>
              <span className="font-['Manrope']">Take a Tour</span>
            </button>
          )}
          <a
            href="mailto:hello@hyve.sg"
            className="flex items-center gap-3 px-4 py-2 text-slate-400 hover:text-[#006b5f] text-sm transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">help</span>
            <span className="font-['Manrope']">Help</span>
          </a>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-4 py-2 text-slate-400 hover:text-red-500 text-sm transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            <span className="font-['Manrope']">Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

function MobileBottomNav({ navLinks, location }) {
  const flatLinks = navLinks.flatMap((link) =>
    link.children ? link.children.slice(0, 1) : [link]
  ).slice(0, 5);

  return (
    <div className="md:hidden fixed bottom-0 w-full bg-white border-t border-[#bbcac6]/20 px-6 py-3 flex justify-between items-center z-50">
      {flatLinks.map((link) => {
        const isActive = location.pathname === link.to;
        return (
          <Link
            key={link.to}
            to={link.to}
            className={`flex flex-col items-center gap-1 ${isActive ? "text-[#006b5f]" : "text-[#6c7a77]"}`}
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
    </div>
  );
}

export default function PortalLayout({ children }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navLinks = getNavLinks(profile?.role);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showTour, setShowTour] = useState(false);

  // Show tour on first visit (non-admin)
  useEffect(() => {
    if (profile && profile.role !== "ADMIN" && !localStorage.getItem("hyve_tour_done")) {
      const timer = setTimeout(() => setShowTour(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [profile]);

  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      {showTour && <PortalTour onComplete={() => setShowTour(false)} />}
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar
          profile={profile}
          navLinks={navLinks}
          location={location}
          onLinkClick={() => {}}
          signOut={signOut}
          onStartTour={() => setShowTour(true)}
        />
      </div>

      {/* Mobile: hamburger button */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-white rounded-xl shadow-sm border border-[#bbcac6]/20 flex items-center justify-center text-[#006b5f]"
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
              onStartTour={() => { setSidebarOpen(false); setShowTour(true); }}
            />
          </div>
        </>
      )}

      {/* Main content */}
      <main className="md:ml-64 min-h-screen">
        <div className="px-6 py-8 lg:px-12 lg:py-10 pb-24 md:pb-10">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <MobileBottomNav navLinks={navLinks} location={location} />
    </div>
  );
}
