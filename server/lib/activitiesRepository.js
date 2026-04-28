import { pool, query } from './db.js';
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
        a.id,
        a.employee_user_id,
        to_char(event_date, 'DD.MM.YYYY') as event_date,
        to_char(event_time, 'HH24:MI:SS') as event_time,
        a.name,
        a.person,
        a.objects,
        a.event_type,
        a.visibility,
        coalesce(array_remove(array_agg(ap.employee_user_id order by ap.employee_user_id), null), '{}') as participant_user_ids,
        coalesce(array_remove(array_agg(coalesce(u.display_name, u.email, '') order by coalesce(u.display_name, u.email, '')), ''), '{}') as participant_names
      from activities a
      left join activity_participants ap on ap.activity_id = a.id
      left join app_users u on u.id = ap.employee_user_id
      group by a.id
      order by event_date asc, event_time asc nulls first, a.name asc
    `,
  );

  return result.rows.map(mapDbRowToActivity);
}

export async function listPublicActivities() {
  const result = await query(
    `
      select
        a.id,
        a.employee_user_id,
        to_char(event_date, 'DD.MM.YYYY') as event_date,
        to_char(event_time, 'HH24:MI:SS') as event_time,
        a.name,
        a.person,
        a.objects,
        a.event_type,
        a.visibility,
        coalesce(array_remove(array_agg(ap.employee_user_id order by ap.employee_user_id), null), '{}') as participant_user_ids,
        coalesce(array_remove(array_agg(coalesce(u.display_name, u.email, '') order by coalesce(u.display_name, u.email, '')), ''), '{}') as participant_names
      from activities a
      left join activity_participants ap on ap.activity_id = a.id
      left join app_users u on u.id = ap.employee_user_id
      where a.visibility = 'public'
      group by a.id
      order by event_date asc, event_time asc nulls first, a.name asc
    `,
  );

  return result.rows.map(mapDbRowToActivity);
}

export async function createActivity(activity) {
  const normalized = normalizeActivityInput(activity);

  if (!normalized.id) {
    throw new Error('Activity id is required.');
  }

  const client = await pool.connect();

  try {
    await client.query('begin');

    await client.query(
      `
        insert into activities (
          id,
          employee_user_id,
          event_date,
          event_time,
          name,
          person,
          objects,
          event_type,
          visibility
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        normalized.id,
        normalized.employeeUserId || normalized.participantUserIds[0] || null,
        parseDateString(normalized.date),
        parseTimeString(normalized.time),
        normalized.name,
        normalized.participantNames.length > 0 ? normalized.participantNames.join(', ') : normalized.person,
        normalized.objects,
        normalized.eventType,
        normalized.visibility,
      ],
    );

    for (const participantUserId of normalized.participantUserIds) {
      await client.query(
        `
          insert into activity_participants (activity_id, employee_user_id)
          values ($1, $2)
          on conflict (activity_id, employee_user_id) do nothing
        `,
        [normalized.id, participantUserId],
      );
    }

    const result = await client.query(
      `
        select
          a.id,
          a.employee_user_id,
          to_char(a.event_date, 'DD.MM.YYYY') as event_date,
          to_char(a.event_time, 'HH24:MI:SS') as event_time,
          a.name,
          a.person,
          a.objects,
          a.event_type,
          a.visibility,
          coalesce(array_remove(array_agg(ap.employee_user_id order by ap.employee_user_id), null), '{}') as participant_user_ids,
          coalesce(array_remove(array_agg(coalesce(u.display_name, u.email, '') order by coalesce(u.display_name, u.email, '')), ''), '{}') as participant_names
        from activities a
        left join activity_participants ap on ap.activity_id = a.id
        left join app_users u on u.id = ap.employee_user_id
        where a.id = $1
        group by a.id
      `,
      [normalized.id],
    );

    await client.query('commit');
    return mapDbRowToActivity(result.rows[0]);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateActivity(id, activity) {
  const normalized = normalizeActivityInput(activity);
  const targetId = String(id || normalized.id || '').trim();

  if (!targetId) {
    throw new Error('Activity id is required.');
  }

  const client = await pool.connect();

  try {
    await client.query('begin');

    const result = await client.query(
      `
        update activities
        set
          employee_user_id = $2,
          event_date = $3,
          event_time = $4,
          name = $5,
          person = $6,
          objects = $7,
          event_type = $8,
          visibility = $9,
          updated_at = now()
        where id = $1
      `,
      [
        targetId,
        normalized.employeeUserId || normalized.participantUserIds[0] || null,
        parseDateString(normalized.date),
        parseTimeString(normalized.time),
        normalized.name,
        normalized.participantNames.length > 0 ? normalized.participantNames.join(', ') : normalized.person,
        normalized.objects,
        normalized.eventType,
        normalized.visibility,
      ],
    );

    if (!result.rowCount) {
      throw new Error('Activity not found.');
    }

    await client.query('delete from activity_participants where activity_id = $1', [targetId]);

    for (const participantUserId of normalized.participantUserIds) {
      await client.query(
        `
          insert into activity_participants (activity_id, employee_user_id)
          values ($1, $2)
          on conflict (activity_id, employee_user_id) do nothing
        `,
        [targetId, participantUserId],
      );
    }

    const finalResult = await client.query(
      `
        select
          a.id,
          a.employee_user_id,
          to_char(a.event_date, 'DD.MM.YYYY') as event_date,
          to_char(a.event_time, 'HH24:MI:SS') as event_time,
          a.name,
          a.person,
          a.objects,
          a.event_type,
          a.visibility,
          coalesce(array_remove(array_agg(ap.employee_user_id order by ap.employee_user_id), null), '{}') as participant_user_ids,
          coalesce(array_remove(array_agg(coalesce(u.display_name, u.email, '') order by coalesce(u.display_name, u.email, '')), ''), '{}') as participant_names
        from activities a
        left join activity_participants ap on ap.activity_id = a.id
        left join app_users u on u.id = ap.employee_user_id
        where a.id = $1
        group by a.id
      `,
      [targetId],
    );

    await client.query('commit');
    return mapDbRowToActivity(finalResult.rows[0]);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteActivity(id) {
  const result = await query('delete from activities where id = $1', [String(id)]);

  if (!result.rowCount) {
    throw new Error('Activity not found.');
  }
}