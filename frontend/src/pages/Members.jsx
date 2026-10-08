import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCopy, Plus, Users, ChevronRight, X } from 'lucide-react';
import api from '../lib/api';
import useFeedback from '../hooks/useFeedback';
import {
  DEFAULT_CATEGORIES,
  parseCategories,
  getCategoryColor,
  hexToRgba,
} from '../lib/categories';
import Signature from '../components/Signature';
import PageHeader from '../components/PageHeader';
import StatusPill from '../components/StatusPill';
import OrgSwitcher from '../components/OrgSwitcher';

const ACCOUNT_STATES = {
  accepted: { label: 'Active', tone: 'success', title: 'Active account' },
  pending: { label: 'Invited', tone: 'primary', title: 'Resend the invitation' },
  none: { label: 'Invite', tone: 'neutral', title: 'Send an invitation' },
};

function AccountPill({ member, onClick, onCancel }) {
  const state = ACCOUNT_STATES[member.invite_status] || ACCOUNT_STATES.none;
  const clickable = member.invite_status !== 'accepted';

  return (
    <span className="inline-flex items-center gap-1.5">
      <StatusPill
        tone={state.tone}
        title={state.title}
        onClick={clickable ? onClick : undefined}
        className={clickable ? 'cursor-pointer' : ''}
      >
        {state.label}
      </StatusPill>
      {member.invite_status === 'pending' && (
        <button
          type="button"
          onClick={onCancel}
          title="Cancel the invitation"
          aria-label={`Cancel the invitation for ${member.first_name} ${member.last_name}`}
          className="text-ink/30 hover:text-danger transition"
        >
          <X size={13} />
        </button>
      )}
    </span>
  );
}

// Edited locally, saved once on blur.
function NotesField({ value, onSave }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onSave(draft)}
      onClick={(e) => e.stopPropagation()}
      placeholder="Add a note…"
      rows={draft?.split('\n').length || 1}
      className="w-full resize-none border border-transparent rounded-brutal bg-transparent px-2.5 py-1.5
        text-row text-ink/75 placeholder:italic placeholder:text-ink/35 outline-none transition
        hover:border-dashed hover:border-ink/25
        focus:border-2 focus:border-ink focus:bg-surface focus:px-[8px] focus:py-[5px]"
    />
  );
}

// Same as NotesField, on one line.
function BlurInput({ value, onSave }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onSave(draft)}
      className="input-brutal-text py-1"
    />
  );
}

export default function Members() {
  const navigate = useNavigate();
  const { notify, confirm } = useFeedback();
  const [members, setMembers] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);

  useEffect(() => {
    Promise.all([api.get('/members'), api.get('/options')]).then(([membersRes, optionsRes]) => {
      setCategories(parseCategories(optionsRes.data?.categories));
      setMembers(membersRes.data || []);
    });
  }, []);

  const catColorOf = (memberCategories) =>
    getCategoryColor(categories, memberCategories?.[0] || '');
  const categoryTextStyle = (memberCategories) => {
    const color = catColorOf(memberCategories);
    return color ? { color, fontWeight: 600 } : {};
  };

  const orderIndex = (category) => {
    const i = categories.findIndex((c) => c.name === category);
    return i === -1 ? categories.length : i;
  };

  const active = members.filter((member) => !member.resigned);
  const resignedMembers = members.filter((member) => member.resigned);

  // "YYYY-MM-DD", most recent first, none last.
  const sortByDepartureDate = (a, b) =>
    (b.departure_date || '').localeCompare(a.departure_date || '');

  const resignedByCategory = categories.map((cat) => ({
    cat,
    list: resignedMembers
      .filter((member) => (member.categories?.[0] || '') === cat.name)
      .sort(sortByDepartureDate),
  }));

  const categoryCounts = Object.fromEntries(
    categories.map((cat) => [
      cat.name,
      active.filter((member) => (member.categories?.[0] || '') === cat.name).length,
    ]),
  );

  const formatPhone = (phone) => {
    const cleaned = ('' + phone).replace(/\D/g, '');
    return cleaned.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
  };

  // Optimistic, rolled back if the save fails.
  const handleUpdate = (id, changes, failure = 'Could not save the change.') => {
    const current = members.find((member) => member.id === id) || {};
    const updated = { ...current, ...changes };

    setMembers((prev) => prev.map((member) => (member.id === id ? updated : member)));

    api.put(`/members/${id}`, updated).catch(() => {
      setMembers((prev) => prev.map((member) => (member.id === id ? current : member)));
      notify(failure, 'error');
    });
  };

  const errorOf = (err) => err.response?.data?.detail || err.message;

  const invitationResult = (data, sentText) =>
    data.email_sent
      ? notify(`${sentText} ${data.email}.`)
      : notify(`The email could not be sent to ${data.email}.`, 'warning');

  const sorted = [...active].sort(
    (a, b) =>
      orderIndex(a.categories?.[0] || '') - orderIndex(b.categories?.[0] || '') ||
      (a.last_name || '').localeCompare(b.last_name || ''),
  );

  const copyEmail = (email) => {
    navigator.clipboard.writeText(email).catch(() => {});
  };

  const refreshMembers = () => api.get('/members').then((r) => setMembers(r.data));

  const handleCancelInvitation = async (member) => {
    const ok = await confirm(
      `Cancel the pending invitation for ${member.first_name} ${member.last_name}?`,
      { confirmLabel: 'Cancel invitation', danger: true },
    );
    if (!ok) return;
    api
      .delete(`/members/${member.id}/invitation`)
      .then(refreshMembers)
      .catch((err) => notify(errorOf(err), 'error'));
  };

  const handleAccountClick = async (member) => {
    if (member.invite_status === 'pending') {
      if (
        !(await confirm(`Send the invitation to ${member.email} again?`, {
          confirmLabel: 'Resend',
        }))
      )
        return;
      api
        .post(`/members/${member.id}/invitation/resend`)
        .then((res) => invitationResult(res.data, 'Invitation sent again to'))
        .catch((err) => notify(errorOf(err), 'error'));
      return;
    }

    if (!member.email) {
      notify('This member has no email address.', 'warning');
      return;
    }
    const ok = await confirm(
      `Invite ${member.first_name} ${member.last_name}? An email will be sent to ${member.email}.`,
      { confirmLabel: 'Invite' },
    );
    if (!ok) return;
    api
      .post(`/members/${member.id}/create-account`)
      .then((res) => {
        if (res.data.status === 'linked') notify('Linked to your own account.');
        else invitationResult(res.data, 'Invitation sent to');
        refreshMembers();
      })
      .catch((err) => notify(errorOf(err), 'error'));
  };

  const handleDelete = async (member) => {
    const ok = await confirm(
      `Permanently delete ${member.first_name} ${member.last_name}? This cannot be undone.`,
      { confirmLabel: 'Delete', danger: true },
    );
    if (!ok) return;
    api
      .delete(`/members/${member.id}`)
      .then(() => setMembers((prev) => prev.filter((p) => p.id !== member.id)))
      .catch((err) => notify(errorOf(err), 'error'));
  };

  return (
    <div className="flex-1 flex flex-col">
      <PageHeader
        title="Members"
        subtitle={`${active.length} active · ${resignedMembers.length} resigned`}
      >
        <OrgSwitcher />
        <button
          onClick={() => navigate('/members/new')}
          className="inline-flex items-center gap-2 border-2 border-ink rounded-brutal-sm bg-secondary-tint shadow-brutal-xs px-3.5 py-2 text-row font-bold text-secondary-deep"
        >
          <Plus size={14} />
          Add member
        </button>
      </PageHeader>

      <main className="flex-1 flex flex-col bg-surface">
        <div className="flex items-center gap-3 px-7 py-[13px] border-b-2 border-ink bg-secondary-tint text-secondary">
          <Users size={19} />
          <span className="font-bold text-title tracking-snugger text-ink">Active members</span>
          <span className="font-mono text-meta font-bold uppercase tracking-widest">
            {active.length}
          </span>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-[190px] border-b-2 border-ink bg-surface px-7 py-[11px] font-sans text-row font-bold tracking-snug text-left whitespace-nowrap">
                Name
              </th>
              <th className="w-24 border-b-2 border-ink border-l border-ink/10 bg-surface px-7 py-[11px] font-sans text-row font-bold tracking-snug text-center whitespace-nowrap">
                Account
              </th>
              <th className="border-b-2 border-ink border-l border-ink/10 bg-surface px-7 py-[11px] font-sans text-row font-bold tracking-snug text-left">
                Availability notes
              </th>
              <th className="w-[190px] border-b-2 border-ink border-l border-ink/10 bg-surface px-7 py-[11px] font-sans text-row font-bold tracking-snug text-left">
                Contact
              </th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              let lastCategory = null;
              return sorted.flatMap((member) => {
                const currentCategory = member.categories?.[0] || 'Other';
                const catColor = catColorOf(member.categories);
                const rows = [];

                if (currentCategory !== lastCategory) {
                  lastCategory = currentCategory;
                  rows.push(
                    <tr key={`category-${currentCategory}`}>
                      <td
                        colSpan={4}
                        className="border-t border-b border-ink/10 px-7 py-[7px] font-sans text-row font-bold tracking-snug"
                        style={{
                          color: catColor || undefined,
                          backgroundColor: catColor ? hexToRgba(catColor, 0.09) : undefined,
                        }}
                      >
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: catColor || 'rgb(var(--color-ink) / 0.4)' }}
                          />
                          {currentCategory} · {categoryCounts[currentCategory] ?? 0}
                        </span>
                      </td>
                    </tr>,
                  );
                }

                rows.push(
                  <tr
                    key={member.id}
                    onClick={() => navigate(`/members/${member.id}`)}
                    className="cursor-pointer border-t border-ink/10 transition hover:bg-muted"
                  >
                    <td
                      className="px-7 py-[11px] font-semibold text-row"
                      style={categoryTextStyle(member.categories)}
                    >
                      {member.first_name} <span className="uppercase">{member.last_name}</span>
                    </td>

                    <td className="border-l border-ink/10 px-3.5 py-[11px] text-center">
                      <AccountPill
                        member={member}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAccountClick(member);
                        }}
                        onCancel={(e) => {
                          e.stopPropagation();
                          handleCancelInvitation(member);
                        }}
                      />
                    </td>

                    <td className="border-l border-ink/10 px-3.5 py-1.5">
                      <NotesField
                        value={member.availability_notes || ''}
                        onSave={(notes) =>
                          handleUpdate(
                            member.id,
                            { availability_notes: notes },
                            'Could not save the note.',
                          )
                        }
                      />
                    </td>
                    <td
                      className="border-l border-ink/10 px-7 py-[11px] whitespace-nowrap font-mono text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2">
                        {member.email}
                        <button
                          onClick={() => copyEmail(member.email)}
                          className="text-ink/40 hover:text-ink align-middle"
                        >
                          <ClipboardCopy size={13} />
                        </button>
                      </div>
                      <div className="text-ink/50">{formatPhone(member.phone)}</div>
                    </td>
                  </tr>,
                );
                return rows;
              });
            })()}
          </tbody>
        </table>

        {resignedMembers.length > 0 && (
          <details className="group mt-auto border-t-2 border-ink bg-well">
            <summary className="flex items-center gap-2.5 px-7 py-[15px] cursor-pointer list-none">
              <ChevronRight
                size={16}
                className="text-ink/45 transition-transform group-open:rotate-90"
              />
              <span className="font-bold text-emphasis tracking-snug">
                Resigned / Inactive ({resignedMembers.length})
              </span>
            </summary>
            <div className="border-t border-ink/10 p-6 space-y-8 bg-bg">
              {resignedByCategory.map(({ cat, list }) => {
                if (list.length === 0) return null;

                return (
                  <div key={cat.name}>
                    <h3
                      className="font-mono text-xs font-bold uppercase tracking-widest mb-3"
                      style={{ color: cat.color }}
                    >
                      {cat.name}
                    </h3>
                    <div className="table-frame">
                      <table className="table-brutal min-w-full">
                        <thead>
                          <tr>
                            <th>Departure date</th>
                            <th>First name</th>
                            <th>Last name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Observations</th>
                            <th className="text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {list.map((member) => (
                            <tr key={member.id} className="hover:bg-muted transition">
                              <td>
                                <input
                                  type="date"
                                  value={member.departure_date || ''}
                                  onChange={(e) =>
                                    handleUpdate(member.id, { departure_date: e.target.value })
                                  }
                                  className="input-brutal-text w-40 py-1"
                                />
                              </td>
                              <td
                                className="font-semibold"
                                style={categoryTextStyle(member.categories)}
                              >
                                {member.first_name}
                              </td>
                              <td
                                className="font-semibold"
                                style={categoryTextStyle(member.categories)}
                              >
                                {member.last_name}
                              </td>
                              <td className="font-mono text-xs whitespace-nowrap">
                                {member.email}
                                <button
                                  onClick={() => copyEmail(member.email)}
                                  className="text-ink/40 hover:text-ink ml-2 align-middle"
                                >
                                  <ClipboardCopy size={14} />
                                </button>
                              </td>
                              <td className="font-mono text-xs whitespace-nowrap">
                                {formatPhone(member.phone)}
                              </td>
                              <td>
                                <BlurInput
                                  value={member.observations || ''}
                                  onSave={(observations) =>
                                    handleUpdate(member.id, { observations })
                                  }
                                />
                              </td>
                              <td>
                                <div className="flex gap-2 justify-center">
                                  <button
                                    className="btn-brutal-success px-3 py-1.5 text-xs"
                                    onClick={() =>
                                      handleUpdate(
                                        member.id,
                                        { resigned: false, departure_date: '' },
                                        'Could not reinstate the member.',
                                      )
                                    }
                                  >
                                    Reinstate
                                  </button>
                                  <button
                                    className="btn-brutal-danger px-3 py-1.5 text-xs"
                                    onClick={() => handleDelete(member)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        )}

        <p
          className={`text-center font-mono text-meta text-ink/40 bg-well py-[14px] ${resignedMembers.length > 0 ? 'border-t border-ink/10' : 'mt-auto border-t-2 border-ink'}`}
        >
          <Signature />
        </p>
      </main>
    </div>
  );
}
