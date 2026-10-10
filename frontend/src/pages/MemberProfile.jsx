import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, UserMinus, Check, User } from 'lucide-react';
import api from '../lib/api';
import useFeedback from '../hooks/useFeedback';
import {
  DEFAULT_CATEGORIES,
  parseCategories,
  getCategoryColor,
  hexToRgba,
} from '../lib/categories';
import OrgSwitcher from '../components/OrgSwitcher';

function Section({ title, children, first }) {
  return (
    <section
      className={`flex flex-col md:flex-row gap-4 md:gap-10 px-5 sm:px-7 py-6 ${first ? '' : 'border-t border-ink/[0.12]'}`}
    >
      <div className="md:w-[268px] shrink-0">
        <h3 className="font-sans font-bold text-emphasis tracking-snug">{title}</h3>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </section>
  );
}

function Chip({ selected, color, onClick, children }) {
  return (
    <label
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border-2 px-3.5 py-[7px] text-row cursor-pointer transition ${
        selected
          ? 'border-ink font-semibold'
          : 'border-ink/30 bg-surface text-ink/70 hover:border-ink/50'
      }`}
      style={selected ? { background: hexToRgba(color, 0.12), color } : undefined}
    >
      {children}
    </label>
  );
}

function OptionChip({ checked, onChange, disabled = false, title, children }) {
  return (
    <label
      title={title}
      className={`flex items-center gap-3 rounded-brutal border-2 px-[13px] py-2.5 transition ${
        disabled
          ? 'border-ink/15 bg-well text-ink/35 cursor-not-allowed'
          : checked
            ? 'border-ink bg-primary/10 cursor-pointer'
            : 'border-ink/30 hover:bg-muted cursor-pointer'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="sr-only"
      />
      <span
        className={`w-4 h-4 shrink-0 rounded-[5px] border-2 flex items-center justify-center ${
          checked ? 'bg-primary border-primary' : disabled ? 'border-ink/25' : 'border-ink'
        }`}
      >
        {checked && <Check size={11} strokeWidth={3} className="text-surface" />}
      </span>
      <span className="font-bold text-sm">{children}</span>
    </label>
  );
}

export default function MemberProfile() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNewMember = id === 'new';
  const [member, setMember] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    categories: [],
    resigned: false,
    availability_notes: '',
    observations: '',
  });
  const [createAccount, setCreateAccount] = useState(false);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [saving, setSaving] = useState(false);
  const { notify, confirm } = useFeedback();

  useEffect(() => {
    if (id !== 'new') {
      api.get(`/members/${id}`).then((res) => {
        setMember(res.data);
      });
    }
  }, [id]);

  useEffect(() => {
    api
      .get('/options')
      .then((res) => setCategories(parseCategories(res.data?.categories)))
      .catch(() => {});
  }, []);

  // The invitation follows the email: unavailable without a valid one, ticked again once there is.
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((member.email || '').trim());
  const [wasEmailValid, setWasEmailValid] = useState(emailValid);
  if (emailValid !== wasEmailValid) {
    setWasEmailValid(emailValid);
    setCreateAccount(emailValid);
  }

  const handleChange = (field, value) => {
    setMember({ ...member, [field]: value });
  };

  const handleCategory = (value) => {
    setMember({ ...member, categories: [value] });
  };

  const handleSubmit = async () => {
    if (saving) return;
    if (!member.categories?.length) {
      notify(t('member_profile.choose_category'), 'error');
      return;
    }
    setSaving(true);
    const data = { ...member, resigned: member.resigned || false };

    let response;
    try {
      response = isNewMember
        ? await api.post('/members', data)
        : await api.put(`/members/${id}`, data);
    } catch (error) {
      console.error(error);
      notify(error.response?.data?.detail || t('member_profile.save_failed'), 'error');
      setSaving(false);
      return;
    }

    if (isNewMember && createAccount && emailValid) {
      try {
        const invitation = (await api.post(`/members/${response.data.id}/create-account`)).data;
        if (invitation.status === 'linked') notify(t('member_profile.created_linked'));
        else if (invitation.email_sent)
          notify(t('member_profile.created_invited', { email: invitation.email }));
        else
          notify(t('member_profile.created_email_failed', { email: invitation.email }), 'warning');
      } catch (error) {
        console.error(error);
        const detail = error.response?.data?.detail;
        notify(
          `${t('member_profile.created_not_invited')}${detail ? `\n${detail}` : ''}`,
          'warning',
        );
      }
    } else {
      notify(isNewMember ? t('member_profile.created') : t('member_profile.saved'));
    }

    navigate('/members');
  };

  const handleDelete = async () => {
    const ok = await confirm(
      t('members.confirm_delete', { name: `${member.first_name} ${member.last_name}` }),
      { confirmLabel: t('common.delete'), danger: true },
    );
    if (!ok) return;
    try {
      await api.delete(`/members/${id}`);
      notify(t('member_profile.deleted'));
      navigate('/members');
    } catch (error) {
      notify(error.response?.data?.detail || t('member_profile.delete_failed'), 'error');
    }
  };

  const handleResign = async () => {
    const ok = await confirm(
      t('member_profile.confirm_resign', { name: `${member.first_name} ${member.last_name}` }),
      { confirmLabel: t('member_profile.mark_resigned') },
    );
    if (!ok) return;
    try {
      await api.put(`/members/${member.id}`, { ...member, resigned: true });
      notify(t('member_profile.resigned'));
      navigate('/members');
    } catch (error) {
      notify(error.response?.data?.detail || t('member_profile.update_failed'), 'error');
    }
  };

  const memberCategory = member.categories?.[0] || '';
  const categoryColor = getCategoryColor(categories, memberCategory);

  return (
    <div className="flex-1 flex flex-col">
      <div className="no-print flex items-center gap-3 border-b-2 border-ink bg-surface px-5 sm:px-7 py-4">
        <Link
          to="/members"
          title={t('member_profile.back')}
          className="w-[34px] h-8 shrink-0 border border-ink/20 rounded-brutal-sm flex items-center justify-center hover:bg-secondary-tint transition"
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <h1 className="font-sans font-bold text-heading sm:text-2xl tracking-snugger truncate">
            {isNewMember
              ? t('member_profile.new_member')
              : `${member.first_name} ${member.last_name}`.trim() || t('member_profile.edit')}
          </h1>
          <span className="font-mono text-label uppercase tracking-widest text-ink/50 truncate">
            {t('nav.members')} /{' '}
            {isNewMember ? t('member_profile.breadcrumb_new') : member.last_name || '…'}
          </span>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <OrgSwitcher />
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap border-b-2 border-ink bg-secondary-tint px-5 sm:px-7 py-[13px]">
        <User size={19} className="shrink-0 text-secondary" />
        <span className="font-bold text-title tracking-snugger">
          {isNewMember
            ? t('member_profile.create_title')
            : `${member.first_name} ${member.last_name}`.trim().toUpperCase() || t('roles.member')}
        </span>
        {!isNewMember && memberCategory && (
          <span className="inline-flex items-center gap-2 font-mono text-meta font-bold uppercase tracking-caps-md text-ink/55">
            <span
              className="w-[9px] h-[9px] rounded-full"
              style={{ background: categoryColor || 'rgb(var(--color-ink) / 0.4)' }}
            />
            {memberCategory}
          </span>
        )}
      </div>

      <main className="flex-1 bg-surface pb-24">
        <Section first title={t('member_profile.personal')}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-w-[620px]">
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-label font-bold uppercase tracking-caps-lg text-ink/50">
                {t('member_profile.first_name_required')}
              </span>
              <input
                type="text"
                placeholder={t('profile.first_name')}
                value={member.first_name}
                onChange={(e) => handleChange('first_name', e.target.value)}
                className="input-brutal-hairline-text"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-label font-bold uppercase tracking-caps-lg text-ink/50">
                {t('member_profile.last_name_required')}
              </span>
              <input
                type="text"
                placeholder={t('profile.last_name')}
                value={member.last_name}
                onChange={(e) => handleChange('last_name', e.target.value)}
                className="input-brutal-hairline-text uppercase"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-label font-bold uppercase tracking-caps-lg text-ink/50">
                {t('common.email')}
              </span>
              <input
                type="email"
                placeholder={t('member_profile.email_placeholder')}
                value={member.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="input-brutal-hairline"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-label font-bold uppercase tracking-caps-lg text-ink/50">
                {t('profile.phone')}
              </span>
              <input
                type="tel"
                placeholder="06 12 34 56 78"
                value={member.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="input-brutal-hairline"
              />
            </label>
          </div>
        </Section>

        <Section title={t('member_profile.category')}>
          <div className="flex flex-wrap gap-2.5">
            {categories.map((cat) => {
              const s = cat.name;
              const selected = member.categories.includes(s);
              return (
                <Chip
                  key={s}
                  selected={selected}
                  color={cat.color}
                  onClick={() => handleCategory(s)}
                >
                  <input
                    type="radio"
                    name="category"
                    checked={selected}
                    onChange={() => handleCategory(s)}
                    className="sr-only"
                  />
                  <span
                    className="w-[9px] h-[9px] rounded-full"
                    style={{ background: cat.color }}
                  />
                  {s}
                </Chip>
              );
            })}
          </div>
        </Section>

        {isNewMember && (
          <Section title={t('nav.options')}>
            <OptionChip
              checked={createAccount}
              onChange={() => setCreateAccount(!createAccount)}
              disabled={!emailValid}
              title={emailValid ? undefined : t('member_profile.invite_disabled')}
            >
              {t('member_profile.send_invite')}
            </OptionChip>
          </Section>
        )}

        <Section title={t('member_profile.notes')}>
          <div className="flex flex-col gap-3.5 max-w-[620px]">
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-label font-bold uppercase tracking-caps-lg text-ink/50">
                {t('member_profile.availability')}
              </span>
              <textarea
                placeholder={t('member_profile.availability_placeholder')}
                value={member.availability_notes || ''}
                onChange={(e) => handleChange('availability_notes', e.target.value)}
                rows="3"
                className="input-brutal-hairline resize-y"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-label font-bold uppercase tracking-caps-lg text-ink/50">
                {t('members.observations')}
              </span>
              <textarea
                placeholder={t('member_profile.observations_placeholder')}
                value={member.observations || ''}
                onChange={(e) => handleChange('observations', e.target.value)}
                rows="3"
                className="input-brutal-hairline resize-y"
              />
            </label>
          </div>
        </Section>
      </main>

      <div className="no-print sticky bottom-24 sm:bottom-0 bg-surface border-t-2 border-ink px-4 sm:px-7 py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div
          className={`flex-1 flex items-center gap-4 ${isNewMember ? '' : 'basis-full sm:basis-0'}`}
        >
          {!isNewMember && (
            <>
              <button
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 text-danger text-sm font-semibold hover:underline"
              >
                <Trash2 size={15} /> {t('common.delete')}
              </button>
              <button
                onClick={handleResign}
                className="inline-flex items-center gap-1.5 text-ink/65 text-sm font-semibold hover:underline"
              >
                <UserMinus size={15} /> {t('member_profile.mark_resigned')}
              </button>
            </>
          )}
        </div>
        <button
          onClick={() => navigate('/members')}
          className="ml-auto bg-transparent px-1.5 py-2.5 text-row font-semibold text-ink/55 hover:text-ink underline transition"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="inline-flex items-center gap-2 border-2 border-ink rounded-brutal-sm bg-secondary-tint shadow-brutal-xs px-[18px] py-2.5 text-row font-bold disabled:opacity-60 text-secondary-deep"
        >
          <Save size={15} />{' '}
          {saving
            ? t('common.saving')
            : isNewMember
              ? t('member_profile.create')
              : t('profile.save')}
        </button>
      </div>
    </div>
  );
}
