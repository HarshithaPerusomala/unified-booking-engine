// Creates tables (if they don't already exist) and seeds default data.
// Safe to run repeatedly — used both to prep a fresh dev database and as a
// pretest hook so the schema exists before any test file runs.
import 'dotenv/config';
import { initDb, pool } from '../db.js';

initDb()
  .then(() => {
    console.log('Database schema is up to date.');
    return pool.end();
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
