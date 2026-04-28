import { query } from './db.js';

function mapRow(row) {
  return {
    id: Number(row.id),
    name: String(row.name || ''),
    address: String(row.address || ''),
    description: String(row.description || ''),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listObjects({ includeInactive = false } = {}) {
  const result = await query(
    `
      select id, name, address, description, is_active, created_at, updated_at
      from objects
      ${includeInactive ? '' : "where is_active = true"}
      order by name asc
    `,
  );
  return result.rows.map(mapRow);
}

export async function createObject({ name, address = '', description = '' }) {
  const normalizedName = String(name || '').trim();
  if (!normalizedName) throw new Error('Название объекта обязательно.');

  const result = await query(
    `
      insert into objects (name, address, description)
      values ($1, $2, $3)
      returning id, name, address, description, is_active, created_at, updated_at
    `,
    [normalizedName, String(address || '').trim(), String(description || '').trim()],
  );
  return mapRow(result.rows[0]);
}

export async function updateObject(id, { name, address, description }) {
  const normalizedId = Number(id);
  if (!normalizedId) throw new Error('ID объекта обязателен.');

  const normalizedName = String(name || '').trim();
  if (!normalizedName) throw new Error('Название объекта обязательно.');

  const result = await query(
    `
      update objects
      set name = $1,
          address = $2,
          description = $3,
          updated_at = now()
      where id = $4
      returning id, name, address, description, is_active, created_at, updated_at
    `,
    [normalizedName, String(address || '').trim(), String(description || '').trim(), normalizedId],
  );
  if (result.rows.length === 0) throw new Error('Объект не найден.');
  return mapRow(result.rows[0]);
}

export async function setObjectActive(id, isActive) {
  const normalizedId = Number(id);
  if (!normalizedId) throw new Error('ID объекта обязателен.');

  const result = await query(
    `
      update objects
      set is_active = $1, updated_at = now()
      where id = $2
      returning id, name, address, description, is_active, created_at, updated_at
    `,
    [Boolean(isActive), normalizedId],
  );
  if (result.rows.length === 0) throw new Error('Объект не найден.');
  return mapRow(result.rows[0]);
}

export async function deleteObject(id) {
  const normalizedId = Number(id);
  if (!normalizedId) throw new Error('ID объекта обязателен.');

  await query('delete from objects where id = $1', [normalizedId]);
}
