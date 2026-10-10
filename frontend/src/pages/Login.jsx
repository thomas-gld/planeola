import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import AuthLayout, { AuthError, AuthLink, AuthFooter } from '../components/AuthLayout';
import VerifyCodeForm from '../components/VerifyCodeForm';
import { applyIdentitySession } from '../lib/session';

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', { email, password });

      if (response.data.status === 'verification_required') {
        setPendingEmail(response.data.email || email);
        return;
      }

      await applyIdentitySession(response.data, { login, navigate });
    } catch (err) {
      console.error(err);
      const errorMessage = err.response?.data?.detail || err.message || t('login.error');
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
    <AuthLayout title={t('login.title')}>
      <form onSubmit={handleLogin} className="space-y-4">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-label font-bold uppercase tracking-caps-lg text-ink/50">
            {t('common.email')}
          </span>
          <input
            type="email"
            autoComplete="email"
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
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-brutal-hairline-text pr-12"
              placeholder={t('login.password_placeholder')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/50 hover:text-ink transition"
              aria-label={showPassword ? t('common.hide_password') : t('common.show_password')}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>

        <AuthError>{error}</AuthError>

        <button
          type="submit"
          disabled={loading}
          className="btn-brutal-primary w-full py-[13px] text-emphasis shadow-brutal-sm mt-0.5"
        >
          {loading ? t('login.submitting') : t('login.submit')}
        </button>

        <AuthFooter>
          <AuthLink to="/forgot-password">{t('login.forgot_password')}</AuthLink>
          <AuthLink to="/register">{t('login.create_account')}</AuthLink>
        </AuthFooter>
      </form>
    </AuthLayout>
  );
}
