// Mirrors `password_problem` in core/security.py, which is the one that counts.
export function passwordChecks(password, confirm, email = '') {
  const value = password || '';
  const checks = [
    { label: 'At least 8 characters', ok: value.length >= 8 },
    { label: 'A letter', ok: /\p{L}/u.test(value) },
    { label: 'A digit', ok: /\p{Nd}/u.test(value) },
  ];
  if (email) {
    checks.push({
      label: 'Different from your email',
      ok: value !== '' && value.trim().toLowerCase() !== email.trim().toLowerCase(),
    });
  }
  checks.push({ label: 'Passwords match', ok: value !== '' && value === confirm });
  return checks;
}
