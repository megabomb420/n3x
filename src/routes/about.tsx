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
            This is an unofficial companion for Brawl Stars club{" "}
            <span className="text-fg">'N3X</span> (<span className="text-fg">#2JYGUQ2P8</span>).
            Club is the home tab: live roster, member profiles, and who joined or left. Meta is
            the second tab — Ladder versus Ranked, never mixed.
          </p>
        </section>

        <section>
          <h3 className="font-medium text-fg">Club roster</h3>
          <p className="mt-2">
            The member list is the public club page on{" "}
            <a className="underline" href="https://brawltime.ninja/club/2JYGUQ2P8" target="_blank" rel="noreferrer">
              Brawl Time Ninja
            </a>
            . Tapping a member loads that player’s public profile from the same site (trophies,
            Ranked ELO / league, top brawlers, recent battles). No official API key is used or
            needed — the public site was being treated as a bot, not missing a secret.
          </p>
        </section>

        <section>
          <h3 className="font-medium text-fg">Joined / left</h3>
          <p className="mt-2">
            Brawl Stars does not publish a club activity feed. We keep one shared snapshot of
            the last seen roster and compare it on each refresh. New tags are joins; missing
            tags are leaves; a role change is recorded as a promotion or demotion. The first
            successful save is a baseline — nothing is invented as a join or leave until a later
            snapshot differs. If the snapshot cannot be stored, the live roster still shows and
            the activity log says so.
          </p>
        </section>

        <section>
          <h3 className="font-medium text-fg">Sources (meta)</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <span className="text-fg">Ladder & Ranked stats:</span> Brawl Time Ninja analytics cube
              (
              <a className="underline" href="https://brawltime.ninja" target="_blank" rel="noreferrer">
                brawltime.ninja
              </a>
              ). Ranked is <code className="text-fg">powerplay=1</code> battles; Ladder is{" "}
              <code className="text-fg">powerplay=0</code>. On Ranked the cube’s{" "}
              <code className="text-fg">trophyRange</code> is league rank (Bronze I–Pro), not
              brawler trophies. Ladder still uses 100-trophy buckets.
            </li>
            <li>
              <span className="text-fg">Brawlers, maps, art:</span>{" "}
              <a className="underline" href="https://brawlapi.com" target="_blank" rel="noreferrer">
                BrawlAPI
              </a>{" "}
              +{" "}
              <a className="underline" href="https://cdn.brawlify.com" target="_blank" rel="noreferrer">
                Brawlify CDN
              </a>
              .
            </li>
            <li>
              <span className="text-fg">Creator lists:</span> public YouTube RSS for SpenLC, Ash,
              KairosTime, and CryingMan. Each channel’s latest video whose title is a tier list
              or ranking, with the publish date. Placements inside the video are not transcribed.
            </li>
            <li>
              <span className="text-fg">Ranked discussion:</span> public RSS of{" "}
              <a
                className="underline"
                href="https://www.reddit.com/r/BrawlStarsCompetitive"
                target="_blank"
                rel="noreferrer"
              >
                r/BrawlStarsCompetitive
              </a>
              . Posts about Ranked, draft, meta, and tier lists, with the publish date. We do
              not scrape comment rankings or invent a community S–D board.
            </li>
            <li>
              <span className="text-fg">Community vote:</span> Brawl Time Ninja survey cube for the
              current season. Last-vote time is the newest ballot, not a scrape of their visual
              S–D board.
            </li>
          </ul>
          <p className="mt-2">None of those projects, nor Supercell, endorse this app.</p>
        </section>

        <section>
          <h3 className="font-medium text-fg">Ladder trophies vs Ranked ELO</h3>
          <p className="mt-2">
            Ladder filters by brawler trophies (0–999, 1000+, 1500+, 2000+). Ranked does not —
            those battles do not move brawler trophies. Ranked filters by league floor (Gold+,
            Diamond+, Mythic+, Legendary+, Masters+), which is the cube’s rank index 1–22
            (Bronze I through Pro). ELO numbers on the chips are Ranked 2.0 league floors, not a
            raw ELO field. A member’s profile Ranked line is that player’s public ELO / league
            from Brawl Time Ninja.
          </p>
        </section>

        <section>
          <h3 className="font-medium text-fg">Freshness & sample</h3>
          <p className="mt-2">
            Club roster refreshes about every 90 seconds while the Club tab is open. Meta lists
            store source, fetch time, last cube refresh, sample size, and active filters. Tap
            the “Updated …” chip on Meta or Maps to inspect them. Cached snapshots are used if
            the network fails; anything older than 30 minutes is labelled stale. Numbers are
            never invented.
          </p>
        </section>

        <section>
          <h3 className="font-medium text-fg">Adjusted win rate</h3>
          <p className="mt-2">
            Adjusted WR is Brawl Time Ninja’s Bayesian average: small samples are pulled toward a
            trophy-aware prior (~1,583 pseudo-battles). We use it as the main quality signal instead
            of raw win rate.
          </p>
        </section>

        <section>
          <h3 className="font-medium text-fg">Tier score</h3>
          <p className="mt-2">
            Inside the current filter, each brawler gets a ranking quality that shrinks adjusted
            WR toward the group average with 800 pseudo-battles, then{" "}
            <code className="text-fg">0.70 × z(quality) + 0.30 × z(adj WR × log10(picks + 10))</code>.
            That stops a 200-game spike from outranking a million-battle 57%. Use rate is not in
            the score — popularity has its own “Most used” strip. Tiers S–D are cut from that
            score’s distribution, not from fixed win-rate thresholds. The adjusted WR you see is
            still Brawl Time Ninja’s number.
          </p>
        </section>

        <section>
          <h3 className="font-medium text-fg">Confidence</h3>
          <p className="mt-2">
            HIGH ≥ 8,000 battles, MEDIUM ≥ 1,200, otherwise LOW. LOW samples cannot sit in S or A.
            Under 80 battles they are capped at C.
          </p>
        </section>

        <section>
          <h3 className="font-medium text-fg">Known limits</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Joins and leaves only exist after a stored snapshot. We cannot reconstruct history
              from before this app started watching.
            </li>
            <li>
              Ranked filters by league / ELO floor (Gold+, Diamond+, …), mapped from cube rank
              index 1–22 (Bronze I through Pro). Raw ELO is not published — we do not invent a
              per-point ELO slider.
            </li>
            <li>Ban rate is not published. We do not estimate it from pick rate.</li>
            <li>
              BrawlAPI’s event rotation feed is empty, so “active maps” are maps with battles in the
              last ~90 minutes.
            </li>
            <li>
              Creator lists only see the last ~15 uploads on each channel’s public RSS. If someone
              posts a list further back, it will not appear until it is in that window.
            </li>
            <li>
              Ranked talk only sees the last ~25 posts on r/BrawlStarsCompetitive’s public RSS.
              We do not pull scores, flairs, or older threads, and we do not invent a community
              S–D board from comments.
            </li>
            <li>We do not invent a creator’s S–D ranking from memory or from an old screenshot.</li>
            <li>
              A tiny server call fetches Brawl Time Ninja’s public cube token because that token
              endpoint has no CORS headers. Stats themselves load in the browser from the cube.
            </li>
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
              Supercell’s Fan Content Policy
            </a>
            .
          </p>
        </section>
      </article>
    </AppShell>
  );
}
