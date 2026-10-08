// A count pinned to the top-right corner of its `relative` parent. Nothing when zero.
export default function CountBadge({ count }) {
  if (!count) return null;
  return (
    <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 rounded-full border-2 border-ink bg-danger text-surface font-mono text-label font-bold flex items-center justify-center">
      {count}
    </span>
  );
}
