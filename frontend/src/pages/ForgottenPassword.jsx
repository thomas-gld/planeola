import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import AuthLayout, { AuthLink, AuthNote, AuthFooter } from '../components/AuthLayout';

export default function ForgottenPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post('/auth/forgot-password', { email });
    } catch {
      // Same answer whether the email exists or not.
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  };

  return (
    <AuthLayout title={submitted ? t('forgot.sent_title') : t('forgot.title')}>
      {submitted ? (
        <div className="space-y-[18px]">
          <AuthNote>{t('forgot.sent')}</AuthNote>
          <Link
            to="/login"
            className="btn-brutal-primary w-full py-[13px] text-emphasis shadow-brutal-sm"
          >
            {t('auth.back_to_login')}
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <button
            type="submit"
            disabled={loading}
            className="btn-brutal-primary w-full py-[13px] text-emphasis shadow-brutal-sm mt-0.5"
          >
            {loading ? t('common.sending') : t('forgot.submit')}
          </button>

          <AuthFooter>
            <AuthLink to="/login">{t('auth.back_to_login')}</AuthLink>
          </AuthFooter>
        </form>
      )}
    </AuthLayout>
  );
}
