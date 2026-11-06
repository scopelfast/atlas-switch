create table if not exists integration_sync_events (
  id serial primary key,
  team_id integer not null references teams(id) on delete cascade,
  integration_key varchar(60) not null,
  entity_type varchar(40) not null,
  entity_id integer,
  operation varchar(40) not null,
  status varchar(20) not null,
  message text,
  payload text,
  created_at timestamp with time zone not null default now()
);

create index if not exists integration_sync_events_team_key_created_idx
  on integration_sync_events(team_id, integration_key, created_at desc);

create index if not exists integration_sync_events_team_entity_created_idx
  on integration_sync_events(team_id, entity_type, entity_id, created_at desc);
