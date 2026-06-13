import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config } from './config.js';
import redis from './redis/client.js';
import pool from './db/pool.js';
import { setupSocket } from './socket.js';
import { runSweep } from './services/timerService.js';
import authRoutes from './routes/auth.js';
import deskRoutes from './routes/desks.js';
import sessionRoutes from './routes/sessions.js';
import adminRoutes from './routes/admin.js';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: config.corsOrigin, methods: ['GET', 'POST'] },
});

app.set('io', io);
setupSocket(io);

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    await redis.ping();
    res.json({ status: 'ok', service: 'deskguard-api' });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

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

async function start() {
  try {
    await pool.query('SELECT 1');
    await redis.ping();
    console.log('Connected to PostgreSQL and Redis');

    setInterval(() => runSweep(io), config.timers.sweepIntervalSeconds * 1000);

    httpServer.listen(config.port, () => {
      console.log(`DeskGuard API running on http://localhost:${config.port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
