import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import useFeedback from '../hooks/useFeedback';
import dayjs from 'dayjs';
import 'dayjs/locale/en';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronDown, X, Lock, LockOpen } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import PageHeader from '../components/PageHeader';
import OrgSwitcher from '../components/OrgSwitcher';
import SubmissionBanner from '../components/SubmissionBanner';
import { getCategoryColor, hexToRgba } from '../lib/categories';
import { isDayOpen } from '../lib/closedDays';
import { timeSlotLabel, shouldGroupPlanning } from '../lib/timeSlots';
import { DEFAULT_ORG_CONFIG, parseOrgConfig } from '../lib/orgConfig';
import { computeSubmissionDiffs } from '../lib/availabilityDiff';
import { orgToday } from '../lib/timezone';
dayjs.locale('en');

const VIEW_KEY = 'planning_view';

const UNCATEGORIZED = 'uncategorized';

export default function Planning() {
  const { notify, confirm } = useFeedback();
  const [members, setMembers] = useState([]);
  const [config, setConfig] = useState(DEFAULT_ORG_CONFIG);
  const { categories, timeSlots, closedDays, openDays, showPastDays, timezone } = config;
  const today = orgToday(timezone);
  const todayStr = today.format('YYYY-MM-DD');
  const [selectedId, setSelectedId] = useState(null);
  const [allAssignments, setAllAssignments] = useState({});
  const [edits, setEdits] = useState({});
  const [holidays, setHolidays] = useState([]);
  const [togglingDay, setTogglingDay] = useState(null);
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [currentSubmissionIndex, setCurrentSubmissionIndex] = useState(0);
  const [viewPref, setViewPref] = useState(() => localStorage.getItem(VIEW_KEY));

  const [searchParams, setSearchParams] = useSearchParams();
  const monthParam = searchParams.get('month');
  const [currentMonth, setCurrentMonth] = useState(
    monthParam ? dayjs(monthParam) : dayjs().startOf('month'),
  );

  // Past days of the current month start folded unless `show_past_days` is set.
  const [collapsed, setCollapsed] = useState({});
  const isPastInCurrentMonth = (d) =>
    currentMonth.isSame(today, 'month') && d.isBefore(today, 'day');

  useEffect(() => {
    const next = {};
    if (!showPastDays && currentMonth.isSame(today, 'month')) {
      for (let i = 0; i < currentMonth.daysInMonth(); i++) {
        const d = currentMonth.startOf('month').add(i, 'day');
        if (d.isBefore(today, 'day')) next[d.format('YYYY-MM-DD')] = true;
      }
    }
    setCollapsed(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `today` changes with `todayStr`
  }, [currentMonth, showPastDays, todayStr]);

  const toggleRow = (dateStr) => setCollapsed((prev) => ({ ...prev, [dateStr]: !prev[dateStr] }));

  const isDayActive = (day) => isDayOpen(day, { closedDays, holidays, openDays });

  // A toggle can write either a holiday or an open_days entry.
  const refreshCalendarExceptions = async () => {
    const [h, o] = await Promise.all([api.get('/holidays'), api.get('/options')]);
    setHolidays(h.data || []);
    setConfig(parseOrgConfig(o.data));
  };

  const toggleDay = async (dateStr) => {
    if (togglingDay) return;
    setTogglingDay(dateStr);
    try {
      await api.post('/holidays/toggle', { date: dateStr });
      await refreshCalendarExceptions();
    } catch (error) {
      console.error(error);
      notify(
        `Could not change this day.\n${error.response?.data?.detail || error.message}`,
        'error',
      );
    } finally {
      setTogglingDay(null);
    }
  };

  useEffect(() => {
    api.get('/members').then((res) => setMembers(res.data || []));
    api.get('/assignments').then((res) => setAllAssignments(res.data || {}));
    refreshCalendarExceptions();
  }, []);

  // Refetched on a month change, which also lets the backend drop expired dates.
  useEffect(() => {
    api.get('/availability-submissions').then((res) => setAllSubmissions(res.data || []));
  }, [currentMonth]);

  const categoryColor = (category) =>
    getCategoryColor(categories, category || '') || 'rgb(var(--color-ink))';
  const memberColor = (member) => categoryColor(member?.categories?.[0]);
  const ALL_CATEGORIES = categories.map((c) => c.name);
  const getCategory = (member) => member?.categories?.[0] || UNCATEGORIZED;

  const categoryRank = (member) => {
    const i = ALL_CATEGORIES.indexOf(getCategory(member));
    return i === -1 ? ALL_CATEGORIES.length : i;
  };
  const sortedMembers = [...members].sort(
    (a, b) =>
      categoryRank(a) - categoryRank(b) ||
      a.last_name.localeCompare(b.last_name) ||
      a.first_name.localeCompare(b.first_name),
  );

  const gridCols = timeSlots.length * categories.length;
  const compact = viewPref ? viewPref === 'grouped' : shouldGroupPlanning(timeSlots, categories);
  const chooseView = (v) => {
    setViewPref(v);
    localStorage.setItem(VIEW_KEY, v);
  };
  const totalCols = 1 + (compact ? timeSlots.length : gridCols);

  const monthDays = Array.from({ length: currentMonth.daysInMonth() }, (_, i) =>
    currentMonth.startOf('month').add(i, 'day'),
  );

  const inactiveDays = monthDays.filter((d) => !isDayActive(d)).map((d) => d.format('YYYY-MM-DD'));

  // The pending edit, else what the server last returned.
  const idsIn = (draft, dateStr, time_slot, category) =>
    draft?.[dateStr]?.[time_slot]?.[category] ??
    allAssignments?.[dateStr]?.[time_slot]?.[category] ??
    [];

  const withIds = (draft, dateStr, time_slot, category, ids) => ({
    ...draft,
    [dateStr]: {
      ...draft[dateStr],
      [time_slot]: { ...draft[dateStr]?.[time_slot], [category]: ids },
    },
  });

  const toggleSlot = (dateStr, time_slot) => {
    if (!selectedId || inactiveDays.includes(dateStr)) return;
    const id = Number(selectedId);
    const category = getCategory(members.find((member) => member.id === id));
    const current = idsIn(edits, dateStr, time_slot, category);
    const wasAssigned = current.includes(id);
    const next = wasAssigned ? current.filter((i) => i !== id) : [...new Set([...current, id])];

    const updated = withIds(edits, dateStr, time_slot, category, next);
    setEdits(updated);
    autoSaveAssignment(updated, { id, dateStr, time_slot, isAdding: !wasAssigned });
  };

  const removeAssignment = (dateStr, time_slot, id) => {
    const updated = ALL_CATEGORIES.reduce(
      (draft, category) =>
        withIds(
          draft,
          dateStr,
          time_slot,
          category,
          idsIn(draft, dateStr, time_slot, category).filter((i) => i !== id),
        ),
      edits,
    );
    setEdits(updated);
    autoSaveAssignment(updated, { id, dateStr, time_slot, isAdding: false });
  };

  const confirmAndRemove = async (dateStr, time_slot, member) => {
    const slotLabel = timeSlotLabel(timeSlots, time_slot);
    const dateLabel = dayjs(dateStr).format('MMMM D');
    const ok = await confirm(
      `Remove ${member.first_name} ${member.last_name} from the ${slotLabel} of ${dateLabel}?`,
      { confirmLabel: 'Remove', danger: true },
    );
    if (!ok) return;
    removeAssignment(dateStr, time_slot, member.id);
  };

  // Keeps the member's own availability in step with the planning.
  const syncMemberCalendar = async (memberId, dateStr, time_slot, isAdding) => {
    const member = members.find((m) => m.id === memberId);
    if (!member) return;

    let slots = [];
    try {
      slots = JSON.parse(member.availability_calendar || '[]');
    } catch {
      slots = [];
    }

    const matches = (d) => d.date === dateStr && d.time_slot === time_slot;
    if (isAdding) {
      if (!slots.some(matches)) slots.push({ date: dateStr, time_slot });
    } else {
      slots = slots.filter((d) => !matches(d));
    }
    const calendar = JSON.stringify(slots);

    try {
      await api.put(`/members/${memberId}`, { ...member, availability_calendar: calendar });
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, availability_calendar: calendar } : m)),
      );
    } catch (error) {
      console.error(error);
    }
  };

  const autoSaveAssignment = (currentEdits, change) => {
    api
      .post('/assignments', currentEdits)
      .then(() => api.get('/assignments'))
      .then((res) => {
        setAllAssignments(res.data || {});
        setEdits({});
        syncMemberCalendar(change.id, change.dateStr, change.time_slot, change.isAdding);
      })
      .catch((error) => console.error(error));
  };

  const currentSubmission = allSubmissions[currentSubmissionIndex];
  const currentSubmissionDiffs = currentSubmission
    ? computeSubmissionDiffs(currentSubmission, allAssignments, todayStr)
    : [];

  const refreshSubmissions = async () => {
    const res = await api.get('/availability-submissions');
    setAllSubmissions(res.data || []);
    setCurrentSubmissionIndex(0);
  };

  const handleValidateSubmission = async (submissionId) => {
    try {
      await api.put(`/availability-submissions/${submissionId}/validate`);
      await refreshSubmissions();
      await api.get('/assignments').then((res) => setAllAssignments(res.data || {}));
    } catch (error) {
      console.error(error);
      notify('Could not validate the submission.', 'error');
    }
  };

  const handleIgnoreSubmission = async (submissionId) => {
    try {
      await api.delete(`/availability-submissions/${submissionId}`);
      await refreshSubmissions();
    } catch (error) {
      console.error(error);
      notify('Could not ignore the submission.', 'error');
    }
  };

  const isAssigned = (dateStr, time_slot) => {
    if (!selectedId) return false;
    const id = Number(selectedId);
    const category = getCategory(members.find((member) => member.id === id));
    return idsIn(edits, dateStr, time_slot, category).includes(id);
  };

  const membersByIds = (ids) =>
    [...new Set(ids)].map((id) => members.find((m) => m.id === id)).filter(Boolean);

  const getCategoryMembers = (dateStr, time_slot, category) =>
    membersByIds(idsIn(edits, dateStr, time_slot, category)).sort((a, b) =>
      a.last_name.localeCompare(b.last_name),
    );

  const getSlotMembers = (dateStr, time_slot) =>
    categories.flatMap((cat) =>
      getCategoryMembers(dateStr, time_slot, cat.name).map((member) => ({
        member,
        category: cat.name,
      })),
    );

  // `dot`: the grouped layout's header does not name the category.
  const renderAssigned = (member, category, dateStr, time_slot, dot) => (
    <div key={`${category}-${member.id}`} className="flex items-center gap-1">
      {dot && (
        <span
          className="w-1.5 h-1.5 shrink-0 rounded-full"
          style={{ background: categoryColor(category) }}
        />
      )}
      <Link
        to={`/members/${member.id}`}
        className="flex-1 min-w-0 truncate text-meta font-semibold leading-tight hover:underline transition"
        style={{ color: categoryColor(category) }}
      >
        {member.first_name} {member.last_name}
      </Link>
      <button
        type="button"
        title="Remove from this slot"
        aria-label={`Remove ${member.first_name} ${member.last_name} from this slot`}
        className="w-4 h-4 shrink-0 border border-ink/20 rounded-[5px] bg-surface text-ink/35 hover:bg-danger hover:text-surface hover:border-danger flex items-center justify-center transition"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          confirmAndRemove(dateStr, time_slot, member);
        }}
      >
        <X size={10} strokeWidth={3} />
      </button>
    </div>
  );

  const goToMonth = (newMonth) => {
    setCurrentMonth(newMonth);
    setSearchParams({ month: newMonth.format('YYYY-MM') });
  };

  const SLOT_HOURS = 3;
  const openDates = monthDays
    .map((day) => day.format('YYYY-MM-DD'))
    .filter((dateStr) => !inactiveDays.includes(dateStr));

  const categoryHours = Object.fromEntries(categories.map((c) => [c.name, 0]));
  const categoryPeople = Object.fromEntries(categories.map((c) => [c.name, new Set()]));
  openDates.forEach((dateStr) => {
    timeSlots.forEach((slot) => {
      categories.forEach((c) => {
        const assigned = getCategoryMembers(dateStr, slot.key, c.name);
        categoryHours[c.name] += assigned.length * SLOT_HOURS;
        assigned.forEach((member) => categoryPeople[c.name].add(member.id));
      });
    });
  });
  const totalMonthHours = Object.values(categoryHours).reduce((a, b) => a + b, 0);

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col">
        <PageHeader
          title="Planning"
          subtitle={`${currentMonth.format('MMMM YYYY')} · ${totalMonthHours} h assigned`}
        >
          <OrgSwitcher />
          <div className="flex items-center gap-1.5">
            <button
              title="Previous month"
              onClick={() => goToMonth(currentMonth.subtract(1, 'month'))}
              className="w-[34px] h-[34px] border border-ink/20 rounded-brutal-sm bg-surface flex items-center justify-center hover:bg-primary-tint transition"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              title="Next month"
              onClick={() => goToMonth(currentMonth.add(1, 'month'))}
              className="w-[34px] h-[34px] border border-ink/20 rounded-brutal-sm bg-surface flex items-center justify-center hover:bg-primary-tint transition"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </PageHeader>

        <SubmissionBanner
          submission={currentSubmission}
          diffs={currentSubmissionDiffs}
          timeSlots={timeSlots}
          index={currentSubmissionIndex}
          total={allSubmissions.length}
          onPrev={() => setCurrentSubmissionIndex((i) => Math.max(0, i - 1))}
          onNext={() =>
            setCurrentSubmissionIndex((i) => Math.min(allSubmissions.length - 1, i + 1))
          }
          onValidate={() => handleValidateSubmission(currentSubmission.id)}
          onIgnore={() => handleIgnoreSubmission(currentSubmission.id)}
        />

        <div className="border-b-2 border-ink bg-surface px-7 py-3 flex items-center gap-3.5 flex-wrap">
          <span className="text-row font-bold shrink-0">Member to assign</span>
          <div className="relative min-w-[240px]">
            <select
              className="select-brutal rounded-brutal-sm pl-8"
              value={selectedId || ''}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="">— Choose —</option>
              {sortedMembers
                .filter((member) => !member.resigned)
                .map((member) => (
                  <option
                    key={member.id}
                    value={member.id}
                    style={{
                      color: getCategoryColor(categories, member.categories?.[0]) || undefined,
                    }}
                  >
                    {member.last_name} {member.first_name}
                  </option>
                ))}
            </select>
            {selectedId && (
              <span
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                style={{
                  background: memberColor(
                    members.find((member) => member.id === Number(selectedId)),
                  ),
                }}
              />
            )}
            <ChevronDown
              size={15}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink/50"
            />
          </div>

          <div className="inline-flex shrink-0 border border-ink/20 rounded-brutal-sm overflow-hidden">
            {[
              {
                key: 'by-category',
                label: 'By category',
                title: `One column per category (${gridCols} columns)`,
              },
              {
                key: 'grouped',
                label: 'Grouped',
                title: `One column per time slot (${timeSlots.length} columns)`,
              },
            ].map((v) => {
              const active = (v.key === 'grouped') === compact;
              return (
                <button
                  key={v.key}
                  onClick={() => chooseView(v.key)}
                  title={v.title}
                  className={`px-2.5 py-1.5 font-mono text-label font-bold uppercase tracking-caps transition ${
                    active ? 'bg-ink text-surface' : 'bg-surface text-ink/55 hover:text-ink'
                  }`}
                >
                  {v.label}
                </button>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-4 flex-wrap text-row">
            {categories.map((cat) => (
              <span key={cat.name} className="inline-flex items-baseline gap-1.5">
                <span className="font-mono font-bold" style={{ color: cat.color }}>
                  {categoryPeople[cat.name].size}
                </span>
                <span className="text-ink/60">
                  {cat.name} · {categoryHours[cat.name]} h
                </span>
              </span>
            ))}
          </div>
        </div>

        <main className="flex-1 bg-surface overflow-x-auto">
          <table className="w-full border-collapse text-row">
            <thead>
              <tr>
                <th
                  rowSpan={compact ? 1 : 2}
                  className="w-[118px] sticky left-0 z-20 bg-surface px-5 py-2.5 text-left align-middle font-sans text-row font-bold tracking-snug border-b-2 border-ink"
                >
                  Date
                </th>
                {timeSlots.map((slot) => (
                  <th
                    key={`grp-${slot.key}`}
                    colSpan={compact ? 1 : categories.length}
                    className={`px-3 py-2.5 text-center font-sans text-row font-bold border-l border-ink/10 ${
                      compact ? 'min-w-[190px] border-b-2 border-ink' : ''
                    }`}
                    style={{ background: hexToRgba(slot.color, 0.12), color: slot.color }}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: slot.color }} />
                      {slot.label}
                    </span>
                  </th>
                ))}
              </tr>
              {!compact && (
                <tr>
                  {timeSlots.flatMap((slot) =>
                    categories.map((cat) => (
                      <th
                        key={`${slot.key}-${cat.name}`}
                        className="min-w-[104px] bg-well px-2.5 py-[7px] text-left font-mono text-label font-bold uppercase tracking-caps border-b-2 border-ink border-l border-ink/10"
                        style={{ color: cat.color }}
                      >
                        {cat.name}
                      </th>
                    )),
                  )}
                </tr>
              )}
            </thead>
            <tbody>
              {monthDays.map((day, idx) => {
                const dateStr = day.format('YYYY-MM-DD');
                const isInactive = inactiveDays.includes(dateStr);
                const mondayTop = idx > 0 && day.day() === 1;
                const isPast = isPastInCurrentMonth(day);
                const isCollapsed = !!collapsed[dateStr];
                const topBorderClass = mondayTop
                  ? 'border-t-[3px] border-primary/45'
                  : 'border-t border-ink/10';

                if (isCollapsed) {
                  return (
                    <tr key={dateStr}>
                      <td colSpan={totalCols} className={`bg-well px-7 py-[7px] ${topBorderClass}`}>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-meta uppercase tracking-caps-md text-ink/45">
                            {day.format('ddd MM/DD')}
                          </span>
                          <button
                            onClick={() => toggleRow(dateStr)}
                            className="border border-ink/30 rounded-brutal-sm bg-surface px-2.5 py-0.5 font-mono text-label font-bold uppercase tracking-caps text-ink/60"
                          >
                            Show
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={dateStr}
                    className={`${topBorderClass} transition-colors hover:bg-muted/60`}
                  >
                    <td
                      className={`w-[118px] sticky left-0 z-10 px-5 py-[5px] align-top border-r border-ink/10 ${
                        isInactive ? 'bg-closed' : 'bg-surface'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold uppercase tracking-[0.04em]">
                          {day.format('ddd MM/DD')}
                        </span>
                        <span className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => toggleDay(dateStr)}
                            disabled={togglingDay !== null}
                            className="text-ink/30 hover:text-ink transition disabled:opacity-40"
                            title={
                              isInactive
                                ? 'Closed — click to reopen this day'
                                : 'Open — click to close this day'
                            }
                            aria-label={isInactive ? `Reopen ${dateStr}` : `Close ${dateStr}`}
                          >
                            {isInactive ? <Lock size={13} /> : <LockOpen size={13} />}
                          </button>
                          {isPast && (
                            <button
                              onClick={() => toggleRow(dateStr)}
                              className="font-mono text-micro uppercase tracking-caps text-ink/40 hover:text-ink transition"
                              title="Collapse this day"
                            >
                              Hide
                            </button>
                          )}
                        </span>
                      </div>

                      {!isInactive && selectedId && (
                        <div className="flex gap-1 mt-2">
                          {timeSlots.map((slot) => {
                            const active = isAssigned(dateStr, slot.key);
                            return (
                              <button
                                key={slot.key}
                                onClick={() => toggleSlot(dateStr, slot.key)}
                                className="flex-1 text-center border-[1.5px] rounded-[7px] py-[3px] font-mono text-micro font-bold uppercase tracking-caps transition hover:brightness-95"
                                style={{
                                  borderColor: slot.color,
                                  backgroundColor: active ? slot.color : 'transparent',
                                  color: active ? 'rgb(var(--color-surface))' : slot.color,
                                }}
                              >
                                {slot.label}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {isInactive && (
                        <span className="inline-block mt-2 font-mono text-micro font-bold uppercase tracking-caps-md text-ink/40">
                          Closed
                        </span>
                      )}
                    </td>

                    {timeSlots.flatMap((slot) => {
                      const time_slot = slot.key;
                      const cellBg = {
                        backgroundColor: isInactive ? undefined : hexToRgba(slot.color, 0.07),
                      };

                      if (compact) {
                        return (
                          <td
                            key={`${dateStr}-${time_slot}`}
                            className="min-w-[190px] px-2 py-[3px] align-top border-l border-ink/10"
                            style={cellBg}
                          >
                            <div className="flex flex-col gap-[3px]">
                              {getSlotMembers(dateStr, time_slot).map(({ member, category }) =>
                                renderAssigned(member, category, dateStr, time_slot, true),
                              )}
                            </div>
                          </td>
                        );
                      }

                      return categories.map((cat) => (
                        <td
                          key={`${dateStr}-${time_slot}-${cat.name}`}
                          className="min-w-[104px] px-2 py-[3px] align-top border-l border-ink/10"
                          style={cellBg}
                        >
                          <div className="flex flex-col gap-[3px]">
                            {getCategoryMembers(dateStr, time_slot, cat.name).map((member) =>
                              renderAssigned(member, cat.name, dateStr, time_slot, false),
                            )}
                          </div>
                        </td>
                      ));
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </main>
      </div>
    </AppLayout>
  );
}
