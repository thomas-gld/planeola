import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { orgToday } from '../lib/timezone';
import OrgSwitcher from './OrgSwitcher';
import RoleBadge from './RoleBadge';

// An admin's fullname defaults to the organization name or the email: no first name then.
function firstName(user, orgName) {
  const name = (user?.fullname || '').trim();
  if (!name || name.includes('@') || name === orgName) return '';
  return name.split(/\s+/)[0];
}

// `orgName` is null until fetched.
export default function HomeHeader({ orgName, timezone }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const name = firstName(user, orgName);

  return (
    <div className="flex items-start justify-between gap-6 flex-wrap">
      <div className="flex flex-col gap-1.5 sm:gap-2">
        <p className="font-mono text-label sm:text-meta font-bold uppercase tracking-[0.18em] text-ink/45">
          {orgToday(timezone).format(t('formats.full_date'))}
        </p>
        <h1 className="font-sans font-bold text-display-sm sm:text-display tracking-[-0.03em] leading-[1.05]">
          {name ? t('home_header.hello_name', { name }) : t('home_header.hello')}
        </h1>
        <div className="flex items-center gap-3 mt-1 min-h-[34px] flex-wrap">
          <RoleBadge role={user?.role} size="md" />
          {orgName === null ? (
            <span className="inline-block h-6 w-48 bg-ink/10 rounded-brutal-sm animate-pulse" />
          ) : (
            <span className="font-sans text-heading sm:text-headline font-bold tracking-snugger leading-tight break-words">
              {orgName || t('home_header.your_org')}
            </span>
          )}
        </div>
      </div>
      <OrgSwitcher showEmail />
    </div>
  );
}
