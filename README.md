# 'N3X

Unofficial companion for the Brawl Stars club **'N3X** (`#2JYGUQ2P8`).

Live public build: https://n3x.grok.me/

- **Club** — roster, tap a member for trophies / Ranked ELO / recent battles, join & leave log
- **Meta** — Ladder vs Ranked, separate filters (Ranked uses league / ELO floors, not brawler trophies)
- **Maps** — current maps and best brawlers

Not affiliated with Supercell or Brawl Time Ninja.

## Known production bug

On the **published** site, club and meta both fail:

- Club: `Source unavailable (403)`
- Cube token: `Token source unavailable (403)`

Root cause, measured 2026-09-22: `brawltime.ninja` returns `403 cf-mitigated: challenge` to **every** datacenter egress — Cloudflare Workers, GitHub Actions/Azure, `r.jina.ai` and Vercel alike (only `/robots.txt` passes) — and sends no CORS headers, so a hosted app cannot read it from the server *or* the browser. The published build is also stale: `/btn-src/*` 404s although the current source builds that rewrite.

The replacement backend is `worker/` (deployed as `n3x-api`), built on the **official** Brawl Stars API (`api.brawlstars.com`, reached through RoyaleAPI's public proxy because official keys are IP-locked) with the join/leave log in Workers KV. It needs the owner's `BRAWL_API_KEY` secret; see `HANDOFF.md` for the current state, the exact commands and the feature consequences (BTN's Cube aggregates are unreachable from any host).

See `worker/index.js` for the API surface and `src/lib/club/queries.ts` for the still-current BTN path.

## Stack

TanStack Start, React 19, Tailwind v4. Club join/leave diffs are stored in Postgres (Neon when `DATABASE_URL` is set, otherwise embedded PGLite in dev only).
