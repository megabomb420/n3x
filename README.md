# 'N3X

Unofficial companion for the Brawl Stars club **'N3X** (`#2JYGUQ2P8`).

Live public build: https://n3x.grok.me/

- **Club** — roster, tap a member for trophies / Ranked ELO / recent battles, join & leave log
- **Meta** — Ladder vs Ranked, separate filters (Ranked uses league / ELO floors, not brawler trophies)
- **Maps** — current maps and best brawlers

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
- `GET /ladder?type=players|clubs` — official leaderboards
- `GET /maps` — the live event rotation
- `GET /creators` — the tracked creator channels (name, handle, channel URL)
- `GET /creators/<id>` — one channel's recent uploads, classified by title
- `GET /__warm?index=N` — ops: refresh one creator feed into KV (requires the `REGISTER_KEY` header; the same work runs on a 15-minute cron)
- `GET /health` — what the deployment can reach

Five tabs: **Club** (roster, member pages, join/leave), **Stats** (the club's own
battle logs — sample sizes shown, no global rates exist), **Meta** (seven creator
channels: tier-list uploads, an "everything" view and a count of brawler names in
the last month's titles), **Ladder** (official leaderboards) and **Maps**
(rotation).

One owner step remains: create an API key at
[developer.brawlstars.com](https://developer.brawlstars.com), whitelist
RoyaleAPI's published proxy addresses (official keys are locked to IPs and a
Worker has no fixed one), then run
`npx wrangler secret put BRAWL_API_KEY --config worker/wrangler.jsonc`.
Until it is set, every data endpoint answers `503 upstream-denied` and the app
says exactly that instead of showing numbers.

Hosting: `.github/workflows/pages.yml` publishes the static build to GitHub
Pages under `/n3x/`, and the Cloudflare Pages project `n3x` serves the
root-based build. Both are prerendered shells — data always arrives on the
client from the Worker.

## Stack

TanStack Start, React 19, Tailwind v4, deployed as a prerendered static build.
The backend is a Cloudflare Worker (`worker/`) with Workers KV for the club
snapshot and join/leave log; PGlite/Neon are no longer used by the app.
