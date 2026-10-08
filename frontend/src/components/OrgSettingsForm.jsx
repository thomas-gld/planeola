import { forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, X, Plus, Lock, Clock, Users, MapPin, History } from 'lucide-react';
import { parseCategories } from '../lib/categories';
import { WEEKDAYS, parseClosedDays } from '../lib/closedDays';
import { parseTimeSlots, slugifyTimeSlot } from '../lib/timeSlots';
import { DEFAULT_TIMEZONE, browserTimezone, parseTimezone, timezoneChoices } from '../lib/timezone';

const FALLBACK_COLOR = '#6b7280';

const patchAt = (list, index, field, value) =>
  list.map((item, i) => (i === index ? { ...item, [field]: value } : item));

const removeAt = (list, index) => list.filter((_, i) => i !== index);

const swap = (list, index, delta) => {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

// Rows also carry their saved name (`_orig`), to detect a rename.
const persisted = (list) => list.map(({ name, color }) => ({ name, color }));

function SettingsCard({ title, children }) {
  return (
    <div className="card-brutal p-6">
      <h3 className="font-sans font-bold text-emphasis tracking-snug">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

const BAND_TONES = {
  warning: 'bg-warning-tint text-warning',
  danger: 'bg-danger-tint text-danger',
  primary: 'bg-primary-tint text-primary',
  secondary: 'bg-secondary-tint text-secondary',
};

function SettingsBand({ tone, Icon, title, meta, hint, top, children }) {
  return (
    <div>
      <div
        className={`flex items-center gap-3 flex-wrap px-7 py-[13px] border-b-2 border-ink ${BAND_TONES[tone]} ${top ? '' : 'border-t-2 border-ink'}`}
      >
        <Icon size={19} />
        <span className="font-bold text-title tracking-snugger text-ink">{title}</span>
        {meta && (
          <span className="font-mono text-meta font-bold uppercase tracking-widest">{meta}</span>
        )}
        {hint && <span className="ml-auto text-row text-ink/60">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function ReorderableRow({
  banded,
  color,
  name,
  placeholder,
  isFirst,
  isLast,
  onMove,
  onColor,
  onName,
  onRemove,
  trailing,
}) {
  return (
    <div
      className={
        banded
          ? 'flex items-center gap-3 py-2.5 border-b border-ink/8'
          : 'flex items-center gap-2 border border-ink/15 rounded-brutal px-2.5 py-2'
      }
    >
      <div className="flex flex-col shrink-0">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={isFirst}
          title="Move up"
          className="text-ink/40 hover:text-ink disabled:opacity-20 leading-none"
        >
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={isLast}
          title="Move down"
          className="text-ink/40 hover:text-ink disabled:opacity-20 leading-none"
        >
          <ChevronDown size={14} />
        </button>
      </div>
      <input
        type="color"
        value={color}
        onChange={(e) => onColor(e.target.value)}
        title="Color"
        className="w-[26px] h-[26px] rounded-full border-2 border-ink cursor-pointer p-0 bg-surface shrink-0 overflow-hidden"
      />
      <input
        type="text"
        value={name}
        placeholder={placeholder}
        onChange={(e) => onName(e.target.value)}
        className={`min-w-0 border border-transparent rounded-[8px] bg-transparent px-2 py-1
          text-row font-semibold outline-none transition
          hover:border-dashed hover:border-ink/25
          focus:border-2 focus:border-ink focus:bg-surface focus:px-[7px] focus:py-[3px]
          ${banded ? 'w-[260px] shrink-0' : 'flex-1'}`}
      />
      {banded && trailing && (
        <span
          className="w-24 h-1.5 rounded-[3px] overflow-hidden shrink-0"
          style={{ background: `${color}24` }}
        >
          <span className="block h-full" style={{ width: trailing?.share, background: color }} />
        </span>
      )}
      {banded && trailing && (
        <span className="shrink-0 font-mono text-row font-bold">{trailing.count}</span>
      )}
      {!banded && trailing && (
        <span className="shrink-0 font-mono text-label uppercase tracking-wide text-ink/45 whitespace-nowrap">
          {trailing}
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        title="Delete"
        className={`text-ink/35 hover:text-danger transition p-1 shrink-0 ${banded ? 'ml-auto' : ''}`}
      >
        <X size={15} />
      </button>
    </div>
  );
}

// "banded" on the Options page, "card" in the create-organization modal.
const OrgSettingsForm = forwardRef(function OrgSettingsForm(
  { initial = {}, memberCounts, onDirtyChange, variant = 'card', orgName, onOrgNameChange },
  ref,
) {
  const banded = variant === 'banded';
  // A new organization is offered the creator's zone, an existing one has the default.
  const initialTimezone = parseTimezone(
    initial.timezone,
    banded ? DEFAULT_TIMEZONE : browserTimezone(),
  );
  const [timezone, setTimezone] = useState(initialTimezone);
  const [closedDays, setClosedDays] = useState(parseClosedDays(initial.closed_days));
  const [showPastDays, setShowPastDays] = useState(initial.show_past_days === 'true');
  const [timeSlots, setTimeSlots] = useState(parseTimeSlots(initial.time_slots));
  const [categories, setCategories] = useState(
    parseCategories(initial.categories).map((c) => ({ ...c, _orig: c.name })),
  );
  const [error, setError] = useState('');

  const updateCategory = (index, field, value) =>
    setCategories((l) => patchAt(l, index, field, value));
  const addCategory = () => setCategories((l) => [...l, { name: '', color: FALLBACK_COLOR }]);
  const removeCategory = (index) => setCategories((l) => removeAt(l, index));
  const moveCategory = (index, delta) => setCategories((l) => swap(l, index, delta));

  const updateTimeSlot = (index, field, value) =>
    setTimeSlots((l) => patchAt(l, index, field, value));
  const addTimeSlot = () =>
    setTimeSlots((l) => [...l, { key: '', label: '', color: FALLBACK_COLOR }]);
  const removeTimeSlot = (index) => setTimeSlots((l) => removeAt(l, index));
  const moveTimeSlot = (index, delta) => setTimeSlots((l) => swap(l, index, delta));

  const toggleClosedDay = (num) => {
    setClosedDays((prev) => (prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]));
  };

  const sortedDays = (days) => JSON.stringify([...days].sort((a, b) => a - b));
  // Trimmed, so a trailing space does not count as a change.
  const cleanSlots = (list) =>
    list.map((s) => ({ key: s.key, label: (s.label || '').trim(), color: s.color }));
  const cleanNames = (list) => persisted(list).map((c) => ({ ...c, name: c.name.trim() }));
  const isDirty = () =>
    timezone !== initialTimezone ||
    showPastDays !== (initial.show_past_days === 'true') ||
    sortedDays(closedDays) !== sortedDays(parseClosedDays(initial.closed_days)) ||
    JSON.stringify(cleanSlots(timeSlots)) !==
      JSON.stringify(cleanSlots(parseTimeSlots(initial.time_slots))) ||
    JSON.stringify(cleanNames(categories)) !==
      JSON.stringify(cleanNames(parseCategories(initial.categories)));

  useEffect(() => {
    onDirtyChange?.(isDirty());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timezone, closedDays, showPastDays, timeSlots, categories]);

  useImperativeHandle(ref, () => ({
    isDirty,
    // `allowEmptyRows: false` (autosave) reports unnamed rows as `incomplete` instead of dropping them.
    getValues({ allowEmptyRows = true } = {}) {
      if (
        !allowEmptyRows &&
        (categories.some((c) => !c.name.trim()) || timeSlots.some((s) => !(s.label || '').trim()))
      ) {
        return { incomplete: true };
      }

      const cleanCategories = categories
        .map((c) => ({ name: c.name.trim(), color: c.color }))
        .filter((c) => c.name);
      if (cleanCategories.length === 0) {
        setError('At least one category is required.');
        return null;
      }
      const names = cleanCategories.map((c) => c.name.toLowerCase());
      if (new Set(names).size !== names.length) {
        setError('Two categories have the same name.');
        return null;
      }

      // A new slot keys off its label, suffixed on a collision.
      const usedKeys = new Set();
      const cleanTimeSlots = [];
      for (const slot of timeSlots) {
        const label = (slot.label || '').trim();
        if (!label) continue;
        const base = (slot.key || '').trim() || slugifyTimeSlot(label);
        let key = base;
        let n = 2;
        while (usedKeys.has(key)) key = `${base}_${n++}`;
        usedKeys.add(key);
        cleanTimeSlots.push({ key, label, color: slot.color || FALLBACK_COLOR });
      }
      if (cleanTimeSlots.length === 0) {
        setError('At least one time slot is required.');
        return null;
      }

      setError('');
      const renames = categories.filter(
        (c) => c._orig && c._orig.trim() && c.name.trim() && c._orig.trim() !== c.name.trim(),
      );
      return {
        payload: {
          timezone,
          show_past_days: showPastDays ? 'true' : 'false',
          closed_days: JSON.stringify([...closedDays].sort((a, b) => a - b)),
          time_slots: JSON.stringify(cleanTimeSlots),
          categories: JSON.stringify(cleanCategories),
        },
        renames,
        // Only what the save fixed: saved names and new keys. Rows edited since are kept.
        applySaved: () => {
          // Returns `list` itself when nothing changes, so no re-render and no new save.
          const patch = (list, fix) => {
            const next = list.map(fix);
            return next.some((item, i) => item !== list[i]) ? next : list;
          };
          const savedNames = categories.map((c) => c.name.trim());
          setCategories((prev) =>
            patch(prev, (c, i) =>
              savedNames[i] && c._orig !== savedNames[i] ? { ...c, _orig: savedNames[i] } : c,
            ),
          );
          const keyByLabel = new Map(cleanTimeSlots.map((slot) => [slot.label, slot.key]));
          setTimeSlots((prev) =>
            patch(prev, (slot) => {
              const key = keyByLabel.get((slot.label || '').trim());
              return slot.key || !key ? slot : { ...slot, key };
            }),
          );
        },
      };
    },
  }));

  const maxCategoryCount = Math.max(1, ...categories.map((c) => memberCounts?.[c.name] ?? 0));
  const totalMembers = Object.values(memberCounts || {}).reduce((a, b) => a + b, 0);

  const closedDaysToggles = (
    <div className={banded ? 'flex flex-wrap gap-2 px-7 py-5' : 'flex flex-wrap gap-2'}>
      {WEEKDAYS.map(({ num, label }) => {
        const closed = closedDays.includes(num);
        return (
          <button
            key={num}
            type="button"
            onClick={() => toggleClosedDay(num)}
            className={`border-2 border-ink rounded-brutal px-4 py-2 font-mono text-xs font-bold uppercase tracking-wide transition ${
              closed
                ? 'bg-danger/10 text-danger shadow-brutal-sm'
                : 'bg-surface text-ink hover:bg-muted'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  const timezoneSelect = (
    <select
      value={timezone}
      onChange={(e) => setTimezone(e.target.value)}
      className="select-brutal"
    >
      {timezoneChoices(timezone).map(({ value, label, cities }) => (
        <option key={value} value={value}>
          {cities ? `${label} — ${cities}` : label}
        </option>
      ))}
    </select>
  );

  const pastDaysToggle = (
    <div className={banded ? 'flex flex-wrap gap-2 px-7 py-5' : 'flex flex-wrap gap-2'}>
      {[
        { value: true, label: 'Show' },
        { value: false, label: 'Hide' },
      ].map(({ value, label }) => (
        <button
          key={label}
          type="button"
          onClick={() => setShowPastDays(value)}
          className={`border-2 border-ink rounded-brutal px-4 py-2 font-mono text-xs font-bold uppercase tracking-wide transition ${
            showPastDays === value
              ? 'bg-warning/10 text-warning shadow-brutal-sm'
              : 'bg-surface text-ink hover:bg-muted'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const timeSlotRows = (
    <div className={banded ? 'px-7 pt-1.5 pb-4' : 'space-y-2'}>
      <div className={banded ? '' : 'space-y-2'}>
        {timeSlots.map((slot, index) => (
          <ReorderableRow
            key={index}
            banded={banded}
            color={slot.color || FALLBACK_COLOR}
            name={slot.label}
            placeholder="Time slot name"
            isFirst={index === 0}
            isLast={index === timeSlots.length - 1}
            onMove={(d) => moveTimeSlot(index, d)}
            onColor={(v) => updateTimeSlot(index, 'color', v)}
            onName={(v) => updateTimeSlot(index, 'label', v)}
            onRemove={() => removeTimeSlot(index)}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={addTimeSlot}
        className={
          banded
            ? 'inline-flex items-center gap-[7px] bg-transparent pt-2.5 text-row font-semibold text-ink/55 hover:text-ink transition underline'
            : 'btn-brutal-white mt-4 px-4 py-2'
        }
      >
        <Plus size={14} /> Add a time slot
      </button>
    </div>
  );

  const categoryRows = (
    <div className={banded ? 'px-7 pt-1.5 pb-5' : 'space-y-2'}>
      <div className={banded ? '' : 'space-y-2'}>
        {categories.map((cat, index) => (
          <ReorderableRow
            key={index}
            banded={banded}
            color={cat.color}
            name={cat.name}
            placeholder="Category name"
            isFirst={index === 0}
            isLast={index === categories.length - 1}
            onMove={(d) => moveCategory(index, d)}
            onColor={(v) => updateCategory(index, 'color', v)}
            onName={(v) => updateCategory(index, 'name', v)}
            onRemove={() => removeCategory(index)}
            trailing={
              banded
                ? {
                    count: memberCounts ? (memberCounts[cat.name] ?? 0) : 0,
                    share: `${((memberCounts?.[cat.name] ?? 0) / maxCategoryCount) * 100}%`,
                  }
                : memberCounts
                  ? `${memberCounts[cat.name] ?? 0} members`
                  : undefined
            }
          />
        ))}
      </div>
      <button
        type="button"
        onClick={addCategory}
        className={
          banded
            ? 'inline-flex items-center gap-[7px] bg-transparent pt-2.5 text-row font-semibold text-ink/55 hover:text-ink transition underline'
            : 'btn-brutal-white mt-4 px-4 py-2'
        }
      >
        <Plus size={14} /> Add a category
      </button>
    </div>
  );

  if (banded) {
    return (
      <div>
        <SettingsBand top tone="warning" Icon={MapPin} title="Identity">
          <div className="flex gap-7 flex-wrap px-7 py-5">
            <label className="flex-1 min-w-[280px] max-w-[420px] flex flex-col gap-1.5">
              <span className="font-mono text-label font-bold uppercase tracking-caps-lg text-ink/50">
                Organization name
              </span>
              <input
                type="text"
                value={orgName}
                onChange={(e) => onOrgNameChange?.(e.target.value)}
                className="input-brutal-hairline-text"
              />
            </label>
            <label className="flex-1 min-w-[280px] max-w-[420px] flex flex-col gap-1.5">
              <span className="font-mono text-label font-bold uppercase tracking-caps-lg text-ink/50">
                Time zone
              </span>
              {timezoneSelect}
            </label>
          </div>
        </SettingsBand>

        <SettingsBand
          tone="danger"
          Icon={Lock}
          title="Closed days"
          hint="Set your organization's weekly closed days"
        >
          {closedDaysToggles}
        </SettingsBand>

        <SettingsBand
          tone="warning"
          Icon={History}
          title="Past days"
          hint="Show or hide past days for this month on the planning."
        >
          {pastDaysToggle}
        </SettingsBand>

        <SettingsBand
          tone="primary"
          Icon={Clock}
          title="Planning time slots"
          meta={`${timeSlots.length} columns`}
        >
          {timeSlotRows}
        </SettingsBand>

        <SettingsBand
          tone="secondary"
          Icon={Users}
          title="Member categories"
          meta={memberCounts ? `${totalMembers} members` : undefined}
        >
          {categoryRows}
        </SettingsBand>

        {error && <div className="mx-7 my-4 alert-brutal-danger">{error}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SettingsCard title="Time zone">{timezoneSelect}</SettingsCard>

      <SettingsCard title="Closed days">{closedDaysToggles}</SettingsCard>

      <SettingsCard title="Past days">{pastDaysToggle}</SettingsCard>

      <SettingsCard title="Planning time slots">{timeSlotRows}</SettingsCard>

      <SettingsCard title="Member categories">{categoryRows}</SettingsCard>

      {error && <div className="alert-brutal-danger">{error}</div>}
    </div>
  );
});

export default OrgSettingsForm;
