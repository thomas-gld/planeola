import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CalendarDays, CalendarCheck, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import dayjs from 'dayjs';
import { timeSlotLabel } from '../lib/timeSlots';
import { DEFAULT_ORG_CONFIG, parseOrgConfig } from '../lib/orgConfig';
import { dateIn, orgToday } from '../lib/timezone';
import { getCategoryColor } from '../lib/categories';
import Signature from '../components/Signature';
import HomeHeader from '../components/HomeHeader';
import AppLayout from '../components/AppLayout';

export default function MemberHome() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [myAssignments, setMyAssignments] = useState([]);
  const [teammates, setTeammates] = useState([]);
  const [config, setConfig] = useState(DEFAULT_ORG_CONFIG);
  const { orgName, categories, timeSlots, timezone } = config;
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState(null);
  const [pendingSubmission, setPendingSubmission] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Read here, not from state: needed below before a state update would land.
        const [membersRes, optionsRes] = await Promise.all([
          api.get('/members'),
          api.get('/options').catch(() => null),
        ]);
        const orgConfig = optionsRes ? parseOrgConfig(optionsRes.data) : DEFAULT_ORG_CONFIG;
        setConfig(orgConfig);
        const currentMember = membersRes.data.find((m) => m.user_id === user?.id);
        setMember(currentMember || null);

        if (!currentMember) {
          setLoading(false);
          return;
        }

        api
          .get('/my-availability-submission')
          .then((res) => setPendingSubmission(res.data))
          .catch(() => {});

        const allAssignments = (await api.get('/assignments')).data;

        const today = orgToday(orgConfig.timezone).format('YYYY-MM-DD');

        const idsOn = (date, time_slot) => Object.values(allAssignments[date][time_slot]).flat();

        const found = [];
        for (const [date, slots] of Object.entries(allAssignments)) {
          if (date < today) continue;
          for (const time_slot of Object.keys(slots)) {
            const ids = idsOn(date, time_slot);
            if (ids.includes(currentMember.id)) {
              const others = new Set(ids.filter((id) => id !== currentMember.id));
              found.push({ date, time_slot, othersCount: others.size });
            }
          }
        }

        const slotOrder = orgConfig.timeSlots.map((s) => s.key);
        found.sort(
          (a, b) =>
            a.date.localeCompare(b.date) ||
            slotOrder.indexOf(a.time_slot) - slotOrder.indexOf(b.time_slot),
        );
        setMyAssignments(found);

        if (found.length > 0) {
          const membersById = Object.fromEntries(membersRes.data.map((m) => [m.id, m]));
          const next = found[0];
          const teammateIds = new Set(
            idsOn(next.date, next.time_slot).filter((id) => id !== currentMember.id),
          );
          setTeammates([...teammateIds].map((id) => membersById[id]).filter(Boolean));
        }

        setLoading(false);
      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    };

    if (user?.id) {
      fetchData();
    }
  }, [user]);

  const memberColor = (member) =>
    getCategoryColor(categories, member?.categories?.[0] || '') || undefined;

  const sortedTeammates = [...teammates].sort((a, b) => {
    const order = categories.map((c) => c.name);
    const rank = (m) => {
      const i = order.indexOf(m.categories?.[0] || '');
      return i === -1 ? order.length : i;
    };
    return rank(a) - rank(b);
  });

  const nextAssignment = myAssignments[0] || null;
  const upcoming = myAssignments.slice(1, 6);

  let missingMonthLabel = null;
  if (member) {
    try {
      const submitted = JSON.parse(member.availability_calendar || '[]');
      const today = orgToday(timezone);
      const todayStr = today.format('YYYY-MM-DD');
      const coveredMonths = new Set(
        submitted.filter((d) => d.date >= todayStr).map((d) => d.date.slice(0, 7)),
      );
      const monthsToCheck = [today, today.add(1, 'month')];
      const missing = monthsToCheck.find((m) => !coveredMonths.has(m.format('YYYY-MM')));
      if (missing)
        missingMonthLabel = t('member_home.missing_month', { month: missing.format('MMMM') });
    } catch {
      // ignore
    }
  }

  const submissionStatusLabel = pendingSubmission
    ? t('member_home.sent_pending', {
        date: dayjs(dateIn(timezone, new Date(pendingSubmission.created_at))).format(
          t('formats.day_month'),
        ),
      })
    : t('member_home.none_pending');

  return (
    <AppLayout>
      <main className="flex-1 flex flex-col px-5 sm:px-9 py-6 sm:py-8 gap-[18px] sm:gap-[30px]">
        <HomeHeader orgName={loading ? null : orgName} timezone={timezone} />

        {!loading && nextAssignment && (
          <div className="border-2 border-ink rounded-brutal-lg bg-surface shadow-brutal-sm overflow-hidden">
            <div className="px-[18px] py-4 sm:px-6 sm:py-5 bg-warning-tint border-b-2 border-ink">
              <p className="font-mono text-label sm:text-meta font-bold uppercase tracking-[0.16em] mb-1.5 sm:mb-2 text-warning">
                {t('member_home.next_session')}
              </p>
              <p className="font-sans font-bold text-title sm:text-headline tracking-snugger leading-[1.25]">
                {dayjs(nextAssignment.date).format(t('formats.full_date_year'))} —{' '}
                {timeSlotLabel(timeSlots, nextAssignment.time_slot)}
              </p>
            </div>
            {sortedTeammates.length > 0 && (
              <div className="px-[18px] py-3.5 sm:px-6 sm:py-[18px]">
                <p className="font-mono text-label sm:text-meta font-bold uppercase tracking-[0.16em] text-ink/45 mb-2 sm:mb-2.5">
                  {t('member_home.with')}
                </p>
                <div className="flex flex-col sm:grid sm:grid-cols-2 gap-1.5 sm:gap-x-6 sm:gap-y-2">
                  {sortedTeammates.map((mate) => (
                    <span
                      key={mate.id}
                      className="inline-flex items-center gap-2 sm:gap-2.5 text-sm sm:text-emphasis font-semibold"
                    >
                      <span
                        className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0"
                        style={{ background: memberColor(mate) }}
                      />
                      {mate.first_name} {mate.last_name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-5 sm:gap-[26px] items-start">
          <div className="w-full sm:flex-1 sm:min-w-0 border-2 border-ink rounded-brutal-lg bg-surface shadow-brutal-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 sm:px-[22px] py-3.5 border-b-2 border-ink bg-primary-tint text-primary">
              <CalendarDays size={19} />
              <span className="font-bold text-title tracking-snugger text-ink">
                {t('member_home.upcoming')}
              </span>
              <Link
                to="/member-planning"
                className="ml-auto font-mono text-label font-bold uppercase tracking-widest underline"
              >
                {t('home.full_planning')}
              </Link>
            </div>
            <div className="px-5 sm:px-[22px] pb-2 pt-1">
              {upcoming.length === 0 ? (
                <p className="py-4 text-sm text-ink/45">{t('member_home.no_more')}</p>
              ) : (
                upcoming.map((a, i) => (
                  <div
                    key={`${a.date}-${a.time_slot}`}
                    className={`flex items-baseline gap-3.5 py-[13px] ${i < upcoming.length - 1 ? 'border-b border-ink/[0.08]' : ''}`}
                  >
                    <span className="w-[74px] sm:w-[88px] font-mono text-row font-bold shrink-0">
                      {dayjs(a.date).format(t('formats.short_day_month'))}
                    </span>
                    <span className="flex-1 text-emphasis">
                      {dayjs(a.date).format('dddd')} — {timeSlotLabel(timeSlots, a.time_slot)}
                    </span>
                    {a.othersCount > 0 && (
                      <span className="text-row text-ink/50 shrink-0">
                        {t('member_home.with_others', { count: a.othersCount })}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="w-full sm:w-[330px] shrink-0 border-2 border-ink rounded-brutal-lg bg-surface shadow-brutal-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b-2 border-ink bg-secondary-tint text-secondary">
              <CalendarCheck size={19} />
              <span className="font-bold text-title tracking-snugger text-ink">
                {t('nav.my_availability')}
              </span>
            </div>
            <div className="px-5 py-[18px] pb-5">
              <p className="font-mono text-label font-bold uppercase tracking-widest text-ink/45 mb-1">
                {t('member_home.last_submission')}
              </p>
              <p className="text-emphasis font-semibold mb-3.5">{submissionStatusLabel}</p>
              {missingMonthLabel && (
                <p className="text-sm leading-relaxed text-ink/60 mb-4">{missingMonthLabel}</p>
              )}
              <Link
                to="/my-availability"
                className="inline-flex items-center gap-2 border-2 border-ink rounded-brutal-sm bg-secondary text-surface shadow-brutal-xs px-4 py-2.5 text-sm font-bold"
              >
                {t('member_home.update_availability')}
                <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </div>

        <p className="text-center font-mono text-meta text-ink/40 mt-auto pt-2">
          <Signature />
        </p>
      </main>
    </AppLayout>
  );
}
