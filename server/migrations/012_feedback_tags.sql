alter table feedback_messages
  add column if not exists tags text[] not null default '{}';

create index if not exists feedback_messages_tags_idx on feedback_messages using gin (tags);
