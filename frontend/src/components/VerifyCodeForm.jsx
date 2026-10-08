import { useState } from 'react';
import api from '../lib/api';
import { AuthError, AuthNote, AuthFooter } from './AuthLayout';

export default function VerifyCodeForm({ email, onVerified, onBack }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-email', { email, code: code.trim() });
      await onVerified(res.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Invalid code.');
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    setResent(false);
    try {
      await api.post('/auth/resend-code', { email });
      setResent(true);
      setCode('');
    } catch (err) {
      console.error(err);
      setError('Could not send a new code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm leading-[1.55] text-ink/60">
        Code sent to <span className="font-bold text-ink break-all">{email}</span>.
      </p>

      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-label font-bold uppercase tracking-caps-lg text-ink/50">
          Confirmation code
        </span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          required
          className="input-brutal-hairline text-center text-2xl font-bold tracking-[0.5em]"
          placeholder="000000"
        />
      </label>

      {resent && <AuthNote>New code sent.</AuthNote>}
      <AuthError>{error}</AuthError>

      <button
        type="submit"
        disabled={loading || code.length !== 6}
        className="btn-brutal-primary w-full py-[13px] text-emphasis shadow-brutal-sm"
      >
        {loading ? 'Confirming…' : 'Confirm'}
      </button>

      <AuthFooter>
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="text-row font-semibold text-primary hover:text-primary-deep transition disabled:opacity-50"
        >
          {resending ? 'Sending…' : 'Send a new code'}
        </button>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="text-row font-semibold text-ink/50 hover:text-ink transition"
          >
            Use a different email
          </button>
        )}
      </AuthFooter>
    </form>
  );
}
