# Bethub Frontend

React 19 + Vite 8 + Tailwind CSS v3 client for Bethub.

## Run
```bash
npm install
npm run dev
```
Open http://localhost:5173. The dev server proxies `/api` and `/socket.io` to `http://localhost:5000`.

## Build
```bash
npm run build
npm run preview
```

## Structure
- `src/pages` — public pages (home, live, match detail, teams, players, stats, videos)
- `src/admin` — admin dashboard pages and shell
- `src/components` — shared UI, scorecards, live player, chat, insights, SVG charts
- `src/contexts` — auth, socket, theme, and toast providers
- `src/hooks` — `useFetch` polling and one-shot match view tracking
- `src/lib` — API client, clipboard fallback, chase/view/sort helpers

## Notes
- Light theme is the default; the dark-mode choice persists in `localStorage` (`bethub_theme`).
- Routes are lazy-loaded; `hls.js` and `livekit-client` ship as separate chunks.
- LiveKit playback is lazy-loaded by the live player; the stream desk publishes the host camera, microphone and screen through a LiveKit room.
- View counts are recorded once per browser session per match (`sessionStorage`).
- Admin credentials are configured on the backend (default `admin@bethub.com` / `Bethub@123`).
- The realtime ops centre lives at `/admin/ops` and listens to `ops:pulse`, `admin:presence`, `ops:audit`, `ops:task`, `ops:flag`, `ops:chat` and `ops:limits`.
- Admins can raise or lower the live-video window and upload limits in `/admin/settings`; `settings:limits` is broadcast to every open client immediately.
- Press `Ctrl+K` (`Cmd+K` on macOS) anywhere in the admin to open the command palette.
- See the root `README.md` for full setup, environment variables, and API details.
