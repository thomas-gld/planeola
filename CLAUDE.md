# CLAUDE.md

**Planeola**: a multi-tenant scheduling app. Members declare when they are
available, admins turn that into a monthly schedule. `backend/` is FastAPI +
SQLAlchemy + PostgreSQL, `frontend/` is React + Vite + Tailwind. Everything is
in English.

Frontend: `src/pages/`, `src/components/`, and the non-UI modules (API client,
option parsing, dates, diffs) in `src/lib/`.

## Commands

```bash
# backend
cd backend
.venv/bin/pip install -r requirements.lock.txt -r requirements-dev.txt   # the lock file, as CI
.venv/bin/alembic upgrade head
.venv/bin/python main.py                                                 # :8000
.venv/bin/python -m ruff check . && .venv/bin/python -m pytest -q
.venv/bin/python -m pytest tests/test_api.py::test_name

# frontend
cd frontend
npm ci && npm run dev          # :5173, proxies /api to :8000
npm run lint && npx prettier --check src && npm run build
```

CI runs ruff, pytest, eslint and the build, not Prettier: check it locally
(`npm run format` rewrites `src`).

## Data model

Every table except `Login` has an `account_id` and cascades from `Account` (one
organization).

- **Login**: one person's credentials, global; email is the identifier.
- **User**: one Login's membership in one organization, with one `role`
  (`admin | member`). A Login can hold both roles in the same organization.
- **Member**: someone who can be scheduled. Linked to a User only once an
  invitation is accepted.
- **Assignment**: one member on one `date` / `time_slot` / `category`, stored
  flat; the API returns `{date: {time_slot: {category: [member_id]}}}`.
- **AvailabilitySubmission**, **Invitation**: deleted once handled, never kept.
- **Holiday**: a date forced closed. **Option**: per-organization key/value.

## Invariants

- **Multi-tenancy.** Every query filters on `get_account_id(current_user)`, and
  a lookup by id checks ownership: another organization's row is a 404, never a 403.
- **Login vs membership.** Login returns a `select_token` and the person's
  organizations; `/auth/switch-account` exchanges it for a JWT. Selection is by
  `user_id`, not `account_id` (two roles in one organization).
- **Primary category.** `categories[0]` decides how a member is scheduled, on
  both sides.
- **Today.** Schedule dates are zoneless `"YYYY-MM-DD"` in the organization's
  calendar. "Today" is read in the `timezone` option: `org_today` in
  `core/options.py`, `orgToday(config.timezone)` in `lib/timezone.js`, never a bare
  `dayjs()`. Instants are UTC in naive columns; `as_utc` stamps them on the way out.
- **Submissions.** MyAvailability writes `Member.availability_calendar` before
  validation, so a submission ignored or expired realigns that calendar on the
  real assignments. Validation rebuilds every month it touches plus every month
  with future assignments.

## Logic duplicated on purpose (change both sides)

- Open/closed day: `open_days` > `Holiday` > weekly `closed_days`.
  `isDayOpen` in `lib/closedDays.js` / `routers/holidays.py`.
- New-password rule: `password_problem` in `core/security.py` refuses,
  `passwordChecks` in `lib/password.js` drives the live checklist.
- Legal pages: `frontend/src/legal/*.{fr,en}.md` change together, French is the
  reference. `privacy.*.md` describes what the code stores: update it when a
  model or an email changes.

## Options

| Key                         | Value                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `org_name`, `manager_email` | strings; `manager_email` receives notes-change emails                                   |
| `closed_days`               | JSON `[0..6]`, 0 = Sunday                                                               |
| `open_days`                 | JSON `["YYYY-MM-DD"]` forced open                                                       |
| `time_slots`                | JSON `[{key, label, color}]`; `key` is what assignments store                           |
| `categories`                | JSON `[{name, color}]`; the name is stored, so rename through `POST /categories/rename` |
| `show_past_days`            | `"true"` / `"false"`                                                                    |
| `timezone`                  | IANA name, default `Europe/Paris`; `POST /options` refuses an unknown one               |

`parseOrgConfig` (`lib/orgConfig.js`) is the only place the frontend maps options to
values. `OrgSettingsForm` serves both the Options page and the
create-organization modal.

## Conventions and traps

- API fields and option keys stay `snake_case` in JS; local names are
  `camelCase`. `{ availability_notes }` in a payload is a wire name.
- Empty `catch` blocks hold `// ignore`: ESLint's `no-empty` needs it.
- User feedback goes through `useFeedback()` (`notify`, `confirm`), never
  `alert()` / `window.confirm()`.
- Styling: use the tokens from `index.css` / `tailwind.config.cjs` (`ink`,
  `primary`, `*-tint`, `text-row`, `rounded-brutal`, `btn-brutal`…), not
  arbitrary values. The hexes in `lib/categories.js` and `lib/timeSlots.js` are seeds for
  user-chosen colours, not theme: leave them literal.
- Endpoints take `session: AsyncSession = SessionDep` (`db.py`), which commits
  before the response. Emails go out as `BackgroundTasks`, after it.
- `routers/static.py` is registered last: its catch-all would shadow the API.
- Member names are normalized on save: `last_name.upper()`,
  `first_name.capitalize()`. A resigned member stays in the database and loses
  access to that organization (left out of the login list, 403 on switch).
- Migrations: `alembic revision --autogenerate`, then review. Declare constraints
  and indexes unnamed (the naming convention on `Base` names them). Autogenerate
  misorders the `use_alter` key `logins.default_user_id`: check it by hand.
  Once deployed, migrations are append-only.

## Tests and email

`tests/test_api.py` runs against the local database from `.env`; each test
registers its own `pytest-…@example.test` account, deleted at the end. Rate
limiting is off in `conftest.py`.

The autouse `no_outgoing_email` fixture unsets `SMTP_*` and replaces
`smtplib.SMTP`/`SMTP_SSL` with something raising `SmtpAttempted`, a
`BaseException` because `_send` swallows `Exception`. Keep both: a local `.env`
may hold real SMTP credentials. Running the app with them sends real emails.

`ECHO_SECRETS=true` prints verification codes and reset links to stdout; never
on a server.

## Deployment (not live yet)

`/var/www/planeola`, systemd `planeola.service` (uvicorn on `127.0.0.1:8000`),
nginx in front. Production values come from the systemd environment.

```bash
cd /var/www/planeola && git pull
cd backend && .venv/bin/pip install -r requirements.lock.txt
DATABASE_URL="..." .venv/bin/alembic upgrade head
cd ../frontend && npm ci && npm run build
rm -rf ../backend/frontend_dist/* && cp -r dist/* ../backend/frontend_dist/
sudo systemctl restart planeola.service
```

- Keep the `rm -rf`: `cp -r` merges and would serve stale files forever.
- nginx must send `X-Forwarded-For` (otherwise every client shares one rate-limit
  bucket) and `X-Forwarded-Proto` (otherwise no HSTS header).
- One uvicorn worker only: rate limits live in memory.
- Single origin, so no CORS. Nothing is loaded from a third party (the CSP
  forbids it).
- `APP_URL` in `https://` turns on `PRODUCTION` (`core/config.py`): API docs
  hidden, and startup fails on a `SECRET_KEY` under 32 characters.
- Logs rotate daily and keep 180 files: the privacy policy promises six months
  at most. journald keeps stdout separately, so cap it too
  (`MaxRetentionSec=6month`).
