import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { loadMemberRanked, type MemberRanked } from "@/lib/club/stats-loader";
import { useT } from "@/lib/i18n/provider";
import { formatTrophies } from "@/lib/meta/format";
import { PlayerIcon } from "./player-icon";

/**
 * Who stands where in Ranked, on the club tab under the roster: the club
 * endpoint publishes trophies only, so the tier and Elo of every member come
 * from their own profile — one request each, six at a time, cached by
 * `loadMemberRanked`.
 *
 * The run starts with the club tab itself rather than when the board scrolls
 * into view: the reader asked for the Elo to be there when the app opens, not to
 * arrive while they watch it. While it runs the header carries the count, so a
 * wait is visibly a wait.
 */
export function RankedBoard({
  members,
}: {
  members: Array<{ tag: string; name: string; iconUrl: string | null }>;
}) {
  const t = useT();
  const tags = members.map((member) => member.tag);

  const [partial, setPartial] = useState<MemberRanked[] | null>(null);
  const query = useQuery({
    queryKey: ["club-ranked", tags.join(",")],
    queryFn: () => loadMemberRanked(tags, setPartial),
    enabled: tags.length > 0,
    staleTime: 10 * 60_000,
  });

  // Rows hold the roster's order while the profiles land — reordering under the
  // reader as each one arrives would be worse than the wait. Once the run is
  // done the board is a ranking.
  const standings = query.data ?? partial;
  const settled = query.data != null;
  const read = standings?.filter((entry) => entry.elo != null).length ?? 0;
  const rows = members
    .map((member) => ({
      member,
      standing: standings?.find((entry) => entry.tag === member.tag) ?? null,
    }))
    .sort(
      settled
        ? (a, b) =>
            (b.standing?.elo ?? -1) - (a.standing?.elo ?? -1) ||
            a.member.name.localeCompare(b.member.name)
        : () => 0,
    );

  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg tracking-wide">{t("club.ranked")}</h2>
        <span className="text-right text-[11px] text-subtle" aria-live="polite">
          {settled
            ? t("club.rankedHint")
            : t("club.rankedReading", { done: read, total: tags.length })}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {rows.map(({ member, standing }, index) => (
          <li
            key={member.tag}
            className="flex min-h-12 items-center gap-3 rounded-xl bg-surface px-3 py-2"
          >
            <span className="w-5 shrink-0 text-center font-mono text-xs tabular text-subtle">
              {settled && standing?.elo != null ? index + 1 : "·"}
            </span>
            <PlayerIcon src={member.iconUrl} name={member.name} size={32} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-fg">{member.name}</p>
              {standing?.rankName ? (
                <p className="truncate text-[11px] tracking-wide text-gold">{standing.rankName}</p>
              ) : (
                <p className="text-[11px] text-subtle">
                  {standings ? t("club.rankedNone") : t("club.rankedLoading")}
                </p>
              )}
            </div>
            <p className="shrink-0 font-mono text-sm tabular text-gold">
              {standing?.elo != null ? formatTrophies(standing.elo) : "—"}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
