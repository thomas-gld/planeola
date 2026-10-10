import { useTranslation } from 'react-i18next';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Settings,
  CalendarCheck,
  User,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import useOrgAccounts from '../hooks/useOrgAccounts';
import OrgSwitcher from './OrgSwitcher';

// Written out in full: Tailwind only picks up class names it can see.
const BLUE = { text: 'text-primary' };
const VIOLET = { text: 'text-secondary' };
const AMBER = { text: 'text-warning' };

const ADMIN_ITEMS = [
  { to: '/', label: 'nav.home', Icon: LayoutDashboard, ...BLUE, end: true },
  { to: '/planning', label: 'nav.planning', Icon: CalendarDays, ...BLUE },
  { to: '/members', label: 'nav.members', Icon: Users, ...VIOLET },
  { to: '/options', label: 'nav.options', Icon: Settings, ...AMBER },
];

const MEMBER_ITEMS = [
  { to: '/member-home', label: 'nav.home', Icon: LayoutDashboard, ...BLUE, end: true },
  { to: '/member-planning', label: 'nav.planning', Icon: CalendarDays, ...BLUE },
  { to: '/my-availability', label: 'nav.my_availability', Icon: CalendarCheck, ...VIOLET },
  { to: '/my-profile', label: 'nav.my_profile', Icon: User, ...AMBER },
];

// Translation keys. The tab bar is too narrow for the rail labels.
const TAB_LABELS = {
  '/my-availability': 'nav.availability_short',
  '/my-profile': 'nav.profile_short',
};

export default function AppRail() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { accounts } = useOrgAccounts();
  const isAdmin = user?.role === 'admin';
  const items = isAdmin ? ADMIN_ITEMS : MEMBER_ITEMS;
  // Tells the two spaces apart at a glance.
  const railBg = isAdmin ? 'bg-rail-admin' : 'bg-rail-member';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <aside
        className={`no-print hidden sm:flex w-[104px] shrink-0 flex-col items-center gap-[26px]
        border-r-2 border-ink py-[18px] ${railBg}`}
      >
        <div className="w-11 h-11 border-2 border-ink rounded-brutal overflow-hidden">
          <img src="/planeola_carre.png" alt="" className="w-full h-full object-cover" />
        </div>

        <nav className="flex flex-col items-center gap-3.5">
          {items.map(({ to, label, Icon, text, end }) => (
            <NavLink key={to} to={to} end={end} className="flex flex-col items-center gap-[5px]">
              {({ isActive }) => (
                <>
                  <span
                    className={`w-12 h-11 rounded-brutal flex items-center justify-center transition-colors ${text} ${
                      isActive
                        ? 'border-2 border-ink bg-surface'
                        : 'border-2 border-transparent hover:bg-surface/60'
                    }`}
                  >
                    <Icon size={19} />
                  </span>
                  <span
                    className={`w-14 text-center font-mono text-micro uppercase tracking-caps-md leading-[1.3] ${
                      isActive ? 'text-ink' : 'text-ink/55'
                    }`}
                  >
                    {t(label)}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          title={t('nav.log_out')}
          className="mt-auto w-12 h-11 rounded-brutal bg-transparent text-ink/50 flex items-center
            justify-center hover:bg-danger/[0.12] hover:text-danger transition-colors"
        >
          <LogOut size={19} />
        </button>
      </aside>

      <header
        className={`no-print sm:hidden flex-shrink-0 flex items-center gap-2.5 border-b-2 border-ink px-[18px] py-3.5 ${railBg}`}
      >
        <div className="w-[34px] h-[34px] shrink-0 border-2 border-ink rounded-brutal-sm overflow-hidden">
          <img src="/planeola_carre.png" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          {accounts.length > 0 ? (
            <OrgSwitcher inMobileHeader />
          ) : (
            <span className="block truncate font-bold text-sm">Planeola</span>
          )}
        </div>
        <button
          onClick={handleLogout}
          title={t('nav.log_out')}
          className="w-11 h-[38px] shrink-0 border-2 border-ink rounded-brutal-sm bg-surface flex items-center justify-center"
        >
          <LogOut size={18} />
        </button>
      </header>

      <nav
        className={`no-print sm:hidden fixed bottom-0 inset-x-0 z-40 flex justify-around
        border-t-2 border-ink px-3 pt-2 pb-5 ${railBg}`}
      >
        {items.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end}>
            {({ isActive }) => (
              <span
                className={`flex flex-col items-center gap-1 px-3.5 py-1.5 rounded-brutal ${
                  isActive ? 'bg-surface text-primary' : 'text-ink/55'
                }`}
              >
                <Icon size={20} />
                <span className="font-mono text-micro uppercase tracking-caps">
                  {t(TAB_LABELS[to] || label)}
                </span>
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
