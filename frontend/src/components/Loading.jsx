import { useTranslation } from 'react-i18next';

export default function Loading({ fullScreen = false }) {
  const { t } = useTranslation();
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 ${fullScreen ? 'min-h-screen bg-bg' : 'py-16'}`}
    >
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-ink/15 border-t-primary" />
      <p className="font-mono text-xs uppercase tracking-widest text-ink/50">
        {t('common.loading')}
      </p>
    </div>
  );
}
