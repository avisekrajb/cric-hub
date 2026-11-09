# Stumps · live cricket site + admin dashboard

React + Vite + Tailwind. Data lives in `localStorage` and syncs across tabs of the same browser.

## Run

```bash
npm install
npm run dev
```

Open the printed URL. Click **Admin** at the bottom of any page.

**Demo admin login:** `a@gmail.com` / `123456` (checked in the browser only; change it in `src/constants/admin.js`).

## Structure

- `src/constants` – admin creds, storage keys, seed data, tab list
- `src/lib` – helpers, scoring engine (`ball()`), icons, `cn`
- `src/hooks` – `useStore` (localStorage + cross-tab sync), `useAdminSession`
- `src/components` – shared pieces; `ui/` has Button, Field, Segmented, Modal, Card
- `src/pages` – viewer pages and login modal
- `src/admin` – admin app, tabs and scoring widgets
- `src/layout` – SideNav, TopBar, Footer
- `src/index.css` – Tailwind directives plus the shared component classes

## Notes

- Shared component classes in `index.css` are written as plain CSS after the Tailwind directives so they are never purged. Tailwind utilities are still available in any component.
- This is a demo: there is no server, so the admin login is not secure and data is per browser.
- Replace the placeholder YouTube IDs in `src/constants/seed.js`, or paste a live ID in Admin > Scoring.
