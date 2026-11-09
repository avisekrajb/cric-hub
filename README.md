# Bethub

A modern Cricbuzz-like real-time cricket platform with live scoring, live video/broadcasting, recordings/replays, and a full admin dashboard. Built with Node.js/Express, MongoDB, Socket.IO, React + Vite + Tailwind, and Cloudinary.

## Tech stack
- **Backend**: Node.js, Express, Mongoose, Socket.IO, JWT, Cloudinary, Multer, bcryptjs, LiveKit server SDK
- **Frontend**: React 19, Vite 8, Tailwind CSS v3, React Router 7, socket.io-client, hls.js, livekit-client, lucide-react
- **Realtime**: Live scores, commentary, chat/reactions, stream status, WebRTC broadcast signals, admin presence and ops pulse
- **Media**: Images/videos uploaded to Cloudinary (proxy via backend). HLS/embed/live camera + LiveKit SFU + recordings.

## Project structure
```
cricket/
├── bethub-backend/   # API, realtime, scoring engine, seed
└── bethub-frontend/  # Public site + admin dashboard
```

## Quick start

### 1) Backend
```bash
cd bethub-backend
npm install
cp .env.example .env  # fill in values (or use provided)
npm run dev           # http://localhost:5000
```

### 2) Frontend
```bash
cd bethub-frontend
npm install
npm run dev           # http://localhost:5173
```

### 3) Seed data (optional)
```bash
cd bethub-backend
npm run seed:fresh       # full demo rebuild
npm run seed:countries   # add missing cricket nations, keeps existing data
```
`seed:fresh` reseeds teams/countries/players/matches/videos/series and sets up demo live matches with slugs. `seed:countries` is non-destructive: it tops up the directory to the full 108-nation cricket list, fills only missing flags, and never overwrites custom uploads, teams, players or matches.

## Environment (.env)
See `bethub-backend/.env.example`. Key variables:
- `MONGODB_URI`, `MONGODB_DB` (MongoDB Atlas)
- `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `CLIENT_URL`, `PUBLIC_URL`
- `MAX_LIVE_MATCHES` (default 10), `MAX_CONCURRENT_RECORDINGS` (default 5), `MAX_VIDEO_MB` (200), `MAX_IMAGE_MB` (50), `MAX_LIVE_HOURS` (4)
  These are **first-boot defaults only**. Admins can raise or lower every value live in Admin → Settings; changes are stored in MongoDB and applied without a restart.
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_TOKEN_TTL` (optional; required for LiveKit broadcasts)
- `TURN_URL`/`TURN_USERNAME`/`TURN_CREDENTIAL` (optional for WebRTC)

## Admin access
- URL: `http://localhost:5173/admin/login`
- Email: `admin@bethub.com`
- Password: `Bethub@123`

## Key features
- **Public experience**: light theme by default with a persisted dark-mode toggle, left-to-right mobile drawer, floating live player, chase equations, view counts, and per-match ball animations (6/4/out/no-ball).
- **Realtime scoring**: Add ball with runs/extras/wickets; auto strike rotation; wides/no-balls/free hit; run-outs; innings close/chase creation; undo; manual strike swap; commentary; player of match on finish.
- **Admin dashboard**: Countries (108-nation cricket directory plus fully custom country/name/logo), teams/players (add once, reuse in lineups), matches/fixtures (including an inline “New match” modal), scoring console, broadcast desk (LiveKit/camera/HLS/embed), media library, settings.
- **Realtime ops centre** (`/admin/ops`): live KPI pulse, viewer sparkline, admin presence with page tracking, smart alerts, match start/finish/feature commands, bulk match actions, stream and recording monitors, shared task board with create/move/delete, chat moderation (hide/pin/delete), feature flags, fan announcements, server health, LiveKit room and participant monitor, live audit feed with filters, six CSV exports, schedule countdown, notification bell and a `Ctrl+K` command palette.
- **Live video**: LiveKit SFU broadcast and fan playback, floating draggable/minimizable player, HLS via `hls.js`, embed (YouTube/Vimeo), legacy WebRTC camera broadcast, QR/shareable live links. LiveKit tokens are capped to the remaining live window.
- **Recordings/replays**: Start/stop recording (limit enforced), upload to Cloudinary, create replay video; finished matches show replay without “LIVE”.
- **Stats & charts**: Auto-computed records, leaders, winning percentages and run/wicket timelines rendered with dependency-free SVG bar and line charts.
- **Views**: One-shot per-session view tracking for every match, with live viewer counts powered by Socket.IO.
- **Limits**: Max 10 simultaneous live matches, max 5 concurrent recordings, video max 200MB, image max 50MB, and a 4-hour live-video window (enforced server-side). Every limit is admin-editable in real time from Admin → Settings; a watchdog auto-ends any stream that exceeds the live window, deletes its LiveKit room and writes an audit entry.
- **Realtime everywhere**: Socket.IO events for scores, stream status/viewers, chat/reactions, notifications.

## Routes (frontend)
Public: `/`, `/live`, `/live/:slug`, `/matches`, `/match/:id`, `/matches/:id`, `/videos`, `/teams`, `/teams/:id`, `/players`, `/players/:id`, `/stats`  
Admin: `/admin/login`, `/admin`, `/admin/ops`, `/admin/matches`, `/admin/matches/new`, `/admin/matches/:id/edit`, `/admin/matches/:id/score`, `/admin/streams`, `/admin/teams`, `/admin/players`, `/admin/countries`, `/admin/media`, `/admin/settings`

## API highlights
- Auth: `POST /api/auth/login`, `GET /api/auth/me`, `PATCH /api/auth/me`, `POST /api/auth/change-password`
- Matches: CRUD, `POST /api/matches/:id/start`, `POST /api/matches/:id/finish`, lineups, `POST /api/matches/:id/view`
- Stats: `GET /api/stats/analytics` (totals, teams, leaders, records, timeline), leaderboards, standings, series
- Scoring: `POST /api/matches/:id/ball`, `POST /api/matches/:id/undo`, `POST /api/matches/:id/bowler`, `POST /api/matches/:id/swap-strike`, `POST /api/matches/:id/end-innings`, `POST /api/matches/:id/commentary`, `POST /api/matches/:id/reset`
- Streams: `POST /api/streams/:id/go-live`, `POST /api/streams/:id/end-live`, `POST /api/streams/:id/livekit/token`, `POST /api/streams/:id/recording/start|cancel|finish`, `DELETE /api/streams/:id/recording`, `GET /api/streams/by-slug/:slug`, `GET /api/streams/:id/qr`
- Ops (admin): `GET /api/ops/overview|pulse|health|audit|livekit|export`, `GET|POST|PATCH|DELETE /api/ops/tasks`, `POST /api/ops/matches/:id/action`, `POST /api/ops/matches/bulk`, `GET|PATCH|DELETE /api/ops/chat`, `GET|PATCH /api/ops/flags`, `GET|PATCH /api/ops/limits`, `POST /api/ops/live/enforce`, `POST /api/ops/announce`
- Media: `POST /api/media/image`, `POST /api/media/video`, `GET /api/media/videos`, `DELETE /api/media/videos/:id`

## Build
```bash
cd bethub-frontend
npm run build
```
Output in `dist/`. Backend runs with `npm start`.

## QA scripts
Located in `bethub-backend/qa/`:
- `scoring.qa.mjs` - End-to-end scoring flow
- `streams.qa.mjs` - Live/recording/replay/limits/Cloudinary upload

Run with `npm run qa:scoring` / `npm run qa:streams` (backend must be running).

## Notes
- Media stored on Cloudinary; seed uses external URLs. All admin uploads go through backend to Cloudinary.
- Match detail normalizes overs to string and exposes `innings.oversDetail`.
- Auth clears session only on 401/403; transient network errors don't force logout.
- Browser automation can be flaky in some environments; API-level verification is reliable.
