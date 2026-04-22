create table if not exists user_hierarchy (
  manager_user_id text not null references app_users(id) on delete cascade,
  employee_user_id text not null references app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (manager_user_id, employee_user_id),
  constraint user_hierarchy_no_self check (manager_user_id <> employee_user_id)
);

create index if not exists user_hierarchy_manager_idx on user_hierarchy (manager_user_id);
create index if not exists user_hierarchy_employee_idx on user_hierarchy (employee_user_id);