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

The preview (this machine) can fetch `https://brawltime.ninja/club/2JYGUQ2P8` and `POST https://brawltime.ninja/api/trpc/auth.getToken` and gets HTTP 200. The same requests from the Vercel server that hosts `n3x.grok.me` come back **403**. Cloudflare in front of Brawl Time Ninja is rejecting the datacenter IP. The HTML page has no CORS headers, so the browser cannot fetch it directly either.

See `src/lib/club/queries.ts` (`fetchHtml`) and `src/lib/meta/token.ts`.

## Stack

TanStack Start, React 19, Tailwind v4. Club join/leave diffs are stored in Postgres (Neon when `DATABASE_URL` is set, otherwise embedded PGLite in dev only).
