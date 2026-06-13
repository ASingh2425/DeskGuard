import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'http';
import { Server } from 'socket.io';
import { config } from '../config.js';
import redis from '../redis/client.js';
import pool from '../db/pool.js';
import { runSweep } from '../services/timerService.js';

let io = null;

async function start() {
  try {
    await pool.query('SELECT 1');
    await redis.ping();

    const httpServer = createServer();
    io = new Server(httpServer, {
      cors: { origin: config.corsOrigin, methods: ['GET', 'POST'] },
    });

    httpServer.listen(0);

    console.log('[worker] DeskGuard sweep worker started');
    console.log(`[worker] Sweep interval: ${config.timers.sweepIntervalSeconds}s`);

    await runSweep(io);

    setInterval(async () => {
      try {
        await runSweep(io);
      } catch (err) {
        console.error('[worker] Sweep error:', err);
      }
    }, config.timers.sweepIntervalSeconds * 1000);
  } catch (err) {
    console.error('[worker] Failed to start:', err);
    process.exit(1);
  }
}

start();
