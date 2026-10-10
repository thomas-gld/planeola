import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import AuthLayout, { AuthError, AuthLink, AuthNote, AuthFooter } from '../components/AuthLayout';
import { passwordChecks } from '../lib/password';
import PasswordInput from '../components/PasswordInput';
import PasswordRequirements from '../components/PasswordRequirements';

export default function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const checks = passwordChecks(password, confirm);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, new_password: password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || t('reset.error'));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout title={t('reset.invalid_title')}>
        <div className="space-y-[18px]">
          <AuthError>{t('reset.invalid')}</AuthError>
          <Link
            to="/forgot-password"
            className="btn-brutal-primary w-full py-[13px] text-emphasis shadow-brutal-sm"
          >
            {t('auth.request_new_link')}
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title={t('reset.done_title')}>
        <div className="space-y-[18px]">
          <AuthNote>{t('reset.done')}</AuthNote>
          <Link
            to="/login"
            className="btn-brutal-primary w-full py-[13px] text-emphasis shadow-brutal-sm"
          >
            {t('auth.sign_in')}
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('reset.title')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-label font-bold uppercase tracking-caps-lg text-ink/50">
            {t('reset.new_password')}
          </span>
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
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
          {loading ? t('common.saving') : t('reset.submit')}
        </button>

        <AuthFooter>
          <AuthLink to="/login">{t('auth.back_to_login')}</AuthLink>
          <AuthLink to="/forgot-password">{t('auth.request_new_link')}</AuthLink>
        </AuthFooter>
      </form>
    </AuthLayout>
  );
}
