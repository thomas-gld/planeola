import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Star, Plus, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import CreateOrganizationModal from './CreateOrganizationModal';
import Loading from './Loading';
import RoleBadge from './RoleBadge';
import CountBadge from './CountBadge';
import PendingInvitesModal from './PendingInvitesModal';
import usePendingInvites from '../hooks/usePendingInvites';
import { groupByRole } from '../lib/accounts';

export default function OrganizationsList() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [defaultUserId, setDefaultUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInvites, setShowInvites] = useState(false);
  const { invites, busyId: inviteBusyId, accept, decline } = usePendingInvites();

  useEffect(() => {
    api
      .get('/auth/my-accounts')
      .then((res) => {
        setAccounts(res.data.accounts || []);
        setDefaultUserId(res.data.default_user_id ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const selectOrg = async (account) => {
    if (busyId) return;
    setBusyId(account.user_id);
    try {
      const res = await api.post('/auth/switch-account', { user_id: account.user_id });
      login(res.data.access_token);
      window.location.assign(account.role === 'admin' ? '/' : '/member-home');
    } catch (e) {
      console.error(e);
      setBusyId(null);
    }
  };

  const toggleDefault = async (account, e) => {
    e.stopPropagation();
    const nextDefault = defaultUserId === account.user_id ? null : account.user_id;
    const previous = defaultUserId;
    setDefaultUserId(nextDefault);
    try {
      await api.put('/auth/default-account', { user_id: nextDefault });
    } catch (e) {
      console.error(e);
      setDefaultUserId(previous);
    }
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="space-y-4">
      {accounts.length === 0 ? (
        <p className="text-center text-sm text-ink/60">{t('orgs.none')}</p>
      ) : (
        groupByRole(accounts).map((group) => (
          <div key={group.role} className="space-y-3">
            <h2 className="font-mono text-label font-bold uppercase tracking-caps-md text-ink/45">
              {group.label}
            </h2>
            {group.accounts.map((a) => (
              <button
                key={a.user_id}
                onClick={() => selectOrg(a)}
                disabled={busyId === a.user_id}
                className="w-full flex items-center gap-3 px-4 py-3 border-2 border-ink rounded-brutal bg-surface shadow-brutal-sm transition-all
                hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal-md
                active:translate-x-0 active:translate-y-0 active:shadow-none
                disabled:opacity-50 disabled:pointer-events-none text-left"
              >
                <span
                  onClick={(e) => toggleDefault(a, e)}
                  title={defaultUserId === a.user_id ? t('orgs.is_default') : t('orgs.set_default')}
                  className="shrink-0 text-accent hover:scale-110 transition"
                >
                  <Star
                    size={20}
                    strokeWidth={2.5}
                    fill={defaultUserId === a.user_id ? 'currentColor' : 'none'}
                  />
                </span>
                <span className="min-w-0 flex-1 font-bold truncate">
                  {a.name || t('orgs.fallback_name', { id: a.account_id })}
                </span>
                <RoleBadge role={a.role} />
              </button>
            ))}
          </div>
        ))
      )}

      <button
        onClick={() => setShowCreateModal(true)}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-ink/40 rounded-brutal
          font-mono text-sm font-bold uppercase tracking-wide text-ink/60
          hover:border-ink hover:text-ink hover:bg-muted transition"
      >
        <Plus size={16} />
        {t('orgs.create')}
      </button>

      <button
        onClick={() => setShowInvites(true)}
        className="relative w-full flex items-center justify-center gap-2 py-3 border-2 border-ink rounded-brutal bg-primary-tint
          font-mono text-sm font-bold uppercase tracking-wide text-primary
          hover:bg-primary/15 transition"
      >
        <Mail size={16} />
        {t('invites.title')}
        <CountBadge count={invites.length} />
      </button>

      {showInvites && (
        <PendingInvitesModal
          invites={invites}
          busyId={inviteBusyId}
          onAccept={accept}
          onDecline={decline}
          onClose={() => setShowInvites(false)}
        />
      )}

      {showCreateModal && (
        <CreateOrganizationModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(token) => {
            login(token);
            window.location.assign('/');
          }}
        />
      )}
    </div>
  );
}
