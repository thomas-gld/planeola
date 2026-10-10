import { useTranslation } from 'react-i18next';
import OrganizationsList from '../components/OrganizationsList';
import PageHeader from '../components/PageHeader';

export default function Organizations() {
  const { t } = useTranslation();
  return (
    <div>
      <PageHeader title={t('orgs.your_orgs')} />

      <main className="max-w-xl mx-auto px-4 sm:px-6 py-8">
        <p className="font-mono text-xs uppercase tracking-wider text-ink/50 text-center mb-6">
          {t('organizations.star_hint')}
        </p>
        <OrganizationsList />
      </main>
    </div>
  );
}
