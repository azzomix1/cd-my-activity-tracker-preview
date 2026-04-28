alter table activity_reports
  add column if not exists created_by_user_id text references app_users(id) on delete set null,
  add column if not exists updated_by_user_id text references app_users(id) on delete set null;

with ranked_reports as (
  select
    activity_id,
    employee_user_id,
    row_number() over (
      partition by activity_id
      order by updated_at desc, created_at desc, employee_user_id asc
    ) as row_number
  from activity_reports
)
delete from activity_reports ar
using ranked_reports rr
where ar.activity_id = rr.activity_id
  and ar.employee_user_id = rr.employee_user_id
  and rr.row_number > 1;

update activity_reports
set
  created_by_user_id = coalesce(created_by_user_id, employee_user_id),
  updated_by_user_id = coalesce(updated_by_user_id, employee_user_id);

drop index if exists activity_reports_employee_user_id_idx;

alter table activity_reports
  drop constraint if exists activity_reports_pkey;

alter table activity_reports
  add constraint activity_reports_pkey primary key (activity_id);

alter table activity_reports
  drop column if exists employee_user_id;

alter table activity_report_drafts
  add column if not exists created_by_user_id text references app_users(id) on delete set null,
  add column if not exists updated_by_user_id text references app_users(id) on delete set null;

with ranked_drafts as (
  select
    activity_id,
    employee_user_id,
    row_number() over (
      partition by activity_id
      order by updated_at desc, created_at desc, employee_user_id asc
    ) as row_number
  from activity_report_drafts
)
delete from activity_report_drafts ard
using ranked_drafts rd
where ard.activity_id = rd.activity_id
  and ard.employee_user_id = rd.employee_user_id
  and rd.row_number > 1;

update activity_report_drafts
set
  created_by_user_id = coalesce(created_by_user_id, employee_user_id),
  updated_by_user_id = coalesce(updated_by_user_id, employee_user_id);

drop index if exists activity_report_drafts_employee_user_id_idx;

alter table activity_report_drafts
  drop constraint if exists activity_report_drafts_pkey;

alter table activity_report_drafts
  add constraint activity_report_drafts_pkey primary key (activity_id);

alter table activity_report_drafts
  drop column if exists employee_user_id;

create table if not exists activity_notifications (
  id bigserial primary key,
  recipient_user_id text not null references app_users(id) on delete cascade,
  activity_id text not null references activities(id) on delete cascade,
  notification_type text not null,
  notification_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists activity_notifications_recipient_created_idx
  on activity_notifications (recipient_user_id, created_at desc);

create index if not exists activity_notifications_recipient_unread_idx
  on activity_notifications (recipient_user_id)
  where read_at is null;
