create table if not exists activities (
  id text primary key,
  event_date date not null,
  event_time time without time zone,
  name text not null default '',
  person text not null default '',
  objects text not null default '',
  event_type text not null default 'internal' check (event_type in ('internal', 'external')),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists activity_reports (
  activity_id text primary key references activities(id) on delete cascade,
  report_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists activity_report_drafts (
  activity_id text primary key references activities(id) on delete cascade,
  draft_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists activities_event_date_idx on activities (event_date);
create index if not exists activities_person_idx on activities (person);
create index if not exists activities_visibility_idx on activities (visibility);