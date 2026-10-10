import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import useFeedback from '../hooks/useFeedback';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Signature from '../components/Signature';
import OrganizationsList from '../components/OrganizationsList';
import HomeHeader from '../components/HomeHeader';
import AppLayout from '../components/AppLayout';
import { isDayOpen } from '../lib/closedDays';
import { DEFAULT_ORG_CONFIG, parseOrgConfig } from '../lib/orgConfig';
import { computeSubmissionDiffs, summarizeDiffs } from '../lib/availabilityDiff';
import { orgToday } from '../lib/timezone';
import { Users, CalendarDays, TriangleAlert } from 'lucide-react';

// One month, or the first and last months when the diffs span several.
function monthRangeLabel(monthDiffs) {
  if (monthDiffs.length === 0) return '';
  const first = monthDiffs[0].month;
  const last = monthDiffs[monthDiffs.length - 1].month;
  if (monthDiffs.length === 1) return first.format('MMMM YYYY');
  if (first.year() === last.year()) return `${first.format('MMMM')} – ${last.format('MMMM YYYY')}`;
  return `${first.format('MMMM YYYY')} – ${last.format('MMMM YYYY')}`;
}

const PANEL_TONES = {
  primary: 'bg-primary-tint text-primary',
  secondary: 'bg-secondary-tint text-secondary',
  warning: 'bg-warning-tint text-warning',
};

function Panel({ tone, Icon, title, meta, link, linkTo, children }) {
  return (
    <div className="border-2 border-ink rounded-brutal-lg bg-surface shadow-brutal-sm overflow-hidden">
      <div
        className={`flex items-center gap-3 px-[22px] py-4 border-b-2 border-ink ${PANEL_TONES[tone]}`}
      >
        <Icon size={19} />
        <span className="font-bold text-title tracking-snugger text-ink">{title}</span>
        {meta && (
          <span className="font-mono text-meta font-bold uppercase tracking-widest">{meta}</span>
        )}
        {link && (
          <Link
            to={linkTo}
            className="ml-auto font-mono text-label font-bold uppercase tracking-widest underline"
          >
            {link}
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { notify } = useFeedback();
  // null until fetched: a skeleton shows instead.
  const [orgName, setOrgName] = useState(null);
  const [config, setConfig] = useState(DEFAULT_ORG_CONFIG);
  const { categories, timeSlots, closedDays, openDays, timezone } = config;
  const [holidays, setHolidays] = useState([]);
  const [members, setMembers] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [allAssignments, setAllAssignments] = useState({});

  const isMember = user?.role === 'member';
  // No role: login has not resolved to one organization.
  const isUnresolved = user && !user.role;

  const refreshSubmissions = () =>
    api.get('/availability-submissions').then((res) => setSubmissions(res.data || []));

  useEffect(() => {
    if (isMember || isUnresolved) return;
    api
      .get('/options')
      .then((res) => {
        setOrgName((res.data?.org_name || '').trim());
        setConfig(parseOrgConfig(res.data));
      })
      .catch(() => setOrgName(''));
    api.get('/members').then(
      (res) => setMembers(res.data || []),
      () => {},
    );
    api.get('/assignments').then(
      (res) => setAllAssignments(res.data || {}),
      () => {},
    );
    api.get('/holidays').then(
      (res) => setHolidays(res.data || []),
      () => {},
    );
    refreshSubmissions().catch(() => {});
  }, [isMember, isUnresolved]);

  if (isMember) {
    return <Navigate to="/member-home" replace />;
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (isUnresolved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <div className="card-brutal w-full max-w-md p-6 md:p-8">
          <div className="text-center mb-6">
            <img src="/planeola_rect.png" alt="Planeola" className="w-48 mx-auto mb-6" />
            <h1 className="font-sans font-bold text-2xl tracking-tight">{t('orgs.your_orgs')}</h1>
          </div>

          <OrganizationsList />

          <button
            onClick={handleLogout}
            className="mt-6 w-full text-center font-mono text-xs uppercase tracking-wider text-ink/50 hover:text-ink transition"
          >
            {t('home.logout')}
          </button>
        </div>
      </div>
    );
  }

  const active = members.filter((m) => !m.resigned);
  const today = orgToday(timezone);
  const todayStr = today.format('YYYY-MM-DD');

  const submissionCards = submissions.map((sub) => {
    const monthDiffs = computeSubmissionDiffs(sub, allAssignments, todayStr);
    const { toAdd, toRemove } = summarizeDiffs(monthDiffs);
    return { sub, toAdd, toRemove, when: monthRangeLabel(monthDiffs) };
  });

  const handleValidate = async (id) => {
    try {
      await api.put(`/availability-submissions/${id}/validate`);
      await refreshSubmissions();
      api.get('/assignments').then((res) => setAllAssignments(res.data || {}));
    } catch (error) {
      console.error(error);
      notify(t('home.validate_failed'), 'error');
    }
  };

  const handleDismiss = async (id) => {
    try {
      await api.delete(`/availability-submissions/${id}`);
      await refreshSubmissions();
    } catch (error) {
      console.error(error);
      notify(t('home.ignore_failed'), 'error');
    }
  };

  const categoryCounts = categories.map((c) => ({
    ...c,
    count: active.filter((m) => (m.categories?.[0] || '') === c.name).length,
  }));
  const maxCategoryCount = Math.max(1, ...categoryCounts.map((c) => c.count));

  const nextOpenDays = [];
  for (let i = 0; nextOpenDays.length < 4 && i < 60; i++) {
    const day = today.add(i, 'day');
    if (!isDayOpen(day, { closedDays, holidays, openDays })) continue;
    const dateStr = day.format('YYYY-MM-DD');
    const slotCounts = timeSlots.map((slot) => {
      const perCategory = allAssignments?.[dateStr]?.[slot.key] || {};
      return { ...slot, count: new Set(Object.values(perCategory).flat()).size };
    });
    nextOpenDays.push({ dateStr, day, slotCounts });
  }

  return (
    <AppLayout background="bg-page-admin">
      <main className="flex-1 flex flex-col px-9 pt-[34px] pb-[26px] gap-[30px]">
        <HomeHeader orgName={orgName} timezone={timezone} />

        <div className="flex gap-[26px] items-start">
          <div className="flex-1 min-w-0 flex flex-col gap-[22px]">
            <Panel
              tone="primary"
              Icon={CalendarDays}
              title={t('home.next_open_days')}
              link={t('home.full_planning')}
              linkTo="/planning"
            >
              <div className="px-[22px] pb-4 pt-1.5">
                {nextOpenDays.length === 0 ? (
                  <p className="py-4 text-sm text-ink/45">{t('home.no_open_days')}</p>
                ) : (
                  nextOpenDays.map(({ dateStr, day, slotCounts }, i) => (
                    <div
                      key={dateStr}
                      className={`flex items-baseline gap-4 py-3 ${i < nextOpenDays.length - 1 ? 'border-b border-ink/[0.08]' : ''}`}
                    >
                      <span className="w-[118px] font-mono text-row font-bold shrink-0">
                        {day.format(t('formats.weekday_short_day_month'))}
                      </span>
                      <span className="flex-1 flex gap-[18px] text-sm flex-wrap">
                        {slotCounts.map((slot) => (
                          <span
                            key={slot.key}
                            className={slot.count === 0 ? 'text-ink/45' : undefined}
                          >
                            <span
                              className="font-mono font-bold"
                              style={slot.count > 0 ? { color: slot.color } : undefined}
                            >
                              {slot.count}
                            </span>{' '}
                            {slot.label.toLowerCase()}
                          </span>
                        ))}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </Panel>

            <Panel
              tone="secondary"
              Icon={Users}
              title={t('nav.members')}
              meta={t('home.active', { count: active.length })}
              link={t('home.all_members')}
              linkTo="/members"
            >
              <div className="px-[22px] pb-3.5 pt-1.5">
                {categoryCounts.map((cat, i) => (
                  <div
                    key={cat.name}
                    className={`flex items-center gap-3.5 py-[11px] ${i < categoryCounts.length - 1 ? 'border-b border-ink/[0.08]' : ''}`}
                  >
                    <span
                      className="w-2 h-[26px] rounded-[3px] shrink-0"
                      style={{ background: cat.color }}
                    />
                    <span className="flex-1 text-sm">{cat.name}</span>
                    <span
                      className="w-24 h-1.5 rounded-[3px] overflow-hidden shrink-0"
                      style={{ background: `${cat.color}24` }}
                    >
                      <span
                        className="block h-full"
                        style={{
                          width: `${(cat.count / maxCategoryCount) * 100}%`,
                          background: cat.color,
                        }}
                      />
                    </span>
                    <span className="w-[26px] text-right font-mono text-sm font-bold shrink-0">
                      {cat.count}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {submissionCards.length > 0 && (
            <div className="w-[330px] shrink-0 border-2 border-ink rounded-brutal-lg bg-surface shadow-brutal-sm overflow-hidden">
              <div className="px-5 py-3.5 bg-warning-tint border-b-2 border-ink flex items-center gap-2.5">
                <TriangleAlert size={17} className="text-warning" />
                <span className="text-sm font-bold">{t('home.pending_validation')}</span>
                <span className="ml-auto font-mono text-xs font-bold text-warning">
                  {submissionCards.length}
                </span>
              </div>
              <div className="px-5 pb-1">
                {submissionCards.map(({ sub, toAdd, toRemove, when }, i) => (
                  <div
                    key={sub.id}
                    className={`py-4 ${i < submissionCards.length - 1 ? 'border-b border-ink/10' : ''}`}
                  >
                    <div className="text-emphasis font-bold tracking-snug">
                      {sub.member?.first_name} {sub.member?.last_name}
                    </div>
                    <div className="font-mono text-meta uppercase tracking-caps-md text-ink/45 mb-2.5">
                      {when || t('home.no_date')}
                    </div>
                    <div className="flex gap-4 items-baseline mb-3">
                      <span className="font-mono text-emphasis font-bold text-success-deep">
                        +{toAdd}{' '}
                        <span className="font-normal text-label uppercase tracking-caps-md text-ink/45">
                          {t('home.to_add')}
                        </span>
                      </span>
                      <span
                        className={`font-mono text-emphasis font-bold ${toRemove > 0 ? 'text-danger-deep' : 'text-ink/35'}`}
                      >
                        −{toRemove}{' '}
                        <span className="font-normal text-label uppercase tracking-caps-md text-ink/45">
                          {t('home.to_remove')}
                        </span>
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleValidate(sub.id)}
                        className="border-2 border-ink rounded-brutal-sm bg-success text-surface shadow-brutal-xs px-4 py-[7px] text-row font-bold"
                      >
                        {t('submission.validate')}
                      </button>
                      <button
                        onClick={() => handleDismiss(sub.id)}
                        className="bg-transparent px-1.5 py-[7px] text-row font-semibold text-ink/50 hover:text-ink underline"
                      >
                        {t('submission.ignore')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="text-center font-mono text-meta text-ink/40 mt-auto pt-4">
          <Signature />
        </p>
      </main>
    </AppLayout>
  );
}
