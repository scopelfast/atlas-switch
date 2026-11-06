create table if not exists reunify_reason_catalog (
  id serial primary key,
  reason_type varchar(20) not null,
  code varchar(64) not null,
  label varchar(120) not null,
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create unique index if not exists reunify_reason_catalog_reason_type_code_unique
  on reunify_reason_catalog(reason_type, code);

create index if not exists reunify_reason_catalog_reason_type_active_idx
  on reunify_reason_catalog(reason_type, active);
