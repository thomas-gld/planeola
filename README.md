<div align="center">

# Planeola

**Semi-automated planning and member management.**

[![Website](https://img.shields.io/badge/planeola.com-visit-2563eb?style=for-the-badge)](https://planeola.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

</div>

Designed and built for associations, community groups or any organization with a large, rotating team of members.<br>
As an admin, you manage your member list, build the monthly schedule and
validate the availability your members send in.<br>
As a member, you declare when
you are available and check the schedule at any time.

---

## How it works

```
  Member                         Administrator                 Everyone
  ──────                         ─────────────                 ────────
  fills in their    ──submit──▶  reviews what would   ──▶      sees the
  availability                   change, validates             monthly schedule
                                 or ignores it
```

| Role       | What they can do                                                     |
| ---------- | -------------------------------------------------------------------- |
| **Admin**  | Everything: members, schedule, invitations, organization settings.   |
| **Member** | See the schedule, submit their availability, edit their own profile. |

---

## Getting started

1. **Register** with your email and a password.
2. **Join or create an organization**: Accept an invitation you received, or
   create your own organization and become its administrator.
3. As an administrator, **go to Options** to set your closed days, time slots
   (_Morning_, _Afternoon_...) and your member categories (_Lead_,
   _Intern_...).

---

## For administrators

- **Members**: Add members, resign those who leave and reinstate them at any time.
- **Invitations**: Send an invite to your members by email so they can join the
  organization with their own account.
- **Planning**: Build the schedule by assigning members to each day and time slot.
- **Availability**: When a member submits their availability, a banner shows the
  shifts that would be added and removed. Validate to automatically apply the
  changes to the schedule.

---

## For members

- **Join** an organization by accepting the invitation you receive by email or
  in your account.
- **Planning**: See the schedule for each month.
- **My availability**: Send your upcoming availability for the admin to review.
- **My profile**: Update your personal details.

---

<h3>One account can belong to and administer several organizations.</h3>
<h4>Switch between them from the top-right corner dropdown.</h4>

---

## For developers

### Frontend

**React** · **Vite** · **Tailwind CSS**

### Backend

**FastAPI** · **SQLAlchemy** · **PostgreSQL**

### Architecture

```
backend/
├── main.py
├── core/
│   ├── config.py
│   ├── security.py
│   ├── options.py
│   ├── logging.py
│   └── limiter.py
├── routers/
│   ├── auth.py
│   ├── members.py
│   ├── assignments.py
│   ├── submissions.py
│   ├── holidays.py
│   ├── options.py
│   └── static.py
├── models.py
├── schemas.py
└── migrations/
frontend/src/
├── App.jsx
├── api.js
├── pages/
└── components/
```

### Run it locally

Requires Python 3.10+, Node.js 18+ and PostgreSQL.

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.lock.txt -r requirements-dev.txt
cp .env.example .env            # set DATABASE_URL and SECRET_KEY
alembic upgrade head
python main.py                  # http://127.0.0.1:8000

# Frontend (in another terminal)
cd frontend
npm ci
npm run dev                     # http://localhost:5173
```

---

## License

The code is released under the [MIT License](LICENSE) — © 2026 Thomas Gladin.

### Trademark

The MIT License covers the code, not the name. "Planeola", its logo and the
planeola.com domain identify the official service and are not licensed for
reuse. If you run your own copy, give it a different name and logo.
