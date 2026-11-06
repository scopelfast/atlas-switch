create table if not exists reunify_meeting_history (
  id serial primary key,
  team_id integer not null references teams(id) on delete cascade,
  meeting_id integer not null,
  action_type varchar(40) not null,
  payload text,
  performed_by_user_id integer references users(id) on delete set null,
  created_at timestamp with time zone not null default now()
);

create index if not exists reunify_meeting_history_team_meeting_idx
  on reunify_meeting_history(team_id, meeting_id);

create index if not exists reunify_meeting_history_created_at_idx
  on reunify_meeting_history(created_at);
