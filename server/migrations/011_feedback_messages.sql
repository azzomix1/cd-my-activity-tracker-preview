create table if not exists feedback_messages (
  id bigserial primary key,
  user_id text references app_users(id) on delete set null,
  sender_name text not null default '',
  sender_email text not null default '',
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists feedback_messages_created_at_idx on feedback_messages (created_at desc);
create index if not exists feedback_messages_user_id_idx on feedback_messages (user_id);
