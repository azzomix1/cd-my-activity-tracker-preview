-- Справочник объектов (площадок/локаций проведения мероприятий)
create table if not exists objects (
  id        serial primary key,
  name      text not null,
  address   text not null default '',
  description text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists objects_name_idx on objects (lower(name));

-- Ссылка из активностей на объект-справочник (nullable — старые записи остаются без object_id)
alter table activities
  add column if not exists object_id integer references objects(id) on delete set null;

create index if not exists activities_object_id_idx on activities (object_id);
