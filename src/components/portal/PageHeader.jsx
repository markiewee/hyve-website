// Shared admin page header. Standardizes the top of every /portal/admin/* page.
// Replaces 4 different h1 treatments across 17 pages with a single component.

export default function PageHeader({ title, subtitle, action, children }) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-3xl font-extrabold text-[#181511] font-['Inter'] tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-[#57534E] font-['Inter']">{subtitle}</p>
        )}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
