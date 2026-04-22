with normalized_users as (
  select
    u.id,
    lower(trim(u.display_name)) as normalized_display_name,
    lower(trim(u.email)) as normalized_email,
    split_part(lower(trim(u.email)), '@', 1) as normalized_email_local
  from app_users u
  where u.is_active = true
),
activity_candidates as (
  select
    a.id as activity_id,
    lower(trim(a.person)) as normalized_person
  from activities a
  where a.employee_user_id is null
    and trim(coalesce(a.person, '')) <> ''
),
matches as (
  select
    ac.activity_id,
    nu.id as user_id,
    count(*) over (partition by ac.activity_id) as match_count,
    row_number() over (
      partition by ac.activity_id
      order by nu.id
    ) as match_rank
  from activity_candidates ac
  join normalized_users nu
    on ac.normalized_person = nu.normalized_display_name
    or ac.normalized_person = nu.normalized_email
    or ac.normalized_person = nu.normalized_email_local
)
update activities a
set employee_user_id = m.user_id
from matches m
where a.id = m.activity_id
  and m.match_count = 1
  and m.match_rank = 1;
