import { query } from '../db/pool.js';

export async function logAudit({ deskId, userId, sessionId, action, details = {} }) {
  await query(
    `INSERT INTO audit_logs (desk_id, user_id, session_id, action, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [deskId, userId, sessionId, action, JSON.stringify(details)]
  );
}

export async function getAuditLogs({ limit = 50, deskId, userId } = {}) {
  let sql = `
    SELECT al.*, u.name as user_name, d.desk_code
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    LEFT JOIN desks d ON al.desk_id = d.id
    WHERE 1=1
  `;
  const params = [];
  let idx = 1;

  if (deskId) {
    sql += ` AND al.desk_id = $${idx++}`;
    params.push(deskId);
  }
  if (userId) {
    sql += ` AND al.user_id = $${idx++}`;
    params.push(userId);
  }

  sql += ` ORDER BY al.timestamp DESC LIMIT $${idx}`;
  params.push(limit);

  const result = await query(sql, params);
  return result.rows;
}
