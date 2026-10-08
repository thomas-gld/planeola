import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import AuthLayout, { AuthError, AuthLink, AuthFooter } from '../components/AuthLayout';
import VerifyCodeForm from '../components/VerifyCodeForm';
import { applyIdentitySession } from '../lib/session';

export default function Login() {
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
      const errorMessage = err.response?.data?.detail || err.message || 'Login error.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (pendingEmail) {
    return (
      <AuthLayout title="Confirm your email">
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
    <AuthLayout title="Sign in">
      <form onSubmit={handleLogin} className="space-y-4">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-label font-bold uppercase tracking-caps-lg text-ink/50">
            Email
          </span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input-brutal-hairline"
            placeholder="you@example.com"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-label font-bold uppercase tracking-caps-lg text-ink/50">
            Password
          </span>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-brutal-hairline-text pr-12"
              placeholder="Enter your password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/50 hover:text-ink transition"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
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
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <AuthFooter>
          <AuthLink to="/forgot-password">Forgot password?</AuthLink>
          <AuthLink to="/register">Create an account</AuthLink>
        </AuthFooter>
      </form>
    </AuthLayout>
  );
}
