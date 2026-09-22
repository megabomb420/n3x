import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/about")({ component: AboutPage });

function AboutPage() {
  return (
    <AppShell title="Data">
      <article className="space-y-5 px-4 pb-8 text-sm leading-relaxed text-muted">
        <Link to="/" className="inline-flex min-h-11 items-center gap-1 text-fg">
          <ChevronLeft className="size-4" /> Back to club
        </Link>

        <section>
          <h2 className="font-display text-2xl tracking-wide text-fg">Data / methodology</h2>
          <p className="mt-2">
            This is an unofficial companion for Brawl Stars club <span className="text-fg">'N3X</span> (
            <span className="text-fg">#2JYGUQ2P8</span>). Club is the home tab: live roster, member
            profiles and who joined or left. Ladder shows the official global leaderboards, Maps the
            live event rotation.
          </p>
        </section>

        <section>
          <h3 className="font-medium text-fg">Where the numbers come from</h3>
          <p className="mt-2">
            Everything is read from the official{" "}
            <a className="underline" href="https://developer.brawlstars.com" target="_blank" rel="noreferrer">
              Brawl Stars API
            </a>{" "}
            through this app's own Cloudflare Worker. The Worker holds the API key, caches responses
            for a minute and is the only party that talks to Supercell — the browser never sees a key.
            Official API keys are locked to the IP addresses that may use them, and a Worker has no
            fixed address, so the Worker calls the API through RoyaleAPI's public proxy and that
            proxy's published addresses are the ones on the key.
          </p>
        </section>

        <section>
          <h3 className="font-medium text-fg">Why the app no longer reads Brawl Time Ninja</h3>
          <p className="mt-2">
            Earlier builds scraped {" "}
            <a className="underline" href="https://brawltime.ninja/club/2JYGUQ2P8" target="_blank" rel="noreferrer">
              Brawl Time Ninja
            </a>
            . That site answers every datacenter request with a Cloudflare challenge and sends no CORS
            headers, so a hosted build can read neither its pages nor the browser-side Cube API they
            feed. The measurement (Cloudflare Workers, GitHub/Azure runners, Vercel and the jina relay
            all rejected) is recorded in the repository's <code className="text-fg">HANDOFF.md</code>.
            The club, member, Ladder and Maps data above does not depend on it.
          </p>
        </section>

        <section>
          <h3 className="font-medium text-fg">Joined / left</h3>
          <p className="mt-2">
            Brawl Stars publishes no club activity feed. The Worker keeps one shared snapshot of the
            last roster it saw and compares it on every refresh: new tags are joins, missing tags are
            leaves, a changed role is a promotion or demotion. The first stored snapshot is a
            baseline — nothing is invented as a join or leave until a later snapshot differs. The log
            lives in the Worker's KV store, so it is the same for everyone who opens the app.
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
          <h3 className="font-medium text-fg">Ladder and Maps</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <span className="text-fg">Ladder:</span> the official global leaderboards — the top 200
              players or clubs, with trophies and club names, exactly as the API returns them. Rank
              order is never re-sorted.
            </li>
            <li>
              <span className="text-fg">Maps:</span> the live event rotation — what is running now and
              what comes next, with mode and map names. Counts of games per map are not published by
              the API, so the app does not show any.
            </li>
            <li>
              <span className="text-fg">Brawler and map art:</span>{" "}
              <a className="underline" href="https://brawlapi.com" target="_blank" rel="noreferrer">
                BrawlAPI
              </a>{" "}
              and the{" "}
              <a className="underline" href="https://cdn.brawlify.com" target="_blank" rel="noreferrer">
                Brawlify CDN
              </a>{" "}
              (a static catalog, loaded by the browser directly).
            </li>
          </ul>
        </section>

        <section>
          <h3 className="font-medium text-fg">Freshness</h3>
          <p className="mt-2">
            The Worker caches club data for 45 seconds and player data for a minute; the browser keeps
            the last good payload and shows it, labelled, if the network fails. Club re-checks about
            every 90 seconds while the tab is open, Ladder every 5 minutes, Maps every 10. Nothing is
            invented to fill a gap: a failed request shows the reason it failed.
          </p>
        </section>

        <section>
          <h3 className="font-medium text-fg">Known limits</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Joins and leaves only exist after a stored snapshot; history from before this app started
              watching cannot be reconstructed.
            </li>
            <li>
              The official battle log lags behind by up to about half an hour and returns only the most
              recent battles, so a member page can miss very recent games.
            </li>
            <li>
              Ranked win-rate and pick-rate boards (per map, per brawler, filtered by league) existed
              only in Brawl Time Ninja's analytics cube and have no official equivalent — they are not
              part of this app rather than replaced with invented numbers.
            </li>
            <li>
              Ban rates are not published anywhere official, so they are not estimated from pick rates.
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
