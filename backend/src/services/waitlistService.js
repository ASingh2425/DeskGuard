import { query } from '../db/pool.js';

/**
 * Join the waitlist for a desk identified by deskCode.
 * Returns the waitlist position (1-based).
 */
export async function joinWaitlist(userId, deskCode) {
  // Resolve desk
  const deskResult = await query('SELECT id FROM desks WHERE desk_code = $1', [deskCode]);
  const desk = deskResult.rows[0];
  if (!desk) throw new Error('Desk not found');

  // Insert (ignore duplicate — user already on waitlist)
  await query(
    `INSERT INTO waitlist (desk_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (desk_id, user_id) DO NOTHING`,
    [desk.id, userId]
  );

  return getWaitlistPosition(userId, deskCode);
}

/**
 * Leave the waitlist for a desk identified by deskCode.
 */
export async function leaveWaitlist(userId, deskCode) {
  const deskResult = await query('SELECT id FROM desks WHERE desk_code = $1', [deskCode]);
  const desk = deskResult.rows[0];
  if (!desk) throw new Error('Desk not found');

  await query(
    `DELETE FROM waitlist WHERE desk_id = $1 AND user_id = $2`,
    [desk.id, userId]
  );
}

/**
 * Get the ordered waitlist for a desk, each entry includes position.
 * Returns: [{userId, name, position, joinedAt}]
 */
export async function getWaitlist(deskCode) {
  const deskResult = await query('SELECT id FROM desks WHERE desk_code = $1', [deskCode]);
  const desk = deskResult.rows[0];
  if (!desk) throw new Error('Desk not found');

  const result = await query(
    `SELECT w.user_id, u.name, w.joined_at,
            ROW_NUMBER() OVER (ORDER BY w.joined_at ASC) AS position
     FROM waitlist w
     JOIN users u ON w.user_id = u.id
     WHERE w.desk_id = $1
     ORDER BY w.joined_at ASC`,
    [desk.id]
  );

  return result.rows.map((row) => ({
    userId: row.user_id,
    name: row.name,
    position: parseInt(row.position, 10),
    joinedAt: row.joined_at,
  }));
}

/**
 * Get the 1-based waitlist position for a specific user, or null if not in waitlist.
 */
export async function getWaitlistPosition(userId, deskCode) {
  const deskResult = await query('SELECT id FROM desks WHERE desk_code = $1', [deskCode]);
  const desk = deskResult.rows[0];
  if (!desk) throw new Error('Desk not found');

  const result = await query(
    `SELECT position FROM (
       SELECT user_id, ROW_NUMBER() OVER (ORDER BY joined_at ASC) AS position
       FROM waitlist
       WHERE desk_id = $1
     ) ranked
     WHERE user_id = $2`,
    [desk.id, userId]
  );

  return result.rows[0] ? parseInt(result.rows[0].position, 10) : null;
}

/**
 * Notify the first unnotified person in the waitlist for a given desk (by desk UUID).
 * Updates notified_at, emits socket events.
 */
export async function notifyNextInWaitlist(deskId, io) {
  // Find the first unnotified entry
  const result = await query(
    `SELECT w.id, w.user_id, d.desk_code
     FROM waitlist w
     JOIN desks d ON w.desk_id = d.id
     WHERE w.desk_id = $1 AND w.notified_at IS NULL
     ORDER BY w.joined_at ASC
     LIMIT 1`,
    [deskId]
  );

  const entry = result.rows[0];
  if (!entry) return; // Nobody waiting or all already notified

  // Mark as notified
  await query(
    `UPDATE waitlist SET notified_at = NOW() WHERE id = $1`,
    [entry.id]
  );

  const message = "Your waitlisted desk is now available! Book it quickly.";

  // Emit targeted notification to the user
  if (io) {
    io.emit(`notification:user:${entry.user_id}`, {
      type: 'waitlist_available',
      message,
      deskCode: entry.desk_code,
    });

    // Also broadcast a general desk refresh
    io.emit('desks:refresh');
  }
}

/**
 * Clear the entire waitlist for a desk (e.g. when desk goes to maintenance).
 */
export async function clearWaitlist(deskId) {
  await query('DELETE FROM waitlist WHERE desk_id = $1', [deskId]);
}
