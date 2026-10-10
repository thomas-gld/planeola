import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import useFeedback from '../hooks/useFeedback';
import dayjs from 'dayjs';
import { isDayOpen } from '../lib/closedDays';
import { DEFAULT_ORG_CONFIG, parseOrgConfig } from '../lib/orgConfig';
import { hexToRgba } from '../lib/categories';
import { ChevronLeft, ChevronRight, Check, Lock, ArrowRight, CalendarCheck } from 'lucide-react';
import Loading from '../components/Loading';
import PageHeader from '../components/PageHeader';
import OrgSwitcher from '../components/OrgSwitcher';
import SubmitAvailabilityModal from '../components/SubmitAvailabilityModal';
import { computeCalendarDiff, slotCount } from '../lib/availabilityDiff';
import { orgToday } from '../lib/timezone';

// Past this many time slots, a day's slots scroll.
const VISIBLE_SLOTS = 4;

const shortSlotLabel = (slot) => (slot.label || slot.key).slice(0, 3).toUpperCase();

export default function MyAvailability() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [member, setMember] = useState(null);
  const [availabilityNotes, setAvailabilityNotes] = useState('');
  const [originalNotes, setOriginalNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { notify } = useFeedback();
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [holidays, setHolidays] = useState([]);
  const [config, setConfig] = useState(DEFAULT_ORG_CONFIG);
  const { timeSlots, closedDays, openDays, timezone } = config;
  const today = orgToday(timezone);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [savingCalendar, setSavingCalendar] = useState(false);
  const [allAssignments, setAllAssignments] = useState({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingChanges, setPendingChanges] = useState({ toAdd: [], toRemove: [] });
  const [submissionMessage, setSubmissionMessage] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [membersRes, holidaysRes, optionsRes, assignmentsRes] = await Promise.all([
          api.get('/members'),
          api.get('/holidays'),
          api.get('/options'),
          api.get('/assignments'),
        ]);

        const currentMember = membersRes.data.find((m) => m.user_id === user?.id);
        if (currentMember) {
          setMember(currentMember);
          setAvailabilityNotes(currentMember.availability_notes || '');
          setOriginalNotes(currentMember.availability_notes || '');
          try {
            setSelectedSlots(JSON.parse(currentMember.availability_calendar || '[]'));
          } catch (error) {
            console.error('Error parsing availability_calendar:', error);
            setSelectedSlots([]);
          }
        }

        setHolidays(holidaysRes.data || []);
        setConfig(parseOrgConfig(optionsRes.data));
        setAllAssignments(assignmentsRes.data || {});
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const isInactiveDay = (date) => !isDayOpen(date, { closedDays, holidays, openDays });

  const generateCalendarDays = () => {
    const startDay = currentMonth.startOf('month').day();
    const blanks = startDay === 0 ? 6 : startDay - 1;
    return [
      ...Array(blanks).fill(null),
      ...Array.from({ length: currentMonth.daysInMonth() }, (_, i) => currentMonth.date(i + 1)),
    ];
  };

  const goToPrevMonth = () => {
    const prev = currentMonth.subtract(1, 'month');
    if (!prev.isBefore(today.startOf('month'))) {
      setCurrentMonth(prev);
    }
  };

  const goToNextMonth = () => {
    setCurrentMonth(currentMonth.add(1, 'month'));
  };

  const isSlotSelected = (date, time_slot) => {
    return selectedSlots.some(
      (slot) => slot.date === date.format('YYYY-MM-DD') && slot.time_slot === time_slot,
    );
  };

  const toggleSlot = (date, time_slot) => {
    const dateStr = date.format('YYYY-MM-DD');
    setSelectedSlots((prev) =>
      isSlotSelected(date, time_slot)
        ? prev.filter((slot) => !(slot.date === dateStr && slot.time_slot === time_slot))
        : [...prev, { date: dateStr, time_slot }],
    );
  };

  const calendarDiff = () =>
    computeCalendarDiff(selectedSlots, member, allAssignments, today.format('YYYY-MM-DD'));

  const handleSaveCalendar = () => {
    if (!member) return;
    setPendingChanges(calendarDiff());
    setShowConfirmModal(true);
  };

  // Notes and calendar always together, so neither save overwrites the other.
  const saveMember = async (extra = {}) => {
    const calendar = JSON.stringify(selectedSlots);
    await api.put(`/members/${member.id}`, {
      ...member,
      availability_notes: availabilityNotes,
      availability_calendar: calendar,
      ...extra,
    });
    setMember((prev) => ({
      ...prev,
      availability_notes: availabilityNotes,
      availability_calendar: calendar,
    }));
    setOriginalNotes(availabilityNotes);
  };

  const confirmSaveCalendar = async () => {
    setShowConfirmModal(false);
    setSavingCalendar(true);

    try {
      await saveMember();

      // Submitted even when empty: that is how a member clears their slots.
      const response = await api.post('/availability-submissions', {
        dates: JSON.stringify(selectedSlots),
        ...(submissionMessage.trim() && { message: submissionMessage.trim() }),
      });
      setSubmissionMessage('');

      notify(
        response.data.status === 'pending' ? t('availability.sent') : t('availability.unchanged'),
      );
    } catch (error) {
      console.error(error);
      notify(t('availability.send_failed'), 'error');
    } finally {
      setSavingCalendar(false);
    }
  };

  const handleSave = async () => {
    if (!member) return;

    setSaving(true);
    try {
      // The manager is emailed the change.
      const notesChanged = availabilityNotes !== originalNotes;
      await saveMember(notesChanged ? { previous_availability_notes: originalNotes } : {});
      notify(t('availability.notes_saved'));
    } catch (error) {
      console.error(error);
      notify(t('availability.notes_failed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Loading />;
  }

  if (!member) {
    return (
      <div className="flex items-center justify-center p-4 py-24">
        <div className="border-2 border-ink rounded-brutal-lg bg-accent shadow-brutal p-6 text-center max-w-md">
          <p className="font-bold">{t('profile.no_member')}</p>
          <button
            onClick={() => navigate('/member-home')}
            className="btn-brutal-primary px-4 py-2 mt-4"
          >
            {t('profile.back_home')}
          </button>
        </div>
      </div>
    );
  }

  const pendingChangeCount = (() => {
    const { groupedToAdd, groupedToRemove } = calendarDiff();
    return slotCount(groupedToAdd) + slotCount(groupedToRemove);
  })();

  const inCurrentMonth = currentMonth.isSame(today, 'month');

  const monthDaysList = Array.from({ length: currentMonth.daysInMonth() }, (_, i) =>
    currentMonth.date(i + 1),
  );
  const weekGroups = [];
  monthDaysList.forEach((date) => {
    const last = weekGroups[weekGroups.length - 1];
    if (!last || date.day() === 1) {
      weekGroups.push({ label: date.format('ddd D MMMM'), days: [date] });
    } else {
      last.days.push(date);
    }
  });

  return (
    <div>
      {showConfirmModal && (
        <SubmitAvailabilityModal
          changes={pendingChanges}
          timeSlots={timeSlots}
          message={submissionMessage}
          onMessageChange={setSubmissionMessage}
          onBack={() => setShowConfirmModal(false)}
          onSubmit={confirmSaveCalendar}
        />
      )}

      <PageHeader
        title={t('nav.my_availability')}
        subtitle={`${member.first_name} ${member.last_name}`}
      >
        <OrgSwitcher />
      </PageHeader>

      <div className="hidden sm:flex items-center gap-4 flex-wrap border-b-2 border-ink bg-secondary-tint px-7 py-3">
        <CalendarCheck size={19} className="shrink-0 text-secondary" />
        <span className="font-bold text-title tracking-snugger">
          {currentMonth.format('MMMM YYYY')}
        </span>
        <span className="inline-flex items-center gap-0.5 border border-ink/20 rounded-brutal bg-surface">
          <button
            onClick={goToPrevMonth}
            disabled={inCurrentMonth}
            aria-label={t('common.previous_month')}
            className="w-[30px] h-[30px] flex items-center justify-center disabled:opacity-35"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={goToNextMonth}
            aria-label={t('common.next_month')}
            className="w-[30px] h-[30px] flex items-center justify-center"
          >
            <ChevronRight size={15} />
          </button>
        </span>
      </div>

      <div className="flex sm:hidden items-center gap-3 border-b-2 border-ink bg-secondary-tint px-4 py-3">
        <CalendarCheck size={17} className="shrink-0 text-secondary" />
        <span className="inline-flex items-center gap-0.5 border border-ink/20 rounded-brutal bg-surface">
          <button
            onClick={goToPrevMonth}
            disabled={inCurrentMonth}
            aria-label={t('common.previous_month')}
            className="w-8 h-8 flex items-center justify-center disabled:opacity-35"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="px-3 text-sm font-bold tracking-snug whitespace-nowrap">
            {currentMonth.format('MMMM YYYY')}
          </span>
          <button
            onClick={goToNextMonth}
            aria-label={t('common.next_month')}
            className="w-8 h-8 flex items-center justify-center"
          >
            <ChevronRight size={15} />
          </button>
        </span>
      </div>

      <main className="px-4 sm:px-7 py-4 sm:py-[18px] pb-32 flex flex-col gap-4">
        <div className="hidden sm:block">
          <div className="grid grid-cols-7 gap-1.5">
            {t('common.weekdays_short', { returnObjects: true }).map((day, i) => (
              <div
                key={day}
                className={`text-center font-mono text-label font-bold uppercase tracking-caps-md pb-1.5 ${i >= 5 ? 'text-ink/30' : 'text-ink/45'}`}
              >
                {day}
              </div>
            ))}

            {generateCalendarDays().map((date, index) => {
              if (!date) return <div key={`empty-${index}`} className="min-h-[78px]" />;

              const inactive = isInactiveDay(date);
              const isPast = date.isBefore(today, 'day');
              const isToday = date.isSame(today, 'day');

              if (inactive) {
                return (
                  <div
                    key={date.format('YYYY-MM-DD')}
                    className="min-h-[78px] border border-ink/12 rounded-brutal-sm bg-closed p-[5px] flex flex-col items-start gap-1"
                  >
                    <span className="font-mono text-meta font-bold pl-0.5 text-ink/40">
                      {date.date()}
                    </span>
                    <span className="m-auto text-ink/28">
                      <Lock size={14} />
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={date.format('YYYY-MM-DD')}
                  className={`min-h-[78px] rounded-brutal-sm p-[5px] flex flex-col gap-1 ${
                    isPast
                      ? 'bg-well border border-ink/14 text-ink/30'
                      : isToday
                        ? 'bg-surface border-2 border-ink'
                        : 'bg-surface border border-ink/14'
                  }`}
                >
                  <span
                    className={`font-mono text-meta font-bold pl-0.5 ${isToday ? 'text-primary' : ''}`}
                  >
                    {date.date()}
                    {isToday && ` · ${t('common.today')}`}
                  </span>
                  {!isPast && (
                    <div className="flex-1 flex flex-col gap-1 max-h-[84px] overflow-y-auto scroll-thin">
                      {timeSlots.map((slot) => {
                        const sel = isSlotSelected(date, slot.key);
                        return (
                          <button
                            key={slot.key}
                            type="button"
                            onClick={() => toggleSlot(date, slot.key)}
                            title={slot.label}
                            className="flex-1 min-h-[18px] rounded-[7px] flex items-center justify-center gap-1 font-mono text-micro font-bold uppercase transition hover:brightness-95"
                            style={
                              sel
                                ? { background: slot.color, color: 'rgb(var(--color-surface))' }
                                : { background: hexToRgba(slot.color, 0.1), color: slot.color }
                            }
                          >
                            {sel && <Check size={11} />}
                            {shortSlotLabel(slot)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex sm:hidden flex-col gap-2.5">
          {weekGroups.map((group, gi) => (
            <React.Fragment key={gi}>
              <span className="font-mono text-label font-bold uppercase tracking-widest text-ink/45 mt-1">
                {t('availability.week_of', { date: group.label })}
              </span>
              {group.days.map((date) => {
                const inactive = isInactiveDay(date);
                const isToday = date.isSame(today, 'day');

                if (inactive) {
                  return (
                    <div
                      key={date.format('YYYY-MM-DD')}
                      className="flex items-center gap-2 border border-ink/12 rounded-brutal bg-closed px-2.5 py-3"
                    >
                      <span className="w-[52px] font-mono text-meta font-bold uppercase tracking-wide text-ink/45">
                        {date.format('ddd D')}
                      </span>
                      <span className="flex-1 inline-flex items-center gap-1.5 font-mono text-label font-bold uppercase tracking-widest text-ink/40">
                        <Lock size={12} /> {t('common.closed')}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={date.format('YYYY-MM-DD')}
                    className={`flex items-center gap-2 rounded-brutal bg-surface px-2.5 py-2 ${isToday ? 'border-2 border-ink' : 'border border-ink/15'}`}
                  >
                    <span
                      className={`w-[52px] font-mono text-meta font-bold uppercase tracking-wide ${isToday ? 'text-primary' : ''}`}
                    >
                      {date.format('ddd D')}
                    </span>
                    <div className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto scroll-thin">
                      {timeSlots.map((slot) => {
                        const sel = isSlotSelected(date, slot.key);
                        return (
                          <button
                            key={slot.key}
                            type="button"
                            onClick={() => toggleSlot(date, slot.key)}
                            className={`h-11 min-w-0 px-1 rounded-brutal-sm flex items-center justify-center gap-1.5 font-mono text-label font-bold uppercase transition ${
                              timeSlots.length > VISIBLE_SLOTS
                                ? 'shrink-0 w-[calc((100%-1.125rem)/4)]'
                                : 'flex-1'
                            }`}
                            style={
                              sel
                                ? { background: slot.color, color: 'rgb(var(--color-surface))' }
                                : { background: hexToRgba(slot.color, 0.1), color: slot.color }
                            }
                          >
                            {sel && <Check size={13} className="shrink-0" />}
                            <span className="truncate">{slot.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </main>

      <div className="border-t-2 border-ink bg-surface px-4 sm:px-7 py-[18px] flex flex-col gap-2.5">
        <span className="text-emphasis font-bold tracking-snug">{t('availability.notes')}</span>
        <textarea
          value={availabilityNotes}
          onChange={(e) => setAvailabilityNotes(e.target.value)}
          placeholder={t('availability.notes_placeholder')}
          className="input-brutal-hairline min-h-[44px] resize-none"
        />
      </div>

      <div className="no-print sticky bottom-24 sm:bottom-0 bg-surface border-t-2 border-ink px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <span className="flex-1 font-mono text-label font-bold uppercase tracking-wide text-ink/55">
          {t('availability.slots', { count: selectedSlots.length })}
          {pendingChangeCount > 0
            ? ` · ${t('availability.changes', { count: pendingChangeCount })}`
            : ''}
        </span>
        <button
          onClick={handleSave}
          disabled={saving}
          className="hidden sm:inline-flex border-2 border-ink/30 rounded-brutal bg-surface px-4 py-2.5 text-row font-bold hover:bg-muted transition"
        >
          {saving ? t('common.saving') : t('availability.save_notes')}
        </button>
        <button
          onClick={handleSaveCalendar}
          disabled={savingCalendar}
          className="btn-brutal-primary px-[18px] py-3 sm:py-2.5 text-row"
        >
          {savingCalendar ? t('common.saving') : t('availability.review')} <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
