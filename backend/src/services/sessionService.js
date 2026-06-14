import { query } from '../db/pool.js';
import { config } from '../config.js';
import {
  setSessionState,
  setAwayTimer,
  clearAwayTimer,
  setLivenessDue,
  setLivenessGrace,
  clearLivenessGrace,
  clearSessionTimers,
  setUserActiveSession,
  acquireLock,
  releaseLock,
  RedisKeys,
} from '../redis/client.js';
import { logAudit } from './auditService.js';
import { notifyLivenessPrompt, notifySessionEnded } from './notificationService.js';

// Read from config.timers at call time so admin runtime updates take effect

function anonymizeName(name) {
  if (!name) return null;
  const parts = name.split(' ');
  return parts.map((p) => p[0]?.toUpperCase() || '').join('.');
}

export async function getDeskWithSession(deskId) {
  const result = await query(
    `SELECT d.*, z.name as zone_name,
            s.id as session_id, s.status as session_status, s.checkin_time,
            s.away_start, s.away_count, s.liveness_due, s.liveness_prompted_at,
            u.id as occupant_id, u.name as occupant_name
     FROM desks d
     JOIN zones z ON d.zone_id = z.id
     LEFT JOIN sessions s ON s.desk_id = d.id AND s.status IN ('active', 'away', 'liveness_pending')
     LEFT JOIN users u ON s.user_id = u.id
     WHERE d.id = $1`,
    [deskId]
  );
  return result.rows[0];
}

export async function getAllDesks({ floor, zoneId, status } = {}) {
  let sql = `
    SELECT d.*, z.name as zone_name,
           s.id as session_id, s.status as session_status, s.checkin_time,
           s.away_start, s.away_count, s.liveness_due, s.liveness_prompted_at,
           u.id as occupant_id, u.name as occupant_name
    FROM desks d
    JOIN zones z ON d.zone_id = z.id
    LEFT JOIN sessions s ON s.desk_id = d.id AND s.status IN ('active', 'away', 'liveness_pending')
    LEFT JOIN users u ON s.user_id = u.id
    WHERE 1=1
  `;
  const params = [];
  let idx = 1;

  if (floor) {
    sql += ` AND d.floor = $${idx++}`;
    params.push(floor);
  }
  if (zoneId) {
    sql += ` AND d.zone_id = $${idx++}`;
    params.push(zoneId);
  }
  if (status) {
    sql += ` AND d.status = $${idx++}`;
    params.push(status);
  }

  sql += ' ORDER BY d.desk_code';
  const result = await query(sql, params);
  return result.rows.map(formatDeskResponse);
}

function formatDeskResponse(desk) {
  const now = Date.now();
  let timeRemaining = null;
  let timeElapsed = null;

  if (desk.checkin_time) {
    timeElapsed = Math.floor((now - new Date(desk.checkin_time).getTime()) / 1000);
  }

  if (desk.status === 'away' && desk.away_start) {
    const awayExpires = new Date(desk.away_start).getTime() + awayLimitMinutes * 60 * 1000;
    timeRemaining = Math.max(0, Math.floor((awayExpires - now) / 1000));
  } else if (desk.status === 'occupied' && desk.liveness_due) {
    timeRemaining = Math.max(0, Math.floor((new Date(desk.liveness_due).getTime() - now) / 1000));
  }

  return {
    id: desk.id,
    deskCode: desk.desk_code,
    zoneId: desk.zone_id,
    zoneName: desk.zone_name,
    floor: desk.floor,
    qrCode: desk.qr_code,
    status: desk.status,
    x: parseFloat(desk.x_coord),
    y: parseFloat(desk.y_coord),
    width: parseFloat(desk.width),
    height: parseFloat(desk.height),
    sessionId: desk.session_id,
    sessionStatus: desk.session_status,
    checkinTime: desk.checkin_time,
    awayStart: desk.away_start,
    awayCount: desk.away_count,
    livenessDue: desk.liveness_due,
    occupant: desk.occupant_id ? {
      id: desk.occupant_id,
      initials: anonymizeName(desk.occupant_name),
    } : null,
    timeElapsed,
    timeRemaining,
  };
}

export async function getUserActiveSession(userId) {
  const result = await query(
    `SELECT s.*, s.duration_minutes, s.expires_at, s.extended_count, s.away_start,
            d.desk_code, d.status as desk_status, d.id as desk_id, z.name as zone_name
     FROM sessions s
     JOIN desks d ON s.desk_id = d.id
     JOIN zones z ON d.zone_id = z.id
     WHERE s.user_id = $1 AND s.status IN ('active', 'away', 'liveness_pending')
     ORDER BY s.checkin_time DESC LIMIT 1`,
    [userId]
  );
  const session = result.rows[0];
  if (!session) return null;

  const { awayLimitMinutes, maxAwayPeriods, livenessGraceMinutes } = config.timers;
  const now = Date.now();
  let awayExpiresAt = null;
  let livenessDueAt = session.liveness_due;

  if (session.status === 'away' && session.away_start) {
    awayExpiresAt = new Date(session.away_start).getTime() + awayLimitMinutes * 60 * 1000;
  }

  return {
    id: session.id,
    deskId: session.desk_id,
    deskCode: session.desk_code,
    deskStatus: session.desk_status,
    zoneName: session.zone_name,
    status: session.status,
    checkinTime: session.checkin_time,
    awayStart: session.away_start,
    awayCount: session.away_count,
    awayExpiresAt,
    awayRemainingSeconds: awayExpiresAt ? Math.max(0, Math.floor((awayExpiresAt - now) / 1000)) : null,
    livenessDueAt,
    livenessRemainingSeconds: livenessDueAt ? Math.max(0, Math.floor((new Date(livenessDueAt).getTime() - now) / 1000)) : null,
    livenessPromptedAt: session.liveness_prompted_at,
    durationMinutes: session.duration_minutes,
    expiresAt: session.expires_at,
    extendedCount: session.extended_count,
    maxAwayPeriods,
    awayLimitMinutes,
    livenessGraceMinutes,
  };
}

export async function checkIn(userId, deskCode, durationMinutes = 120) {
  const lockKey = RedisKeys.deskLock(deskCode);
  const lock = await acquireLock(lockKey, 10);
  if (!lock) throw new Error('Desk operation in progress, try again');

  try {
    const deskResult = await query('SELECT * FROM desks WHERE desk_code = $1', [deskCode]);
    const desk = deskResult.rows[0];
    if (!desk) throw new Error('Desk not found');
    if (desk.status !== 'free') throw new Error('Desk is not available');

    const existingSession = await query(
      `SELECT id FROM sessions WHERE user_id = $1 AND status IN ('active', 'away', 'liveness_pending')`,
      [userId]
    );
    if (existingSession.rows.length > 0) {
      throw new Error('You already have an active session. One desk per student.');
    }

    const { livenessIntervalHours } = config.timers;
    const livenessDue = new Date(Date.now() + livenessIntervalHours * 60 * 60 * 1000);
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    const sessionResult = await query(
      `INSERT INTO sessions (desk_id, user_id, liveness_due, status, duration_minutes, expires_at)
       VALUES ($1, $2, $3, 'active', $4, $5) RETURNING *`,
      [desk.id, userId, livenessDue, durationMinutes, expiresAt]
    );
    const session = sessionResult.rows[0];

    await query(`UPDATE desks SET status = 'occupied', updated_at = NOW() WHERE id = $1`, [desk.id]);
    await query(`UPDATE users SET active_desk_id = $1, updated_at = NOW() WHERE id = $2`, [desk.id, userId]);

    await setSessionState(session.id, {
      status: 'active',
      deskId: desk.id,
      userId,
      checkinTime: session.checkin_time,
    });
    await setLivenessDue(session.id, livenessDue.getTime());
    await setUserActiveSession(userId, session.id);

    await logAudit({
      deskId: desk.id,
      userId,
      sessionId: session.id,
      action: 'check_in',
      details: { deskCode },
    });

    return { session, desk: await getDeskWithSession(desk.id) };
  } finally {
    await releaseLock(lockKey, lock);
  }
}

export async function markAway(userId, sessionId) {
  const sessionResult = await query(
    `SELECT s.*, d.id as desk_id, d.desk_code FROM sessions s
     JOIN desks d ON s.desk_id = d.id
     WHERE s.id = $1 AND s.user_id = $2 AND s.status = 'active'`,
    [sessionId, userId]
  );
  const session = sessionResult.rows[0];
  if (!session) throw new Error('No active session found');

  const { awayLimitMinutes, maxAwayPeriods } = config.timers;
  if (session.away_count >= maxAwayPeriods) {
    throw new Error(`Maximum away periods (${maxAwayPeriods}) reached for this session`);
  }

  const awayStart = new Date();
  const awayExpires = new Date(awayStart.getTime() + awayLimitMinutes * 60 * 1000);

  await query(
    `UPDATE sessions SET status = 'away', away_start = $1, away_count = away_count + 1, updated_at = NOW()
     WHERE id = $2`,
    [awayStart, sessionId]
  );
  await query(`UPDATE desks SET status = 'away', updated_at = NOW() WHERE id = $1`, [session.desk_id]);

  await setSessionState(sessionId, { status: 'away', awayStart: awayStart.toISOString() });
  await setAwayTimer(sessionId, awayExpires.getTime());

  await logAudit({
    deskId: session.desk_id,
    userId,
    sessionId,
    action: 'away',
    details: { awayCount: session.away_count + 1 },
  });

  return getUserActiveSession(userId);
}


export async function markBack(userId, sessionId) {
  const sessionResult = await query(
    `SELECT s.*, d.id as desk_id FROM sessions s
     JOIN desks d ON s.desk_id = d.id
     WHERE s.id = $1 AND s.user_id = $2 AND s.status = 'away'`,
    [sessionId, userId]
  );
  const session = sessionResult.rows[0];
  if (!session) throw new Error('No away session found');

  await query(
    `UPDATE sessions SET status = 'active', away_start = NULL, updated_at = NOW() WHERE id = $1`,
    [sessionId]
  );
  await query(`UPDATE desks SET status = 'occupied', updated_at = NOW() WHERE id = $1`, [session.desk_id]);

  await setSessionState(sessionId, { status: 'active' });
  await clearAwayTimer(sessionId); // properly delete the key instead of setting epoch 0

  await logAudit({ deskId: session.desk_id, userId, sessionId, action: 'back' });

  return getUserActiveSession(userId);
}

export async function respondLiveness(userId, sessionId) {
  const sessionResult = await query(
    `SELECT s.*, d.id as desk_id FROM sessions s
     JOIN desks d ON s.desk_id = d.id
     WHERE s.id = $1 AND s.user_id = $2 AND s.status = 'liveness_pending'`,
    [sessionId, userId]
  );
  const session = sessionResult.rows[0];
  if (!session) throw new Error('No liveness prompt pending');

  const { livenessIntervalHours } = config.timers;
  const newLivenessDue = new Date(Date.now() + livenessIntervalHours * 60 * 60 * 1000);

  await query(
    `UPDATE sessions SET status = 'active', liveness_due = $1, liveness_prompted_at = NULL, updated_at = NOW()
     WHERE id = $2`,
    [newLivenessDue, sessionId]
  );
  await query(`UPDATE desks SET status = 'occupied', updated_at = NOW() WHERE id = $1`, [session.desk_id]);

  await setSessionState(sessionId, { status: 'active' });
  await setLivenessDue(sessionId, newLivenessDue.getTime());
  await clearLivenessGrace(sessionId); // properly delete the key instead of setting epoch 0

  await logAudit({ deskId: session.desk_id, userId, sessionId, action: 'liveness_confirmed' });

  return getUserActiveSession(userId);
}

export async function checkout(userId, sessionId, reason = 'manual_checkout') {
  return endSession(sessionId, reason, userId);
}

export async function endSession(sessionId, reason, userId = null) {
  const sessionResult = await query(
    `SELECT s.*, d.id as desk_id, d.desk_code FROM sessions s
     JOIN desks d ON s.desk_id = d.id
     WHERE s.id = $1 AND s.status IN ('active', 'away', 'liveness_pending')`,
    [sessionId]
  );
  const session = sessionResult.rows[0];
  if (!session) return null;

  const endStatus = reason.includes('abandon') ? 'abandoned' : 'ended';
  const deskStatus = reason.includes('abandon') ? 'abandoned' : 'free';

  await query(
    `UPDATE sessions SET status = $1, checkout_time = NOW(), end_reason = $2, updated_at = NOW() WHERE id = $3`,
    [endStatus, reason, sessionId]
  );
  await query(`UPDATE desks SET status = $1, updated_at = NOW() WHERE id = $2`, [deskStatus, session.desk_id]);

  if (session.user_id) {
    await query(`UPDATE users SET active_desk_id = NULL, updated_at = NOW() WHERE id = $1`, [session.user_id]);
    await setUserActiveSession(session.user_id, null);
    notifySessionEnded(session.user_id, reason);
  }

  await clearSessionTimers(sessionId);

  await logAudit({
    deskId: session.desk_id,
    userId: userId || session.user_id,
    sessionId,
    action: endStatus === 'abandoned' ? 'abandoned' : 'checkout',
    details: { reason },
  });

  if (deskStatus === 'abandoned') {
    setTimeout(async () => {
      await query(`UPDATE desks SET status = 'free', updated_at = NOW() WHERE id = $1 AND status = 'abandoned'`, [session.desk_id]);
    }, 30000);
  }

  return session;
}

export async function triggerLivenessPrompt(session) {
  const { livenessGraceMinutes } = config.timers;
  const graceExpires = new Date(Date.now() + livenessGraceMinutes * 60 * 1000);

  await query(
    `UPDATE sessions SET status = 'liveness_pending', liveness_prompted_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [session.id]
  );
  await query(`UPDATE desks SET status = 'occupied', updated_at = NOW() WHERE id = $1`, [session.desk_id]);

  await setSessionState(session.id, { status: 'liveness_pending' });
  await setLivenessGrace(session.id, graceExpires.getTime());

  notifyLivenessPrompt(session.user_id, session.id, livenessGraceMinutes);

  await logAudit({
    deskId: session.desk_id,
    userId: session.user_id,
    sessionId: session.id,
    action: 'liveness_prompted',
  });
}

export async function getUserHistory(userId, limit = 20) {
  const result = await query(
    `SELECT s.*, d.desk_code, z.name as zone_name
     FROM sessions s
     JOIN desks d ON s.desk_id = d.id
     JOIN zones z ON d.zone_id = z.id
     WHERE s.user_id = $1
     ORDER BY s.checkin_time DESC LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

export async function getDeskByCode(deskCode) {
  const result = await query(
    `SELECT d.*, z.name as zone_name FROM desks d
     JOIN zones z ON d.zone_id = z.id WHERE d.desk_code = $1`,
    [deskCode]
  );
  return result.rows[0];
}

export async function extendSession(userId, sessionId) {
  const result = await query(
    `UPDATE sessions SET
       expires_at = expires_at + INTERVAL '30 minutes',
       extended_count = extended_count + 1,
       updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status IN ('active', 'away', 'liveness_pending')
     RETURNING *`,
    [sessionId, userId]
  );
  if (!result.rows[0]) throw new Error('Session not found or not yours');
  return getUserActiveSession(userId);
}
