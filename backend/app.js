import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { pool } from './db.js';
import { BookingError, priceMovieBooking, priceHotelBooking, priceTravelBooking } from './pricing.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. Copy .env.example to .env and set a value.');
}

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Wrap async route handlers so a rejected promise reaches the error
// middleware instead of crashing the process or hanging the request.
const asyncHandler = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// Slow down brute-force login/registration attempts. Skipped automatically
// in tests (NODE_ENV=test) so the test suite isn't rate-limited.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many attempts. Please try again later.' },
});

// ---- Read-only default catalog (seed data, not user-generated, so it stays in code) ----
// Dates are generated relative to today so the demo catalogue never expires.
const d = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

const getDefaultMovies = () => [
  {
    id: 'm1',
    title: 'Epic Horizon',
    genre: 'Sci-Fi',
    duration: '2h 15m',
    rating: 'PG-13',
    price: 12,
    availableDates: [d(1), d(2), d(3)],
    showtimesByDate: {
      [d(1)]: ['10:00 AM', '2:30 PM', '6:00 PM'],
      [d(2)]: ['11:00 AM', '3:00 PM', '8:00 PM'],
      [d(3)]: ['09:45 AM', '1:30 PM', '7:45 PM'],
    },
  },
  {
    id: 'm2',
    title: 'Midnight Run',
    genre: 'Thriller',
    duration: '1h 48m',
    rating: 'R',
    price: 14,
    availableDates: [d(1), d(4)],
    showtimesByDate: {
      [d(1)]: ['12:00 PM', '5:00 PM', '9:00 PM'],
      [d(4)]: ['01:15 PM', '6:30 PM', '10:00 PM'],
    },
  },
  {
    id: 'm3',
    title: 'Laugh Lane',
    genre: 'Comedy',
    duration: '1h 55m',
    rating: 'PG',
    price: 11,
    availableDates: [d(2), d(3), d(4)],
    showtimesByDate: {
      [d(2)]: ['11:30 AM', '2:45 PM', '6:15 PM'],
      [d(3)]: ['10:30 AM', '1:30 PM', '5:30 PM'],
      [d(4)]: ['12:30 PM', '4:30 PM', '8:30 PM'],
    },
  },
  {
    id: 'm4',
    title: 'Night Whisper',
    genre: 'Horror',
    duration: '2h 02m',
    rating: 'A',
    price: 13,
    availableDates: [d(3), d(4)],
    showtimesByDate: {
      [d(3)]: ['7:30 PM', '10:15 PM'],
      [d(4)]: ['6:45 PM', '9:45 PM'],
    },
  },
  {
    id: 'm5',
    title: 'Steel Reign',
    genre: 'Action',
    duration: '2h 10m',
    rating: 'PG-13',
    price: 15,
    availableDates: [d(1), d(2)],
    showtimesByDate: {
      [d(1)]: ['10:45 AM', '2:00 PM', '7:00 PM'],
      [d(2)]: ['11:15 AM', '3:30 PM', '8:45 PM'],
    },
  },
];
const defaultHotels = [
  { id: 'h1', name: 'Grand Plaza Hotel', city: 'New York', stars: 5, pricePerNight: 189, amenities: ['Pool', 'Spa', 'Restaurant'], image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80' },
  { id: 'h2', name: 'Coastal Inn', city: 'Miami', stars: 4, pricePerNight: 129, amenities: ['Beach', 'Breakfast'], image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80' },
  { id: 'h3', name: 'Mountain Lodge', city: 'Denver', stars: 4, pricePerNight: 149, amenities: ['Ski', 'Fireplace'], image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80' },
];
const getDefaultTravels = () => [
  {
    id: 't1', type: 'Flight', flightCategory: 'domestic', from: 'New York (JFK)', to: 'Los Angeles (LAX)',
    date: d(10), price: 299, carrier: 'SkyWays',
    departureLocalTime: '09:20 AM', arrivalLocalTime: '12:35 PM',
    departureTimezone: 'EDT (UTC-4)', arrivalTimezone: 'PDT (UTC-7)',
  },
  {
    id: 't4', type: 'Flight', flightCategory: 'international', from: 'Mumbai (BOM)', to: 'London (LHR)',
    date: d(19), price: 649, carrier: 'AirBridge',
    departureLocalTime: '02:10 AM', arrivalLocalTime: '07:45 AM',
    departureTimezone: 'IST (UTC+5:30)', arrivalTimezone: 'BST (UTC+1)',
  },
  { id: 't2', type: 'Train', from: 'Boston', to: 'Washington DC', date: d(5), price: 89, carrier: 'Amtrak' },
  { id: 't3', type: 'Bus', from: 'Chicago', to: 'Detroit', date: d(7), price: 45, carrier: 'Greyhound' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---- DB-backed helpers ----
function rowToUser(row) {
  return (
    row && {
      id: row.id,
      email: row.email,
      name: row.name,
      isAdmin: row.is_admin,
      passwordHash: row.password_hash,
    }
  );
}

async function getUserByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return rowToUser(rows[0]);
}
async function getUserById(id) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rowToUser(rows[0]);
}
async function getAdminRows(table) {
  const { rows } = await pool.query(`SELECT data FROM ${table}`);
  return rows.map((r) => r.data);
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function adminMiddleware(req, res, next) {
  if (!req.user || !req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
  next();
}

// ---- Health check (used by Render/uptime monitors) ----
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ---- Auth ----
app.post(
  '/api/auth/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    const user = email && (await getUserByEmail(email));
    if (!user || !bcrypt.compareSync(password || '', user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = jwt.sign({ id: user.id, email: user.email, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin } });
  })
);

app.post(
  '/api/auth/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password, name } = req.body || {};
    if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid email is required' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (await getUserByEmail(email)) return res.status(400).json({ error: 'Email already registered' });

    const id = uuidv4();
    const passwordHash = bcrypt.hashSync(password, 10);
    const finalName = (name || email.split('@')[0]).trim();
    await pool.query(
      'INSERT INTO users (id, email, password_hash, name, is_admin) VALUES ($1, $2, $3, $4, FALSE)',
      [id, email, passwordHash, finalName]
    );
    const token = jwt.sign({ id, email, isAdmin: false }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id, email, name: finalName, isAdmin: false } });
  })
);

// ---- Catalog (public) – default + admin-added ----
app.get(
  '/api/movies',
  asyncHandler(async (req, res) => res.json([...getDefaultMovies(), ...(await getAdminRows('admin_movies'))]))
);
app.get(
  '/api/hotels',
  asyncHandler(async (req, res) => res.json([...defaultHotels, ...(await getAdminRows('admin_hotels'))]))
);
app.get(
  '/api/travels',
  asyncHandler(async (req, res) => res.json([...getDefaultTravels(), ...(await getAdminRows('admin_travels'))]))
);

app.get(
  '/api/hotels/:hotelId/reviews',
  asyncHandler(async (req, res) => {
    const hotels = [...defaultHotels, ...(await getAdminRows('admin_hotels'))];
    const hotel = hotels.find((h) => h.id === req.params.hotelId);
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
    const { rows } = await pool.query(
      `SELECT id, user_id AS "userId", user_name AS "userName", rating, comment, created_at AS "createdAt"
       FROM hotel_reviews WHERE hotel_id = $1 ORDER BY created_at DESC`,
      [req.params.hotelId]
    );
    const averageRating = rows.length ? rows.reduce((sum, r) => sum + r.rating, 0) / rows.length : 0;
    res.json({ reviews: rows, averageRating, count: rows.length });
  })
);

app.get(
  '/api/settings/pricing',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT value FROM settings WHERE key = $1', ['pricing']);
    res.json(rows[0].value);
  })
);

app.post(
  '/api/hotels/:hotelId/reviews',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const hotels = [...defaultHotels, ...(await getAdminRows('admin_hotels'))];
    const hotel = hotels.find((h) => h.id === req.params.hotelId);
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
    const rating = Number(req.body?.rating);
    const comment = String(req.body?.comment || '').trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
    }
    const user = await getUserById(req.user.id);
    const review = {
      id: `rev-${uuidv4().slice(0, 8)}`,
      hotelId: req.params.hotelId,
      userId: req.user.id,
      userName: user?.name || req.user.email,
      rating,
      comment,
    };
    const { rows } = await pool.query(
      `INSERT INTO hotel_reviews (id, hotel_id, user_id, user_name, rating, comment)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id AS "userId", user_name AS "userName", rating, comment, created_at AS "createdAt"`,
      [review.id, review.hotelId, review.userId, review.userName, review.rating, review.comment]
    );
    res.status(201).json(rows[0]);
  })
);

app.put(
  '/api/admin/settings/pricing',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    const weekendMultiplier = Number(req.body?.weekendMultiplier);
    const infantDiscountMultiplier = Number(req.body?.infantDiscountMultiplier);
    if (!Number.isFinite(weekendMultiplier) || weekendMultiplier < 1) {
      return res.status(400).json({ error: 'weekendMultiplier must be a number >= 1' });
    }
    if (!Number.isFinite(infantDiscountMultiplier) || infantDiscountMultiplier < 0 || infantDiscountMultiplier > 1) {
      return res.status(400).json({ error: 'infantDiscountMultiplier must be between 0 and 1' });
    }
    const pricingSettings = { weekendMultiplier, infantDiscountMultiplier };
    await pool.query('UPDATE settings SET value = $1 WHERE key = $2', [JSON.stringify(pricingSettings), 'pricing']);
    res.json(pricingSettings);
  })
);

// ---- Admin: add movie / hotel / travel ----
app.post(
  '/api/admin/movies',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    const { title, genre, duration, rating, showtimes, price } = req.body || {};
    if (!title || !genre || !duration || !rating || !Array.isArray(showtimes) || !showtimes.length || price == null) {
      return res.status(400).json({ error: 'Missing fields: title, genre, duration, rating, showtimes (array), price' });
    }
    const id = `m-admin-${uuidv4().slice(0, 8)}`;
    const movie = { id, title, genre, duration, rating, showtimes, price: Number(price) };
    await pool.query('INSERT INTO admin_movies (id, data) VALUES ($1, $2)', [id, JSON.stringify(movie)]);
    res.status(201).json(movie);
  })
);

app.post(
  '/api/admin/hotels',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    const { name, city, stars, pricePerNight, amenities, image } = req.body || {};
    if (!name || !city || stars == null || pricePerNight == null) {
      return res.status(400).json({ error: 'Missing fields: name, city, stars, pricePerNight' });
    }
    const id = `h-admin-${uuidv4().slice(0, 8)}`;
    const hotel = {
      id,
      name,
      city,
      stars: Number(stars),
      pricePerNight: Number(pricePerNight),
      amenities: Array.isArray(amenities) ? amenities : [],
      image: image || `https://picsum.photos/seed/${encodeURIComponent(id)}/1200/800`,
    };
    await pool.query('INSERT INTO admin_hotels (id, data) VALUES ($1, $2)', [id, JSON.stringify(hotel)]);
    res.status(201).json(hotel);
  })
);

app.post(
  '/api/admin/travels',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    const { type, from, to, date, price, carrier, flightCategory, departureLocalTime, arrivalLocalTime, departureTimezone, arrivalTimezone } = req.body || {};
    if (!type || !from || !to || !date || price == null || !carrier) {
      return res.status(400).json({ error: 'Missing fields: type, from, to, date, price, carrier' });
    }
    const id = `t-admin-${uuidv4().slice(0, 8)}`;
    const travel = { id, type, from, to, date, price: Number(price), carrier };
    if (type === 'Flight') {
      travel.flightCategory = flightCategory === 'international' ? 'international' : 'domestic';
      travel.departureLocalTime = departureLocalTime || '09:00 AM';
      travel.arrivalLocalTime = arrivalLocalTime || '12:00 PM';
      travel.departureTimezone = departureTimezone || 'Local time';
      travel.arrivalTimezone = arrivalTimezone || 'Local time';
    }
    await pool.query('INSERT INTO admin_travels (id, data) VALUES ($1, $2)', [id, JSON.stringify(travel)]);
    res.status(201).json(travel);
  })
);

// ---- Bookings (protected) ----
function bookingRowToJson(row) {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    details: row.details,
    totalAmount: Number(row.total_amount),
    paymentId: row.payment_id,
    createdAt: row.created_at,
  };
}

const BOOKING_TYPES = ['movie', 'hotel', 'travel'];

async function findCatalogItem(defaults, table, id) {
  return [...defaults, ...(await getAdminRows(table))].find((x) => x.id === id);
}

// Seats already taken for one show (lets the UI grey them out).
app.get(
  '/api/movies/:movieId/seats',
  asyncHandler(async (req, res) => {
    const { date, showtime } = req.query;
    const { rows } = await pool.query(
      'SELECT seat FROM seat_reservations WHERE movie_id = $1 AND show_date = $2 AND showtime = $3',
      [req.params.movieId, String(date || ''), String(showtime || '')]
    );
    res.json({ taken: rows.map((r) => r.seat) });
  })
);

app.post(
  '/api/bookings',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { type, details } = req.body || {};
    if (!BOOKING_TYPES.includes(type) || !details || typeof details !== 'object') {
      return res.status(400).json({ error: 'Missing or invalid booking data' });
    }

    // The client never decides the price: the server recomputes it from the catalogue.
    let total;
    let storedDetails = { ...details };
    let reservation = null;

    if (type === 'movie') {
      const movie = await findCatalogItem(getDefaultMovies(), 'admin_movies', details.movieId);
      if (!movie) return res.status(404).json({ error: 'Movie not found' });
      const priced = priceMovieBooking(movie, details);
      total = priced.total;
      storedDetails = { ...details, movie: movie.title, genre: movie.genre, tickets: details.seats.length, seatPrices: priced.seatPrices };
      reservation = { movieId: movie.id, date: details.date, showtime: details.showtime, seats: details.seats };
    } else if (type === 'hotel') {
      const hotel = await findCatalogItem(defaultHotels, 'admin_hotels', details.hotelId);
      if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
      const priced = priceHotelBooking(hotel, details);
      total = priced.total;
      storedDetails = { ...details, hotel: hotel.name, city: hotel.city, stars: hotel.stars, nights: priced.nights, pricePerNight: hotel.pricePerNight, amenities: hotel.amenities };
    } else {
      const travel = await findCatalogItem(getDefaultTravels(), 'admin_travels', details.travelId);
      if (!travel) return res.status(404).json({ error: 'Travel option not found' });
      const { rows } = await pool.query('SELECT value FROM settings WHERE key = $1', ['pricing']);
      const priced = priceTravelBooking(travel, details, rows[0].value);
      total = priced.total;
      storedDetails = { ...details, type: travel.type, from: travel.from, to: travel.to, carrier: travel.carrier, baseFare: travel.price, weekendApplied: priced.weekendApplied };
    }

    const id = `BKG-${uuidv4().slice(0, 8).toUpperCase()}`;
    const paymentId = `PAY-${uuidv4().slice(0, 8).toUpperCase()}`;

    // Booking + seat reservations succeed or fail together.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO bookings (id, user_id, type, details, total_amount, payment_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [id, req.user.id, type, JSON.stringify(storedDetails), total, paymentId]
      );
      if (reservation) {
        for (const seat of reservation.seats) {
          await client.query(
            'INSERT INTO seat_reservations (movie_id, show_date, showtime, seat, booking_id) VALUES ($1, $2, $3, $4, $5)',
            [reservation.movieId, reservation.date, reservation.showtime, seat, id]
          );
        }
      }
      await client.query('COMMIT');
      res.status(201).json(bookingRowToJson(rows[0]));
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23505') return res.status(409).json({ error: 'One or more seats were just booked by someone else. Please pick different seats.' });
      throw err;
    } finally {
      client.release();
    }
  })
);

app.get(
  '/api/bookings',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM bookings WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json(rows.map(bookingRowToJson));
  })
);

app.get(
  '/api/bookings/:id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM bookings WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Booking not found' });
    res.json(bookingRowToJson(rows[0]));
  })
);

// ---- Receipt (protected) – returns booking + user for receipt ----
app.get(
  '/api/receipt/:bookingId',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM bookings WHERE id = $1 AND user_id = $2', [req.params.bookingId, req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Booking not found' });
    const booking = bookingRowToJson(rows[0]);
    const user = await getUserById(req.user.id);
    const passengerName = booking?.details?.passenger?.fullName?.trim?.();
    res.json({
      booking,
      user: user ? { name: passengerName || user.name, email: user.email } : null,
    });
  })
);

// 404 for unmatched API routes
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Centralized error handler — keeps stack traces out of responses and out of
// the client's hands, while still logging them server-side for debugging.
app.use((err, req, res, next) => {
  if (err instanceof BookingError) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
