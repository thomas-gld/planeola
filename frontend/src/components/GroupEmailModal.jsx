import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail } from 'lucide-react';
import api from '../lib/api';
import useFeedback from '../hooks/useFeedback';
import { getCategoryColor } from '../lib/categories';
import RichTextEditor from './RichTextEditor';

function GroupCheckbox({ checked, mixed, onChange, label }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current.indeterminate = mixed;
  }, [mixed]);
  return (
    <input ref={ref} type="checkbox" checked={checked} onChange={onChange} aria-label={label} />
  );
}

const fullName = (m) => `${m.first_name} ${m.last_name}`;

export default function GroupEmailModal({ members, categories, onClose }) {
  const { t } = useTranslation();
  const { notify, confirm } = useFeedback();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [excluded, setExcluded] = useState(() => new Set());
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .post('/mailing/preview', { subject, message })
        .then((res) => !cancelled && setPreview(res.data))
        .catch(() => !cancelled && setPreview(null))
        .finally(() => !cancelled && setLoading(false));
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [subject, message]);

  const recipients = members.filter((m) => m.email?.trim());
  const skipped = members.filter((m) => !m.email?.trim());
  const selected = recipients.filter((m) => !excluded.has(m.id));
  const canSend = subject.trim() && message && selected.length > 0 && !sending;

  // group by primary category, in the organization's order
  const primary = (m) => m.categories?.[0] || '';
  const names = [
    ...categories.map((c) => c.name),
    ...new Set(recipients.map(primary).filter((n) => !categories.some((c) => c.name === n))),
  ];
  const groups = names
    .map((name) => ({
      name,
      list: recipients
        .filter((m) => primary(m) === name)
        .sort((a, b) => a.last_name.localeCompare(b.last_name)),
    }))
    .filter((g) => g.list.length > 0);

  const setIncluded = (ids, included) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (included ? next.delete(id) : next.add(id)));
      return next;
    });

  const handleSend = async () => {
    const ok = await confirm(t('group_email.confirm', { count: selected.length }), {
      confirmLabel: t('group_email.send'),
    });
    if (!ok) return;
    setSending(true);
    try {
      const res = await api.post('/mailing/send', {
        subject,
        message,
        member_ids: selected.map((m) => m.id),
      });
      const { sent, failed } = res.data;
      if (failed) notify(t('group_email.partly_sent', { count: sent, failed }), 'warning');
      else notify(t('group_email.sent', { count: sent }));
      onClose();
    } catch (err) {
      notify(err.response?.data?.detail || t('group_email.send_failed'), 'error');
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4">
      <div className="w-full max-w-5xl border-2 border-ink rounded-brutal-lg bg-surface shadow-brutal-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="px-[22px] py-4 border-b-2 border-ink bg-primary-tint flex items-center gap-3">
          <Mail size={19} className="shrink-0 text-primary" />
          <h3 className="text-title font-bold tracking-snugger">{t('group_email.title')}</h3>
        </div>

        <div className="grid md:grid-cols-5 gap-5 px-[22px] py-4 overflow-y-auto">
          <div className="md:col-span-3 flex flex-col gap-3.5 min-w-0">
            <label className="flex flex-col gap-1.5">
              <span className="label-brutal">{t('group_email.subject')}</span>
              <input
                type="text"
                value={subject}
                maxLength={200}
                onChange={(e) => setSubject(e.target.value)}
                className="input-brutal-text"
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="label-brutal">{t('group_email.message')}</span>
              <RichTextEditor
                onChange={setMessage}
                empty={!message}
                placeholder={t('group_email.message_placeholder')}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="label-brutal">
                {t('group_email.preview')}
                {loading && (
                  <span className="ml-2 normal-case tracking-normal font-normal text-ink/40">
                    {t('group_email.refreshing')}
                  </span>
                )}
              </span>
              {preview ? (
                <iframe
                  title={t('group_email.preview')}
                  srcDoc={preview.html}
                  sandbox=""
                  className={`w-full h-[420px] border-2 border-ink rounded-brutal bg-surface transition-opacity ${
                    loading ? 'opacity-60' : ''
                  }`}
                />
              ) : (
                <div className="w-full h-[420px] border-2 border-ink rounded-brutal flex items-center justify-center text-row text-ink/40">
                  {t('common.loading')}
                </div>
              )}
            </div>
          </div>

          <div className="md:col-span-2 flex flex-col gap-1.5 min-w-0">
            <span className="label-brutal">
              {t('group_email.recipients', { selected: selected.length, total: recipients.length })}
            </span>
            <div className="flex-1 min-h-[240px] max-h-[640px] overflow-y-auto scroll-thin border-2 border-ink rounded-brutal bg-well p-2">
              {recipients.length > 0 ? (
                <div className="flex gap-3 px-1.5 pb-2 mb-1 border-b border-ink/10 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setExcluded(new Set())}
                    className="underline text-ink/60 hover:text-ink"
                  >
                    {t('group_email.select_all')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setExcluded(new Set(recipients.map((m) => m.id)))}
                    className="underline text-ink/60 hover:text-ink"
                  >
                    {t('group_email.select_none')}
                  </button>
                </div>
              ) : (
                <p className="px-1.5 py-1 text-row italic text-ink/50">
                  {t('group_email.no_recipients')}
                </p>
              )}
              {groups.map(({ name, list }) => {
                const ticked = list.filter((m) => !excluded.has(m.id)).length;
                const color = getCategoryColor(categories, name);
                return (
                  <div key={name} className="mt-2">
                    <label
                      className="flex items-center gap-2 px-1.5 py-1 rounded-brutal-sm cursor-pointer hover:bg-muted text-row font-bold"
                      style={{ color: color || undefined }}
                    >
                      <GroupCheckbox
                        checked={ticked === list.length}
                        mixed={ticked > 0 && ticked < list.length}
                        onChange={() =>
                          setIncluded(
                            list.map((m) => m.id),
                            ticked < list.length,
                          )
                        }
                        label={name}
                      />
                      {name} · {ticked}/{list.length}
                    </label>
                    <ul className="ml-5">
                      {list.map((m) => (
                        <li key={m.id}>
                          <label className="flex items-start gap-2 px-1.5 py-1 rounded-brutal-sm cursor-pointer hover:bg-muted">
                            <input
                              type="checkbox"
                              checked={!excluded.has(m.id)}
                              onChange={() => setIncluded([m.id], excluded.has(m.id))}
                              className="mt-1"
                            />
                            <span className="min-w-0">
                              <span className="block text-row font-semibold">{fullName(m)}</span>
                              <span className="block truncate font-mono text-xs text-ink/50">
                                {m.email}
                              </span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              {skipped.length > 0 && (
                <>
                  <p className="mt-3 pt-2 px-1.5 border-t border-ink/10 font-mono text-label font-bold uppercase tracking-caps-lg text-ink/50">
                    {t('group_email.skipped', { count: skipped.length })}
                  </p>
                  <ul className="px-1.5 text-row text-ink/40">
                    {skipped.map((m) => (
                      <li key={m.id} className="py-0.5">
                        {fullName(m)}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-ink/12 px-[22px] py-3.5 flex gap-2.5 justify-end">
          <button
            onClick={onClose}
            disabled={sending}
            className="text-center border-2 border-ink/30 rounded-brutal bg-surface px-5 py-2.5 text-row font-bold"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="btn-brutal-primary px-5 py-2.5 text-row disabled:opacity-50"
          >
            {sending
              ? t('common.sending')
              : t('group_email.send_count', { count: selected.length })}
          </button>
        </div>
      </div>
    </div>
  );
}
