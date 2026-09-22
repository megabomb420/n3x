# Handoff — 'N3X public 403

Written 22 Sep 2026. Repo: https://github.com/megabomb420/n3x
Live site: https://n3x.grok.me/
Issue: https://github.com/megabomb420/n3x/issues/1

The product works in the Grok preview. The **published** site does not load club or meta. Do not invent stats, an API key, or a fake roster to hide that.

## 2026-09-22 (evening): BTN is unreachable from any host — rebuilding on the official API

Measured, not assumed (all from this machine):

- The published site is a **stale build**: `/btn-src/club/2JYGUQ2P8` answers 404, while a local `npm run build` of `main` emits exactly that rewrite (`.vercel/output/config.json`), and its asset hashes differ from the live ones. A republish is needed regardless.
- **Every datacenter egress is challenged.** `brawltime.ninja` (and `starlist.pro`, `brawlytix.com`, `brawlify.com`, `docs.royaleapi.com`) return `403 cf-mitigated: challenge` for `/club/*`, `/profile/*`, `/api/trpc/auth.getToken`, `cube.brawltime.ninja`, `/api/*`, `.json` variants and even `/favicon.ico` — only `/robots.txt` passes. Tested from: Cloudflare Workers, GitHub Actions (Azure, `52.186.174.150`), `r.jina.ai`, Vercel (per the 403 the live site already showed). A Chrome UA, HEAD, trailing slashes, `www.`, `http://` and Accept variations all fail.
- BTN sends **no CORS headers** on either endpoint, so a browser cannot read them cross-origin either — the fetch must leave from a non-datacenter IP, which no hosted free option provides.
- Consequence: the relay that briefly existed here (a PC + cloudflared quick tunnel registered into a `n3x-btn` Worker) was **removed**. A hosted replacement cannot use BTN at all.

### What replaces it

`api.brawlstars.com` is **not** challenged from datacenter IPs (`403 accessDenied` = missing key, not a challenge), and since 2026-05 the player payload carries Ranked fields (`rankedElo`, `rankedName`, `rankedRank`, `highestAllTimeRanked*`). Its keys are IP-locked, so the Worker calls it through RoyaleAPI's documented public proxy (`bsproxy.royaleapi.dev`) and the key whitelists *their* IPs.

- New backend: `worker/` → deployed as `n3x-api` (`https://n3x-api.whip-blanket.workers.dev`), KV namespace `n3x-relay` reused as the roster-snapshot / join-leave store. Surface: `GET /club`, `GET /player/<tag>`, `GET /ladder?type=players|clubs`, `GET /maps`, `GET /health`. It maps upstream payloads into the app's existing `ClubLive` / `PlayerProfile` shapes, so `src/lib/club/types.ts` stays the contract.
- Requires one secret the owner creates: `BRAWL_API_KEY` (`developer.brawlstars.com`), with RoyaleAPI's proxy IPs whitelisted on it. Set it with `npx wrangler secret put BRAWL_API_KEY --config worker/wrangler.jsonc` (the key itself belongs in the Supercell portal and in Cloudflare, never in git). Until it is set, every data endpoint answers `503 upstream-denied` — honest, not a fake roster.
- **Feature consequence:** BTN's Cube aggregates (the Meta tab's win/pick rates and league-floor filters) exist nowhere else and are unreachable from a hosted app. Meta becomes the official leaderboards (`/rankings/...`), Maps becomes the live rotation (`/events/rotation`). Club, member pages (including Ranked Elo chips) and the join/leave log stay intact.
- The app half of that rewrite is done — see the next section.


## Product

### 2026-09-22 (night): the app is off BTN and hosted

The client no longer knows Brawl Time Ninja exists.

- `src/lib/api/client.ts` is the only data path: `apiGet()` against the `n3x-api` Worker, with honest messages per failure (`upstream-denied` → "Data source is not configured yet (the backend is missing its API key)").
- `src/lib/club/queries.ts` is a thin fetch plus the 45s club / 60s player caches and the last-good-payload fallback; the pure display helpers moved to `src/lib/club/format.ts`.
- Deleted with the BTN path: `src/lib/http/{btn-client,outbound}.ts`, `src/lib/club/parse.ts`, `src/lib/meta/{cube,token,queries,creators,reddit,seasons,scoring}.ts`, `src/store/filters.ts`, and the screens/routes that fed on Cube aggregates (Meta, Brawlers, Lists, map detail, filter bar, search overlay, tier badges, creator/reddit strips).
- New screens: **Ladder** (`GET /ladder?type=players|clubs`, official top-200, order preserved) and **Maps** (`GET /maps`, the live event rotation). Nav is Club / Ladder / Maps; `src/routes/about.tsx` documents the new sources and the limits.
- The join/leave log now lives entirely in the Worker's KV store, so it is shared and survives a closed browser.
- `scripts/worker-mapping.test.mjs` pins the mapping layer (club, player with Ranked fields, battle log with `soloRanked`, leaderboards, roster diff, tag normalisation) against documented payload shapes — 6 tests, no network.

### Hosting

- Prerendering is on for `/`, `/ladder`, `/maps`, `/about`: the nitro/vercel preset builds the document inside its function, so a static host would otherwise have no `index.html`. Data still arrives on the client after hydration; member deep links land on each host's 404 fallback.
- The router takes its `basepath` from `import.meta.env.BASE_URL`, so the same source serves `/` (Cloudflare Pages, Vercel, the Worker) and `/n3x/` (GitHub Pages project site).
- `npm run build:pages` builds with `--base=/n3x/` and runs `scripts/static-fallback.mjs`, which copies the document to `404.html` and adds `.nojekyll`.
- GitHub Pages is enabled on the repository (`build_type: workflow`); `.github/workflows/pages.yml` builds and deploys on every push to `main`. Cloudflare Pages project `n3x` serves the root-based build at https://n3x-dk5.pages.dev.
- `scripts/with-app-env.mjs` now spawns npm's `.cmd` shims through a shell on Windows (with the command line built as one string, so Node's DEP0190 stays quiet), which is what makes `npm run dev`/`build` work outside the Linux sandbox.

Verified so far: `tsc --noEmit` clean; the 6 mapping tests pass; the dev server and the deployed Pages bundle both call the Worker (browser shows `GET /player/2JYGUQ2P8` → 503 → the honest "missing its API key" state, with the Club / Ladder / Maps nav). **Not yet verified: real data end to end — that needs `BRAWL_API_KEY`.**

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
