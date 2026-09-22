-- Unowned public club roster snapshots for 'N3X (#2JYGUQ2P8).
-- No user_id: join/leave is shared, not personal. Insert-only events.
create table if not exists club_snapshot (
  id            integer primary key,
  fetched_at    timestamptz not null default now(),
  trophies      integer not null,
  member_count  integer not null,
  members_json  text not null
);

create table if not exists club_events (
  id           serial primary key,
  kind         text not null,
  player_tag   text not null,
  player_name  text not null,
  role_from    text,
  role_to      text,
  occurred_at  timestamptz not null default now()
);

create index if not exists club_events_occurred_idx on club_events (occurred_at desc);
