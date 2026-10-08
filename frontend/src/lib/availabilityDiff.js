import dayjs from 'dayjs';

// Date first, so the month is a prefix.
const slotKey = (date, timeSlot) => `${date}|${timeSlot}`;

const categoryOf = (member) => member?.categories?.[0] || 'member';

// Dates before `today` (the organization's) are history: never requested nor removed.
function assignedSlots(allAssignments, memberId, category, today) {
  const keys = new Set();
  Object.entries(allAssignments).forEach(([date, slots]) => {
    if (date < today) return;
    Object.entries(slots).forEach(([time_slot, byCategory]) => {
      if ((byCategory[category] || []).includes(memberId)) keys.add(slotKey(date, time_slot));
    });
  });
  return keys;
}

function requestedSlots(slots, today) {
  return new Set(slots.filter((s) => s.date >= today).map((s) => slotKey(s.date, s.time_slot)));
}

// toAdd/toRemove: sorted dates. grouped*: { date: [time_slot] }.
function diffSlots(requested, existing) {
  const byDate = (keys) => {
    const grouped = {};
    keys.forEach((key) => {
      const [date, time_slot] = key.split('|');
      (grouped[date] ||= []).push(time_slot);
    });
    return grouped;
  };

  const groupedToAdd = byDate([...requested].filter((key) => !existing.has(key)));
  const groupedToRemove = byDate([...existing].filter((key) => !requested.has(key)));
  return {
    toAdd: Object.keys(groupedToAdd).sort(),
    toRemove: Object.keys(groupedToRemove).sort(),
    groupedToAdd,
    groupedToRemove,
  };
}

export function computeCalendarDiff(selectedSlots, member, allAssignments, today) {
  if (!member) return { toAdd: [], toRemove: [], groupedToAdd: {}, groupedToRemove: {} };
  return diffSlots(
    requestedSlots(selectedSlots, today),
    assignedSlots(allAssignments, member.id, categoryOf(member), today),
  );
}

// Per month, only those that change.
export function computeSubmissionDiffs(submission, allAssignments, today) {
  const member = submission?.member;
  if (!member?.id) return [];

  let submitted;
  try {
    submitted = JSON.parse(submission.dates) || [];
  } catch {
    return [];
  }

  const requested = requestedSlots(submitted, today);
  const existing = assignedSlots(allAssignments, member.id, categoryOf(member), today);

  const monthOf = (key) => key.slice(0, 7);
  const inMonth = (keys, month) => new Set([...keys].filter((key) => monthOf(key) === month));
  const months = [...new Set([...requested, ...existing].map(monthOf))].sort();

  return months
    .map((key) => ({
      key,
      month: dayjs(`${key}-01`),
      ...diffSlots(inMonth(requested, key), inMonth(existing, key)),
    }))
    .filter((d) => d.toAdd.length > 0 || d.toRemove.length > 0);
}

// Time slots, not days: three slots on one day count three.
export const slotCount = (grouped) =>
  Object.values(grouped).reduce((total, slots) => total + slots.length, 0);

export function summarizeDiffs(monthDiffs) {
  return monthDiffs.reduce(
    (acc, d) => ({
      toAdd: acc.toAdd + slotCount(d.groupedToAdd),
      toRemove: acc.toRemove + slotCount(d.groupedToRemove),
    }),
    { toAdd: 0, toRemove: 0 },
  );
}
