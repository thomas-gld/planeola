import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import AuthLayout, { AuthError, AuthLink, AuthNote, AuthFooter } from '../components/AuthLayout';
import { passwordChecks } from '../lib/password';
import PasswordInput from '../components/PasswordInput';
import PasswordRequirements from '../components/PasswordRequirements';

export default function ResetPassword() {
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
      setError(err.response?.data?.detail || 'Reset error.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout title="Invalid link">
        <div className="space-y-[18px]">
          <AuthError>This reset link is incomplete. Request a new one.</AuthError>
          <Link
            to="/forgot-password"
            className="btn-brutal-primary w-full py-[13px] text-emphasis shadow-brutal-sm"
          >
            Request a new link
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title="Password updated">
        <div className="space-y-[18px]">
          <AuthNote>Your password has been changed. Redirecting you to the login page…</AuthNote>
          <Link
            to="/login"
            className="btn-brutal-primary w-full py-[13px] text-emphasis shadow-brutal-sm"
          >
            Sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="New password">
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-label font-bold uppercase tracking-caps-lg text-ink/50">
            New password
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
            Confirm password
          </span>
          <PasswordInput
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            placeholder="Re-enter your password"
          />
        </label>

        <PasswordRequirements checks={checks} />

        <AuthError>{error}</AuthError>

        <button
          type="submit"
          disabled={loading || !checks.every((c) => c.ok)}
          className="btn-brutal-primary w-full py-[13px] text-emphasis shadow-brutal-sm mt-0.5"
        >
          {loading ? 'Saving…' : 'Set my new password'}
        </button>

        <AuthFooter>
          <AuthLink to="/login">Back to login</AuthLink>
          <AuthLink to="/forgot-password">Request a new link</AuthLink>
        </AuthFooter>
      </form>
    </AuthLayout>
  );
}
