import i18n from '../i18n';

// The person's memberships, admin ones first, each group sorted by organization name.
export function groupByRole(accounts) {
  const byName = (a, b) => (a.name || '').localeCompare(b.name || '');
  return [
    { role: 'admin', label: i18n.t('roles.as_admin') },
    { role: 'member', label: i18n.t('roles.as_member') },
  ]
    .map((g) => ({ ...g, accounts: accounts.filter((a) => a.role === g.role).sort(byName) }))
    .filter((g) => g.accounts.length > 0);
}
