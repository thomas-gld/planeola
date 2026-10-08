import { useEffect, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

// Invitations addressed to the person's login email, whichever organization is open.
export default function usePendingInvites() {
  const { user, login } = useAuth();
  const [invites, setInvites] = useState([]);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!user) return;
    api
      .get('/auth/pending-invites')
      .then((res) => setInvites(res.data.invites || []))
      .catch(() => {});
  }, [user]);

  const accept = async (invite) => {
    setBusyId(invite.id);
    try {
      const res = await api.post(`/auth/invites/${invite.id}/accept`);
      login(res.data.access_token);
      window.location.assign(invite.role === 'admin' ? '/' : '/member-home');
    } catch (e) {
      console.error(e);
      setBusyId(null);
    }
  };

  const decline = async (invite) => {
    setBusyId(invite.id);
    try {
      await api.post(`/auth/invites/${invite.id}/decline`);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
    } catch (e) {
      console.error(e);
    } finally {
      setBusyId(null);
    }
  };

  return { invites: user ? invites : [], busyId, accept, decline };
}
