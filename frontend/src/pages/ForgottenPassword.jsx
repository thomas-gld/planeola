import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import AuthLayout, { AuthLink, AuthNote, AuthFooter } from '../components/AuthLayout';

export default function ForgottenPassword() {
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
    <AuthLayout title={submitted ? 'Check your inbox' : 'Forgot password'}>
      {submitted ? (
        <div className="space-y-[18px]">
          <AuthNote>
            If that email has an account, a link to choose a new password has been sent. It expires
            in 30 minutes.
          </AuthNote>
          <Link
            to="/login"
            className="btn-brutal-primary w-full py-[13px] text-emphasis shadow-brutal-sm"
          >
            Back to login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-label font-bold uppercase tracking-caps-lg text-ink/50">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-brutal-hairline"
              placeholder="you@example.com"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="btn-brutal-primary w-full py-[13px] text-emphasis shadow-brutal-sm mt-0.5"
          >
            {loading ? 'Sending…' : 'Send'}
          </button>

          <AuthFooter>
            <AuthLink to="/login">Back to login</AuthLink>
          </AuthFooter>
        </form>
      )}
    </AuthLayout>
  );
}
