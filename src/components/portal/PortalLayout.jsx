import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "../ui/button";

const TENANT_NAV = [
  { label: "Dashboard", to: "/portal/dashboard" },
  { label: "Billing", to: "/portal/billing" },
  { label: "Issues", to: "/portal/issues" },
];

const HOUSE_CAPTAIN_NAV = [
  { label: "Dashboard", to: "/portal/dashboard" },
  { label: "Billing", to: "/portal/billing" },
  { label: "Issues", to: "/portal/issues" },
  { label: "Property Overview", to: "/portal/property" },
  { label: "Tickets", to: "/portal/property/tickets" },
  { label: "Tenants", to: "/portal/property/tenants" },
];

const ADMIN_NAV = [
  { label: "Dashboard", to: "/portal/dashboard" },
  { label: "Billing", to: "/portal/billing" },
  { label: "Issues", to: "/portal/issues" },
  { label: "Admin", to: "/portal/admin" },
  { label: "Devices", to: "/portal/admin/devices" },
  { label: "Announcements", to: "/portal/admin/announcements" },
  { label: "Rent", to: "/portal/admin/rent" },
  { label: "Investors", to: "/portal/admin/investors" },
  { label: "Expenses", to: "/portal/admin/expenses" },
  { label: "Financials", to: "/portal/admin/financials" },
  { label: "Documents", to: "/portal/admin/documents" },
];

function getNavLinks(role) {
  if (role === "ADMIN") return ADMIN_NAV;
  if (role === "HOUSE_CAPTAIN") return HOUSE_CAPTAIN_NAV;
  return TENANT_NAV;
}

export default function PortalLayout({ children }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navLinks = getNavLinks(profile?.role);
  const unitCode = profile?.rooms?.unit_code ?? profile?.room_id ?? "";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link
            to="/portal/dashboard"
            className="text-base font-semibold text-foreground hover:text-primary transition-colors"
          >
            Hyve Portal
          </Link>

          {/* Nav */}
          <nav className="hidden sm:flex items-center gap-1 flex-1 overflow-x-auto">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right side: unit code + sign out */}
          <div className="flex items-center gap-3 shrink-0">
            {unitCode && (
              <span className="text-xs font-mono bg-secondary text-secondary-foreground px-2 py-1 rounded">
                {unitCode}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="sm:hidden flex items-center gap-1 overflow-x-auto px-4 pb-2">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 py-8">{children}</div>
      </main>
    </div>
  );
}
