import { Router } from 'express';
import { query } from '../db/pool.js';
import { getAllDesks, endSession } from '../services/sessionService.js';
import { getAuditLogs, logAudit } from '../services/auditService.js';
import { getAnalytics } from '../services/timerService.js';
import { getTimerConfig } from '../services/notificationService.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { config } from '../config.js';

const router = Router();

router.use(authenticate, requireRole('librarian', 'admin'));

router.get('/desks', async (req, res, next) => {
  try {
    const { floor, zoneId, status, sort = 'desk_code' } = req.query;
    let desks = await getAllDesks({
      floor: floor ? parseInt(floor, 10) : undefined,
      zoneId,
      status,
    });

    const sortKey = sort.replace(/[^a-z_]/gi, '');
    desks.sort((a, b) => {
      const av = a[sortKey] ?? a.deskCode;
      const bv = b[sortKey] ?? b.deskCode;
      return String(av).localeCompare(String(bv));
    });

    res.json(desks);
  } catch (err) {
    next(err);
  }
});

router.get('/abandoned', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT d.*, z.name as zone_name, s.id as session_id, s.end_reason, s.checkout_time,
              u.name as occupant_name
       FROM desks d
       JOIN zones z ON d.zone_id = z.id
       LEFT JOIN sessions s ON s.desk_id = d.id AND s.status = 'abandoned'
       LEFT JOIN users u ON s.user_id = u.id
       WHERE d.status = 'abandoned' OR s.end_reason LIKE 'abandoned%'
       ORDER BY s.checkout_time DESC NULLS LAST`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post('/desks/:deskId/reset', async (req, res, next) => {
  try {
    const { deskId } = req.params;

    const activeSession = await query(
      `SELECT id FROM sessions WHERE desk_id = $1 AND status IN ('active', 'away', 'liveness_pending')`,
      [deskId]
    );

    if (activeSession.rows[0]) {
      await endSession(activeSession.rows[0].id, 'manual_reset', req.user.id);
    }

    await query(`UPDATE desks SET status = 'free', updated_at = NOW() WHERE id = $1`, [deskId]);

    await logAudit({
      deskId,
      userId: req.user.id,
      action: 'manual_reset',
      details: { by: 'librarian' },
    });

    const io = req.app.get('io');
    if (io) io.emit('desks:refresh');

    res.json({ message: 'Desk reset successfully' });
  } catch (err) {
    next(err);
  }
});

router.post('/desks/:deskId/maintenance', async (req, res, next) => {
  try {
    const { deskId } = req.params;
    const { enabled } = req.body;

    await query(
      `UPDATE desks SET status = $1, updated_at = NOW() WHERE id = $2`,
      [enabled ? 'maintenance' : 'free', deskId]
    );

    await logAudit({
      deskId,
      userId: req.user.id,
      action: enabled ? 'maintenance_on' : 'maintenance_off',
    });

    const io = req.app.get('io');
    if (io) io.emit('desks:refresh');

    res.json({ message: enabled ? 'Desk marked out of service' : 'Desk returned to service' });
  } catch (err) {
    next(err);
  }
});

router.post('/desks/:deskId/force-checkout', async (req, res, next) => {
  try {
    const { deskId } = req.params;
    const session = await query(
      `SELECT id FROM sessions WHERE desk_id = $1 AND status IN ('active', 'away', 'liveness_pending')`,
      [deskId]
    );

    if (!session.rows[0]) {
      return res.status(400).json({ error: 'No active session on this desk' });
    }

    await endSession(session.rows[0].id, 'force_checkout', req.user.id);

    const io = req.app.get('io');
    if (io) io.emit('desks:refresh');

    res.json({ message: 'Force checkout completed' });
  } catch (err) {
    next(err);
  }
});

router.post('/desks', async (req, res, next) => {
  try {
    const { deskCode, zoneId, floor, x, y, width, height } = req.body;
    const qrCode = `deskguard://checkin/${deskCode}`;

    const result = await query(
      `INSERT INTO desks (desk_code, zone_id, floor, qr_code, x_coord, y_coord, width, height)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [deskCode, zoneId, floor || 1, qrCode, x || 0, y || 0, width || 60, height || 40]
    );

    await logAudit({ deskId: result.rows[0].id, userId: req.user.id, action: 'desk_created' });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.get('/audit', async (req, res, next) => {
  try {
    const logs = await getAuditLogs({ limit: parseInt(req.query.limit || '100', 10) });
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

router.get('/analytics', async (req, res, next) => {
  try {
    const analytics = await getAnalytics();
    res.json(analytics);
  } catch (err) {
    next(err);
  }
});

router.get('/config', async (req, res, next) => {
  try {
    res.json(getTimerConfig());
  } catch (err) {
    next(err);
  }
});

router.put('/config', requireRole('admin'), async (req, res, next) => {
  try {
    const timers = { ...config.timers, ...req.body };
    await query(
      `INSERT INTO system_config (key, value) VALUES ('timers', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(timers)]
    );
    Object.assign(config.timers, timers);
    res.json(timers);
  } catch (err) {
    next(err);
  }
});

router.get('/export/sessions', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT s.id, d.desk_code, u.name, u.email, s.checkin_time, s.checkout_time,
              s.status, s.end_reason, z.name as zone_name
       FROM sessions s
       JOIN desks d ON s.desk_id = d.id
       JOIN users u ON s.user_id = u.id
       JOIN zones z ON d.zone_id = z.id
       ORDER BY s.checkin_time DESC`
    );

    const headers = ['id', 'desk_code', 'name', 'email', 'checkin_time', 'checkout_time', 'status', 'end_reason', 'zone_name'];
    const csv = [
      headers.join(','),
      ...result.rows.map((row) =>
        headers.map((h) => `"${row[h] ?? ''}"`).join(',')
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=sessions-export.csv');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

export default router;
