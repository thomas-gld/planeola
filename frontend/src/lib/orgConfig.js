import { DEFAULT_CATEGORIES, parseCategories } from './categories';
import { DEFAULT_CLOSED_DAYS, parseClosedDays, parseOpenDays } from './closedDays';
import { DEFAULT_TIME_SLOTS, parseTimeSlots } from './timeSlots';
import { DEFAULT_TIMEZONE, parseTimezone } from './timezone';

export const DEFAULT_ORG_CONFIG = {
  orgName: '',
  categories: DEFAULT_CATEGORIES,
  timeSlots: DEFAULT_TIME_SLOTS,
  closedDays: DEFAULT_CLOSED_DAYS,
  openDays: [],
  showPastDays: false,
  timezone: DEFAULT_TIMEZONE,
};

export function parseOrgConfig(options) {
  return {
    orgName: (options?.org_name || '').trim(),
    categories: parseCategories(options?.categories),
    timeSlots: parseTimeSlots(options?.time_slots),
    closedDays: parseClosedDays(options?.closed_days),
    openDays: parseOpenDays(options?.open_days),
    showPastDays: options?.show_past_days === 'true',
    timezone: parseTimezone(options?.timezone),
  };
}
