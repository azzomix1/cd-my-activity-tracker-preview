create table if not exists activity_person_alias_map (
  alias text primary key,
  user_id text not null references app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists activity_person_alias_map_user_id_idx
  on activity_person_alias_map (user_id);

update activities a
set employee_user_id = m.user_id
from activity_person_alias_map m
where a.employee_user_id is null
  and lower(trim(a.person)) = lower(trim(m.alias));
