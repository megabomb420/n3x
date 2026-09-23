# Handoff — 'N3X club companion

Started 22 Sep 2026, last updated 23 Sep 2026. Repo: https://github.com/megabomb420/n3x

## Current status (23 Sep 2026)

Live on free hosting, with nothing of the owner's running:

- https://n3x-dk5.pages.dev — Cloudflare Pages, root base
- https://megabomb420.github.io/n3x/ — GitHub Pages under `/n3x/`, published by `.github/workflows/pages.yml` on every push to `main`
- https://n3x-api.whip-blanket.workers.dev — the backend Worker; `/health` says whether its API key is configured. Surface: `GET /club`, `/player/<tag>`, `/battles/<tag>`, `/ladder?type=players|clubs&country=…`, `/maps`, `/tier-list?scope=overall|ranked`, `/creators`, `/creators/<id>`, and the guarded `/__warm?index=N`.

Five tabs plus **Settings**: **Club**, **Stats**, **Meta**, **Ladder**, **Maps**, and a settings screen (language English/Polski using the game's own Polish names, export/import/reset of this device's saved data, and the build version against `version.json` so an old shell can tell it is behind). Club, player, ladder and map data come from the official Brawl Stars API through the Worker; the tier list is parsed from BrawlMetrics' public table and re-read about every 15 minutes; creator links come from public YouTube feeds. Nothing reads Brawl Time Ninja any more.

Owner decision (23 Sep 2026): **delete / throw away** the old Grok/Vercel host https://n3x.grok.me/ — it still serves a stale build, nothing in this app points at it, and it must not stay as a live URL. Do not republish or link it. Issue #1 carries the closing summary of the old 403 era; history below is provenance only.

Everything below the history marker is the record of how the app got here — starting with the original Grok-export handoff and its BTN 403 investigation. Those sections describe a state that no longer exists; read them as provenance, not as instructions.

## GitHub checkout repair (23 Sep 2026)

The GitHub checkout does not contain Grok's ignored `.grok/app-env.json` or `.grok/skills/og/`. Previously `npm run build` without an explicit flag silently compiled `VITE_AUTH_ENABLED` as unset, which the auth helpers interpret as **on** even though this app does not use accounts. `scripts/with-app-env.mjs` now defaults that flag to `"false"` before applying any file or process overrides; explicit opt-in still wins. GitHub Pages already supplied `"false"` in its build job, but a local/Cloudflare build no longer needs a sandbox-only file to get the same result.

The old `npm test` failure was a test-fixture problem, not 18 product failures: the PWA suite silently read this app's `src/lib/og/site.json` and `public/og.jpg`, other tests expected the missing `.grok` skills or an empty migration directory, and two directory-symlink tests needed privileges Windows does not grant. General PWA tests now use an empty fixture root, CLI/env/migration tests use isolated workspaces, Windows uses directory junctions, and four tests that merely parsed absent skill prose were deleted rather than skipped or re-pinned. **Verified here:** `npm test` passes 205 script tests + 71 TypeScript tests (276 total, zero failures); `npm run typecheck`, `npm run build:pages`, and `npm run build` pass.

The production-browser check caught a real deep-link bug that the root-only smoke missed. On a static host, `/settings` redirects to `/settings/`; with an installed service worker, navigating to `/settings` received the **cached Club HTML** while the client rendered Settings, throwing React hydration error #418. The same happened for Stats, Meta and Data. `public/sw.js` now follows the redirect with a normal same-origin GET, strips the redirected response flag for iOS standalone, caches each successful document at its own request URL rather than replacing the root shell, and bumps the shell cache to v3. The router emits canonical trailing-slash links; all typed Link callers were migrated. `scripts/sw-navigation.test.mjs` covers the redirect, route-specific cache and flag stripping. Verified in a 390×844 production browser: Settings link is `/settings/`; after the worker controls the tab, a direct `/settings` request returns **Settings HTML** (not Club) with zero hydration errors, and offline revisit returns the cached Settings document. Offline JS assets are **not** precached, so that last check is evidence for the HTML cache only, not a promise that the entire app works offline.

The iOS 26 band remains **unverified after the already-shipped `black` status-bar change**: no new physical-device probe was supplied. [Apple's Safari reference](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html) says both `black` and `default` place web content below the status bar, but that is not evidence for the installed iOS 26 app; do not publish another viewport guess as a fix. Portrait lock is still a WebKit/standalone limitation. The owner will unpublish `n3x.grok.me` personally; this work does not touch that host. A push to `main` automatically updates GitHub Pages; Cloudflare Pages requires its own deploy and is not updated here.

## History

### Original handoff (22 Sep 2026): the published site did not load club or meta

The product worked in the Grok preview while the **published** site at https://n3x.grok.me/ did not load club or meta. Do not invent stats, an API key, or a fake roster to hide that.

### 2026-09-22 (evening): BTN is unreachable from any host — rebuilding on the official API

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


### 2026-09-22 (later): the Meta tab is back, built from the club's own battle logs

The ranked/meta screens originally read Brawl Time Ninja's Cube aggregates. Those stay unreachable from any hosted build, and the official API publishes no global win or pick rates, so Meta was rebuilt around data this app can actually source: **the members' own recent battles**.

- `GET /battles/<tag>` returns one member's mapped battles (a single upstream call, edge-cached for five minutes). `mapBattles` gained `type` and `competitive` so the app can keep friendlies, challenges and event modes out of the numbers.
- The aggregation runs in the browser, not the Worker: one Worker invocation's subrequest budget is far below 28 battle logs (a 28-log batch answers `Too many subrequests by single Worker invocation`). The app requests six members at a time, caches each log for five minutes and the aggregate for ten.
- `src/lib/meta/club-stats.ts` is the pure arithmetic (directly tested in `club-meta.test.ts`); `src/lib/meta/club-meta.ts` is the loader. *(Both moved to `src/lib/club/stats.ts` and `src/lib/club/stats-loader.ts` in the tab split below.)*
- The tab shows All / Ladder / Ranked with their counts, a battles / wins / win-rate / members / window summary, a brawler table with portraits, win-rate bars, net trophies and a `small sample` badge under five picks, plus mode and map breakdowns. Navigation is four tabs and `/meta` is prerendered.

First live numbers (2026-09-22, club of 28): 437 competitive battles in the members' logs — 344 ladder, 93 Ranked — 64% club win rate, window 09/08 → 22/09. Verified in a real browser on Cloudflare Pages and GitHub Pages; the last table row sits above the nav (measured, after a `fullPage` screenshot suggested otherwise).

What it is not: a global tier list. Every row carries its own sample size, and the screen says so. A battle the API published no trophy change for is excluded from that column rather than counted as a zero — a row where none carried one reads as a dash; the client cache keys carry a version so an older stored shape is never re-read.

### 2026-09-22 (later still): the tab split — Stats for the club, Meta for the creators

The owner meant the *game's* meta by "Meta", so the club numbers moved to **Stats** and **Meta** is now the creator board:

- `GET /creators` first shipped as one call over SpenLC, Ash, KairosTime and CryingMan (four subrequests) and was later split — see the extras below.
- The Meta screen shows those uploads with thumbnails, kind badges and dates, plus chips for brawlers named in the titles (matched against the BrawlAPI catalog). **Placements inside a video are never transcribed** — the app cannot see them.
- Naming: `src/components/stats-screen.tsx` + `src/routes/stats.tsx` + `src/lib/club/stats.ts` (pure arithmetic) and `src/lib/club/stats-loader.ts`; the creator board lives in `src/lib/meta/creators.ts` + `src/components/meta-screen.tsx`. Navigation is five tabs, `/stats` and `/meta` are both prerendered, and `Stats` never claims to be global.
- Tests grew to ten in `scripts/worker-mapping.test.mjs` (creator title classification and feed parsing among them) plus the club-stats arithmetic tests.
- **Extras the owner asked for:** three more verified channels (Rey, Lex, bobby — each checked for a real channel id and a live feed; several candidates were dropped because their feeds are empty or stale), a `Tier lists` / `Everything` filter, and a "Named most in titles" board counting brawler names across the last 30 days of headlines.
- The backend was reshaped for that: `GET /creators` is now just the index of channels and `GET /creators/<id>` answers one feed, because a single Worker invocation could not hold seven feeds inside its subrequest budget (the same reason `/battles/<tag>` exists). The app fans out four at a time and caches each channel for half an hour.
- Lead-video choice, the filter and the mention counting live in `src/lib/meta/creator-math.ts` (pure, tested in `creator-math.test.ts`). The edge `CACHE_VERSION` is 4 and the client keeps its own `CACHE_TAG` (also 4) in the request URLs, so neither layer re-serves a payload from an older release.
- **YouTube throttles the edge addresses.** A feed that answers `200` from a home connection answers `429` from the Worker (verified side by side), so seven channels fetched on one page view left cards empty. Mitigations in place: one short retry inside `creatorFeed`, each channel's last good reading kept in KV for six hours and served as `stale: true` when a refresh fails (the card then says "showing the last reading from …"), a `*/15` cron that warms one channel per run instead of bursting, and a guarded `GET /__warm?index=N` for on-demand warming (its key is the `REGISTER_KEY` secret; the local copy lives in the git-ignored `worker/.dev.vars`).
- **A failed read is never cached.** A `429` stored by the browser kept a card empty for half an hour after YouTube answered again; only successful readings are kept now, and a failed refresh falls back to the Worker's KV copy instead. That, plus the retry above, is why the board survives the throttling.

### 2026-09-22 (late): live on the official API

`BRAWL_API_KEY` is set on the Worker — the owner's key, whose `cidrs` limit it to RoyaleAPI's proxy address. Verified against the live Worker and both hosts:

- `GET /club` → 'N3X, 28 members, 3,532,223 trophies, the first snapshot stored (`baseline:true`), `source: "Supercell Brawl Stars API"`.
- `GET /player/PCRRUPUCP` → 161,930 trophies, Ranked 3,575 ELO / DIAMOND II, peak 7,481 / LEGENDARY II, ALIEN FAME II, 107 brawlers with hyper-charge flags, 25 battles with mode, map, brawler and result, `inClub:true`, role `senior`.
- `GET /ladder?type=players` → 200 rows in the API's order; `GET /maps` → 13 live events.
- Club, member page, Ladder and Maps render that data on https://n3x-dk5.pages.dev and https://megabomb420.github.io/n3x/ .

Three mapping bugs the live payloads exposed, each now covered by a test:

- `/events/rotation` answers with a **bare array** of `{startTime,endTime,slotId,event:{mode,map}}`, not `{active,upcoming}`; the live/upcoming split is done against the clock in `mapRotation()`.
- The Ranked fields are `rankedRankName` and `highestAllTimeRankedRankName`, not `rankedName`.
- Names carry colour markup (`<c7>Pikachu</c>`); `plainName()` strips it from club, member, player and leaderboard names.

The edge-cache key now carries `CACHE_VERSION`, so a deploy that changes a mapper stops serving the previous shape for the rest of its 15-minute TTL.

### Key handling

`BRAWL_API_KEY` lives in exactly one place: the Worker's `secret_text` binding (`npx wrangler secret list --config worker/wrangler.jsonc`). It is **not** in the repository, not in its history (`git log -S eyJ0eXAiOiJKV1Qi` is empty) and not in the build output — checked after the owner pasted it into a chat session. The owner was offered a rotation and **declined it** (2026-09-22); do not raise it again.

Worth knowing for the next reader: the key's Supercell-side restriction is a `cidrs` entry for RoyaleAPI's proxy address, and the Worker reaches the API *through* that shared proxy. The allowlist therefore matches the proxy rather than this app, so whoever holds the token can use it from that proxy until it is revoked. The owner accepted that risk.

### 2026-09-22 (night): the app is off BTN and hosted

The client no longer knows Brawl Time Ninja exists.

- `src/lib/api/client.ts` is the only data path: `apiGet()` against the `n3x-api` Worker, with honest messages per failure (`upstream-denied` → "Data source is not configured yet (the backend is missing its API key)").
- `src/lib/club/queries.ts` is a thin fetch plus the 45s club / 60s player caches and the last-good-payload fallback; the pure display helpers moved to `src/lib/club/format.ts`.
- Deleted with the BTN path: `src/lib/http/{btn-client,outbound}.ts`, `src/lib/club/parse.ts`, `src/lib/meta/{cube,token,queries,creators,reddit,seasons,scoring}.ts`, `src/store/filters.ts`, and the screens/routes that fed on Cube aggregates (Meta, Brawlers, Lists, map detail, filter bar, search overlay, tier badges, creator/reddit strips).
- New screens: **Ladder** (`GET /ladder?type=players|clubs`, official top-200, order preserved) and **Maps** (`GET /maps`, the live event rotation). Nav is Club / Ladder / Maps; `src/routes/about.tsx` documents the new sources and the limits.
- The join/leave log now lives entirely in the Worker's KV store, so it is shared and survives a closed browser.
- `scripts/worker-mapping.test.mjs` pins the mapping layer (club, player with Ranked fields, battle log with `soloRanked`, leaderboards, roster diff, tag normalisation) against documented payload shapes — 6 tests, no network.

### Hosting

- Prerendering is on for `/`, `/stats`, `/meta`, `/ladder`, `/maps` and `/about`: the nitro/vercel preset builds the document inside its function, so a static host would otherwise have no `index.html`. Data still arrives on the client after hydration; member deep links land on each host's 404 fallback.
- The router takes its `basepath` from `import.meta.env.BASE_URL`, so the same source serves `/` (Cloudflare Pages, Vercel, the Worker) and `/n3x/` (GitHub Pages project site).
- `npm run build:pages` builds with `--base=/n3x/` and runs `scripts/static-fallback.mjs`, which copies the document to `404.html` and adds `.nojekyll`.
- GitHub Pages is enabled on the repository (`build_type: workflow`); `.github/workflows/pages.yml` builds and deploys on every push to `main`. Cloudflare Pages project `n3x` serves the root-based build at https://n3x-dk5.pages.dev.
- `scripts/with-app-env.mjs` now spawns npm's `.cmd` shims through a shell on Windows (with the command line built as one string, so Node's DEP0190 stays quiet), which is what makes `npm run dev`/`build` work outside the Linux sandbox.
- `scripts/build.mjs` ends the build once prerendering is done: the prerenderer finishes and then the process stays alive (its Vite preview server is closed in a `finally`, yet the event loop stays busy), which hung `npm run build` and the whole Pages job. It forwards the build output and ends the child after that output goes quiet; a build that exits on its own keeps its own code.
- `scripts/static-fallback.mjs` prefixes the base onto local `src`/`href` references in every emitted document (the platform head tags are root-absolute) and copies the fallback after that rewrite, so `/n3x/404.html` carries it too.

### Brand assets

`scripts/brand-assets.py` (Pillow) is the only thing that writes the icons and the header mark, all composed from `public/og.jpg` — the one piece of art where the star and the `'N3X` wordmark are stacked with a real gap. The earlier loose PNGs were tight crops: the star's lower point overlapped the wordmark and the wordmark sat on the canvas edge, so every square crop (home-screen icon, 40 px header mark) sliced the text. Outputs: `/icons/n3x-{192,512}.png` and `/icons/n3x-apple-180.png` (lockup at 62% of the canvas), `/icons/n3x-maskable-512.png` (50%, inside the 80% safe circle), `/n3x-mark.png` (star alone, for `ClubLogo` and the player-avatar fallback) and the root `apple-touch-icon.png` fallback. The icon URLs are versioned by *path* (`/icons/…`) on purpose: iOS pins the home-screen icon to the URL it was installed from, so an existing tile must be deleted and re-added to pick up new art. The Grok host also injects `/__grok/manifest.webmanifest` and `/__grok/icon-180.png` after our own tags; both files live in `public/__grok/` and must keep resolving (the manifest used to 404 on Pages).

Verified in this session: `tsc --noEmit` clean; 205 tests (`scripts/**` — ten of them mapping the Worker's payloads — plus the TypeScript suites, with the 18 sandbox-environment failures described below); `npm run build` and `npm run build:pages` clean in about six seconds each; a real browser on both hosts showing the club roster (28 members, 3,532,223 trophies), a member page (Ranked 3,575 Elo / DIAMOND II, 107 brawlers, 25 battles), Stats (436 battles, 64%, small-sample badges), Meta (seven creator channels, tier-list badges, zero feed errors), Ladder (200 rows, markup stripped) and Maps (13 live events) — plus screenshots reviewed for layout, a deep link through the `404.html` fallback, and the Worker's live payloads checked channel by channel.

Earlier in the same session, before `BRAWL_API_KEY` was set: the dev server and both static hosts served the shell and the honest "Data source is not configured yet (the backend is missing its API key)" state — kept here as the record of what the app does when its key is missing.

Historically, `npm test` on this machine had 61 passing TypeScript tests and 18 failing script tests: they depended on Grok's missing `.grok/skills/**` / `.grok/app-env.json`, the repo's changed baked metadata/migrations, or directory-symlink privileges Windows does not grant by default. The earlier quoted test count was from that session. The GitHub checkout repair above removes those failures; do not treat this historical result as the current test state.

Unofficial companion for Brawl Stars club **'N3X**, tag `#2JYGUQ2P8`. Not affiliated with Supercell or Brawl Time Ninja.

| Tab | Route | Job |
|---|---|---|
| Club | `/` | Live roster and join/leave log, then the **Ranked board**: every member's tier and Elo, read from their own profile (lazily, six at a time, when the board is scrolled into view) and sorted by Elo. Tap a member (`/m/$tag`) for trophies, Ranked ELO, top brawlers, recent battles. |
| Stats | `/stats` | What the club plays: brawlers, modes and maps from the members' own battle logs, with queue (All/Ladder/Ranked) and range filters. No Elo here on purpose — Ranked standings are the club tab's board, and the API publishes no per-battle Elo delta. |
| Meta | `/meta` | Ladder vs Ranked, kept separate. Ranked filters are league floors (Gold+ … Masters+), **not** brawler trophies. |
| Maps | `/maps` | Maps with recent battles and best brawlers. |

Auth is off. Database is on, rows unowned (no `user_id`). Schema: `migrations/0002_club_activity.sql` (`club_snapshot`, `club_events`). First visit stores a baseline roster. Later diffs become join/leave/role events. Do not import `authMiddleware`.

Stack: TanStack Start, React 19, Tailwind v4, Vite, Nitro preset `vercel`. App shell is a locked full-height column: `html, body { height: var(--app-h, 100%) }` and the shell is `h-full`, so header and nav do not scroll, only `<main>` does. Do not switch to `position: fixed` or document scroll. `viewport-fit=cover` is required: `.safe-top`/`.safe-bottom` pad with `env(safe-area-inset-*)` (plus 1.6 rem at the top so the header's bright mark and title stay out of the blur band iOS 26 lays over the top of the screen), and they only apply in `display-mode: standalone` so the Grok/Safari webviews, which already sit below the notch, are not double-padded.

**Measured on an iPhone 17 Pro, iOS 26, installed app** (`?diag=1`, one tap from the header pill → About): `inner` `vv` `doc` all **812**, screen **874**, `100lvh` **874**, `svh` `dvh` **812**, `env(safe-area-inset-top)` **62px**, `bottom` **34px**, `standalone true`. So the layout viewport — and every vh unit except `lvh` — is the screen *minus the top inset*, anchored at the top of the screen. A `position: fixed` bar placed at the bottom of `100lvh` is never displayed, so **nothing can be laid out below 812**; the page background still paints down to 874 because that is the canvas, not the layout. Two consequences are baked into the shell: the header deliberately paints under the status bar (`.safe-top` = inset + 1.6 rem keeps its bright mark out of the blur band iOS lays over the top of the screen), and the home-indicator inset lies *below* the paintable area, so reserving it only pushed the tabs ~38 px up into the black — `AppShell` sets `--inset-bottom: 0` when `100lvh` is taller than the visible viewport, and `.safe-bottom` reads that variable. A taller `--app-h` is only ever applied when the *visible* viewport really is taller than the layout viewport, which keeps Safari's collapsing toolbars out of it.

**Stale builds heal themselves.** Every deploy replaces the hashed route chunks, and the installed app can sit open for days — tapping a tab then asks the host for a module it no longer serves, which surfaces as the router's error page with "Importing a module script failed" (Safari's wording; Chrome says "Failed to fetch dynamically imported module"). Two guards, both small: `src/lib/recovery.ts` classifies that error and reloads once (floored at 20 s so a broken deployment cannot trap the app in a loop), and `AppErrorComponent` uses it — the stale case says a new version is being fetched and reloads, everything else gets a Reload button, because the alternative in an installed app is force-quitting it. `components/version-guard.tsx`, mounted in `__root`, compares the host's `version.json` with the compiled `APP_VERSION` whenever the app returns to the foreground and every ten minutes, then steps onto the new build via `refreshServiceWorker()` + one reload. Do not remove either without leaving a way out of a stale chunk; both were verified by deleting a chunk from the served output and by faking a newer `version.json`.

### OPEN: the dead band under the nav (iOS 26 standalone)

**Not solved, and it is the one thing on this app that is not.** Everything here was measured on the user's own iPhone 17 Pro, iOS 26, installed app, through `?diag=1`.

What the page is given: `inner` = `vv` = `doc` = **812**, screen **874**, `100lvh` **874**, `svh`/`dvh` **812**, `env(safe-area-inset-top)` **62px**, `bottom` **34px**, `standalone true`. The layout viewport is the screen *minus the status bar*, anchored at the **top** of the screen: the probe's `fixed inset-0` outline draws at screen y 0→812, and the header paints under the clock (iOS lays its blur band over it). The last 62 px of the screen have no layout at all.

**Nothing can paint there.** A `position: fixed` bar placed at the bottom of `100lvh`, and a `100lvh`-tall fixed box, are both invisible on that device — only the page *background* shows, because the canvas covers the whole screen while layout does not. So neither `100dvh` nor `100lvh` is a height to lay out against.

**What was tried, and what each attempt actually changed.**

- `100svh` → `height: 100%` (d978f9a): no visible change; the layout viewport is short either way.
- Growing the column to `window.innerHeight` when it exceeds the layout viewport (fbe97fa): never fires — on this device `inner` *is* the short 812, so there is nothing taller to grow to.
- `--inset-bottom: 0` while the layout viewport is short and `env(safe-area-inset-top)` is real (a995f84): the one real gain. The home-indicator inset then lies *below* the paintable area, so reserving it only pushed the tabs up; dropping it moved them ~38 px down, and the tab rows are 48 px.
- `black-translucent` → `black` plus `color-scheme: dark` (834b08d): meant to make iOS place the web view *below* the status bar so it reaches the bottom edge. The band has not been re-measured on the device since — that screenshot is the next thing to look at.

**What is still worth trying.** `apple-mobile-web-app-status-bar-style: default`, then no status-bar meta at all; if neither moves it, accept that the band is the system's and stop burning attempts on it. One screenshot from the installed app after a full relaunch (swipe the app away, reopen, then `?diag=1`) settles it: `env top 0px` means the view sits below the status bar and the band should be gone; `env top 62px` means iOS kept the anchored-at-top sizing and the space is unreachable. The probe is in the app for exactly this — do not remove it without leaving a replacement way to read those four numbers.

### What fought back, and what is not done

Written by the session that added the Ranked board, the swipe, the stale-build guards and the Stats rework. Kept blunt on purpose: several of these cost hours because the first plausible explanation was wrong.

**Asked for, not delivered.**

1. **The dead band under the nav** — asked twice, four fixes shipped, the last ~62 px are still not ours. Details and the remaining options are in the OPEN section above; do not start from the same assumptions.
2. **Portrait lock.** The manifest asks for `orientation: portrait` and the shell calls `screen.orientation.lock("portrait")` behind a guard, but WebKit ignores the manifest member for home-screen apps and refuses the lock outside fullscreen — an iPhone still rotates. A CSS "fake lock" (rotating the layout on `orientationchange`) was offered and deliberately not built: it breaks touch coordinates, the keyboard and the safe areas. So on iOS this request cannot be honoured from a web app.
3. **"In Ladder remove Elo"** was read as the Stats screen, because the Ladder screen shows no Elo to remove — the official rankings endpoint is trophy-only. Elo therefore left Stats entirely and now lives only on the club's Ranked board. If the ask was about the Ladder screen itself, it is not done, and there is nothing in the API to put there.
4. **The status-bar variants** (`apple-mobile-web-app-status-bar-style: default`, then no meta at all) are still untried. Each is one deploy and one full app relaunch, then a probe screenshot; see the OPEN section.

**Where the first explanation was wrong.**

- **The bottom band.** `100svh` looked like the cause and was not: `inner`/`vv`/`doc` are *all* 812 on iOS 26 standalone, so `height: 100%`, `100svh` and a grown column all land on the same short viewport, and a fixed bar at the bottom of `100lvh` is never displayed. The measurement that settled it was the probe, not reasoning.
- **The "ghost" over the header.** It is not a duplicated header and not a rendering bug: iOS lays a blur band over the top of the screen and samples whatever is under it, so the fix is dark space above the bright mark, not a different layout.
- **The Stats member list showing Elo as trophies.** The first fix split the units in the aggregate — which was a real bug (the All queue added ladder trophies to Ranked Elo) — and only then did the data say the second half: the API sends `trophyChange: null` for every Ranked battle (five of five checked). There is no Ranked gain to show, ever; the column is ladder-only and hidden in the Ranked queue.

**The API's gaps, as measured (not as assumed).**

- Club members: trophies only. Every Ranked value per member costs one `/player/{tag}` call — 28 of them took 38 s at three-at-a-time and 18 s at six, which is why the board loads lazily (IntersectionObserver), fills per batch, and holds the roster order until the run is done.
- Ranked battles publish no trophy change and no Elo delta.
- There is no Elo or Ranked leaderboard endpoint, so tiers on the Ladder screen would mean 200 profile requests per view. Not done, and not going to be.

**Tooling that misled.**

- **The layout probe is easy to misread.** A panel placed in the top ~70 px is unreadable — iOS blurs exactly there — and `document.querySelector("body > div")` matched the probe's own overlay rather than the app column, which made the first magenta outline meaningless. The panel belongs at the bottom, and the column comes from `nav.parentElement`.
- **`tab.run` / `page.evaluate` runs in an isolated world.** Window-level stubs (`matchMedia`, `visualViewport.height`) never reach the app, which made a working guard look broken; DOM reads and mutations *do* cross over, so gestures have to be simulated by dispatching real `TouchEvent`s on the real elements.
- **Serving `.vercel/output/static` while building it** makes the build fail with "index.html is missing — run a build first". Stop the static server before `npm run build`.
- **The tab swipe** was built and then removed on request: it decided the gesture axis too early, so diagonal drags — the normal kind — grabbed the swipe instead of the scroll. If it is ever rebuilt, the axis test needs to wait for a longer, straighter movement and the drag must not start until vertical scrolling is clearly ruled out.

**Noticed and left alone.**

- `public/n3x-logo.png` (1.4 MB) and `public/n3x-logo.jpg` (240 KB) are referenced nowhere — not in `src/`, not in the built output, and not by the platform's share-card lookup, which resolves `og.jpg`/`og.png` only. Together they are about 57% of the 2.8 MB deploy. Left in place rather than deleted: they are the only high-resolution copies of the artwork and removing them was not asked for. **`public/og.jpg` must stay** — link previews are built from it.
- `src/components/layout-probe.tsx` and `src/components/version-guard.tsx` look like scaffolding and are not: the probe is the only way to read the viewport numbers on the device, and the guard is what stops a stale chunk from dead-ending the app. Both are described above.

### What was broken then (Grok era — resolved by the rewrite)

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

### What already worked then (Grok era)

- Preview loads 28 members, member pages, Ladder meta, Ranked ELO chips.
- Ranked cube field `trophyRange` on `powerplay=1` is a **league index 1–22** (Bronze I → Pro), not trophies/100. Floors used as labels only: Gold 1500, Diamond 3000, Mythic 4500, Legendary 6000, Masters 8250. Mapping in `src/lib/meta/cube.ts` (`LEAGUE_IN`). Raw per-point ELO is not published.
- Ladder still uses 100-trophy buckets.
- Tier score is sample-aware. LOW samples cannot be S/A. Do not invent creator S–D boards. Creator strip is YouTube RSS titles + dates only (`src/lib/meta/creators.ts`).
- Join/leave is a snapshot diff, not a live "who left" API. Empty until a second roster differs from the first saved snapshot.

### What was already tried (Grok era)

All of this is on `main`. The published site was still 403 the last time it was opened, so either that deploy predates this code or the edge is blocked too. **Confirm which build is live before adding another proxy.**

1. `src/lib/http/outbound.ts` — server fetch with a Chrome UA. On 403, spawn `curl` (different TLS fingerprint). Vercel serverless has no `curl`. Datacenter IP is still blocked.
2. `src/lib/http/btn-client.ts` — in production the browser tries, in order:
   - same-origin `GET/POST /btn-src/...`
   - `https://r.jina.ai/https://brawltime.ninja/...` (HTML only)
   - `https://api.cors.lol/?url=...`
3. `vite.config.ts` Nitro `routeRules`: `/btn-src/**` proxies to `https://brawltime.ninja/**`. Dev Vite has the same proxy. Idea: the phone talks to our origin, the CDN fetches BTN. If Cloudflare blocks Vercel edge IPs as well, this still 403s.
4. `loadClubHome` / `loadClubPlayer` / `resolveCubeToken` try the browser path first when `import.meta.env.PROD`.

`jina.ai` and `cors.lol` are third-party relays. They are not a fix. They break, change HTML, and should not be the production path. Do not add more open proxies.

## Reference

### Where to change code

The map as of the rewrite (during the BTN era this table named `src/lib/http/outbound.ts`, `src/lib/http/btn-client.ts`, `src/lib/club/parse.ts` and `src/lib/meta/cube.ts` — the rewrite deleted all four):

| File | Role |
|---|---|
| `worker/index.js` | The whole backend: upstream calls, payload mapping, edge cache (`CACHE_VERSION`), KV snapshot + join/leave log, creator feeds, the `*/15` warmer and `/__warm` |
| `worker/wrangler.jsonc` | Worker name, KV binding, cron trigger |
| `src/lib/api/client.ts` | The app's single HTTP client against the Worker (`apiGet`) |
| `src/lib/club/queries.ts`, `types.ts` | Club / member loaders and the payload contract |
| `src/lib/club/stats.ts` (+ `stats.test.ts`) | Aggregation over the club's own battle logs |
| `src/lib/meta/creators.ts`, `creator-math.ts` (+ test) | Creator channels, client cache, lead-video choice, the tier-list filter, mention counting |
| `src/lib/meta/brawlapi.ts` | Brawler-name index the Meta board counts against |
| `src/routes/` | One file per tab, plus the member route |

### Constraints the Grok build lived under (mostly historical)

- Do not invent rankings, sample sizes, or a club roster.
- Do not add a Brawl Stars API token unless the owner provides one. *The owner has since created one; it is a Worker secret, never committed.*
- Do not turn auth on. Do not call `authMiddleware` / `requireUserId`.
- Do not hide the "Created with Grok" pill.
- Do not put `og:*` tags in `src/routes/__root.tsx` (the PWA plugin overwrites them).
- PGLite in the **built** Vercel preview crashes looking for `pglite.data`. `persistAndDiff` skips the DB when `PROD && !DATABASE_URL`. Real Neon (`DATABASE_URL` on deploy) is the join/leave store. Dev PGLite is fine.
- `npm run dev` only, never raw `vite`. `startup.sh` must stay.

### Suggested next step (Grok era — superseded; see "How to verify" below)

1. Open https://n3x.grok.me/ and check whether `/btn-src/club/2JYGUQ2P8` returns the vike HTML or another 403. That single request tells you if the edge proxy works.
2. If 200 and the body contains `vike_pageContext`, the client path in `btnGetHtml` should already populate the club once this commit is what is deployed. Then check `POST /btn-src/api/trpc/auth.getToken` with `{"json":null}` for meta.
3. If the edge proxy is also 403, stop adding User-Agents. The fetch has to leave from an IP Cloudflare allows:
   - a tiny proxy the owner runs (home machine, or any non-blocked host) that GETs the two BTN URLs and returns the body, or
   - a Brawl Stars API token from the owner, used only server-side.
4. Re-test the public site, not only the preview. Preview success does not mean the publish works.

### How to verify

Fast, from the repository root:

```sh
npm run typecheck                                   # tsc --noEmit
npm test                                            # 61 TS tests pass; 18 sandbox tests in scripts/** fail on this machine
curl -s https://n3x-api.whip-blanket.workers.dev/health   # {"ok":true,"key":true}
curl -s "https://n3x-api.whip-blanket.workers.dev/creators/bobby?x=$RANDOM" | head -c 200   # entries, no error
curl -s "https://n3x-api.whip-blanket.workers.dev/ladder?type=players&country=pl" | head -c 120   # 200 Polish rows
curl -s "https://n3x-api.whip-blanket.workers.dev/tier-list?scope=overall" | head -c 180   # rows, tiers, source BrawlMetrics
```

Then in a browser, on **both** hosts (`https://n3x-dk5.pages.dev` and `https://megabomb420.github.io/n3x/`):

- Club shows 28 members and the trophy total; search filters them; a member page shows trophies, a Ranked Elo chip, the brawler count and recent battles.
- Stats has a player select (whole club or one member) and a range (7 / 14 / 30 days / all logs). Both are restored from local storage. Sample sizes stay visible; nothing invents a global rate.
- Meta is a tier-list board (S+ through D, portraits in rows) with Overall / Ranked, a tap-to-inspect row, and a creator-link list under it — not video cards. Zero console errors.
- Ladder has a region select, restored from local storage, and shows 200 rows for that region with markup stripped; Maps shows the live rotation with times.
- A deep link (`/m/2JYGUQ2P8`) lands on the host's 404 fallback and boots the router.

Deploying after a change: `npm run build` then
`npx wrangler pages deploy .vercel/output/static --project-name=n3x --branch=main --commit-dirty=true`
for Cloudflare Pages; GitHub Pages follows from the push via `.github/workflows/pages.yml`.
Worker changes: `npx wrangler deploy --config worker/wrangler.jsonc`.

#### Grok-era verification (superseded)

Preview: club home shows members (about 28), search filters them, a member page shows trophies and a Ranked ELO number, Meta shows Ladder rows and a Ranked tab with ELO chips, console has no uncaught errors.

Public: https://n3x.grok.me/ must show the same roster, not `Source unavailable (403)`. Meta must show battle rows, not an empty filter bar.
