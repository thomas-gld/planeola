import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { User as UserIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import useFeedback from '../hooks/useFeedback';
import Loading from '../components/Loading';
import OrgSwitcher from '../components/OrgSwitcher';
import StatusPill from '../components/StatusPill';
import { passwordChecks } from '../lib/password';
import PasswordInput from '../components/PasswordInput';
import PasswordRequirements from '../components/PasswordRequirements';

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

function PasswordField({ label, value, onChange, autoComplete = 'new-password' }) {
  return (
    <label className="flex flex-col gap-1.5 w-full max-w-[360px]">
      <span className="font-mono text-label font-bold uppercase tracking-caps-lg text-ink/50">
        {label}
      </span>
      <PasswordInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-brutal-hairline"
        autoComplete={autoComplete}
        required
      />
    </label>
  );
}

export default function MyProfile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [member, setMember] = useState(null);
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const { notify } = useFeedback();

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get('/members');
        const currentMember = response.data.find((m) => m.user_id === user?.id);

        if (currentMember) {
          setMember(currentMember);
          setFirstName(currentMember.first_name || '');
          setLastName(currentMember.last_name || '');
          setPhone(currentMember.phone || '');
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    api
      .get('/options')
      .then((res) => setOrgName((res.data?.org_name || '').trim()))
      .catch(() => {});
  }, [user]);

  const handleSaveInfo = async () => {
    if (!member) return;

    setSaving(true);

    try {
      await api.put(`/members/${member.id}`, {
        ...member,
        first_name: firstName,
        last_name: lastName,
        phone,
      });
      setMember((prev) => ({ ...prev, first_name: firstName, last_name: lastName, phone }));
      notify(t('profile.saved'));
    } catch (error) {
      console.error(error);
      notify(error.response?.data?.detail || t('profile.save_failed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const passwordChecksList = passwordChecks(newPassword, confirmPassword, member?.email);
  const passwordOk = passwordChecksList.every((c) => c.ok);

  const handleChangePassword = async (e) => {
    e.preventDefault();

    setChangingPassword(true);

    try {
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      notify(t('profile.password_changed'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    } catch (error) {
      console.error(error);
      notify(error.response?.data?.detail || t('profile.password_failed'), 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return <Loading />;
  }

  if (!member) {
    return (
      <div className="flex items-center justify-center p-4 py-24">
        <div className="border-2 border-ink rounded-brutal-lg bg-accent shadow-brutal p-6 text-center max-w-md">
          <p className="font-bold mb-4">{t('profile.no_member')}</p>
          <button onClick={() => navigate('/')} className="btn-brutal-primary px-4 py-2">
            {t('profile.back_home')}
          </button>
        </div>
      </div>
    );
  }

  const initials = `${member.first_name?.[0] || ''}${member.last_name?.[0] || ''}`.toUpperCase();
  const category = member.categories?.[0] || '';

  return (
    <div className="flex-1 flex flex-col">
      <div className="no-print flex items-center gap-3 border-b-2 border-ink bg-surface px-5 sm:px-7 py-4">
        <span className="w-[34px] h-[34px] sm:w-10 sm:h-10 shrink-0 rounded-full border-2 border-ink bg-primary-tint text-primary flex items-center justify-center font-mono text-row sm:text-sm font-bold">
          {initials}
        </span>
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <h1 className="font-sans font-bold text-emphasis sm:text-xl tracking-snug truncate">
            {member.first_name} {member.last_name}
          </h1>
          <span className="font-mono text-label uppercase tracking-widest text-ink/50 truncate">
            {[category, orgName].filter(Boolean).join(' · ')}
          </span>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <OrgSwitcher />
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap border-b-2 border-ink bg-warning-tint px-5 sm:px-7 py-[13px]">
        <UserIcon size={19} className="shrink-0 text-warning" />
        <span className="font-bold text-title tracking-snugger">{t('nav.my_profile')}</span>
      </div>

      <main className="flex-1 bg-surface">
        <Section first title={t('profile.contact')}>
          <div className="flex flex-col gap-3.5 items-start max-w-[620px]">
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-label font-bold uppercase tracking-caps-lg text-ink/50">
                  {t('profile.first_name')}
                </span>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="input-brutal-hairline-text"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-label font-bold uppercase tracking-caps-lg text-ink/50">
                  {t('profile.last_name')}
                </span>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="input-brutal-hairline-text uppercase"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-label font-bold uppercase tracking-caps-lg text-ink/50">
                  {t('profile.phone')}
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input-brutal-hairline"
                />
              </label>
            </div>
            <button
              onClick={handleSaveInfo}
              disabled={saving}
              className="inline-flex items-center gap-2 border-2 border-ink rounded-brutal-sm bg-warning-tint shadow-brutal-xs px-[18px] py-2.5 text-row font-bold text-warning"
            >
              {saving ? t('common.saving') : t('profile.save')}
            </button>
          </div>
        </Section>

        <Section title={t('profile.password')}>
          <div className="max-w-[620px]">
            {!showPasswordForm ? (
              <button
                onClick={() => setShowPasswordForm(true)}
                className="inline-flex items-center gap-2 border border-ink/25 rounded-brutal bg-surface px-4 py-2.5 text-row font-bold hover:bg-warning-tint transition"
              >
                {t('profile.change_password')}
              </button>
            ) : (
              <form onSubmit={handleChangePassword} className="flex flex-col gap-3.5 items-start">
                <PasswordField
                  label={t('profile.current_password')}
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  autoComplete="current-password"
                />
                <PasswordField
                  label={t('profile.new_password')}
                  value={newPassword}
                  onChange={setNewPassword}
                />
                <PasswordField
                  label={t('profile.confirm_new_password')}
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                />
                <PasswordRequirements checks={passwordChecksList} />

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={changingPassword || !passwordOk}
                    className="border-2 border-ink rounded-brutal-sm bg-warning-tint shadow-brutal-xs px-[18px] py-2.5 text-row font-bold text-warning"
                  >
                    {changingPassword ? t('profile.updating') : t('common.confirm')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                    className="bg-transparent px-1 py-2.5 text-row font-semibold text-ink/55 hover:text-ink underline transition"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </Section>
      </main>
    </div>
  );
}
