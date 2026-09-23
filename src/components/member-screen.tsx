import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { loadClubPlayer } from "@/lib/club/queries";
import { nameColorToCss } from "@/lib/club/format";
import { CLUB_TAG } from "@/lib/club/types";
import { loadCatalog } from "@/lib/meta/brawlapi";
import { useRoleLabel, useT } from "@/lib/i18n/provider";
import { displayBrawlerName, titleCaseMode } from "@/lib/meta/names";
import { formatRelative, formatTrophies } from "@/lib/meta/format";
import { cn } from "@/lib/utils";
import { PlayerIcon } from "./player-icon";
import { Portrait } from "./portrait";
import { EmptyState, ErrorState, SkeletonRows } from "./state-views";
export function MemberScreen({ tag }: { tag: string }) {
  const t = useT();
  const roleLabel = useRoleLabel();
  const query = useQuery({
    queryKey: ["club-player", tag],
    queryFn: () => loadClubPlayer(tag),
  });
  const catalogQuery = useQuery({ queryKey: ["catalog"], queryFn: loadCatalog });
  const player = query.data;

  if (query.isLoading) {
    return (
      <div className="px-3">
        <SkeletonRows count={8} />
      </div>
    );
  }
  if (query.isError && !player) {
    return (
      <div className="px-3">
        <ErrorState
          title={t("state.player.title")}
          body={query.error instanceof Error ? query.error.message : t("state.player.body")}
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }
  if (!player) return null;

  const color = nameColorToCss(player.nameColor);
  const topBrawlers = player.brawlers.slice(0, 10);
  const battles = player.battles.slice(0, 12);

  return (
    <div className="flex flex-col gap-3 px-3">
      <Link to="/" replace className="inline-flex min-h-11 items-center gap-1 text-sm text-muted">
        <ChevronLeft className="size-4" /> {t("member.roster")}
      </Link>

      <section className="flex items-center gap-3 rounded-2xl bg-surface p-4">
        <PlayerIcon src={player.iconUrl} name={player.name} size={56} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-3xl leading-none tracking-wide" style={color ? { color } : undefined}>
            {player.name}
          </p>
          <p className="mt-1 font-mono text-xs text-subtle">#{player.tag}</p>
          <p className="mt-1 text-xs text-muted">
            {player.inClub
              ? `${roleLabel(player.clubRole)} · ${player.clubName ?? "'N3X"}`
              : player.clubName
                ? t("member.nowIn", { club: player.clubName })
                : t("member.notInClub")}
            {player.expLevel ? ` · Lv ${player.expLevel}` : ""}
            {player.fameTierName ? ` · ${player.fameTierName}` : ""}
          </p>
        </div>
      </section>

      <dl className="grid grid-cols-2 gap-1.5">
        <Tile label={t("member.trophies")} value={formatTrophies(player.trophies)} />
        <Tile label={t("member.peak")} value={formatTrophies(player.highestTrophies)} />
        <Tile
          label={t("member.ranked")}
          value={
            player.rankedElo != null
              ? `${formatTrophies(player.rankedElo)} ELO`
              : player.rankedRankName ?? "—"
          }
          sub={player.rankedRankName}
        />
        <Tile
          label={t("member.peakRanked")}
          value={
            player.highestAllTimeRankedElo != null
              ? `${formatTrophies(player.highestAllTimeRankedElo)} ELO`
              : player.highestAllTimeRankedRankName ?? "—"
          }
          sub={player.highestAllTimeRankedRankName}
        />
        <Tile label={t("member.wins3v3")} value={formatTrophies(player.victories3v3)} />
        <Tile label={t("member.showdown")} value={formatTrophies(player.soloVictories + player.duoVictories)} />
      </dl>

      <section>
        <h2 className="mb-1.5 font-display text-lg tracking-wide">{t("member.topBrawlers")}</h2>
        {topBrawlers.length === 0 ? (
          <EmptyState title={t("member.noBrawlers.title")} body={t("member.noBrawlers.body")} />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {topBrawlers.map((b) => {
              const catalog = catalogQuery.data
                ? catalogQuery.data.brawlers.find(
                    (c) => c.slug === b.slug || c.cubeName.toLowerCase() === b.slug,
                  ) ?? null
                : null;
              return (
                <li
                  key={b.id || b.slug}
                  className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2"
                >
                  <Portrait catalog={catalog} cubeName={catalog?.cubeName ?? b.name} size={36} decorative />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {catalog?.name ?? displayBrawlerName(b.name)}
                    </p>
                    <p className="text-xs text-subtle">
                      P{b.power}
                      {b.rank ? ` · ${t("member.rank", { rank: b.rank })}` : ""}
                      {b.hyper ? " · HC" : ""}
                    </p>
                  </div>
                  <p className="font-mono text-sm tabular text-gold">{formatTrophies(b.trophies)}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-1.5 font-display text-lg tracking-wide">{t("member.recentBattles")}</h2>
        {battles.length === 0 ? (
          <EmptyState title={t("member.noBattles.title")} body={t("member.noBattles.body")} />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {battles.map((b, i) => (
              <li key={`${b.timestamp}-${i}`} className="rounded-xl bg-surface px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      b.victory === true ? "text-win" : b.victory === false ? "text-danger" : "text-fg",
                    )}
                  >
                    {b.result || (b.victory === true ? t("member.victory") : b.victory === false ? t("member.defeat") : t("member.battle"))}
                  </p>
                  <p className="text-xs text-subtle">{formatRelative(b.timestamp)}</p>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {b.ranked ? "Ranked · " : ""}
                  {b.mode ? titleCaseMode(b.mode) : "Mode"}
                  {b.map ? ` · ${b.map}` : ""}
                  {b.brawler ? ` · ${displayBrawlerName(b.brawler)}` : ""}
                  {b.trophyChange != null
                    ? ` · ${b.trophyChange > 0 ? "+" : ""}${b.trophyChange}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="pb-4 text-center text-[11px] text-subtle">
        {player.source}
        {player.clubTag && player.clubTag !== CLUB_TAG ? ` · club #${player.clubTag}` : ""}
      </p>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <div className="rounded-xl bg-surface px-3 py-2.5">
      <dt className="text-[10px] uppercase tracking-wider text-subtle">{label}</dt>
      <dd className="font-display text-2xl leading-none tracking-wide tabular">{value}</dd>
      {sub ? <p className="mt-0.5 text-[11px] text-muted">{sub}</p> : null}
    </div>
  );
}
