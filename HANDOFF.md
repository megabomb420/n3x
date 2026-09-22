# Handoff — 'N3X public 403

Written 22 Sep 2026. Repo: https://github.com/megabomb420/n3x
Live site: https://n3x.grok.me/
Issue: https://github.com/megabomb420/n3x/issues/1

The product works in the Grok preview. The **published** site does not load club or meta. Do not invent stats, an API key, or a fake roster to hide that.

## Product

Unofficial companion for Brawl Stars club **'N3X**, tag `#2JYGUQ2P8`. Not affiliated with Supercell or Brawl Time Ninja.

| Tab | Route | Job |
|---|---|---|
| Club | `/` | Live roster. Tap a member (`/m/$tag`) for trophies, Ranked ELO, top brawlers, recent battles. Join/leave log. |
| Meta | `/meta` | Ladder vs Ranked, kept separate. Ranked filters are league floors (Gold+ … Masters+), **not** brawler trophies. |
| Maps | `/maps` | Maps with recent battles and best brawlers. |

Auth is off. Database is on, rows unowned (no `user_id`). Schema: `migrations/0002_club_activity.sql` (`club_snapshot`, `club_events`). First visit stores a baseline roster. Later diffs become join/leave/role events. Do not import `authMiddleware`.

Stack: TanStack Start, React 19, Tailwind v4, Vite, Nitro preset `vercel`. App shell is a locked `100svh` column: header and nav do not scroll, only `<main>` does. Do not switch that to `position: fixed` or document scroll — iPhone already clipped the top and left a dead band at the bottom.

## What is broken

On https://n3x.grok.me/ the shell renders and then:

- Club: `Source unavailable (403)`
- Meta token: `Token source unavailable (403)`

Those strings are thrown by our code when the upstream HTTP status is 403. The HTML document itself is fine. The failing calls are TanStack server functions under `/_serverFn/…`.

Same requests from a normal network return **200**:

```
GET  https://brawltime.ninja/club/2JYGUQ2P8
POST https://brawltime.ninja/api/trpc/auth.getToken
     Content-Type: application/json
     body: {"json":null}
```

Club HTML contains `<script id="vike_pageContext" type="application/json">`. That blob is the roster (`refs.club`). Player pages (`/profile/{TAG}`) put the player in the Vike pinia payload (`brawlstars.player`). Parser: `src/lib/club/parse.ts`.

The club page sends **no CORS headers**. A phone cannot `fetch("https://brawltime.ninja/...")` from `n3x.grok.me`.

Cloudflare in front of brawltime.ninja rejects the published host's Node/serverless IP. A Chrome User-Agent does not fix that. There is no missing secret. The Cube JWT is public and only contains `{iat, exp}` (~1 hour).

Official `api.brawlstars.com` needs a personal API token we do not have and must not invent. BrawlAPI (`api.brawlapi.com`) has brawlers and maps, not clubs or players.

## What already works (leave it)

- Preview loads 28 members, member pages, Ladder meta, Ranked ELO chips.
- Ranked cube field `trophyRange` on `powerplay=1` is a **league index 1–22** (Bronze I → Pro), not trophies/100. Floors used as labels only: Gold 1500, Diamond 3000, Mythic 4500, Legendary 6000, Masters 8250. Mapping in `src/lib/meta/cube.ts` (`LEAGUE_IN`). Raw per-point ELO is not published.
- Ladder still uses 100-trophy buckets.
- Tier score is sample-aware. LOW samples cannot be S/A. Do not invent creator S–D boards. Creator strip is YouTube RSS titles + dates only (`src/lib/meta/creators.ts`).
- Join/leave is a snapshot diff, not a live "who left" API. Empty until a second roster differs from the first saved snapshot.

## What was already tried

All of this is on `main`. The published site was still 403 the last time it was opened, so either that deploy predates this code or the edge is blocked too. **Confirm which build is live before adding another proxy.**

1. `src/lib/http/outbound.ts` — server fetch with a Chrome UA. On 403, spawn `curl` (different TLS fingerprint). Vercel serverless has no `curl`. Datacenter IP is still blocked.
2. `src/lib/http/btn-client.ts` — in production the browser tries, in order:
   - same-origin `GET/POST /btn-src/...`
   - `https://r.jina.ai/https://brawltime.ninja/...` (HTML only)
   - `https://api.cors.lol/?url=...`
3. `vite.config.ts` Nitro `routeRules`: `/btn-src/**` proxies to `https://brawltime.ninja/**`. Dev Vite has the same proxy. Idea: the phone talks to our origin, the CDN fetches BTN. If Cloudflare blocks Vercel edge IPs as well, this still 403s.
4. `loadClubHome` / `loadClubPlayer` / `resolveCubeToken` try the browser path first when `import.meta.env.PROD`.

`jina.ai` and `cors.lol` are third-party relays. They are not a fix. They break, change HTML, and should not be the production path. Do not add more open proxies.

## Where to change code

| File | Role |
|---|---|
| `src/lib/http/outbound.ts` | Server fetch + curl fallback |
| `src/lib/http/btn-client.ts` | Browser attempts |
| `src/lib/club/queries.ts` | `getClubHome` / `getClubPlayer` server fns, `fetchHtmlSmart`, snapshot diff |
| `src/lib/club/parse.ts` | vike HTML → club + player |
| `src/lib/meta/token.ts` | Cube JWT |
| `src/lib/meta/cube.ts` | Cube queries, league index map |
| `vite.config.ts` | `/btn-src` proxy. Keep port `0.0.0.0:8080` for preview and Nitro `serverDir: "./server"`. |

## Constraints

- Do not invent rankings, sample sizes, or a club roster.
- Do not add a Brawl Stars API token unless the owner provides one.
- Do not turn auth on. Do not call `authMiddleware` / `requireUserId`.
- Do not hide the "Created with Grok" pill.
- Do not put `og:*` tags in `src/routes/__root.tsx` (the PWA plugin overwrites them).
- PGLite in the **built** Vercel preview crashes looking for `pglite.data`. `persistAndDiff` skips the DB when `PROD && !DATABASE_URL`. Real Neon (`DATABASE_URL` on deploy) is the join/leave store. Dev PGLite is fine.
- `npm run dev` only, never raw `vite`. `startup.sh` must stay.

## Suggested next step

1. Open https://n3x.grok.me/ and check whether `/btn-src/club/2JYGUQ2P8` returns the vike HTML or another 403. That single request tells you if the edge proxy works.
2. If 200 and the body contains `vike_pageContext`, the client path in `btnGetHtml` should already populate the club once this commit is what is deployed. Then check `POST /btn-src/api/trpc/auth.getToken` with `{"json":null}` for meta.
3. If the edge proxy is also 403, stop adding User-Agents. The fetch has to leave from an IP Cloudflare allows:
   - a tiny proxy the owner runs (home machine, or any non-blocked host) that GETs the two BTN URLs and returns the body, or
   - a Brawl Stars API token from the owner, used only server-side.
4. Re-test the public site, not only the preview. Preview success does not mean the publish works.

## How to verify

Preview: club home shows members (about 28), search filters them, a member page shows trophies and a Ranked ELO number, Meta shows Ladder rows and a Ranked tab with ELO chips, console has no uncaught errors.

Public: https://n3x.grok.me/ must show the same roster, not `Source unavailable (403)`. Meta must show battle rows, not an empty filter bar.
