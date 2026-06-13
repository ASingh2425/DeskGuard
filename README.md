# DeskGuard — Library Seat Booking & Anti-Hoarding System

A full-stack prototype for fair library desk management with server-authoritative timers, real-time SVG seat maps, QR check-in, away mode, liveness checks, and a librarian admin console.

## Architecture

```
┌─────────────┐     WebSocket      ┌─────────────┐
│  React SPA  │◄──────────────────►│  Express    │
│  (Vite)     │     REST API       │  + Socket.IO│
└─────────────┘                    └──────┬──────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
              ┌──────────┐         ┌──────────┐         ┌──────────┐
              │PostgreSQL│         │  Redis   │         │  Sweep   │
              │ (truth)  │         │ (timers) │         │  Worker  │
              └──────────┘         └──────────┘         └──────────┘
```

## Quick Start

### Prerequisites
- Docker & Docker Compose, **or**
- Node.js 20+, PostgreSQL 16, Redis 7

### Docker (recommended)

```bash
cd DeskGuard
docker compose up --build
```

Then seed demo users:

```bash
docker compose exec backend npm run seed
```

Open **http://localhost:5173**

### Local development

```bash
# Terminal 1 — PostgreSQL & Redis (or use Docker for just infra)
docker compose up postgres redis

# Terminal 2 — Backend
cd backend && npm install && npm run seed && npm run dev

# Terminal 3 — Worker
cd backend && npm run worker

# Terminal 4 — Frontend
cd frontend && npm install && npm run dev
```

## Demo Accounts

| Email | Role | Password |
|-------|------|----------|
| student@library.edu | Student | password123 |
| student2@library.edu | Student | password123 |
| librarian@library.edu | Librarian | password123 |
| admin@library.edu | Admin | password123 |

## Features

- **Live SVG map** — color-coded desks (Green/Red/Yellow/Gray) with WebSocket sync
- **QR check-in** — `/checkin/D-101` (simulates QR scan via URL)
- **Away mode** — 20-min server countdown, max 3 away periods per session
- **Liveness checks** — every 2 hours, 10-min grace window
- **One-desk-per-student** — enforced server-side
- **Admin dashboard** — desk grid, abandoned queue, audit log, analytics, CSV export
- **60-second sweep worker** — idempotent timer enforcement via Redis + PostgreSQL

## Redis Key Design

| Key Pattern | Type | Purpose |
|-------------|------|---------|
| `session:{id}:state` | HASH | Cached session state |
| `session:{id}:away_expires` | STRING + TTL | Away countdown deadline |
| `session:{id}:liveness_due` | STRING + TTL | Next liveness check |
| `session:{id}:liveness_grace` | STRING + TTL | Grace window after prompt |
| `desk:{id}:lock` | STRING + TTL | Distributed desk lock |
| `sweep:lock` | STRING + TTL | Idempotent sweep lock |
| `user:{id}:active_session` | STRING | User → session mapping |

## API Endpoints

### Auth
- `POST /api/auth/register` — Register student
- `POST /api/auth/login` — Login (returns JWT)
- `GET /api/auth/me` — Current user

### Desks
- `GET /api/desks` — All desks with live status (`?floor=1&status=free`)
- `GET /api/desks/zones` — Zone list
- `GET /api/desks/:deskCode` — Desk details
- `GET /api/desks/:deskCode/qr` — QR code data URL

### Sessions (authenticated)
- `GET /api/sessions/active` — Current session + server-synced timers
- `GET /api/sessions/history` — Usage history
- `POST /api/sessions/checkin` — `{ deskCode }` — Rate limited
- `POST /api/sessions/away` — Mark away
- `POST /api/sessions/back` — Return from away
- `POST /api/sessions/liveness` — Confirm liveness
- `POST /api/sessions/checkout` — End session

### Admin (librarian/admin)
- `GET /api/admin/desks` — Filterable desk grid
- `GET /api/admin/abandoned` — Abandoned desk queue
- `POST /api/admin/desks/:id/reset` — Manual reset
- `POST /api/admin/desks/:id/force-checkout` — Force checkout
- `POST /api/admin/desks/:id/maintenance` — Toggle maintenance
- `GET /api/admin/audit` — Audit log
- `GET /api/admin/analytics` — Utilization, abandonment, peak hours
- `GET /api/admin/export/sessions` — CSV export
- `PUT /api/admin/config` — Update timer config (admin only)

### WebSocket Events
- Client → `subscribe:desks`, `auth` (userId)
- Server → `desks:refresh`, `notification`, `desk:update`

## Timer Configuration

Set via environment variables or admin API:

| Variable | Default | Description |
|----------|---------|-------------|
| `AWAY_LIMIT_MINUTES` | 20 | Away auto-free timeout |
| `LIVENESS_INTERVAL_HOURS` | 2 | Hours between liveness prompts |
| `LIVENESS_GRACE_MINUTES` | 10 | Response grace window |
| `MAX_AWAY_PERIODS` | 3 | Max away toggles per session |
| `SWEEP_INTERVAL_SECONDS` | 60 | Background worker interval |

For faster demo testing, set `LIVENESS_INTERVAL_HOURS=0.05` (3 min).

## Project Structure

```
DeskGuard/
├── docker-compose.yml
├── migrations/001_initial_schema.sql
├── backend/
│   ├── src/
│   │   ├── index.js              # API + embedded sweep
│   │   ├── routes/               # auth, desks, sessions, admin
│   │   ├── services/             # session, timer, audit, notifications
│   │   ├── redis/client.js       # TTL timer keys
│   │   ├── workers/sweepWorker.js
│   │   └── socket.js
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/           # DeskMap, SessionPanel, Layout
    │   ├── pages/                # Map, CheckIn, Admin, History
    │   ├── api/client.js
    │   └── hooks/useSocket.js
    └── package.json
```

## License

MIT — Prototype for educational/demo use.
