import { query } from './db.js';
import {
  mapDbRowToActivity,
  normalizeActivityInput,
  parseDateString,
  parseTimeString,
} from './activityModel.js';

export async function listActivities() {
  const result = await query(
    `
      select
        id,
        to_char(event_date, 'DD.MM.YYYY') as event_date,
        to_char(event_time, 'HH24:MI:SS') as event_time,
        name,
        person,
        objects,
        event_type,
        visibility
      from activities
      order by event_date asc, event_time asc nulls first, name asc
    `,
  );

  return result.rows.map(mapDbRowToActivity);
}

export async function createActivity(activity) {
  const normalized = normalizeActivityInput(activity);

  if (!normalized.id) {
    throw new Error('Activity id is required.');
  }

  const result = await query(
    `
      insert into activities (
        id,
        event_date,
        event_time,
        name,
        person,
        objects,
        event_type,
        visibility
      ) values ($1, $2, $3, $4, $5, $6, $7, $8)
      returning
        id,
        to_char(event_date, 'DD.MM.YYYY') as event_date,
        to_char(event_time, 'HH24:MI:SS') as event_time,
        name,
        person,
        objects,
        event_type,
        visibility
    `,
    [
      normalized.id,
      parseDateString(normalized.date),
      parseTimeString(normalized.time),
      normalized.name,
      normalized.person,
      normalized.objects,
      normalized.eventType,
      normalized.visibility,
    ],
  );

  return mapDbRowToActivity(result.rows[0]);
}

export async function updateActivity(id, activity) {
  const normalized = normalizeActivityInput(activity);
  const targetId = String(id || normalized.id || '').trim();

  if (!targetId) {
    throw new Error('Activity id is required.');
  }

  const result = await query(
    `
      update activities
      set
        event_date = $2,
        event_time = $3,
        name = $4,
        person = $5,
        objects = $6,
        event_type = $7,
        visibility = $8,
        updated_at = now()
      where id = $1
      returning
        id,
        to_char(event_date, 'DD.MM.YYYY') as event_date,
        to_char(event_time, 'HH24:MI:SS') as event_time,
        name,
        person,
        objects,
        event_type,
        visibility
    `,
    [
      targetId,
      parseDateString(normalized.date),
      parseTimeString(normalized.time),
      normalized.name,
      normalized.person,
      normalized.objects,
      normalized.eventType,
      normalized.visibility,
    ],
  );

  if (!result.rowCount) {
    throw new Error('Activity not found.');
  }

  return mapDbRowToActivity(result.rows[0]);
}

export async function deleteActivity(id) {
  const result = await query('delete from activities where id = $1', [String(id)]);

  if (!result.rowCount) {
    throw new Error('Activity not found.');
  }
}