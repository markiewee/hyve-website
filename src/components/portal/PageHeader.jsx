// Shared admin page header. Standardizes the top of every /portal/admin/* page.
// Replaces 4 different h1 treatments across 17 pages with a single component.

export default function PageHeader({ eyebrow, title, subtitle, action, children }) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <span className="block text-[11px] uppercase tracking-[0.4em] font-semibold text-accent mb-4">
            {eyebrow}
          </span>
        )}
        <h1 className="font-display text-3xl font-extrabold text-foreground tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-foreground-variant font-['Inter']">{subtitle}</p>
        )}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
