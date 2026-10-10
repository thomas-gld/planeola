import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Check, Plus, List, Mail } from 'lucide-react';
import useOrgAccounts from '../hooks/useOrgAccounts';
import CreateOrganizationModal from './CreateOrganizationModal';
import { useAuth } from '../contexts/AuthContext';
import { groupByRole } from '../lib/accounts';
import RoleBadge from './RoleBadge';
import CountBadge from './CountBadge';
import PendingInvitesModal from './PendingInvitesModal';
import usePendingInvites from '../hooks/usePendingInvites';

// Hidden until the session has an organization: the home page has its own picker.
// `showEmail`: the login email above the button, on the home pages.
export default function OrgSwitcher({ showEmail = false, inMobileHeader = false }) {
  const { t } = useTranslation();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const { accounts, current, email, switching, switchTo } = useOrgAccounts();
  const [open, setOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInvites, setShowInvites] = useState(false);
  const { invites, busyId: inviteBusyId, accept, decline } = usePendingInvites();
  const ref = useRef(null);

  useEffect(() => {
    const closeOnOutsideClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  if (!user || !user.role || accounts.length === 0) return null;

  return (
    <div
      ref={ref}
      className={`relative z-50 no-print flex-col gap-1.5 ${
        inMobileHeader ? 'flex items-start min-w-0' : 'hidden sm:flex items-end'
      }`}
    >
      {showEmail && email && (
        <span
          title={t('org_switcher.login_email')}
          className="font-mono text-meta text-ink/55 truncate max-w-[220px] sm:max-w-[280px]"
        >
          {email}
        </span>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={switching}
        className={`relative inline-flex items-center gap-2 bg-surface px-3 font-semibold transition disabled:opacity-60 ${
          inMobileHeader
            ? 'h-[38px] max-w-full border-2 border-ink rounded-brutal-sm text-sm'
            : 'py-2 border border-ink/20 rounded-brutal text-row max-w-[160px] sm:max-w-[220px]'
        }`}
        title={t('org_switcher.switch')}
      >
        <span className="truncate">{current?.name || t('org_switcher.organization')}</span>
        <ChevronDown size={14} className="shrink-0 text-ink/45" />
        <CountBadge count={invites.length} />
      </button>

      {open && (
        <div
          className={`absolute ${inMobileHeader ? 'left-0' : 'right-0'} top-full mt-2 w-64 border-2 border-ink rounded-brutal bg-surface shadow-brutal overflow-hidden`}
        >
          <div className="px-3 py-2 font-mono text-xs font-bold uppercase tracking-widest text-ink/50 border-b-2 border-ink">
            {t('orgs.your_orgs')}
          </div>
          {groupByRole(accounts).map((group) => (
            <div key={group.role}>
              <div className="px-3 pt-2.5 pb-1 font-mono text-micro font-bold uppercase tracking-caps-md text-ink/40 bg-well border-b border-ink/10">
                {group.label}
              </div>
              {group.accounts.map((a) => {
                const isCurrent = a.user_id === current?.user_id;
                return (
                  <button
                    key={a.user_id}
                    onClick={() => {
                      switchTo(a);
                      setOpen(false);
                    }}
                    disabled={switching}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left border-b border-ink/10 transition disabled:opacity-60 ${
                      isCurrent ? 'bg-primary/10' : 'hover:bg-muted'
                    }`}
                  >
                    <RoleBadge role={a.role} />
                    <span className="flex-1 min-w-0 font-bold text-sm truncate">
                      {a.name || t('orgs.fallback_name', { id: a.account_id })}
                    </span>
                    {isCurrent && <Check size={16} className="text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          ))}

          <button
            onClick={() => {
              setOpen(false);
              setShowInvites(true);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-left font-mono text-xs font-bold uppercase tracking-wide hover:bg-muted transition border-b border-ink/10"
          >
            <Mail size={14} />
            {t('invites.title')}
            {invites.length > 0 && (
              <span className="ml-auto min-w-[20px] h-5 px-1 rounded-full bg-danger text-surface text-label flex items-center justify-center">
                {invites.length}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setOpen(false);
              navigate('/organizations');
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-left font-mono text-xs font-bold uppercase tracking-wide hover:bg-muted transition"
          >
            <List size={14} />
            {t('org_switcher.see_all')}
          </button>
          <button
            onClick={() => {
              setOpen(false);
              setShowCreateModal(true);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-left font-mono text-xs font-bold uppercase tracking-wide text-primary hover:bg-primary/10 transition border-t border-ink/10"
          >
            <Plus size={14} />
            {t('orgs.create')}
          </button>
        </div>
      )}

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
