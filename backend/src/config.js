import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://deskguard:deskguard@localhost:5432/deskguard',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'deskguard-dev-secret',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  timers: {
    awayLimitMinutes: parseInt(process.env.AWAY_LIMIT_MINUTES || '20', 10),
    livenessIntervalHours: parseFloat(process.env.LIVENESS_INTERVAL_HOURS || '2'),
    livenessGraceMinutes: parseInt(process.env.LIVENESS_GRACE_MINUTES || '10', 10),
    maxAwayPeriods: parseInt(process.env.MAX_AWAY_PERIODS || '3', 10),
    sweepIntervalSeconds: parseInt(process.env.SWEEP_INTERVAL_SECONDS || '60', 10),
  },
};
