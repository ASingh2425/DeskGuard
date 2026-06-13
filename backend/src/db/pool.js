import pg from 'pg';
import { config } from '../config.js';

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error:', err);
});

export async function query(text, params) {
  return pool.query(text, params);
}

export default pool;
