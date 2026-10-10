import i18n from '../i18n';

// `key` is what Assignment.time_slot stores, so a label can be renamed freely.
const PALETTE = ['#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#db2777', '#ca8a04'];
const timeSlotColor = (index) => PALETTE[index % PALETTE.length];

export const DEFAULT_TIME_SLOTS = [
  { key: 'morning', label: 'Morning', color: '#2563eb' },
  { key: 'afternoon', label: 'Afternoon', color: '#16a34a' },
];

export function parseTimeSlots(value) {
  if (!value) return DEFAULT_TIME_SLOTS;
  try {
    const arr = JSON.parse(value);
    if (Array.isArray(arr)) {
      const clean = arr
        .filter((c) => c && c.key && c.label)
        .map((c, i) => ({
          key: String(c.key),
          label: String(c.label),
          color: c.color || timeSlotColor(i),
        }));
      if (clean.length > 0) return clean;
    }
  } catch {
    // ignore
  }
  return DEFAULT_TIME_SLOTS;
}

export function slugifyTimeSlot(label) {
  const s = (label || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return s || 'time_slot';
}

export function timeSlotLabel(timeSlots, key) {
  const slot = timeSlots.find((s) => s.key === key);
  return slot ? slot.label : key;
}

// Past 12 columns, plannings show one column per time slot and categories as dots.
export const shouldGroupPlanning = (timeSlots, categories) =>
  timeSlots.length * categories.length > 12;

export function formatSlotList(timeSlots, slotKeys) {
  if (slotKeys.length === timeSlots.length) return i18n.t('common.full_day');
  return [...slotKeys]
    .sort()
    .map((key) => timeSlotLabel(timeSlots, key))
    .join(', ');
}
