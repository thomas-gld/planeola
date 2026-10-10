import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { ChevronLeft, ChevronRight, TriangleAlert } from 'lucide-react';
import { formatSlotList } from '../lib/timeSlots';

// An empty submission means "clear all my slots".
function clearsEverything(submission) {
  try {
    return JSON.parse(submission.dates).length === 0;
  } catch {
    return false;
  }
}

function DiffColumn({ diffs, kind, timeSlots }) {
  const { t } = useTranslation();
  const dates = (d) => (kind === 'add' ? d.toAdd : d.toRemove);
  const slotsOn = (d, dateStr) => (kind === 'add' ? d.groupedToAdd : d.groupedToRemove)[dateStr];
  const accent = kind === 'add' ? 'border-success' : 'border-danger';

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-4">
      {diffs
        .filter((d) => dates(d).length > 0)
        .map((d) => (
          <div key={`${kind}-${d.key}`}>
            <p className="font-mono text-label font-bold uppercase tracking-[0.14em] text-ink/45 mb-2">
              {t(kind === 'add' ? 'submission.to_add' : 'submission.to_remove', {
                month: d.month.format('MMMM YYYY'),
              })}
            </p>
            <div className="flex flex-col gap-[5px]">
              {dates(d).map((dateStr) => (
                <span key={dateStr} className={`block border-l-[3px] ${accent} pl-2.5 text-sm`}>
                  <strong className="font-bold">
                    {dayjs(dateStr).format(t('formats.full_date'))}
                  </strong>
                  <span className="text-ink/55">
                    {' '}
                    — {formatSlotList(timeSlots, slotsOn(d, dateStr))}
                  </span>
                </span>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}

export default function SubmissionBanner({
  submission,
  diffs,
  timeSlots,
  index,
  total,
  onPrev,
  onNext,
  onValidate,
  onIgnore,
}) {
  const { t } = useTranslation();
  if (!submission?.member?.id) return null;
  if (diffs.length === 0 && !clearsEverything(submission)) return null;

  const { first_name, last_name } = submission.member;

  return (
    <div className="border-b-2 border-ink bg-warning-tint">
      <div className="flex items-center gap-3 px-7 py-[13px] flex-wrap">
        <TriangleAlert size={17} className="shrink-0 text-warning" />
        <span className="text-emphasis font-bold">
          {t('submission.title', { name: `${first_name} ${last_name?.toUpperCase()}` })}
        </span>
        {submission.message && (
          <span className="text-row italic text-ink/70">"{submission.message}"</span>
        )}
        {total > 1 && (
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <span className="font-mono text-meta font-bold text-warning">
              {index + 1} / {total}
            </span>
            <button
              onClick={onPrev}
              aria-label={t('submission.previous')}
              disabled={index === 0}
              className="w-[30px] h-[30px] border border-ink/20 rounded-[9px] bg-surface flex items-center justify-center disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={onNext}
              aria-label={t('submission.next')}
              disabled={index === total - 1}
              className="w-[30px] h-[30px] border border-ink/20 rounded-[9px] bg-surface flex items-center justify-center disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-warning/25 bg-surface px-7 py-4 flex flex-col md:flex-row gap-8 items-start">
        {diffs.length === 0 ? (
          <p className="flex-1 text-center font-mono text-xs uppercase tracking-wider text-ink/50 py-2">
            {t('common.no_changes')}
          </p>
        ) : (
          <>
            <DiffColumn diffs={diffs} kind="add" timeSlots={timeSlots} />
            <DiffColumn diffs={diffs} kind="remove" timeSlots={timeSlots} />
          </>
        )}
        <div className="w-full md:w-[200px] shrink-0 flex flex-col gap-2">
          <button
            onClick={onValidate}
            className="text-center border-2 border-ink rounded-brutal-sm bg-success text-surface shadow-brutal-xs px-3 py-2.5 text-sm font-bold"
          >
            {t('submission.validate')}
          </button>
          <button
            onClick={onIgnore}
            className="bg-transparent px-1 py-1 text-row font-semibold text-ink/50 hover:text-ink underline text-left"
          >
            {t('submission.ignore')}
          </button>
        </div>
      </div>
    </div>
  );
}
