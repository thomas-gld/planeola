import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Bold, Italic, Underline } from 'lucide-react';

const SIZES = [
  { value: '12px', label: 'rich_text.size_small' },
  { value: '15px', label: 'rich_text.size_normal' },
  { value: '18px', label: 'rich_text.size_large' },
  { value: '24px', label: 'rich_text.size_huge' },
];

const toolButton =
  'w-8 h-8 inline-flex items-center justify-center border-2 border-ink rounded-brutal-sm bg-surface hover:bg-muted';

export default function RichTextEditor({ onChange, empty, placeholder }) {
  const { t } = useTranslation();
  const editorRef = useRef(null);
  const savedRange = useRef(null);

  const sync = () => {
    const el = editorRef.current;
    onChange(el.textContent.trim() === '' ? '' : el.innerHTML);
  };

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel?.rangeCount && editorRef.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  };

  // restore the selection, then wrap it in a styled span
  const applyStyle = (prop, value) => {
    const el = editorRef.current;
    el.focus();
    const sel = window.getSelection();
    if (savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    if (!sel.rangeCount || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return;

    const span = document.createElement('span');
    span.style[prop] = value;
    try {
      range.surroundContents(span);
    } catch {
      span.appendChild(range.extractContents());
      range.insertNode(span);
    }
    const styled = document.createRange();
    styled.selectNodeContents(span);
    sel.removeAllRanges();
    sel.addRange(styled);
    savedRange.current = styled;
    sync();
  };

  // keep the selection on button press
  const keepFocus = (e) => e.preventDefault();

  return (
    <div className="border-2 border-ink rounded-brutal overflow-hidden bg-surface">
      <div className="flex flex-wrap items-center gap-1.5 border-b-2 border-ink bg-well p-2">
        <button
          type="button"
          title={t('rich_text.bold')}
          aria-label={t('rich_text.bold')}
          onMouseDown={keepFocus}
          onClick={() => applyStyle('fontWeight', 'bold')}
          className={toolButton}
        >
          <Bold size={14} />
        </button>
        <button
          type="button"
          title={t('rich_text.italic')}
          aria-label={t('rich_text.italic')}
          onMouseDown={keepFocus}
          onClick={() => applyStyle('fontStyle', 'italic')}
          className={toolButton}
        >
          <Italic size={14} />
        </button>
        <button
          type="button"
          title={t('rich_text.underline')}
          aria-label={t('rich_text.underline')}
          onMouseDown={keepFocus}
          onClick={() => applyStyle('textDecoration', 'underline')}
          className={toolButton}
        >
          <Underline size={14} />
        </button>
        <select
          title={t('rich_text.size')}
          aria-label={t('rich_text.size')}
          onMouseDown={saveSelection}
          onChange={(e) => {
            if (e.target.value) applyStyle('fontSize', e.target.value);
            e.target.value = '';
          }}
          defaultValue=""
          className="h-8 border-2 border-ink rounded-brutal-sm bg-surface px-1.5 text-xs font-semibold"
        >
          <option value="" disabled>
            {t('rich_text.size')}
          </option>
          {SIZES.map((s) => (
            <option key={s.value} value={s.value}>
              {t(s.label)}
            </option>
          ))}
        </select>
        <label
          title={t('rich_text.color')}
          className="h-8 inline-flex items-center gap-1 border-2 border-ink rounded-brutal-sm bg-surface px-1.5 text-xs font-bold cursor-pointer"
        >
          A
          <input
            type="color"
            aria-label={t('rich_text.color')}
            onMouseDown={saveSelection}
            onChange={(e) => applyStyle('color', e.target.value)}
            className="w-5 h-5 cursor-pointer border-0 bg-transparent p-0"
          />
        </label>
      </div>
      <div className="relative">
        {empty && (
          <span className="absolute top-2.5 left-3 text-row text-ink/35 italic pointer-events-none select-none">
            {placeholder}
          </span>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={placeholder}
          onInput={sync}
          onMouseUp={saveSelection}
          onKeyUp={saveSelection}
          className="min-h-[140px] max-h-64 overflow-y-auto px-3 py-2.5 text-row outline-none"
        />
      </div>
    </div>
  );
}
