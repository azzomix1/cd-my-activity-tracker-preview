update app_users
set role = 'administrator'
where role = 'admin';

update app_users
set role = 'full_manager'
where role = 'manager';

alter table app_users
drop constraint if exists app_users_role_check;

alter table app_users
add constraint app_users_role_check
check (role in ('administrator', 'employee', 'line_manager', 'full_manager'));
