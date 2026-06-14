import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { config } from './config.js';
import redis from './redis/client.js';
import pool from './db/pool.js';
import { setupSocket } from './socket.js';
import { runSweep } from './services/timerService.js';
import authRoutes from './routes/auth.js';
import deskRoutes from './routes/desks.js';
import sessionRoutes from './routes/sessions.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: config.corsOrigin, methods: ['GET', 'POST'] },
});

app.set('io', io);
setupSocket(io);

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

const healthHandler = async (req, res) => {
  try {
    await pool.query('SELECT 1');
    await redis.ping();
    res.json({ status: 'ok', service: 'deskguard-api', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
};

// Support both /health and /api/health (Render uses /api/health)
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

app.get('/api/config', (req, res) => {
  res.json(config.timers);
});

app.use('/api/auth', authRoutes);
app.use('/api/desks', deskRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/admin', adminRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

async function runMigrations() {
  try {
    const result = await pool.query(`SELECT to_regclass('public.users') as exists`);
    if (!result.rows[0].exists) {
      console.log('Running database migrations...');
      const migrationPath = path.join(__dirname, '../../migrations/001_initial_schema.sql');
      const sql = readFileSync(migrationPath, 'utf8');
      await pool.query(sql);
      console.log('Migrations complete.');
    } else {
      console.log('Database schema already exists, skipping migration.');
    }

    // Run migration 002 if waitlist table doesn't exist
    const waitlistCheck = await pool.query(`SELECT to_regclass('public.waitlist') as exists`);
    if (!waitlistCheck.rows[0].exists) {
      console.log('Running migration 002...');
      const migration2 = readFileSync(path.join(__dirname, '../../migrations/002_booking_duration.sql'), 'utf8');
      await pool.query(migration2);
      console.log('Migration 002 complete.');
    }
  } catch (err) {
    console.error('Migration error:', err.message);
    throw err;
  }
}

async function start() {
  try {
    await pool.query('SELECT 1');
    await redis.ping();
    console.log('Connected to PostgreSQL and Redis');

    await runMigrations();

    setInterval(() => runSweep(io), config.timers.sweepIntervalSeconds * 1000);

    httpServer.listen(config.port, '0.0.0.0', () => {
      console.log(`DeskGuard API running on port ${config.port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
