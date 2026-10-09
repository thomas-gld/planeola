import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Signature from '../components/Signature';

const STRUCTURES = [
  'Associations and volunteers',
  'Sports clubs: coaches, referees, bar shifts',
  'Shops and restaurants',
  'Leisure centres and after-school clubs',
  'Event and festival crews',
  'Student unions',
  'Care and home-help services',
  'Any team working in shifts',
];

const MONTH_STEPS = [
  'Create your organization. Set time slots and member categories.',
  'Add your members. They receive an invitation to use the app.',
  'Each member sends their own availability.',
  'Planeola shows what each submission would change. Validate, and the planning updates itself.',
  'Everyone sees the planning. You can still adjust it manually.',
];

const ADMIN_ITEMS = [
  'Invite members by email',
  'Add, remove or bring back members',
  'Build the monthly planning',
  'Review availability',
];

const MEMBER_ITEMS = [
  'Send their availability',
  'See the monthly planning',
  'Update their profile',
];

// An illustration of the planning grid, not real data.
const PREVIEW_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const PREVIEW_ROWS = [
  { slot: 'Morning', cells: [['Anna', 'Leo'], ['Marc'], [], ['Sofia', 'Anna'], ['Leo']] },
  { slot: 'Afternoon', cells: [['Sofia'], ['Anna', 'Paul'], [], ['Marc'], ['Paul', 'Sofia']] },
];
const CHIP_TONES = {
  Anna: 'bg-primary-tint',
  Leo: 'bg-secondary-tint',
  Marc: 'bg-warning-tint',
  Sofia: 'bg-primary-tint',
  Paul: 'bg-secondary-tint',
};

function SchedulePreview() {
  return (
    <div className="card-brutal p-4 sm:p-5" aria-hidden="true">
      <div className="mb-3 font-sans font-bold text-title tracking-snug">March</div>
      <div className="grid grid-cols-6 gap-1.5 text-meta">
        <div />
        {PREVIEW_DAYS.map((day, i) => (
          <div
            key={day}
            className={`font-mono font-bold uppercase tracking-caps text-center ${
              i === 2 ? 'text-ink/30' : 'text-ink/60'
            }`}
          >
            {day}
          </div>
        ))}
        {PREVIEW_ROWS.map(({ slot, cells }) => (
          <div key={slot} className="contents">
            <div className="font-mono font-bold uppercase tracking-caps text-ink/60 self-center text-micro sm:text-label">
              {slot}
            </div>
            {cells.map((names, i) => (
              <div
                key={i}
                className={`min-h-16 rounded-brutal-sm border border-ink/15 p-1 flex flex-col gap-1 ${
                  i === 2 ? 'bg-closed' : 'bg-surface'
                }`}
              >
                {names.map((name) => (
                  <span
                    key={name}
                    className={`rounded border border-ink/20 px-1 font-semibold truncate ${CHIP_TONES[name]}`}
                  >
                    {name}
                  </span>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-brutal border border-warning/40 bg-warning-tint px-3 py-2.5">
        <span className="text-row font-semibold text-warning grow">
          New availability from Paul: +3 shifts, −1 shift
        </span>
        <span className="btn-brutal-success px-3 py-1.5 text-row">Validate</span>
      </div>
    </div>
  );
}

function PlainList({ items }) {
  return (
    <ul className="border-t border-ink/15">
      {items.map((item) => (
        <li key={item} className="border-b border-ink/15 py-2.5 text-sm text-ink/80">
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function Landing() {
  useEffect(() => {
    const previous = document.title;
    document.title = 'Planeola · Semi-automated planning and member management';
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div className="min-h-screen bg-bg">
      <header className="mx-auto max-w-5xl px-4 py-5 flex items-center justify-between gap-4">
        <Link to="/">
          <img src="/planeola_rect.png" alt="Planeola" className="h-10 w-auto" />
        </Link>
        <nav className="flex items-center gap-4">
          <Link to="/login" className="text-sm font-semibold text-ink/70 hover:text-ink transition">
            Sign in
          </Link>
          <Link to="/register" className="btn-brutal-white px-4 py-2">
            Create an account
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4">
        <section className="pt-8 pb-16 sm:pt-12 grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h1 className="font-sans font-bold text-display-sm sm:text-display leading-tight tracking-snugger mb-5">
              Semi-automated planning and member management
            </h1>
            <p className="text-emphasis leading-relaxed text-ink/75 mb-7">
              Members send their availability.
              <br />
              Admins validate.
              <br />
              <strong className="font-bold text-ink">Done.</strong>
            </p>
            <div className="flex flex-wrap items-center gap-5">
              <Link to="/register" className="btn-brutal-primary px-5 py-3 text-emphasis">
                Create your organization
              </Link>
              <Link
                to="/login"
                className="text-sm font-semibold text-primary hover:text-primary-deep transition"
              >
                I already have an account
              </Link>
            </div>
          </div>
          <SchedulePreview />
        </section>

        <section className="py-12 border-t-2 border-ink">
          <h2 className="font-sans font-bold text-headline tracking-snugger mb-5">
            Designed for organizations with high turnover,
            <br />
            such as:
          </h2>
          <ul className="grid gap-x-10 sm:grid-cols-2 border-t border-ink/15">
            {STRUCTURES.map((structure) => (
              <li
                key={structure}
                className="border-b border-ink/15 py-2.5 text-emphasis text-ink/80"
              >
                {structure}
              </li>
            ))}
          </ul>
        </section>

        <section className="py-12 border-t-2 border-ink">
          <div className="max-w-2xl">
            <h2 className="font-sans font-bold text-headline tracking-snugger mb-5">
              How it works
            </h2>
            <ol className="space-y-4">
              {MONTH_STEPS.map((step, i) => (
                <li key={step} className="flex gap-4 text-emphasis leading-relaxed text-ink/80">
                  <span className="font-mono font-bold text-primary">{i + 1}.</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="py-12 border-t-2 border-ink grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="font-sans font-bold text-title tracking-snug mb-3">Admins</h2>
            <PlainList items={ADMIN_ITEMS} />
          </div>
          <div>
            <h2 className="font-sans font-bold text-title tracking-snug mb-3">Members</h2>
            <PlainList items={MEMBER_ITEMS} />
          </div>
          <p className="md:col-span-2 text-emphasis text-ink/80">
            One account, several organizations, a different role in each.
          </p>
        </section>

        <section className="py-12 border-t-2 border-ink">
          <p className="text-emphasis leading-relaxed text-ink/80 max-w-2xl">
            Open source, MIT license, on{' '}
            <a
              href="https://github.com/thomas-gld/planeola"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary underline hover:text-primary-deep"
            >
              GitHub
            </a>
            .
          </p>
          <Link to="/register" className="btn-brutal-primary mt-6 px-5 py-3 text-emphasis">
            Create your organization
          </Link>
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-4 pt-4 pb-8 font-mono text-xs text-ink/40">
        <Signature />
      </footer>
    </div>
  );
}
