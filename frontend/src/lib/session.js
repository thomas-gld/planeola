import api from './api';

// From /auth/login, /auth/register or /auth/verify-email: an access_token, or a
// select_token with the accounts to choose from (the home page shows the choice).
export async function applyIdentitySession(body, { login, navigate }) {
  const { select_token, access_token, accounts } = body;

  if (access_token) {
    login(access_token);
    navigate('/');
    return;
  }

  if (!accounts || accounts.length === 0) {
    throw new Error('No organization is linked to this account.');
  }

  if (accounts.length === 1) {
    const res = await api.post(
      '/auth/switch-account',
      { user_id: accounts[0].user_id },
      { headers: { Authorization: `Bearer ${select_token}` } },
    );
    login(res.data.access_token);
    navigate(accounts[0].role === 'admin' ? '/' : '/member-home');
    return;
  }

  login(select_token);
  navigate('/');
}
