# CDL Exchange

B2B SaaS marketplace for buying and selling verified CDL driver leads.

## Stack

- **React 19** + **TypeScript**
- **Vite** — dev server & production builds
- **React Router** — client-side routing
- **Chart.js** — dashboard sparklines
- **Lucide React** — icons

## Getting started

```bash
npm install
cp .env.example .env   # then paste your NEW marketplace project keys
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Supabase (new marketplace project)

This app should use a **separate** Supabase project from CDL Score.

### 1. App connection (Vite / React)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your **new** CDL Exchange project
2. Go to **Project Settings → API**
3. Copy **Project URL** and **anon public** (or publishable) key
4. Create `.env` in the project root:

```env
VITE_SUPABASE_URL=https://YOUR_NEW_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your_key_here
```

5. Restart `npm run dev` after saving `.env`

The client is initialized in `src/lib/supabase.ts` (`supabase` export).

### 2. Cursor MCP connection (for AI / migrations in IDE)

Cursor MCP is configured for marketplace project **`sksgjokkcfnmdgvsmvdn`** in `~/.cursor/mcp.json`.

If MCP tools stop working after a config change, **reload Cursor** or toggle the Supabase MCP server in **Settings → MCP**, then re-authenticate if prompted.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview production build locally |

## Project structure

```
src/
  components/layout/   # App shell, sidebar, topbar, modal, toasts
  context/             # Global app state (purchases, modals, search)
  data/                # Seed driver & dashboard data
  lib/                 # Formatters and shared UI helpers
  pages/               # Route-level page components
  index.css            # Design system (from prototype)
```

## Routes

| Path | Page |
|------|------|
| `/` | Dashboard |
| `/marketplace` | Browse & filter drivers |
| `/drivers/:id` | Driver detail |
| `/sell` | List a driver (multi-step form) |
| `/my-listings` | Manage listings |
| `/purchased` | Purchased leads |
| `/deals` | Escrow & deal tracking |
| `/disputes` | Dispute center |
| `/messages` | Messaging |
| `/profile` | Company profile |
| `/pricing` | Plans & billing |
| `/compliance` | Compliance center |
| `/settings` | Account settings |
| `/admin` | Admin panel |

## Legacy prototype

The original single-file prototype is preserved as `cdl-exchange-prototype.html` for reference.
