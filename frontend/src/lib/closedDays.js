// 0 = Sunday, as in dayjs.
export const DEFAULT_CLOSED_DAYS = [0, 6];

// Labels are translation keys.
export const WEEKDAYS = [
  { num: 1, label: 'weekdays.monday' },
  { num: 2, label: 'weekdays.tuesday' },
  { num: 3, label: 'weekdays.wednesday' },
  { num: 4, label: 'weekdays.thursday' },
  { num: 5, label: 'weekdays.friday' },
  { num: 6, label: 'weekdays.saturday' },
  { num: 0, label: 'weekdays.sunday' },
];

// "[]" means never closed. Only a missing or invalid value falls back.
export function parseClosedDays(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_CLOSED_DAYS;
  try {
    const arr = JSON.parse(value);
    if (Array.isArray(arr)) {
      return arr.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
    }
  } catch {
    // ignore
  }
  return DEFAULT_CLOSED_DAYS;
}

export function parseOpenDays(value) {
  if (!value) return [];
  try {
    const arr = JSON.parse(value);
    if (Array.isArray(arr)) return arr.filter((d) => typeof d === 'string');
  } catch {
    // ignore
  }
  return [];
}

// open_days > holidays > weekly grid, as in routers/holidays.py.
export function isDayOpen(day, { closedDays, holidays = [], openDays = [] }) {
  const dateStr = day.format('YYYY-MM-DD');
  if (openDays.includes(dateStr)) return true;
  if (holidays.includes(dateStr)) return false;
  return !closedDays.includes(day.day());
}
