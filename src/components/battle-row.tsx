/**
 * One battle as a row. The club's own feed and a map's own screen list the same
 * battles, so the row lives here: one line for the outcome and the time, one for
 * who played it, with what, and what it moved.
 *
 * Nothing here is derived — a battle that published no win or loss says so, and
 * a battle that published no trophy change shows none.
 */
import type { PlayerBattle } from "@/lib/club/types";
import { useT } from "@/lib/i18n/provider";
import { formatRelative } from "@/lib/meta/format";
import { displayBrawlerName, titleCaseMode } from "@/lib/meta/names";
import { cn } from "@/lib/utils";

export function BattleRow({
  battle,
  member,
  showMap = false,
}: {
  battle: PlayerBattle;
  /** The member whose log this row came from. */
  member: string;
  /** The club's own feed spans maps, so it names the map; a map screen implies it. */
  showMap?: boolean;
}) {
  const t = useT();
  const outcome =
    battle.result ||
    (battle.victory === true
      ? t("member.victory")
      : battle.victory === false
        ? t("member.defeat")
        : t("member.battle"));

  return (
    <li className="rounded-xl bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p
          className={cn(
            "text-sm font-medium",
            battle.victory === true
              ? "text-win"
              : battle.victory === false
                ? "text-danger"
                : "text-fg",
          )}
        >
          {outcome}
        </p>
        <p className="shrink-0 text-xs text-subtle">{formatRelative(battle.timestamp)}</p>
      </div>
      <p className="mt-0.5 text-xs text-muted">
        {member}
        {battle.mode ? ` · ${titleCaseMode(battle.mode)}` : ""}
        {showMap && battle.map ? ` · ${battle.map}` : ""}
        {battle.brawler ? ` · ${displayBrawlerName(battle.brawler)}` : ""}
        {battle.ranked ? ` · ${t("stats.queue.ranked")}` : ""}
        {battle.trophyChange != null
          ? ` · ${battle.trophyChange > 0 ? "+" : ""}${battle.trophyChange}${battle.ranked ? " ELO" : ""}`
          : ""}
      </p>
    </li>
  );
}
