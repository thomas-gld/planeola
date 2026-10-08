import React, { useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import api from '../lib/api';
import dayjs from 'dayjs';
import 'dayjs/locale/en';
import Loading from '../components/Loading';
import PageHeader from '../components/PageHeader';
import OrgSwitcher from '../components/OrgSwitcher';
import { useAuth } from '../contexts/AuthContext';
import { getCategoryColor, hexToRgba } from '../lib/categories';
import { isDayOpen } from '../lib/closedDays';
import { shouldGroupPlanning } from '../lib/timeSlots';
import { DEFAULT_ORG_CONFIG, parseOrgConfig } from '../lib/orgConfig';
import { orgToday } from '../lib/timezone';

dayjs.locale('en');

export default function MemberPlanning() {
  const { user } = useAuth();
  const [holidays, setHolidays] = useState([]);
  const [members, setMembers] = useState([]);
  const [config, setConfig] = useState(DEFAULT_ORG_CONFIG);
  const { categories, timeSlots, closedDays, openDays, timezone } = config;
  const todayDay = orgToday(timezone);
  const [allAssignments, setAllAssignments] = useState({});
  const [currentMonth, setCurrentMonth] = useState(dayjs().startOf('month'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [membersRes, assignmentsRes, holidaysRes, optionsRes] = await Promise.all([
          api.get('/members'),
          api.get('/assignments'),
          api.get('/holidays'),
          api.get('/options'),
        ]);

        setMembers(membersRes.data.filter((member) => !member.resigned));
        setAllAssignments(assignmentsRes.data || {});
        setHolidays(holidaysRes.data || []);
        setConfig(parseOrgConfig(optionsRes.data));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const isDayActive = (day) => {
    return isDayOpen(day, { closedDays, holidays, openDays });
  };

  const goToPrevMonth = () => {
    if (!currentMonth.isSame(todayDay, 'month')) {
      setCurrentMonth(currentMonth.subtract(1, 'month'));
    }
  };

  const goToNextMonth = () => {
    setCurrentMonth(currentMonth.add(1, 'month'));
  };

  const monthDays = Array.from({ length: currentMonth.daysInMonth() }, (_, i) =>
    currentMonth.startOf('month').add(i, 'day'),
  );

  const memberColor = (member) =>
    getCategoryColor(categories, member.categories?.[0]) || 'rgb(var(--color-ink))';
  const myMember = members.find((member) => member.user_id === user?.id);
  const isMe = (member) => myMember && member.id === myMember.id;

  const compact = shouldGroupPlanning(timeSlots, categories);
  const totalCols = 1 + (compact ? timeSlots.length : timeSlots.length * categories.length);

  const getCategoryMembers = (dateStr, time_slot, targetCategory) => {
    const ids = allAssignments?.[dateStr]?.[time_slot]?.[targetCategory] || [];
    return ids
      .map((id) => members.find((member) => member.id === id))
      .filter(Boolean)
      .sort((a, b) => a.last_name.localeCompare(b.last_name));
  };

  const getAllForSlot = (dateStr, time_slot) =>
    categories.flatMap((cat) => getCategoryMembers(dateStr, time_slot, cat.name));

  // `dot`: the grouped layout's header does not name the category.
  const renderName = (member, dot) => (
    <span
      key={member.id}
      className={`inline-flex gap-1 ${dot ? 'items-center' : 'items-baseline'}`}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 shrink-0 rounded-full"
          style={{ background: memberColor(member) }}
        />
      )}
      <span
        className="font-semibold"
        style={
          isMe(member)
            ? { color: 'rgb(var(--color-primary))', fontWeight: 700 }
            : { color: memberColor(member) }
        }
      >
        {member.first_name} {member.last_name}
      </span>
      {isMe(member) && <span className="font-mono text-micro uppercase text-primary">you</span>}
    </span>
  );

  if (loading) {
    return <Loading />;
  }

  const today = todayDay.format('YYYY-MM-DD');
  const inCurrentMonth = currentMonth.isSame(todayDay, 'month');

  // Consecutive closed days collapse into one row.
  const mobileBlocks = [];
  monthDays.forEach((day) => {
    const active = isDayActive(day);
    const last = mobileBlocks[mobileBlocks.length - 1];
    if (!active && last?.type === 'closed') {
      last.end = day;
    } else {
      mobileBlocks.push(active ? { type: 'open', day } : { type: 'closed', start: day, end: day });
    }
  });

  return (
    <div className="flex-1 flex flex-col">
      <PageHeader title="Planning" subtitle="Read-only">
        <OrgSwitcher />
      </PageHeader>

      <div className="flex items-center gap-3.5 flex-wrap border-b-2 border-ink bg-primary-tint px-7 py-[13px]">
        <CalendarDays size={19} className="shrink-0 text-primary" />
        <span className="font-bold text-title tracking-snugger">
          {currentMonth.format('MMMM YYYY')}
        </span>
        <span className="inline-flex items-center gap-0.5 border border-ink/20 rounded-brutal bg-surface">
          <button
            onClick={goToPrevMonth}
            disabled={inCurrentMonth}
            className="w-[30px] h-[30px] flex items-center justify-center disabled:opacity-35"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={goToNextMonth}
            className="w-[30px] h-[30px] flex items-center justify-center"
          >
            <ChevronRight size={15} />
          </button>
        </span>
      </div>

      <main className="flex-1 bg-surface overflow-x-auto">
        <table className="hidden sm:table w-full border-collapse text-row">
          <thead>
            <tr>
              <th
                rowSpan={compact ? 1 : 2}
                className="w-[108px] sticky left-0 z-10 bg-surface px-7 py-[11px] text-left align-middle font-sans text-row font-bold tracking-snug border-b-2 border-ink whitespace-nowrap"
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
                      className="min-w-[96px] bg-well px-2.5 py-[7px] text-left font-mono text-label font-bold uppercase tracking-caps border-b-2 border-ink border-l border-ink/10"
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
            {monthDays.map((day) => {
              const dateStr = day.format('YYYY-MM-DD');
              const isPast = dateStr < today;
              const isToday = dateStr === today;
              const isInactive = !isDayActive(day);

              if (isInactive) {
                return (
                  <tr key={dateStr}>
                    <td className="sticky left-0 z-10 px-7 py-2 font-mono text-xs font-bold uppercase tracking-[0.04em] border-t border-ink/10 whitespace-nowrap bg-closed">
                      {day.format('ddd DD')}
                    </td>
                    <td
                      colSpan={totalCols - 1}
                      className="px-3.5 py-2 border-t border-l border-ink/10 bg-closed"
                    >
                      <span className="inline-flex items-center gap-1.5 font-mono text-label font-bold uppercase tracking-wide text-ink/40">
                        <Lock size={11} /> Closed
                      </span>
                    </td>
                  </tr>
                );
              }

              return (
                <tr
                  key={dateStr}
                  style={{
                    opacity: isPast ? 0.4 : 1,
                    background: isToday ? 'rgba(37,99,235,0.05)' : undefined,
                  }}
                >
                  <td
                    className="sticky left-0 z-10 px-7 py-[7px] font-mono text-xs font-bold uppercase tracking-[0.04em] border-t border-ink/10 whitespace-nowrap"
                    style={{
                      background: isToday
                        ? 'rgb(var(--color-primary-tint))'
                        : 'rgb(var(--color-surface))',
                      color: isToday ? 'rgb(var(--color-primary))' : undefined,
                    }}
                  >
                    {day.format('ddd DD')}
                    {isToday && ' · today'}
                  </td>

                  {timeSlots.flatMap((slot) => {
                    if (compact) {
                      return (
                        <td
                          key={slot.key}
                          className="min-w-[190px] px-2.5 py-[5px] align-top border-t border-l border-ink/10"
                        >
                          <div className="flex flex-col gap-0.5">
                            {getAllForSlot(dateStr, slot.key).map((member) =>
                              renderName(member, true),
                            )}
                          </div>
                        </td>
                      );
                    }
                    return categories.map((cat) => (
                      <td
                        key={`${slot.key}-${cat.name}`}
                        className="min-w-[96px] px-2.5 py-[5px] align-top border-t border-l border-ink/10"
                      >
                        <div className="flex flex-col gap-0.5">
                          {getCategoryMembers(dateStr, slot.key, cat.name).map((member) =>
                            renderName(member, false),
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

        <div className="flex sm:hidden flex-col gap-3 p-4">
          {mobileBlocks.map((block, i) => {
            if (block.type === 'closed') {
              const label = block.start.isSame(block.end, 'day')
                ? block.start.format('ddd DD')
                : `${block.start.format('ddd DD')} – ${block.end.format('ddd DD')}`;
              return (
                <div
                  key={i}
                  className="border border-ink/12 rounded-brutal px-3 py-2.5 flex items-center gap-2 bg-closed"
                >
                  <span className="font-mono text-meta font-bold uppercase tracking-wide text-ink/45">
                    {label}
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-label font-bold uppercase tracking-wide text-ink/40">
                    <Lock size={11} /> Closed
                  </span>
                </div>
              );
            }

            const day = block.day;
            const dateStr = day.format('YYYY-MM-DD');
            const isPast = dateStr < today;
            const isToday = dateStr === today;

            return (
              <div
                key={i}
                className={`border-2 border-ink rounded-[14px] shadow-brutal-md bg-surface overflow-hidden ${isPast ? 'opacity-50' : ''}`}
              >
                <div className="px-3 py-2.5 border-b border-ink/10 flex items-center gap-2">
                  <span
                    className={`font-mono text-meta font-bold uppercase tracking-wide ${isToday ? 'text-primary' : ''}`}
                  >
                    {day.format('ddd DD')}
                    {isToday && ' · today'}
                  </span>
                </div>
                <div className="px-3 py-2.5 flex flex-col gap-2.5">
                  {timeSlots.map((slot) => {
                    const people = getAllForSlot(dateStr, slot.key);
                    return (
                      <div key={slot.key}>
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="font-mono text-micro font-bold uppercase tracking-wide"
                            style={{ color: slot.color }}
                          >
                            {slot.label}
                          </span>
                        </div>
                        {people.length === 0 ? (
                          <p className="text-row text-ink/35">—</p>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {people.map((member) => (
                              <span
                                key={member.id}
                                className="inline-flex items-center gap-2 text-row font-semibold"
                              >
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ background: memberColor(member) }}
                                />
                                {member.first_name} {member.last_name}
                                {isMe(member) && (
                                  <span className="font-mono text-micro uppercase text-primary">
                                    you
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
