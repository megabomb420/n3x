# 'N3X

Unofficial companion for the Brawl Stars club **'N3X** (`#2JYGUQ2P8`).

Live: https://n3x-dk5.pages.dev and https://megabomb420.github.io/n3x/

- **Club** — roster, tap a member for trophies / Ranked ELO / recent battles, join & leave log
- **Stats** — the club's own battle logs, or one member's, with a saved time range
- **Meta** — a published S+–D tier list, plus links to the tracked creators
- **Ladder** — official leaderboards, with a region that is saved on the device
- **Maps** — the live event rotation

Not affiliated with Supercell or Brawl Time Ninja.

## Status (2026-09-22)

The app no longer reads Brawl Time Ninja. That site answers every datacenter
request with a Cloudflare challenge — measured from Cloudflare Workers,
GitHub/Azure runners, Vercel and the `r.jina.ai` relay alike (only `/robots.txt`
passes) — and sends no CORS headers, so no hosted build can read it from the
server *or* the browser. The evidence is in `HANDOFF.md`.

Data now comes from the **official Brawl Stars API** through this repository's
own Cloudflare Worker (`worker/`, deployed as `n3x-api`), which also replaces the
old Postgres join/leave store with Workers KV:

- `GET /club` — roster plus the join/leave log (KV snapshot diff)
- `GET /player/<tag>` — profile, brawlers, Ranked Elo, recent battles
- `GET /battles/<tag>` — one member's battles, which the app aggregates into Stats
- `GET /ladder?type=players|clubs&country=global|pl|…` — official leaderboards for one region
- `GET /maps` — the live event rotation
- `GET /tier-list?scope=overall|ranked` — the published tier list (BrawlMetrics), parsed server-side
- `GET /creators` — the tracked creator channels (name, handle, channel URL)
- `GET /creators/<id>` — one channel's recent uploads, classified by title
- `GET /__warm?index=N` — ops: refresh one creator feed into KV (requires the `REGISTER_KEY` header; the same work runs on a 15-minute cron)
- `GET /health` — what the deployment can reach

Five tabs: **Club** (roster, member pages, join/leave), **Stats** (the club's own
battle logs, or one member's, inside a saved time range), **Meta** (a published
S+–D tier list, plus links to seven creator channels), **Ladder** (official
leaderboards for a region saved on the device) and **Maps** (rotation).

The API key is set: an owner-created key at
[developer.brawlstars.com](https://developer.brawlstars.com) whose Supercell-side
allowlist points at RoyaleAPI's published proxy addresses (official keys are
locked to IPs and a Worker has no fixed one). It lives in Cloudflare as the
Worker secret `BRAWL_API_KEY` — never in this repository. To replace it:
`npx wrangler secret put BRAWL_API_KEY --config worker/wrangler.jsonc`, then
delete the old key in the portal. Without a key every data endpoint answers
`503 upstream-denied` and the app says exactly that instead of showing numbers.

Hosting: `.github/workflows/pages.yml` publishes the static build to GitHub
Pages under `/n3x/`, and the Cloudflare Pages project `n3x` serves the
root-based build. Both are prerendered shells — data always arrives on the
client from the Worker.

## Stack

TanStack Start, React 19, Tailwind v4, deployed as a prerendered static build.
The backend is a Cloudflare Worker (`worker/`) with Workers KV for the club
snapshot and join/leave log; PGlite/Neon are no longer used by the app.
