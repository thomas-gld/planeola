import i18n from '../i18n';

// Mirrors `password_problem` in core/security.py, which is the one that counts.
export function passwordChecks(password, confirm, email = '') {
  const value = password || '';
  const checks = [
    { label: i18n.t('password.min_length'), ok: value.length >= 8 },
    { label: i18n.t('password.letter'), ok: /\p{L}/u.test(value) },
    { label: i18n.t('password.digit'), ok: /\p{Nd}/u.test(value) },
  ];
  if (email) {
    checks.push({
      label: i18n.t('password.not_email'),
      ok: value !== '' && value.trim().toLowerCase() !== email.trim().toLowerCase(),
    });
  }
  checks.push({ label: i18n.t('password.match'), ok: value !== '' && value === confirm });
  return checks;
}
