# Harvest Tracker

A full-stack time tracking application built with React, Node.js, and SQLite. Supports timers, manual entries, client/project management, budget tracking, and reports.

## Quick Start

```bash
# 1. Install all dependencies
npm install

# 2. Run database migrations
cd /Users/trimarkdigital/harvest-tracker && node server/node_modules/.bin/prisma migrate dev --schema=prisma/schema.prisma --name init

# 3. Seed demo data
cd /Users/trimarkdigital/harvest-tracker/server && NODE_PATH=./node_modules npx tsx ../prisma/seed.ts

# 4. Start the app (runs both server + client)
npm run dev
```

Open http://localhost:5173

## Demo Credentials

| Email | Password | Role |
|---|---|---|
| admin@example.com | password123 | Admin |
| sam@example.com | password123 | Member |
| jordan@example.com | password123 | Member |

## Tech Stack

- **Frontend:** React 18 + TypeScript + Tailwind CSS + Vite
- **Backend:** Node.js + Express + TypeScript
- **Database:** SQLite via Prisma ORM
- **Auth:** JWT (7-day tokens)
- **State:** Zustand + TanStack Query

## Features

- **Live timer** — start/stop with project & task selection; persistent across pages
- **Manual time entry** — log hours by date with notes
- **Clients & Groups** — organize clients into groups, track per-client hours
- **Projects** — one-time or recurring budgets with automatic monthly resets
- **Budget tracking** — progress bars with 80% warning and 100% over-budget alerts
- **Reports** — 6 report views (by client, group, project, task, member, detail log) with Recharts charts and CSV export
- **Settings** — profile management, avatar color, team member management (admin)

## Project Structure

```
/
├── client/          # React frontend (Vite, port 5173)
├── server/          # Express backend (port 3001)
├── prisma/          # Schema + seed script
└── dev.db           # SQLite database (auto-created)
```

## API

All routes are under `/api/v1/`. Auth required (Bearer token) on all routes except `/api/v1/auth/login`.

Key endpoints:
- `POST /api/v1/auth/login` — get token
- `GET/POST /api/v1/time-entries` — list/create entries
- `POST /api/v1/time-entries/start` — start timer
- `POST /api/v1/time-entries/stop/:id` — stop timer
- `GET /api/v1/reports/by-client?preset=this_month` — client report
