import { Check, Circle } from 'lucide-react';

export default function PasswordRequirements({ checks }) {
  return (
    <ul className="flex flex-col gap-1">
      {checks.map((c) => (
        <li
          key={c.label}
          className={`flex items-center gap-2 text-row ${c.ok ? 'text-success' : 'text-ink/45'}`}
        >
          {c.ok ? <Check size={14} strokeWidth={3} /> : <Circle size={14} />}
          {c.label}
        </li>
      ))}
    </ul>
  );
}
