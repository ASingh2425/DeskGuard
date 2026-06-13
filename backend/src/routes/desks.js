import { Router } from 'express';
import QRCode from 'qrcode';
import { query } from '../db/pool.js';
import { getAllDesks, getDeskByCode } from '../services/sessionService.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { floor, zoneId, status } = req.query;
    const desks = await getAllDesks({
      floor: floor ? parseInt(floor, 10) : undefined,
      zoneId,
      status,
    });
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
