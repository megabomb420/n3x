import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useT } from "@/lib/i18n/provider";

export const Route = createFileRoute("/about")({ component: AboutPage });

function AboutPage() {
  const t = useT();
  return (
    <AppShell title={t("about.title")}>
      <article className="space-y-5 px-4 pb-8 text-sm leading-relaxed text-muted">
        <Link to="/" replace className="inline-flex min-h-11 items-center gap-1 text-fg">
          <ChevronLeft className="size-4" /> {t("common.back")}
        </Link>
        <p className="text-[11px] text-subtle">{t("about.note")}</p>
        <LayoutReport />

        <section>
          <h2 className="font-display text-2xl tracking-wide text-fg">Data / methodology</h2>
          <p className="mt-2">
            This is an unofficial companion for Brawl Stars club{" "}
            <span className="text-fg">'N3X</span> (<span className="text-fg">#2JYGUQ2P8</span>).
            Club is the home tab: live roster, member profiles and who joined or left. Stats counts
            the club's own battles, or one member's, inside a chosen time range. Meta is a published
            tier list plus links to the creators. Ladder shows the official leaderboards for a saved
            region and Maps the live event rotation, and each map opens its picture with
            BrawlMetrics' own per-map numbers (one population — no trophy split).
          </p>
        </section>

        <section>
          <h3 className="font-medium text-fg">Where the numbers come from</h3>
          <p className="mt-2">
            Club, player, battle, Ladder and Maps data is read from the official{" "}
            <a
              className="underline"
              href="https://developer.brawlstars.com"
              target="_blank"
              rel="noreferrer"
            >
              Brawl Stars API
            </a>{" "}
            through this app's own Cloudflare Worker. The Worker holds the API key, caches responses
            for a minute and is the only party that talks to Supercell — the browser never sees a
            key. Official API keys are locked to the IP addresses that may use them, and a Worker
            has no fixed address, so the Worker calls the API through RoyaleAPI's public proxy and
            that proxy's published addresses are the ones on the key. The Meta board is the
            exception: it is parsed from BrawlMetrics' published table, and the creator links come
            from public YouTube feeds.
          </p>
        </section>

        <section>
          <h3 className="font-medium text-fg">Why the app no longer reads Brawl Time Ninja</h3>
          <p className="mt-2">
            Earlier builds scraped{" "}
            <a
              className="underline"
              href="https://brawltime.ninja/club/2JYGUQ2P8"
              target="_blank"
              rel="noreferrer"
            >
              Brawl Time Ninja
            </a>
            . That site answers every datacenter request with a Cloudflare challenge and sends no
            CORS headers, so a hosted build can read neither its pages nor the browser-side Cube API
            they feed. The measurement (Cloudflare Workers, GitHub/Azure runners, Vercel and the
            jina relay all rejected) is recorded in the repository's{" "}
            <code className="text-fg">HANDOFF.md</code>. The club, member, Ladder and Maps data
            above does not depend on it.
          </p>
        </section>

        <section>
          <h3 className="font-medium text-fg">Joined / left</h3>
          <p className="mt-2">
            Brawl Stars publishes no club activity feed. The Worker keeps one shared snapshot of the
            last roster it saw and compares it on every refresh: new tags are joins, missing tags
            are leaves, a changed role is a promotion or demotion. The first stored snapshot is a
            baseline — nothing is invented as a join or leave until a later snapshot differs. The
            log lives in the Worker's KV store, so it is the same for everyone who opens the app.
          </p>
        </section>

        <section>
          <h3 className="font-medium text-fg">Member profiles</h3>
          <p className="mt-2">
            Trophies, highest trophies, experience level, per-brawler trophies and the recent battle
            list come from the official player and battle-log endpoints. Ranked Elo and the league
            name are the fields the official API publishes for a player (a Ranked battle's
            <code className="text-fg"> trophyChange</code> is the Elo delta, and its
            <code className="text-fg"> brawlerTrophies</code> field carries the league index, not
            trophies — the app labels those rows accordingly).
          </p>
        </section>

        <section>
          <h3 className="font-medium text-fg">Ladder, Maps, Stats and Meta</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <span className="text-fg">Ladder:</span> the official leaderboards — the top 200
              players or clubs for a region, with trophies and club names, exactly as the API
              returns them. Rank order is never re-sorted. The region is remembered on this device.
            </li>
            <li>
              <span className="text-fg">Maps:</span> the live event rotation — what is running now
              and what comes next, with mode and map names. Tapping a map opens its picture whole,
              with the publisher's own numbers for that map underneath (see Meta below) — its sample
              size, its date, and the note that it is one population with no trophy split. The
              official API publishes no counts of games per map at all.
            </li>
            <li>
              <span className="text-fg">Stats:</span> what this club, or one member, actually played
              and won with, counted from their own battle logs (about the last 25 games each,
              competitive queues only — friendlies and event modes stay out). A time range narrows
              that log. The official API publishes no global win or pick rates, so these are club
              numbers: every row carries its own sample size, and fewer than five games reads as a
              small sample instead of a ranking. The player and the range are remembered on this
              device.
            </li>
            <li>
              <span className="text-fg">Meta:</span> a tier list (S+ through D) from{" "}
              <a
                className="underline"
                href="https://brawlmetrics.gg/tier-list"
                target="_blank"
                rel="noreferrer"
              >
                BrawlMetrics
              </a>
              , whose tiers are percentiles of win rate and use rate — not a creator's opinion, and
              not guessed from a video title. Overall and Ranked are separate. The same publisher's
              per-map table is read the same way and shown on the map's own screen, whole, under its
              picture: ordinary modes rank by win rate, Showdown by top-4 placement (it has no win
              or loss), and the column is labelled from the table's own header. Under the board,
              links to SpenLC, Ash, KairosTime, CryingMan, Rey, Lex and bobby, plus each channel's
              latest tier-list upload when the feed has one.
            </li>
            <li>
              <span className="text-fg">Brawler and map art:</span>{" "}
              <a className="underline" href="https://brawlapi.com" target="_blank" rel="noreferrer">
                BrawlAPI
              </a>{" "}
              and the{" "}
              <a
                className="underline"
                href="https://cdn.brawlify.com"
                target="_blank"
                rel="noreferrer"
              >
                Brawlify CDN
              </a>{" "}
              (a static catalog, loaded by the browser directly).
            </li>
          </ul>
        </section>

        <section>
          <h3 className="font-medium text-fg">Freshness</h3>
          <p className="mt-2">
            The Worker caches club data for 45 seconds and player data for a minute; the browser
            keeps the last good payload and shows it, labelled, if the network fails. Club re-checks
            about every 90 seconds while the tab is open, Ladder every 5 minutes, Maps every 10.
            Nothing is invented to fill a gap: a failed request shows the reason it failed.
          </p>
        </section>

        <section>
          <h3 className="font-medium text-fg">Known limits</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Joins and leaves only exist after a stored snapshot; history from before this app
              started watching cannot be reconstructed.
            </li>
            <li>
              The official battle log lags behind by up to about half an hour and returns only the
              most recent battles, so a member page can miss very recent games.
            </li>
            <li>
              The official API publishes no win, use or pick rates, so every rate in the app is
              either club-scoped (Stats, counted from the members' logs) or the publisher's own
              reading (Meta's tier list, a map's own table). Neither is filtered by trophy range:
              BrawlMetrics has one population and publishes no bracket, so a map's numbers are
              labelled with the sample size they rest on instead of a range the source never gave.
            </li>
            <li>
              Only the club's own Stats screen splits by queue and time range. A map's table is one
              reading per brawler, and a map the publisher does not list (retired maps, and maps
              only in an old log) has no numbers at all rather than a guess.
            </li>
            <li>
              Creator pages only see the recent window of each channel's public feed, so an older
              tier list drops out of Meta as new uploads arrive.
            </li>
            <li>
              Ban rates are not published anywhere official, so they are not estimated from pick
              rates.
            </li>
            <li>The club's own roster is the only club the app tracks.</li>
          </ul>
        </section>

        <section>
          <h3 className="font-medium text-fg">Fan content</h3>
          <p className="mt-2">
            This content is not affiliated with, endorsed, sponsored, or specifically approved by
            Supercell and Supercell is not responsible for it. For more information see{" "}
            <a
              className="underline"
              href="https://www.supercell.com/fan-content-policy"
              target="_blank"
              rel="noreferrer"
            >
              Supercell's Fan Content Policy
            </a>
            .
          </p>
        </section>
      </article>
    </AppShell>
  );
}

/** One tap from the header pill: the numbers an installed-app screenshot needs. */
function LayoutReport() {
  return (
    <section>
      <h3 className="font-medium text-fg">Viewport report</h3>
      <p className="mt-2">
        The installed app is the only place iOS reports the heights it actually gives the page.{" "}
        <a href={`${import.meta.env.BASE_URL}?diag=1`} className="underline text-fg">
          Open the layout probe
        </a>{" "}
        to see them: it prints the visual and layout viewports, `100lvh`, the safe-area insets and
        where the app column ends, and it outlines the column in magenta against the layout viewport
        in cyan. It draws nothing without `?diag=1`.
      </p>
    </section>
  );
}
