alter table activities
add column if not exists employee_user_id text references app_users(id) on delete set null;

create index if not exists activities_employee_user_id_idx on activities (employee_user_id);