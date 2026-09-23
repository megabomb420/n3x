import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Clock, LogIn, LogOut, Search, Shield, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { loadClubHome } from "@/lib/club/queries";
import { loadClubLogs, recentBattles } from "@/lib/club/stats-loader";
import { bareTag, nameColorToCss } from "@/lib/club/format";
import { CLUB_TAG, type ClubEvent, type ClubMember } from "@/lib/club/types";
import { loadLadder } from "@/lib/ladder/rows";
import { useRoleLabel, useT, type StringKey } from "@/lib/i18n/provider";
import { formatRelative, formatTrophies } from "@/lib/meta/format";
import { useOnline } from "@/hooks/use-online";
import { cn } from "@/lib/utils";
import { BattleRow } from "./battle-row";
import { PlayerIcon } from "./player-icon";
import { RankedBoard } from "./ranked-board";
import { EmptyState, ErrorState, OfflineBanner, SkeletonRows } from "./state-views";

/** The rows the club's own feed shows. */
const FEED = 25;

const TYPE_KEYS: Record<string, StringKey> = {
  inviteOnly: "club.type.inviteOnly",
  open: "club.type.open",
  closed: "club.type.closed",
};

export function ClubScreen() {
  const t = useT();
  const online = useOnline();
  const [q, setQ] = useState("");
  const query = useQuery({
    queryKey: ["club-home"],
    queryFn: loadClubHome,
    refetchInterval: 90_000,
  });

  const club = query.data?.club;
  const events = query.data?.events ?? [];
  // The roster is a ladder, so it reads by trophies. The board below is the one
  // that sorts by Elo.
  const members = useMemo(
    () =>
      [...(club?.members ?? [])].sort(
        (a, b) => b.trophies - a.trophies || a.name.localeCompare(b.name),
      ),
    [club?.members],
  );
  const logs = useQuery({
    queryKey: ["club-logs"],
    queryFn: loadClubLogs,
    refetchInterval: 300_000,
  });
  // The club's own place in the Polish club table — the Ladder tab reads the
  // same query key, so opening one warms the other.
  const ladder = useQuery({
    queryKey: ["ladder", "clubs", "pl"],
    queryFn: () => loadLadder("clubs", "pl"),
    staleTime: 300_000,
    refetchInterval: 300_000,
  });
  const latest = useMemo(() => (logs.data ? recentBattles(logs.data.logs, FEED) : []), [logs.data]);
  const memberName = useMemo(() => {
    const names = new Map<string, string>();
    for (const member of members) names.set(member.tag, member.name);
    for (const entry of logs.data?.members ?? [])
      if (!names.has(entry.tag)) names.set(entry.tag, entry.name);
    return (tag: string) => names.get(tag) ?? `#${tag}`;
  }, [members, logs.data]);
  const rankByTag = useMemo(() => {
    const map = new Map<string, number>();
    members.forEach((m, i) => map.set(m.tag, i + 1));
    return map;
  }, [members]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(needle) ||
        m.tag.toLowerCase().includes(needle.replace(/^#/, "")),
    );
  }, [members, q]);

  const typeKey = club ? TYPE_KEYS[club.type] : undefined;
  // Where this club stands in Poland, from the same table the Ladder tab shows.
  const plRow = ladder.data?.rows.find((row) => bareTag(row.tag) === CLUB_TAG) ?? null;
  const plRank = ladder.isLoading
    ? t("club.rankPlReading")
    : ladder.isError && !ladder.data
      ? t("club.rankPlFailed")
      : plRow
        ? t("club.rankPl", { rank: plRow.rank })
        : t("club.rankPlNone");

  return (
    <div className="flex flex-col gap-3 px-3">
      {!online ? <OfflineBanner stale={Boolean(query.data)} /> : null}
      {query.isLoading ? <SkeletonRows count={8} /> : null}
      {query.isError && !query.data ? (
        <ErrorState
          title={t("state.club.title")}
          body={query.error instanceof Error ? query.error.message : t("state.club.body")}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {club ? (
        <>
          <section className="relative overflow-hidden rounded-2xl bg-surface p-4">
            {/* A wash of the app's accent from the top-left corner, gone by the
                middle of the card: the numbers and the description stay on
                plain surface, and the card's radius clips it exactly. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-gold/[0.13] via-transparent to-transparent"
            />
            {/* Positioned, so every line reads above the wash rather than under it. */}
            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wider text-subtle">#{club.tag}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {club.description || t("club.descriptionFallback")}
                  </p>
                </div>
                {typeKey ? (
                  <p className="shrink-0 rounded-full bg-surface-2 px-2 py-1 text-[11px] text-muted">
                    {t(typeKey)}
                  </p>
                ) : null}
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Stat label={t("club.members")} value={`${club.memberCount}`} />
                <Stat label={t("club.trophies")} value={formatTrophies(club.trophies)} />
                <Stat label={t("club.required")} value={formatTrophies(club.requiredTrophies)} />
              </dl>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
                <Trophy className="size-3.5 shrink-0 text-gold" />
                {plRank}
              </p>
              <p className="mt-3 flex items-center gap-1 text-[11px] text-subtle">
                <Clock className="size-3" />
                {t("common.updated", { when: formatRelative(club.fetchedAt) })}
                {query.data?.source ? ` · ${query.data.source}` : ""}
              </p>
            </div>
          </section>

          {/* The roster leads, right under the club's own card. The Ranked board
              and the battle feed follow it and both start with the tab, so they
              are already filling while the reader is up here. */}
          <label className="flex min-h-11 items-center gap-2 rounded-xl bg-surface px-3">
            <Search className="size-4 text-subtle" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("club.search")}
              aria-label={t("club.search")}
              className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
            />
          </label>

          <section>
            <h2 className="mb-1.5 font-display text-lg tracking-wide">{t("club.members")}</h2>
            {filtered.length === 0 ? (
              <EmptyState title={t("club.noMatch.title")} body={t("club.noMatch.body")} />
            ) : (
              <ul className="flex flex-col gap-1.5">
                {filtered.map((m) => (
                  <MemberRow key={m.tag} member={m} rank={rankByTag.get(m.tag) ?? 0} />
                ))}
              </ul>
            )}
          </section>

          {members.length > 0 ? <RankedBoard members={members} /> : null}

          <ClubBattles
            rows={latest}
            name={memberName}
            loading={logs.isLoading}
            failed={logs.isError && !logs.data}
            onRetry={() => void logs.refetch()}
          />

          <ActivityBlock
            events={events}
            baseline={query.data?.baseline ?? false}
            tracking={query.data?.tracking ?? false}
          />
        </>
      ) : null}
    </div>
  );
}

/** The club's newest competitive battles, from the members' own logs. */
function ClubBattles({
  rows,
  name,
  loading,
  failed,
  onRetry,
}: {
  rows: ReturnType<typeof recentBattles>;
  name: (tag: string) => string;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  const t = useT();
  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg tracking-wide">{t("club.battles")}</h2>
        {loading ? (
          <span className="text-[11px] text-subtle" aria-live="polite">
            {t("club.battles.reading")}
          </span>
        ) : null}
      </div>

      {failed ? (
        <ErrorState
          title={t("state.club.battles")}
          body={t("state.club.battlesBody")}
          onRetry={onRetry}
        />
      ) : rows.length === 0 ? (
        <p className="rounded-xl bg-surface px-3 py-3 text-sm text-muted">
          {loading ? t("club.battles.reading") : t("club.battles.none")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map(({ tag, battle }, index) => (
            <BattleRow
              key={`${tag}-${battle.timestamp}-${index}`}
              battle={battle}
              member={name(tag)}
              showMap
            />
          ))}
        </ul>
      )}

      <p className="mt-1.5 text-[11px] leading-relaxed text-subtle">{t("club.battles.note")}</p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-2 py-2">
      <dt className="text-[10px] uppercase tracking-wider text-subtle">{label}</dt>
      <dd className="font-display text-xl leading-none tracking-wide tabular">{value}</dd>
    </div>
  );
}

/**
 * The leadership, each in its own quiet colour: a left edge on the row, a tint
 * this faint, and the role word itself. Nothing louder — the roster is 28 rows
 * and shouting on three of them would read as noise, not as rank.
 */
const ROLE_STYLE: Record<string, { edge: string; tint: string; text: string }> = {
  president: { edge: "border-l-win", tint: "bg-win/[0.07]", text: "text-win" },
  vicePresident: { edge: "border-l-gold", tint: "bg-gold/[0.07]", text: "text-gold" },
  senior: { edge: "border-l-ranked", tint: "bg-ranked/[0.07]", text: "text-ranked" },
};

function MemberRow({ member, rank }: { member: ClubMember; rank: number }) {
  const roleLabel = useRoleLabel();
  const color = nameColorToCss(member.nameColor);
  const role = ROLE_STYLE[member.role] ?? null;
  return (
    <li>
      <Link
        to="/m/$tag/"
        replace
        params={{ tag: member.tag }}
        className={cn(
          "flex min-h-14 items-center gap-3 rounded-xl border-l-[3px] px-3 py-2 transition-transform duration-150 ease-out active:scale-[0.98]",
          role ? `${role.edge} ${role.tint}` : "border-l-transparent bg-surface",
        )}
      >
        <span className="w-5 shrink-0 text-center font-mono text-xs tabular text-subtle">
          {rank || "–"}
        </span>
        <PlayerIcon src={member.iconUrl} name={member.name} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium" style={color ? { color } : undefined}>
            {member.name}
          </p>
          <p className={cn("text-xs", role ? role.text : "text-subtle")}>
            {roleLabel(member.role)}
          </p>
        </div>
        <p className="shrink-0 font-mono text-sm tabular text-gold">
          {formatTrophies(member.trophies)}
        </p>
      </Link>
    </li>
  );
}

function ActivityBlock({
  events,
  baseline,
  tracking,
}: {
  events: ClubEvent[];
  baseline: boolean;
  tracking: boolean;
}) {
  const t = useT();
  const roleLabel = useRoleLabel();
  return (
    <section>
      <h2 className="mb-1.5 font-display text-lg tracking-wide">{t("club.activity")}</h2>
      {events.length === 0 ? (
        <p className="rounded-xl bg-surface px-3 py-3 text-sm text-muted">
          {baseline
            ? t("club.activity.baseline")
            : tracking
              ? t("club.activity.none")
              : t("club.activity.unsaved")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {events.slice(0, 12).map((ev) => (
            <li
              key={ev.id}
              className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2.5 text-sm"
            >
              <KindIcon kind={ev.kind} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-fg">
                  {ev.kind === "join"
                    ? ev.roleTo
                      ? t("club.event.joinLine", {
                          name: ev.playerName,
                          role: roleLabel(ev.roleTo),
                        })
                      : t("club.event.joinLineNoRole", { name: ev.playerName })
                    : ev.kind === "leave"
                      ? ev.roleFrom
                        ? t("club.event.leaveLine", {
                            name: ev.playerName,
                            role: roleLabel(ev.roleFrom),
                          })
                        : t("club.event.leaveLineNoRole", { name: ev.playerName })
                      : `${ev.playerName} · ${roleLabel(ev.roleFrom)} → ${roleLabel(ev.roleTo)}`}
                </p>
                <p className="text-xs text-subtle">{formatRelative(ev.occurredAt)}</p>
              </div>
              {ev.kind !== "leave" ? (
                <Link
                  to="/m/$tag/"
                  replace
                  params={{ tag: ev.playerTag }}
                  className="shrink-0 text-xs text-muted"
                >
                  {t("club.statsLink")}
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function KindIcon({ kind }: { kind: ClubEvent["kind"] }) {
  const cls = cn(
    "flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-2",
    kind === "leave" ? "text-danger" : kind === "join" ? "text-win" : "text-gold",
  );
  if (kind === "leave")
    return (
      <span className={cls}>
        <LogOut className="size-3.5" />
      </span>
    );
  if (kind === "join")
    return (
      <span className={cls}>
        <LogIn className="size-3.5" />
      </span>
    );
  return (
    <span className={cls}>
      <Shield className="size-3.5" />
    </span>
  );
}
