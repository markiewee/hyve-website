// Shared admin page header. Standardizes the top of every /portal/admin/* page.
// Replaces 4 different h1 treatments across 17 pages with a single component.
// Lazybee treatment: mono uppercase eyebrow, serif title, muted standfirst,
// closed off with a hairline rule.

export default function PageHeader({ eyebrow, title, subtitle, action, children }) {
  return (
    <header className="mb-8 border-b border-border pb-6 flex flex-wrap items-end justify-between gap-5">
      <div className="min-w-0">
        {eyebrow && (
          <span className="block font-mono text-[11px] uppercase tracking-[0.28em] text-accent mb-3">
            {eyebrow}
          </span>
        )}
        <h1 className="font-display text-[34px] leading-[1.05] text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-sm leading-relaxed text-foreground-variant max-w-[62ch]">{subtitle}</p>
        )}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
