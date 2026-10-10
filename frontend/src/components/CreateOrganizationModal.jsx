import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import { DEFAULT_CATEGORIES } from '../lib/categories';
import { DEFAULT_TIME_SLOTS } from '../lib/timeSlots';
import OrgSettingsForm from './OrgSettingsForm';

// Translation keys for default names.
const CATEGORY_KEYS = ['lead', 'member', 'intern', 'community_service'];

// The settings are applied with the new organization's own token.
export default function CreateOrganizationModal({ onClose, onCreated }) {
  const { t } = useTranslation();
  const [orgName, setOrgName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const formRef = useRef(null);
  const [initial] = useState(() => ({
    categories: JSON.stringify(
      DEFAULT_CATEGORIES.map((c, i) => ({ ...c, name: t(`orgs.defaults.${CATEGORY_KEYS[i]}`) })),
    ),
    time_slots: JSON.stringify(
      DEFAULT_TIME_SLOTS.map((s) => ({ ...s, label: t(`orgs.defaults.${s.key}`) })),
    ),
  }));

  const handleCreate = async (e) => {
    e.preventDefault();
    const name = orgName.trim();
    if (!name) {
      setError(t('orgs.name_required'));
      return;
    }
    const settings = formRef.current.getValues();
    if (!settings) return;

    setCreating(true);
    setError('');
    try {
      const created = await api.post('/auth/create-organization', { org_name: name });
      const token = created.data.access_token;
      await api.post(
        '/options',
        { org_name: name, ...settings.payload },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      onCreated(token);
    } catch (err) {
      setError(err.response?.data?.detail || t('orgs.create_failed'));
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/50 p-4 overflow-y-auto">
      <div className="card-brutal shadow-brutal-xl w-full max-w-2xl my-8">
        <form onSubmit={handleCreate}>
          <div className="p-6 border-b-2 border-ink">
            <h2 className="font-sans font-bold text-2xl tracking-snugger">{t('orgs.create')}</h2>
          </div>

          <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto bg-bg">
            <div className="card-brutal p-6">
              <label className="label-brutal">
                {t('orgs.name')} <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                autoFocus
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder={t('orgs.name_placeholder')}
                className="input-brutal"
              />
            </div>

            <OrgSettingsForm ref={formRef} initial={initial} />

            {error && (
              <div className="border-2 border-ink bg-danger/10 px-4 py-3 text-sm font-semibold text-center">
                {error}
              </div>
            )}
          </div>

          <div className="p-6 border-t-2 border-ink flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="btn-brutal-white flex-1 py-3"
            >
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={creating} className="btn-brutal-primary flex-1 py-3">
              {creating ? t('common.creating') : t('orgs.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
