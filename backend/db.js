import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and set a value.');
}

// Render (and most managed Postgres hosts) require SSL in production but use
// a self-signed cert, so we disable strict verification only there.
const ssl = process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false;

export const pool = new Pool({ connectionString, ssl });

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    details JSONB NOT NULL,
    total_amount NUMERIC NOT NULL,
    payment_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);

  CREATE TABLE IF NOT EXISTS hotel_reviews (
    id TEXT PRIMARY KEY,
    hotel_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_hotel_reviews_hotel_id ON hotel_reviews(hotel_id);

  -- One row per booked movie seat. The composite primary key makes it
  -- impossible for two users to book the same seat for the same show.
  CREATE TABLE IF NOT EXISTS seat_reservations (
    movie_id TEXT NOT NULL,
    show_date TEXT NOT NULL,
    showtime TEXT NOT NULL,
    seat TEXT NOT NULL,
    booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    PRIMARY KEY (movie_id, show_date, showtime, seat)
  );

  CREATE TABLE IF NOT EXISTS admin_movies (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL
  );
  CREATE TABLE IF NOT EXISTS admin_hotels (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL
  );
  CREATE TABLE IF NOT EXISTS admin_travels (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL
  );
`;

async function seedIfEmpty() {
  const { rows: userRows } = await pool.query('SELECT COUNT(*)::int AS n FROM users');
  if (userRows[0].n === 0) {
    await pool.query(
      'INSERT INTO users (id, email, password_hash, name, is_admin) VALUES ($1, $2, $3, $4, $5)',
      ['1', 'demo@bookflow.com', bcrypt.hashSync('demo123', 10), 'Demo User', false]
    );
    await pool.query(
      'INSERT INTO users (id, email, password_hash, name, is_admin) VALUES ($1, $2, $3, $4, $5)',
      ['admin', 'admin@bookflow.com', bcrypt.hashSync('admin123', 10), 'Administrator', true]
    );
  }

  const { rows: settingsRows } = await pool.query('SELECT COUNT(*)::int AS n FROM settings');
  if (settingsRows[0].n === 0) {
    await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2)', [
      'pricing',
      JSON.stringify({ weekendMultiplier: 1.2, infantDiscountMultiplier: 0.5 }),
    ]);
  }

  const { rows: reviewRows } = await pool.query('SELECT COUNT(*)::int AS n FROM hotel_reviews');
  if (reviewRows[0].n === 0) {
    await pool.query(
      `INSERT INTO hotel_reviews (id, hotel_id, user_id, user_name, rating, comment)
       VALUES
        ('r1', 'h1', '1', 'Demo User', 5, 'Excellent service and very clean rooms.'),
        ('r2', 'h2', '1', 'Demo User', 4, 'Great location near the beach.')`
    );
  }
}

export async function initDb() {
  await pool.query(SCHEMA_SQL);
  await seedIfEmpty();
}

export async function resetDbForTests() {
  await pool.query(
    'TRUNCATE seat_reservations, bookings, hotel_reviews, admin_movies, admin_hotels, admin_travels, users, settings RESTART IDENTITY'
  );
  await seedIfEmpty();
}
