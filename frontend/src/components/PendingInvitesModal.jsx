import { Mail, X } from 'lucide-react';
import RoleBadge from './RoleBadge';

export default function PendingInvitesModal({ invites, busyId, onAccept, onDecline, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/45 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md max-h-[85vh] flex flex-col border-2 border-ink rounded-brutal-lg bg-surface shadow-brutal-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b-2 border-ink bg-primary-tint">
          <Mail size={18} className="text-primary" />
          <h2 className="flex-1 text-title font-bold tracking-snugger">Pending invitations</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-ink/50 hover:text-ink transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto">
          {invites.length === 0 ? (
            <p className="px-5 py-8 text-center text-row text-ink/55">No pending invitation.</p>
          ) : (
            invites.map((invite) => (
              <div key={invite.id} className="px-5 py-4 border-b border-ink/10 flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <RoleBadge role={invite.role} />
                  <span className="font-bold truncate">{invite.org_name || 'An organization'}</span>
                </div>
                <p className="text-row text-ink/60">
                  Invited by {invite.invited_by_email || 'an admin'}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => onAccept(invite)}
                    disabled={busyId === invite.id}
                    className="btn-brutal-primary px-4 py-2 text-row"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => onDecline(invite)}
                    disabled={busyId === invite.id}
                    className="btn-brutal-white px-4 py-2 text-row"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
