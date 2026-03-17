# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shiba is a Hack Club game development program where teenagers build games in Godot and construct a physical arcade in Tokyo. The repo is a monorepo with multiple independent services.

## Repository Structure

| Directory | Tech | Purpose |
| --------- | ---- | ------- |
| `api/` | Go 1.24 | Backend API — file uploads/serving via Cloudflare R2 |
| `site/` | Next.js 16, JS | Main game platform (auth, games, shop, analytics) |
| `countdown/` | Next.js 16, TS | Countdown timer to next program milestone |
| `hackatimeSync/` | Node.js/Express | Syncs Hackatime coding activity → Airtable |
| `gitSync/` | Python/Flask | Analyzes GitHub commits → Airtable |
| `playtestScript/` | Python | Admin scripts for challenges and active users |
| `wiki/` | MediaWiki | Program wiki |

## Commands

### API (Go)

```bash
cd api
go run main.go          # Run locally (port 3001)
go build -o server ./main.go
docker-compose up -d    # Deploy via Docker
```

### Site (Next.js)

```bash
cd site
pnpm install
pnpm dev                # Dev server (port 3000)
pnpm build
pnpm lint
pnpm test               # Run tests (site/components/__tests__/)
```

Required env vars in `site/.env`:
```
AIRTABLE_API_KEY=...
AIRTABLE_BASE_ID=...
```

### Countdown

```bash
cd countdown
pnpm dev
pnpm build
pnpm lint
```

### HackatimeSync

```bash
cd hackatimeSync
npm install
npm start               # Port 3001
npm run dev
```

### GitSync

```bash
cd gitSync
pip install -r requirements.txt
python main.py          # Single run
python server.py        # Continuous server (port 3002)
```

## Architecture

### Data Layer — Airtable

All persistent data lives in Airtable (not a traditional database). The Go API and Next.js site both interact with Airtable directly via API keys. Key tables: Users, Games, Posts, Transactions, Orders, Shop, Playtests, Ships, Releases, OTP. Schema is in `docs/schema.md`.

### File Storage — Cloudflare R2 (S3-compatible)

Game files (zip archives) and misc uploads are stored in R2. The Go API handles all uploads/downloads. Game zips are extracted and served as static files from R2.

### Authentication

OTP-based email auth + Slack OAuth. Session token is stored in `localStorage` (no server sessions). Every API route expects the token in the POST **body** as `req.body.token` — not in headers or cookies. The `site/pages/api/` directory contains 40+ Next.js API routes that act as a BFF (backend-for-frontend), proxying Airtable calls with auth checks.

### Airtable Security

All user-supplied strings inserted into Airtable formula filters must be wrapped with `safeEscapeFormulaString()` from `site/pages/api/utils/security.js` to prevent formula injection. Also in that file: `generateSecureRandomString()`, `isValidEmail()`, `isValidUrl()`, `sanitizeHtml()`.

### Game Hosting

Godot games are uploaded as zips → extracted to R2 → served via the Go API. The Next.js site adds special CORS headers (`Cross-Origin-Embedder-Policy: credentialless`, `Cross-Origin-Opener-Policy: same-origin`) on game routes so Godot WASM games can run in the browser. These headers are set in both `site/next.config.mjs` and `site/middleware.js`.

### Sync Services

- `hackatimeSync` runs every 5 minutes, pulling coding time from Hackatime API and writing to Airtable
- `gitSync` runs every 60 seconds, cloning game repos and analyzing commits between Airtable "posts"

## Key Files

- `api/main.go` — API entry point: S3 client init, Chi router setup, CORS, security headers
- `api/handlers/gameUpload.go` — Zip upload + extraction with path traversal protection
- `site/next.config.mjs` — Cross-origin isolation headers for Godot games
- `site/middleware.js` — Security headers for API routes and game pages
- `site/pages/api/` — All Next.js API routes (auth, games, shop, playtests)
- `site/pages/api/utils/security.js` — Airtable formula escaping + input validation utilities
- `site/pages/api/utils/rateLimit.js` — In-memory rate limiting (resets on server restart)
- `site/jsconfig.json` — Path alias: `@/` maps to `site/` root
- `docs/schema.md` — Airtable table/field schema reference
