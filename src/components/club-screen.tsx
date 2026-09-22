import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Clock, LogIn, LogOut, Search, Shield } from "lucide-react";
import { useMemo, useState } from "react";
import { loadClubHome } from "@/lib/club/queries";
import { nameColorToCss, roleLabel } from "@/lib/club/parse";
import type { ClubEvent, ClubMember } from "@/lib/club/types";
import { formatRelative, formatTrophies } from "@/lib/meta/format";
import { useOnline } from "@/hooks/use-online";
import { cn } from "@/lib/utils";
import { PlayerIcon } from "./player-icon";
import { EmptyState, ErrorState, OfflineBanner, SkeletonRows } from "./state-views";

function clubTypeLabel(type: string): string {
  if (type === "inviteOnly") return "Invite only";
  if (type === "open") return "Open";
  if (type === "closed") return "Closed";
  return type;
}

export function ClubScreen() {
  const online = useOnline();
  const [q, setQ] = useState("");
  const query = useQuery({
    queryKey: ["club-home"],
    queryFn: loadClubHome,
    refetchInterval: 90_000,
  });

  const club = query.data?.club;
  const events = query.data?.events ?? [];
  const members = club?.members ?? [];
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

  return (
    <div className="flex flex-col gap-3 px-3">
      {!online ? <OfflineBanner stale={Boolean(query.data)} /> : null}
      {query.isLoading ? <SkeletonRows count={8} /> : null}
      {query.isError && !query.data ? (
        <ErrorState
          title="Club unavailable"
          body={query.error instanceof Error ? query.error.message : "Could not load the roster."}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {club ? (
        <>
          <section className="rounded-2xl bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-subtle">#{club.tag}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {club.description || "Invite-only club."}
                </p>
              </div>
              <p className="shrink-0 rounded-full bg-surface-2 px-2 py-1 text-[11px] text-muted">
                {clubTypeLabel(club.type)}
              </p>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Stat label="Members" value={`${club.memberCount}`} />
              <Stat label="Trophies" value={formatTrophies(club.trophies)} />
              <Stat label="Required" value={formatTrophies(club.requiredTrophies)} />
            </dl>
            <p className="mt-3 flex items-center gap-1 text-[11px] text-subtle">
              <Clock className="size-3" />
              Updated {formatRelative(club.fetchedAt)}
              {query.data?.source ? ` · ${query.data.source}` : ""}
            </p>
          </section>

          <ActivityBlock
            events={events}
            baseline={query.data?.baseline ?? false}
            tracking={query.data?.tracking ?? false}
          />

          <label className="flex min-h-11 items-center gap-2 rounded-xl bg-surface px-3">
            <Search className="size-4 text-subtle" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search members"
              aria-label="Search members"
              className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
            />
          </label>

          <section>
            <h2 className="mb-1.5 font-display text-lg tracking-wide">Members</h2>
            {filtered.length === 0 ? (
              <EmptyState title="No one matches" body="Clear search to see the full roster." />
            ) : (
              <ul className="flex flex-col gap-1.5">
                {filtered.map((m) => (
                  <MemberRow key={m.tag} member={m} rank={rankByTag.get(m.tag) ?? 0} />
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
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

function MemberRow({ member, rank }: { member: ClubMember; rank: number }) {
  const color = nameColorToCss(member.nameColor);
  return (
    <li>
      <Link
        to="/m/$tag"
        params={{ tag: member.tag }}
        className="flex min-h-14 items-center gap-3 rounded-xl bg-surface px-3 py-2 transition-transform duration-150 ease-out active:scale-[0.98]"
      >
        <span className="w-5 shrink-0 text-center font-mono text-xs tabular text-subtle">
          {rank || "–"}
        </span>
        <PlayerIcon src={member.iconUrl} name={member.name} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium" style={color ? { color } : undefined}>
            {member.name}
          </p>
          <p
            className={cn(
              "text-xs",
              member.role === "president" || member.role === "vicePresident"
                ? "text-gold"
                : "text-subtle",
            )}
          >
            {roleLabel(member.role)}
          </p>
        </div>
        <p className="shrink-0 font-mono text-sm tabular text-gold">{formatTrophies(member.trophies)}</p>
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
  return (
    <section>
      <h2 className="mb-1.5 font-display text-lg tracking-wide">Joined / left</h2>
      {events.length === 0 ? (
        <p className="rounded-xl bg-surface px-3 py-3 text-sm text-muted">
          {baseline
            ? "Roster snapshot saved. The next join or leave will show up here."
            : tracking
              ? "No joins or leaves since tracking started."
              : "Live roster is up. Activity log could not be saved this time."}
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
                  {ev.kind === "join" ? (
                    <>
                      <span className="font-medium">{ev.playerName}</span> joined
                      {ev.roleTo ? ` as ${roleLabel(ev.roleTo)}` : ""}
                    </>
                  ) : ev.kind === "leave" ? (
                    <>
                      <span className="font-medium">{ev.playerName}</span> left
                      {ev.roleFrom ? ` · was ${roleLabel(ev.roleFrom)}` : ""}
                    </>
                  ) : (
                    <>
                      <span className="font-medium">{ev.playerName}</span>
                      {" · "}
                      {roleLabel(ev.roleFrom)} → {roleLabel(ev.roleTo)}
                    </>
                  )}
                </p>
                <p className="text-xs text-subtle">{formatRelative(ev.occurredAt)}</p>
              </div>
              {ev.kind !== "leave" ? (
                <Link
                  to="/m/$tag"
                  params={{ tag: ev.playerTag }}
                  className="shrink-0 text-xs text-muted"
                >
                  Stats
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
