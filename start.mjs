/**
 * DeskGuard Local Dev Launcher
 * Starts embedded PostgreSQL, sets up the database, seeds users,
 * then spawns the backend API server and Vite frontend.
 */
import EmbeddedPostgres from 'embedded-postgres';
import { execSync, spawn } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PG_PORT = 5432;
const PG_USER = 'deskguard';
const PG_PASSWORD = 'deskguard';
const PG_DB = 'deskguard';
const PG_DATA_DIR = path.join(__dirname, '.pg-data');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function log(msg) {
  console.log(`\x1b[36m[launcher]\x1b[0m ${msg}`);
}

async function main() {
  log('Starting embedded PostgreSQL...');

  const pg = new EmbeddedPostgres({
    databaseDir: PG_DATA_DIR,
    user: 'postgres',
    password: 'postgres',
    port: PG_PORT,
    persistent: true,
  });

  try {
    await pg.initialise();
    await pg.start();
    log(`PostgreSQL running on port ${PG_PORT}`);
  } catch (err) {
    if (err.message?.includes('already running') || err.message?.includes('already exists')) {
      log('PostgreSQL already initialised — starting existing cluster...');
      try { await pg.start(); } catch (e2) {
        if (!e2.message?.includes('already running')) throw e2;
        log('PostgreSQL already running, continuing...');
      }
    } else {
      throw err;
    }
  }

  // Give pg a moment to be fully ready
  await sleep(1500);

  // Create deskguard role and database using postgres superuser
  log('Setting up deskguard database and user...');
  const psqlBase = `"${PG_DATA_DIR}/../bin/pg_ctl"`;

  // Use pg client via Node directly
  const { default: pg_pkg } = await import('pg');
  const { Pool } = pg_pkg;

  const adminPool = new Pool({
    host: 'localhost',
    port: PG_PORT,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
  });

  try {
    // Create role if not exists
    await adminPool.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${PG_USER}') THEN
        CREATE ROLE ${PG_USER} WITH LOGIN PASSWORD '${PG_PASSWORD}' CREATEDB;
      END IF;
    END $$;`);

    // Create database if not exists
    const dbCheck = await adminPool.query(`SELECT 1 FROM pg_database WHERE datname = '${PG_DB}'`);
    if (dbCheck.rows.length === 0) {
      await adminPool.query(`CREATE DATABASE ${PG_DB} OWNER ${PG_USER}`);
      log(`Database '${PG_DB}' created.`);
    } else {
      log(`Database '${PG_DB}' already exists.`);
    }
  } finally {
    await adminPool.end();
  }

  // Run migration SQL on deskguard DB
  const appPool = new Pool({
    host: 'localhost',
    port: PG_PORT,
    user: PG_USER,
    password: PG_PASSWORD,
    database: PG_DB,
  });

  try {
    // Check if tables already exist
    const tableCheck = await appPool.query(`SELECT to_regclass('public.users') as exists`);
    if (!tableCheck.rows[0].exists) {
      log('Running database migrations...');
      const migration = readFileSync(path.join(__dirname, 'migrations', '001_initial_schema.sql'), 'utf8');
      await appPool.query(migration);
      log('Migration complete.');
    } else {
      log('Schema already exists, skipping migration.');
    }
  } finally {
    await appPool.end();
  }

  // Seed demo users
  log('Seeding demo users...');
  try {
    execSync('node src/db/seed.js', {
      cwd: path.join(__dirname, 'backend'),
      env: {
        ...process.env,
        DATABASE_URL: `postgresql://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/${PG_DB}`,
        REDIS_URL: 'redis://localhost:6379',
      },
      stdio: 'pipe',
    });
    log('Demo users seeded (password: password123)');
  } catch (err) {
    log(`Seed note: ${err.stderr?.toString() || err.message}`);
  }

  const ENV = {
    ...process.env,
    DATABASE_URL: `postgresql://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/${PG_DB}`,
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'deskguard-dev-secret',
    CORS_ORIGIN: 'http://localhost:5173',
    PORT: '3001',
    AWAY_LIMIT_MINUTES: '20',
    LIVENESS_INTERVAL_HOURS: '2',
    LIVENESS_GRACE_MINUTES: '10',
    MAX_AWAY_PERIODS: '3',
    SWEEP_INTERVAL_SECONDS: '60',
  };

  // Start backend
  log('Starting backend on http://localhost:3001 ...');
  const backend = spawn('node', ['src/index.js'], {
    cwd: path.join(__dirname, 'backend'),
    env: ENV,
    stdio: 'inherit',
  });
  backend.on('exit', code => log(`Backend exited with code ${code}`));

  await sleep(2000);

  // Start frontend
  log('Starting frontend on http://localhost:5173 ...');
  const frontend = spawn('npm', ['run', 'dev'], {
    cwd: path.join(__dirname, 'frontend'),
    env: { ...process.env, VITE_API_URL: 'http://localhost:3001', VITE_WS_URL: 'http://localhost:3001' },
    stdio: 'inherit',
    shell: true,
  });
  frontend.on('exit', code => log(`Frontend exited with code ${code}`));

  log('\x1b[32m✅ DeskGuard is starting up!\x1b[0m');
  log('\x1b[32m   Frontend → http://localhost:5173\x1b[0m');
  log('\x1b[32m   Backend  → http://localhost:3001\x1b[0m');
  log('   Press Ctrl+C to stop all services.\n');

  // Graceful shutdown
  process.on('SIGINT', async () => {
    log('\nShutting down...');
    backend.kill();
    frontend.kill();
    await pg.stop();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('\x1b[31m[launcher ERROR]\x1b[0m', err);
  process.exit(1);
});
