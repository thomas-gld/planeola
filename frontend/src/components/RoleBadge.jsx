const SIZES = {
  sm: 'px-1.5 py-px text-micro shadow-none border-[1.5px]',
  md: 'px-2.5 py-1 text-meta shadow-brutal-xs border-2',
};

export default function RoleBadge({ role, size = 'sm' }) {
  const isAdmin = role === 'admin';
  return (
    <span
      className={`shrink-0 inline-block border-ink rounded-brutal-sm font-mono font-bold uppercase tracking-caps text-surface ${
        isAdmin ? 'bg-danger' : 'bg-primary'
      } ${SIZES[size]}`}
    >
      {isAdmin ? 'Admin' : 'Member'}
    </span>
  );
}
