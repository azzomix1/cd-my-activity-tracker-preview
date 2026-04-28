create table if not exists activity_participants (
  activity_id text not null references activities(id) on delete cascade,
  employee_user_id text not null references app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (activity_id, employee_user_id)
);

create index if not exists activity_participants_employee_user_id_idx
  on activity_participants (employee_user_id);

insert into activity_participants (activity_id, employee_user_id)
select a.id, a.employee_user_id
from activities a
where a.employee_user_id is not null
on conflict (activity_id, employee_user_id) do nothing;

alter table activity_reports
  add column if not exists employee_user_id text references app_users(id) on delete cascade;

update activity_reports ar
set employee_user_id = a.employee_user_id
from activities a
where a.id = ar.activity_id
  and ar.employee_user_id is null
  and a.employee_user_id is not null;

delete from activity_reports
where employee_user_id is null;

alter table activity_reports
  drop constraint if exists activity_reports_pkey;

alter table activity_reports
  add constraint activity_reports_pkey primary key (activity_id, employee_user_id);

create index if not exists activity_reports_employee_user_id_idx
  on activity_reports (employee_user_id);

alter table activity_report_drafts
  add column if not exists employee_user_id text references app_users(id) on delete cascade;

update activity_report_drafts ard
set employee_user_id = a.employee_user_id
from activities a
where a.id = ard.activity_id
  and ard.employee_user_id is null
  and a.employee_user_id is not null;

delete from activity_report_drafts
where employee_user_id is null;

alter table activity_report_drafts
  drop constraint if exists activity_report_drafts_pkey;

alter table activity_report_drafts
  add constraint activity_report_drafts_pkey primary key (activity_id, employee_user_id);

create index if not exists activity_report_drafts_employee_user_id_idx
  on activity_report_drafts (employee_user_id);