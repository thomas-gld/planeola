import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import AuthLayout, { AuthError, AuthLink, AuthFooter } from '../components/AuthLayout';
import VerifyCodeForm from '../components/VerifyCodeForm';
import { applyIdentitySession } from '../lib/session';
import { passwordChecks } from '../lib/password';
import PasswordInput from '../components/PasswordInput';
import PasswordRequirements from '../components/PasswordRequirements';

export default function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const checks = passwordChecks(password, confirm, email);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    setLoading(true);
    try {
      const response = await api.post('/auth/register', { email, password });

      if (response.data.status === 'verification_required') {
        setPendingEmail(response.data.email || email);
      } else {
        // A verified email with the right password: this was a login.
        await applyIdentitySession(response.data, { login, navigate });
      }
    } catch (err) {
      console.error(err);
      const errorMessage = err.response?.data?.detail || t('register.error');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (pendingEmail) {
    return (
      <AuthLayout title={t('auth.confirm_email')}>
        <VerifyCodeForm
          email={pendingEmail}
          onVerified={(body) => applyIdentitySession(body, { login, navigate })}
          onBack={() => {
            setPendingEmail('');
            setError('');
          }}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('register.title')}>
      <form onSubmit={handleRegister} className="space-y-4">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-label font-bold uppercase tracking-caps-lg text-ink/50">
            {t('common.email')}
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input-brutal-hairline"
            placeholder={t('common.email_placeholder')}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-label font-bold uppercase tracking-caps-lg text-ink/50">
            {t('auth.password')}
          </span>
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-label font-bold uppercase tracking-caps-lg text-ink/50">
            {t('auth.confirm_password')}
          </span>
          <PasswordInput
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            placeholder={t('auth.confirm_password_placeholder')}
          />
        </label>

        <PasswordRequirements checks={checks} />

        <AuthError>{error}</AuthError>

        <button
          type="submit"
          disabled={loading || !checks.every((c) => c.ok)}
          className="btn-brutal-primary w-full py-[13px] text-emphasis shadow-brutal-sm mt-0.5"
        >
          {loading ? t('register.submitting') : t('register.submit')}
        </button>

        <AuthFooter>
          <AuthLink to="/login">{t('auth.sign_in')}</AuthLink>
        </AuthFooter>
      </form>
    </AuthLayout>
  );
}
