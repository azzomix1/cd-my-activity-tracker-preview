alter table app_users
drop constraint if exists app_users_role_check;

alter table app_users
add constraint app_users_role_check
check (
  role in (
    'administrator',
    'employee',
    'line_manager',
    'full_manager',
    'support_sales_head',
    'support_sales_manager'
  )
);
