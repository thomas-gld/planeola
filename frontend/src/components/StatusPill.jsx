const TONES = {
  success: 'bg-success/[0.12] text-success',
  danger: 'bg-danger/[0.12] text-danger-deep',
  primary: 'bg-primary/[0.12] text-primary',
  neutral: 'bg-ink/[0.06] text-ink/60',
};

// A variant, not appended classes: two paddings on one element resolve by CSS order.
const SIZES = {
  sm: 'px-2 py-0.5',
  md: 'px-[11px] py-1',
};

export default function StatusPill({
  tone = 'neutral',
  size = 'sm',
  className = '',
  children,
  ...props
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-mono text-label font-bold uppercase ${TONES[tone]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
