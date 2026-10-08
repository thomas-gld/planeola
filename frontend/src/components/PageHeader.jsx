export default function PageHeader({ title, subtitle, children }) {
  return (
    <div className="no-print flex items-center gap-3 border-b-2 border-ink bg-surface px-5 sm:px-7 py-4">
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <h1 className="font-sans font-bold text-heading sm:text-2xl tracking-snugger truncate">
          {title}
        </h1>
        {subtitle && (
          <span className="font-mono text-label uppercase tracking-widest text-ink/50 truncate">
            {subtitle}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2.5 shrink-0">{children}</div>
    </div>
  );
}
