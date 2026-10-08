import { Link } from 'react-router-dom';
import Signature from './Signature';

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-[420px] border-2 border-ink rounded-brutal-lg bg-surface shadow-brutal-sm p-7">
        <img src="/planeola_rect.png" alt="Planeola" className="h-14 w-auto mx-auto mb-7" />
        <h1 className="font-sans font-bold text-headline tracking-[-0.025em] mb-[3px]">{title}</h1>
        {subtitle && (
          <p className="font-mono text-label uppercase tracking-widest text-ink/50 mb-6">
            {subtitle}
          </p>
        )}
        {children}
      </div>

      <div className="fixed bottom-3 left-3.5 font-mono text-xs text-ink/40">
        <Signature />
      </div>
    </div>
  );
}

export function AuthError({ children }) {
  if (!children) return null;
  return (
    <p className="border-l-[3px] border-danger pl-3 py-0.5 text-row font-semibold text-danger-deep">
      {children}
    </p>
  );
}

export function AuthNote({ children }) {
  if (!children) return null;
  return (
    <p className="border-l-[3px] border-success pl-3 py-0.5 text-sm leading-[1.55] text-ink/75">
      {children}
    </p>
  );
}

export function AuthLink({ to, children }) {
  return (
    <Link
      to={to}
      className="inline-block text-row font-semibold text-primary hover:text-primary-deep transition"
    >
      {children}
    </Link>
  );
}

export function AuthFooter({ children }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-ink/10 pt-3.5">
      {children}
    </div>
  );
}
