import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db/pool.js';

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

export async function attachUser(req, res, next) {
  try {
    const result = await query('SELECT id, name, email, role, active_desk_id FROM users WHERE id = $1', [req.user.id]);
    if (!result.rows[0]) return res.status(401).json({ error: 'User not found' });
    req.dbUser = result.rows[0];
    next();
  } catch (err) {
    next(err);
  }
}
