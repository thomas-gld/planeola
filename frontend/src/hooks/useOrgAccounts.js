import { useEffect, useRef, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export default function useOrgAccounts() {
  const { user, login } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [email, setEmail] = useState('');
  const [switching, setSwitching] = useState(false);
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    if (!user) {
      setAccounts([]);
      return;
    }
    api
      .get('/auth/my-accounts')
      .then((res) => {
        if (!active.current) return;
        setAccounts(res.data.accounts || []);
        setCurrentId(res.data.current_user_id ?? null);
        setEmail(res.data.email || '');
      })
      .catch(() => {});
    return () => {
      active.current = false;
    };
  }, [user]);

  const current = accounts.find((a) => a.user_id === currentId);

  const switchTo = async (account) => {
    if (account.user_id === currentId || switching) return;
    setSwitching(true);
    try {
      const res = await api.post('/auth/switch-account', { user_id: account.user_id });
      login(res.data.access_token);
      // Full reload, so every view refetches in the new organization.
      window.location.assign(account.role === 'admin' ? '/' : '/member-home');
    } catch (e) {
      console.error(e);
      setSwitching(false);
    }
  };

  return { accounts, current, currentId, email, switching, switchTo };
}
