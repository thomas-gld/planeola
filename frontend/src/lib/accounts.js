// The person's memberships, admin ones first, each group sorted by organization name.
export function groupByRole(accounts) {
  const byName = (a, b) => (a.name || '').localeCompare(b.name || '');
  return [
    { role: 'admin', label: 'As admin' },
    { role: 'member', label: 'As member' },
  ]
    .map((g) => ({ ...g, accounts: accounts.filter((a) => a.role === g.role).sort(byName) }))
    .filter((g) => g.accounts.length > 0);
}
