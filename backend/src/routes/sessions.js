import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  checkIn,
  markAway,
  markBack,
  respondLiveness,
  checkout,
  getUserActiveSession,
  getUserHistory,
  extendSession,
} from '../services/sessionService.js';
import { authenticate, attachUser } from '../middleware/auth.js';

const router = Router();

const checkInLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many check-in attempts, try again later' },
});

router.use(authenticate, attachUser);

router.get('/active', async (req, res, next) => {
  try {
    const session = await getUserActiveSession(req.user.id);
    res.json(session);
  } catch (err) {
    next(err);
  }
});

router.get('/history', async (req, res, next) => {
  try {
    const history = await getUserHistory(req.user.id);
    res.json(history);
  } catch (err) {
    next(err);
  }
});

router.post('/checkin', checkInLimiter, async (req, res, next) => {
  try {
    const { deskCode, durationMinutes } = req.body;
    if (!deskCode) return res.status(400).json({ error: 'deskCode required' });

    const result = await checkIn(req.user.id, deskCode, durationMinutes || 120);
    const io = req.app.get('io');
    if (io) io.emit('desks:refresh');

    res.status(201).json({
      message: 'Checked in successfully',
      session: result.session,
      deskCode,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/away', async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    const session = await getUserActiveSession(req.user.id);
    if (!session) return res.status(400).json({ error: 'No active session' });

    const result = await markAway(req.user.id, sessionId || session.id);
    const io = req.app.get('io');
    if (io) io.emit('desks:refresh');

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/back', async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    const session = await getUserActiveSession(req.user.id);
    if (!session) return res.status(400).json({ error: 'No active session' });

    const result = await markBack(req.user.id, sessionId || session.id);
    const io = req.app.get('io');
    if (io) io.emit('desks:refresh');

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/liveness', async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    const session = await getUserActiveSession(req.user.id);
    if (!session) return res.status(400).json({ error: 'No active session' });

    const result = await respondLiveness(req.user.id, sessionId || session.id);
    const io = req.app.get('io');
    if (io) io.emit('desks:refresh');

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/checkout', async (req, res, next) => {
  try {
    const session = await getUserActiveSession(req.user.id);
    if (!session) return res.status(400).json({ error: 'No active session' });

    await checkout(req.user.id, session.id);
    const io = req.app.get('io');
    if (io) io.emit('desks:refresh');

    res.json({ message: 'Checked out successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/extend', async (req, res, next) => {
  try {
    const session = await extendSession(req.user.id, req.params.id);
    const io = req.app.get('io');
    if (io) io.emit('desks:refresh');
    res.json(session);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
