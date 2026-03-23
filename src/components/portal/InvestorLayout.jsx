import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

const INVESTOR_NAV = [
  {
    label: "Dashboard",
    to: "/portal/investor/dashboard",
    icon: "dashboard",
  },
];

export default function InvestorLayout({ children }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();

  const displayName =
    profile?.full_name ?? profile?.name ?? profile?.email ?? "Investor";

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#f8f9ff] flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col fixed inset-y-0 left-0 bg-white border-r border-[#bbcac6]/15 z-30">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-[#bbcac6]/10">
          <Link
            to="/portal/investor/dashboard"
            className="flex items-center gap-2"
          >
            <div className="w-8 h-8 rounded-lg bg-[#006b5f] flex items-center justify-center">
              <span
                className="material-symbols-outlined text-white text-[16px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                trending_up
              </span>
            </div>
            <img src="/hyve-logo.png" alt="Hyve" className="h-6" />
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-6 space-y-1">
          {INVESTOR_NAV.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-['Manrope'] font-semibold transition-all ${
                  isActive
                    ? "bg-[#006b5f] text-white shadow-sm shadow-[#006b5f]/20"
                    : "text-[#555f6f] hover:bg-[#eff4ff] hover:text-[#121c2a]"
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[20px] ${
                    isActive ? "text-white" : "text-[#6c7a77]"
                  }`}
                  style={
                    isActive
                      ? { fontVariationSettings: "'FILL' 1" }
                      : undefined
                  }
                >
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User card */}
        <div className="p-4 border-t border-[#bbcac6]/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-[#006b5f]/10 flex items-center justify-center">
              <span className="font-['Plus_Jakarta_Sans'] font-bold text-xs text-[#006b5f]">
                {initials}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-['Manrope'] font-semibold text-[#121c2a] text-xs truncate">
                {displayName}
              </p>
              <p className="font-['Inter'] text-[10px] text-[#6c7a77] uppercase tracking-widest">
                Investor
              </p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[#6c7a77] hover:bg-[#ffdad6]/30 hover:text-[#ba1a1a] transition-colors text-xs font-['Manrope'] font-semibold"
          >
            <span className="material-symbols-outlined text-[16px]">
              logout
            </span>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 h-14 bg-white border-b border-[#bbcac6]/15 z-30 flex items-center justify-between px-4">
        <Link
          to="/portal/investor/dashboard"
          className="flex items-center gap-2"
        >
          <div className="w-7 h-7 rounded-lg bg-[#006b5f] flex items-center justify-center">
            <span
              className="material-symbols-outlined text-white text-[14px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              trending_up
            </span>
          </div>
          <span className="font-['Plus_Jakarta_Sans'] font-extrabold text-[#121c2a] text-sm">
            Hyve Investor
          </span>
        </Link>
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 text-[#6c7a77] text-xs font-['Manrope'] font-semibold"
        >
          <span className="material-symbols-outlined text-[16px]">logout</span>
          Sign Out
        </button>
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-[#bbcac6]/10 z-30 flex">
        {INVESTOR_NAV.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex-1 flex flex-col items-center py-2.5 gap-1 text-[10px] font-['Inter'] font-bold uppercase tracking-widest transition-colors ${
                isActive ? "text-[#006b5f]" : "text-[#6c7a77]"
              }`}
            >
              <span
                className={`material-symbols-outlined text-[22px]`}
                style={
                  isActive
                    ? { fontVariationSettings: "'FILL' 1" }
                    : undefined
                }
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Main content */}
      <main className="flex-1 md:ml-64 pt-14 md:pt-0 pb-16 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
