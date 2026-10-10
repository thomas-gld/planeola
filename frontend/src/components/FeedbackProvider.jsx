import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleCheck, CircleX, TriangleAlert, X } from 'lucide-react';
import { FeedbackContext } from '../contexts/feedback';

const TONES = {
  success: { Icon: CircleCheck, className: 'text-success' },
  error: { Icon: CircleX, className: 'text-danger' },
  warning: { Icon: TriangleAlert, className: 'text-warning' },
};

export default function FeedbackProvider({ children }) {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const nextId = useRef(0);

  const dismiss = useCallback(
    (id) => setToasts((list) => list.filter((toast) => toast.id !== id)),
    [],
  );

  const notify = useCallback(
    (message, tone = 'success') => {
      const id = ++nextId.current;
      setToasts((list) => [...list, { id, message, tone }]);
      setTimeout(() => dismiss(id), tone === 'success' ? 3500 : 6000);
    },
    [dismiss],
  );

  const confirm = useCallback(
    (message, { confirmLabel, danger = false } = {}) =>
      new Promise((resolve) => setDialog({ message, confirmLabel, danger, resolve })),
    [],
  );

  const close = (answer) => {
    dialog.resolve(answer);
    setDialog(null);
  };

  const value = useMemo(() => ({ notify, confirm }), [notify, confirm]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <div className="fixed z-[60] right-4 bottom-28 sm:bottom-6 flex flex-col gap-2.5 w-[calc(100%-2rem)] max-w-sm no-print">
        {toasts.map(({ id, message, tone }) => {
          const { Icon, className } = TONES[tone];
          return (
            <div
              key={id}
              role="status"
              className="flex items-start gap-3 border-2 border-ink rounded-brutal bg-surface shadow-brutal px-4 py-3"
            >
              <Icon size={18} className={`shrink-0 mt-px ${className}`} />
              <p className="flex-1 text-row font-semibold whitespace-pre-line">{message}</p>
              <button
                onClick={() => dismiss(id)}
                aria-label={t('common.dismiss')}
                className="shrink-0 text-ink/40 hover:text-ink transition"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>

      {dialog && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/45 p-4"
          onClick={() => close(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-sm border-2 border-ink rounded-brutal-lg bg-surface shadow-brutal-xl p-5 flex flex-col gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-emphasis font-semibold whitespace-pre-line">{dialog.message}</p>
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => close(false)}
                className="border-2 border-ink/30 rounded-brutal bg-surface px-4 py-2 text-row font-bold hover:bg-muted transition"
              >
                {t('common.cancel')}
              </button>
              <button
                autoFocus
                onClick={() => close(true)}
                className={`${dialog.danger ? 'btn-brutal-danger' : 'btn-brutal-primary'} px-4 py-2 text-row`}
              >
                {dialog.confirmLabel || t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}
