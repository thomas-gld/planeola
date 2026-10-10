import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Github } from 'lucide-react';

export default function Signature() {
  const { t } = useTranslation();
  return (
    <>
      © 2026{' '}
      <a
        href="https://github.com/thomas-gld"
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('signature.source')}
        title={t('signature.github_title')}
        className="inline-flex align-middle hover:text-ink transition"
      >
        <Github size={13} />
      </a>
      {' · '}
      <Link to="/legal" className="hover:text-ink transition">
        {t('signature.legal')}
      </Link>
      {' · '}
      <Link to="/privacy" className="hover:text-ink transition">
        {t('signature.privacy')}
      </Link>
    </>
  );
}
