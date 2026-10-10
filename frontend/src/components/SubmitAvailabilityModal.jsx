import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { CalendarCheck, Plus, Minus } from 'lucide-react';
import { formatSlotList } from '../lib/timeSlots';

function ChangeGroup({ kind, dates, grouped, timeSlots }) {
  const { t } = useTranslation();
  if (dates.length === 0) return null;
  const adding = kind === 'add';
  const Icon = adding ? Plus : Minus;

  return (
    <div className="flex flex-col gap-2">
      <span
        className={`inline-flex items-center gap-1.5 font-mono text-label font-bold uppercase tracking-widest ${
          adding ? 'text-success' : 'text-danger'
        }`}
      >
        <Icon size={13} /> {adding ? t('submit_modal.adding') : t('submit_modal.removing')}
      </span>
      <div
        className={`flex flex-col gap-1.5 pl-3 border-l-2 ${
          adding ? 'border-success/40' : 'border-danger/40'
        }`}
      >
        {dates.map((dateStr) => (
          <div key={dateStr} className="text-row">
            <span className="font-bold">{dayjs(dateStr).format(t('formats.full_date'))}</span>
            <span className="text-ink/55"> — {formatSlotList(timeSlots, grouped[dateStr])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SubmitAvailabilityModal({
  changes,
  timeSlots,
  message,
  onMessageChange,
  onBack,
  onSubmit,
}) {
  const { t } = useTranslation();
  const nothingToDo = changes.toAdd.length === 0 && changes.toRemove.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4">
      <div className="w-full max-w-[400px] border-2 border-ink rounded-brutal-lg bg-surface shadow-brutal-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-[22px] py-4 border-b-2 border-ink bg-secondary-tint flex items-center gap-3">
          <CalendarCheck size={19} className="shrink-0 text-secondary" />
          <h3 className="text-title font-bold tracking-snugger">{t('submit_modal.title')}</h3>
        </div>

        <div className="px-[22px] py-4 flex flex-col gap-3.5 overflow-y-auto">
          {nothingToDo ? (
            <div className="rounded-brutal bg-well p-4">
              <p className="text-center font-mono text-xs uppercase tracking-wider text-ink/50">
                {t('common.no_changes')}
              </p>
            </div>
          ) : (
            <>
              <ChangeGroup
                kind="add"
                dates={changes.toAdd}
                grouped={changes.groupedToAdd}
                timeSlots={timeSlots}
              />
              <ChangeGroup
                kind="remove"
                dates={changes.toRemove}
                grouped={changes.groupedToRemove}
                timeSlots={timeSlots}
              />
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-label font-bold uppercase tracking-caps-lg text-ink/50">
              {t('submit_modal.message')}
            </label>
            <textarea
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              className="input-brutal-text resize-none"
              rows={2}
            />
          </div>
        </div>

        <div className="border-t border-ink/12 px-[22px] py-3.5 flex gap-2.5">
          <button
            onClick={onBack}
            className="flex-1 text-center border-2 border-ink/30 rounded-brutal bg-surface py-2.5 text-row font-bold"
          >
            {t('common.back')}
          </button>
          <button onClick={onSubmit} className="btn-brutal-primary flex-1 py-2.5 text-row">
            {t('common.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
