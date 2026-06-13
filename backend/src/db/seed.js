import bcrypt from 'bcryptjs';
import { query } from './pool.js';

const USERS = [
  { name: 'Alex Student', email: 'student@library.edu', role: 'student' },
  { name: 'Jordan Student', email: 'student2@library.edu', role: 'student' },
  { name: 'Sam Librarian', email: 'librarian@library.edu', role: 'librarian' },
  { name: 'Admin User', email: 'admin@library.edu', role: 'admin' },
];

async function seed() {
  const hash = await bcrypt.hash('password123', 10);

  for (const user of USERS) {
    await query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET password_hash = $3, name = $1`,
      [user.name, user.email, hash, user.role]
    );
  }

  console.log('Seeded users (password: password123)');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
