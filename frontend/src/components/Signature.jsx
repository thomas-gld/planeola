import { Link } from 'react-router-dom';
import { Github } from 'lucide-react';

export default function Signature() {
  return (
    <>
      © 2026{' '}
      <a
        href="https://github.com/thomas-gld"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Source on GitHub"
        title="Thomas Gladin on GitHub"
        className="inline-flex align-middle hover:text-ink transition"
      >
        <Github size={13} />
      </a>
      {' · '}
      <Link to="/legal" className="hover:text-ink transition">
        Legal notice
      </Link>
      {' · '}
      <Link to="/privacy" className="hover:text-ink transition">
        Privacy
      </Link>
    </>
  );
}
