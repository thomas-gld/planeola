import OrganizationsList from '../components/OrganizationsList';
import PageHeader from '../components/PageHeader';

export default function Organizations() {
  return (
    <div>
      <PageHeader title="Your organizations" />

      <main className="max-w-xl mx-auto px-4 sm:px-6 py-8">
        <p className="font-mono text-xs uppercase tracking-wider text-ink/50 text-center mb-6">
          Click the star to set your default organization — opened automatically next time you log
          in.
        </p>
        <OrganizationsList />
      </main>
    </div>
  );
}
