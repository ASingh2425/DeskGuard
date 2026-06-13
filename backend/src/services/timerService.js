import { query } from '../db/pool.js';
import { endSession, triggerLivenessPrompt } from './sessionService.js';
import { config } from '../config.js';
import redis, { acquireLock, releaseLock, RedisKeys } from '../redis/client.js';
import { notifyAwayReminder } from './notificationService.js';

const { awayLimitMinutes, livenessGraceMinutes } = config.timers;

export async function runSweep(io) {
  const lockToken = await acquireLock(RedisKeys.sweepLock(), config.timers.sweepIntervalSeconds - 5);
  if (!lockToken) {
    console.log('[sweep] Skipped — another worker holds lock');
    return { skipped: true };
  }

  const stats = { awayExpired: 0, livenessPrompted: 0, livenessAbandoned: 0 };

  try {
    const awaySessions = await query(
      `SELECT s.*, d.desk_code FROM sessions s
       JOIN desks d ON s.desk_id = d.id
       WHERE s.status = 'away' AND s.away_start IS NOT NULL`
    );

    const now = Date.now();
    for (const session of awaySessions.rows) {
      const awayExpires = new Date(session.away_start).getTime() + awayLimitMinutes * 60 * 1000;
      const remaining = awayExpires - now;

      if (remaining <= 0) {
        await endSession(session.id, 'abandoned_via_away_timeout');
        stats.awayExpired++;
        if (io) io.emit('desk:update', { type: 'abandoned', sessionId: session.id });
      } else if (remaining <= 5 * 60 * 1000 && remaining > 4 * 60 * 1000) {
        notifyAwayReminder(session.user_id, 5);
      }
    }

    const activeSessions = await query(
      `SELECT s.*, d.desk_code FROM sessions s
       JOIN desks d ON s.desk_id = d.id
       WHERE s.status = 'active' AND s.liveness_due IS NOT NULL AND s.liveness_due <= NOW()`
    );

    for (const session of activeSessions.rows) {
      await triggerLivenessPrompt(session);
      stats.livenessPrompted++;
      if (io) io.emit('desk:update', { type: 'liveness_prompt', sessionId: session.id });
    }

    const pendingLiveness = await query(
      `SELECT s.*, d.desk_code FROM sessions s
       JOIN desks d ON s.desk_id = d.id
       WHERE s.status = 'liveness_pending' AND s.liveness_prompted_at IS NOT NULL`
    );

    for (const session of pendingLiveness.rows) {
      const graceExpires = new Date(session.liveness_prompted_at).getTime() + livenessGraceMinutes * 60 * 1000;
      if (now >= graceExpires) {
        await endSession(session.id, 'abandoned_via_liveness_timeout');
        stats.livenessAbandoned++;
        if (io) io.emit('desk:update', { type: 'abandoned', sessionId: session.id });
      }
    }

    const redisAwayKeys = await redis.keys('session:*:away_expires');
    for (const key of redisAwayKeys) {
      const ttl = await redis.ttl(key);
      if (ttl === -2) {
        const sessionId = key.split(':')[1];
        const sessionCheck = await query(
          `SELECT id, status FROM sessions WHERE id = $1 AND status = 'away'`,
          [sessionId]
        );
        if (sessionCheck.rows.length > 0) {
          await endSession(sessionId, 'abandoned_via_away_timeout');
          stats.awayExpired++;
        }
      }
    }

    console.log(`[sweep] Complete:`, stats);
    return stats;
  } finally {
    await releaseLock(RedisKeys.sweepLock(), lockToken);
  }
}

export async function getAnalytics() {
  const [utilization, abandonment, peakHours, avgDuration] = await Promise.all([
    query(`
      SELECT
        COUNT(*) FILTER (WHERE status != 'free') as occupied,
        COUNT(*) as total,
        ROUND(100.0 * COUNT(*) FILTER (WHERE status != 'free') / NULLIF(COUNT(*), 0), 1) as utilization_rate
      FROM desks
    `),
    query(`
      SELECT
        COUNT(*) FILTER (WHERE end_reason LIKE 'abandoned%') as abandoned,
        COUNT(*) as total_sessions,
        ROUND(100.0 * COUNT(*) FILTER (WHERE end_reason LIKE 'abandoned%') / NULLIF(COUNT(*), 0), 1) as abandonment_rate
      FROM sessions WHERE checkout_time IS NOT NULL
    `),
    query(`
      SELECT EXTRACT(HOUR FROM checkin_time) as hour, COUNT(*) as checkins
      FROM sessions
      GROUP BY EXTRACT(HOUR FROM checkin_time)
      ORDER BY checkins DESC
    `),
    query(`
      SELECT ROUND(AVG(EXTRACT(EPOCH FROM (checkout_time - checkin_time)) / 60), 1) as avg_minutes
      FROM sessions WHERE checkout_time IS NOT NULL
    `),
  ]);

  const zoneUsage = await query(`
    SELECT z.name, COUNT(s.id) as sessions,
           COUNT(*) FILTER (WHERE s.end_reason LIKE 'abandoned%') as abandonments
    FROM zones z
    LEFT JOIN desks d ON d.zone_id = z.id
    LEFT JOIN sessions s ON s.desk_id = d.id
    GROUP BY z.id, z.name
    ORDER BY sessions DESC
  `);

  return {
    utilization: utilization.rows[0],
    abandonment: abandonment.rows[0],
    peakHours: peakHours.rows,
    avgSessionMinutes: avgDuration.rows[0]?.avg_minutes || 0,
    zoneUsage: zoneUsage.rows,
  };
}
