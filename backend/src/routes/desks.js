import { Router } from 'express';
import QRCode from 'qrcode';
import { query } from '../db/pool.js';
import { getDeskByCode } from '../services/sessionService.js';
import { authenticate, attachUser } from '../middleware/auth.js';
import {
  joinWaitlist,
  leaveWaitlist,
  getWaitlist,
} from '../services/waitlistService.js';

const router = Router();

/**
 * Anonymize occupant name: "First L." format.
 */
function anonymizeOccupant(name) {
  if (!name) return null;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastInitial = parts[parts.length - 1][0]?.toUpperCase() || '';
  return `${first} ${lastInitial}.`;
}

router.get('/', async (req, res, next) => {
  try {
    const { floor, zoneId, status } = req.query;

    let sql = `
      SELECT d.*, z.name as zone_name,
        s.id as session_id, s.expires_at, s.away_start, s.status as session_status,
        u.name as occupant_name
      FROM desks d
      LEFT JOIN zones z ON d.zone_id = z.id
      LEFT JOIN sessions s ON s.desk_id = d.id AND s.status IN ('active','away','liveness_pending')
      LEFT JOIN users u ON s.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (floor) {
      sql += ` AND d.floor = $${idx++}`;
      params.push(parseInt(floor, 10));
    }
    if (zoneId) {
      sql += ` AND d.zone_id = $${idx++}`;
      params.push(zoneId);
    }
    if (status) {
      sql += ` AND d.status = $${idx++}`;
      params.push(status);
    }

    sql += ' ORDER BY d.floor, d.desk_code';

    const result = await query(sql, params);

    const desks = result.rows.map((d) => ({
      id: d.id,
      deskCode: d.desk_code,
      zoneId: d.zone_id,
      zoneName: d.zone_name,
      floor: d.floor,
      qrCode: d.qr_code,
      status: d.status,
      x: parseFloat(d.x_coord),
      y: parseFloat(d.y_coord),
      width: parseFloat(d.width),
      height: parseFloat(d.height),
      notes: d.notes || null,
      tags: d.tags || [],
      sessionId: d.session_id || null,
      expiresAt: d.expires_at || null,
      awayStart: d.away_start || null,
      sessionStatus: d.session_status || null,
      occupantName: anonymizeOccupant(d.occupant_name),
    }));

    res.json(desks);
  } catch (err) {
    next(err);
  }
});

router.get('/zones', async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM zones ORDER BY floor, name');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:deskCode/waitlist', async (req, res, next) => {
  try {
    const waitlist = await getWaitlist(req.params.deskCode);
    res.json(waitlist);
  } catch (err) {
    next(err);
  }
});

router.post('/:deskCode/waitlist', authenticate, attachUser, async (req, res, next) => {
  try {
    const position = await joinWaitlist(req.user.id, req.params.deskCode);
    res.status(201).json({ position });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:deskCode/waitlist', authenticate, attachUser, async (req, res, next) => {
  try {
    await leaveWaitlist(req.user.id, req.params.deskCode);
    res.json({ message: 'Removed from waitlist' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:deskCode', async (req, res, next) => {
  try {
    const desk = await getDeskByCode(req.params.deskCode);
    if (!desk) return res.status(404).json({ error: 'Desk not found' });
    res.json({
      id: desk.id,
      deskCode: desk.desk_code,
      zoneName: desk.zone_name,
      floor: desk.floor,
      status: desk.status,
      qrCode: desk.qr_code,
      notes: desk.notes || null,
      tags: desk.tags || [],
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:deskCode/qr', authenticate, async (req, res, next) => {
  try {
    const desk = await getDeskByCode(req.params.deskCode);
    if (!desk) return res.status(404).json({ error: 'Desk not found' });

    const checkInUrl = `${process.env.CORS_ORIGIN || 'http://localhost:5173'}/checkin/${desk.desk_code}`;
    const qrDataUrl = await QRCode.toDataURL(checkInUrl, { width: 300 });

    res.json({ deskCode: desk.desk_code, checkInUrl, qrDataUrl });
  } catch (err) {
    next(err);
  }
});

export default router;
