// Schedule dates are days of the organization's calendar, so "today" is read in its
// zone, never the browser's. Backend: `org_today` in core/options.py.
import dayjs from 'dayjs';

export const DEFAULT_TIMEZONE = 'Europe/Paris';

export function parseTimezone(value, fallback = DEFAULT_TIMEZONE) {
  if (!value) return fallback;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return value;
  } catch {
    return fallback;
  }
}

// One real zone per standard offset, not "Etc/GMT-1", so summer time still applies.
export const TIMEZONE_CHOICES = [
  { value: 'Etc/GMT+12', label: 'GMT−12', cities: 'Baker Island' },
  { value: 'Pacific/Pago_Pago', label: 'GMT−11', cities: 'Pago Pago, Niue' },
  { value: 'Pacific/Honolulu', label: 'GMT−10', cities: 'Honolulu, Tahiti' },
  { value: 'America/Anchorage', label: 'GMT−9', cities: 'Anchorage, Juneau' },
  { value: 'America/Los_Angeles', label: 'GMT−8', cities: 'Los Angeles, Vancouver, Tijuana' },
  { value: 'America/Denver', label: 'GMT−7', cities: 'Denver, Calgary, Edmonton' },
  { value: 'America/Chicago', label: 'GMT−6', cities: 'Chicago, Houston, Winnipeg' },
  { value: 'America/New_York', label: 'GMT−5', cities: 'New York, Toronto, Montréal' },
  {
    value: 'America/Martinique',
    label: 'GMT−4',
    cities: 'Martinique, Guadeloupe, Caracas, La Paz',
  },
  { value: 'America/St_Johns', label: 'GMT−3:30', cities: "St. John's" },
  { value: 'America/Sao_Paulo', label: 'GMT−3', cities: 'São Paulo, Buenos Aires, Cayenne' },
  { value: 'America/Noronha', label: 'GMT−2', cities: 'Fernando de Noronha' },
  { value: 'Atlantic/Azores', label: 'GMT−1', cities: 'Azores, Cape Verde' },
  { value: 'Europe/London', label: 'GMT', cities: 'London, Dublin, Lisbon' },
  { value: 'Europe/Paris', label: 'GMT+1', cities: 'Paris, Brussels, Berlin, Madrid, Rome' },
  { value: 'Europe/Athens', label: 'GMT+2', cities: 'Athens, Helsinki, Kyiv, Bucharest' },
  { value: 'Europe/Moscow', label: 'GMT+3', cities: 'Moscow, Istanbul, Nairobi, Mayotte' },
  { value: 'Asia/Tehran', label: 'GMT+3:30', cities: 'Tehran' },
  { value: 'Asia/Dubai', label: 'GMT+4', cities: 'Dubai, Réunion, Mauritius' },
  { value: 'Asia/Kabul', label: 'GMT+4:30', cities: 'Kabul' },
  { value: 'Asia/Karachi', label: 'GMT+5', cities: 'Karachi, Tashkent, Maldives' },
  { value: 'Asia/Kolkata', label: 'GMT+5:30', cities: 'Mumbai, Delhi, Colombo' },
  { value: 'Asia/Kathmandu', label: 'GMT+5:45', cities: 'Kathmandu' },
  { value: 'Asia/Dhaka', label: 'GMT+6', cities: 'Dhaka, Bishkek, Thimphu' },
  { value: 'Asia/Yangon', label: 'GMT+6:30', cities: 'Yangon' },
  { value: 'Asia/Bangkok', label: 'GMT+7', cities: 'Bangkok, Jakarta, Hanoi' },
  { value: 'Asia/Singapore', label: 'GMT+8', cities: 'Singapore, Beijing, Perth, Manila' },
  { value: 'Asia/Tokyo', label: 'GMT+9', cities: 'Tokyo, Seoul' },
  { value: 'Australia/Adelaide', label: 'GMT+9:30', cities: 'Adelaide, Darwin' },
  { value: 'Australia/Sydney', label: 'GMT+10', cities: 'Sydney, Melbourne, Canberra' },
  { value: 'Pacific/Noumea', label: 'GMT+11', cities: 'Nouméa, Solomon Islands' },
  { value: 'Pacific/Auckland', label: 'GMT+12', cities: 'Auckland, Wellington' },
  { value: 'Pacific/Tongatapu', label: 'GMT+13', cities: "Nuku'alofa, Apia" },
  { value: 'Pacific/Kiritimati', label: 'GMT+14', cities: 'Kiritimati' },
];

// Plus the organization's own zone when the list lacks it.
export function timezoneChoices(current) {
  if (!current || TIMEZONE_CHOICES.some((c) => c.value === current)) return TIMEZONE_CHOICES;
  return [{ value: current, label: current.replaceAll('_', ' '), cities: '' }, ...TIMEZONE_CHOICES];
}

// "GMT+01:00"
const offsetAt = (timezone, date) =>
  new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset' })
    .formatToParts(date)
    .find((p) => p.type === 'timeZoneName').value;

const toMinutes = (offset) => {
  const m = offset.match(/([+-])(\d{2}):(\d{2})/);
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
};

// The entry with the browser's January and July offsets, else its standard offset.
export function browserTimezone() {
  const own = parseTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const year = new Date().getFullYear();
  const dates = [new Date(Date.UTC(year, 0, 15)), new Date(Date.UTC(year, 6, 15))];
  const offsets = (tz) => dates.map((d) => toMinutes(offsetAt(tz, d)));
  const [ownJan, ownJul] = offsets(own);
  const match =
    TIMEZONE_CHOICES.find((c) => {
      const [jan, jul] = offsets(c.value);
      return jan === ownJan && jul === ownJul;
    }) || TIMEZONE_CHOICES.find((c) => Math.min(...offsets(c.value)) === Math.min(ownJan, ownJul));
  return match ? match.value : DEFAULT_TIMEZONE;
}

export function dateIn(timezone, instant = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// A dayjs at local midnight: the organization's date, plain arithmetic.
export const orgToday = (timezone) => dayjs(dateIn(timezone));
