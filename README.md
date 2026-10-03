# BookFlow – Ticket Booking App
![CI](https://github.com/HarshithaPerusomala/unified-booking-engine/actions/workflows/ci.yml/badge.svg)
> **Live demo:** _add your Vercel link here_ · **API:** _add your Render link here_

A full-stack ticket booking app where you can book **movies**, **hotels**, and **travel** (flights, trains, buses) in one place, with login, an admin panel, hotel reviews, and payment receipt generation.

## Features

- **Login & Register** – accounts with bcrypt-hashed passwords and JWT-based sessions.
- **Movies** – Browse movies, pick a date, showtime and seats on a seat map (already-booked seats are greyed out), confirm and pay.
- **Hotels** – Choose a hotel, set number of nights, confirm and pay, leave a review.
- **Travel** – Book flights, trains, or buses; confirm and pay.
- **Admin panel** – Admin users can add movies/hotels/travel options and adjust pricing rules.
- **My Bookings** – List of all your bookings with links to receipts.
- **Receipt** – After each booking you get a receipt with Booking ID, Payment ID, and details. Use **Print / Save PDF** to print or save as PDF.

## Engineering highlights

- **Server-side pricing.** The browser sends *what* is being booked (ids, seats, nights, dates); the server calculates the price (seat zones, weekend multiplier, infant discount) and ignores any total the client sends. A tampered request cannot change what you pay.
- **No double-booking.** Movie seats are stored in a `seat_reservations` table whose composite primary key `(movie, date, showtime, seat)` makes a duplicate impossible at the database level. Booking and seat reservation run in one transaction, so a failed multi-seat booking reserves nothing. A test fires 10 simultaneous requests for one seat and asserts exactly one succeeds.
- **Tested against real Postgres**, not mocks, locally and in CI.

## Tech Stack

- **Frontend:** React 18, Vite, React Router, CSS Modules
- **Backend:** Node.js, Express, JWT auth, bcrypt password hashing
- **Database:** PostgreSQL (via `pg`), with foreign keys and CHECK constraints enforced at the DB level
- **Security:** Helmet security headers, rate-limited auth endpoints, centralized error handling
- **Tests:** Node's built-in test runner + Supertest, run against a real Postgres database (locally and in CI)
- **CI:** GitHub Actions — runs the backend test suite against a Postgres service container and builds the frontend on every push/PR

## Quick Start

### 1. Get Postgres running

The easiest way is Docker Compose (spins up Postgres with the right databases already created):

```bash
docker compose up -d
```

Don't have Docker? Install PostgreSQL locally instead and create a `bookflow` user/database yourself — see `.env.example` in `backend/` for the exact credentials the app expects.

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and set `JWT_SECRET` to a real random value (a generator command is
suggested inside the file). The default `DATABASE_URL` already matches the
Docker Compose setup, so if you used that, you don't need to change it.

```bash
npm run dev
```

The API runs at **http://localhost:3001** and creates/updates its tables
automatically on startup (see `backend/db.js`), then seeds a demo user and an
admin user if the database is empty.

### 3. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. In dev, Vite proxies `/api/*` requests to the
backend automatically — no extra config needed.

### 4. Demo logins

- **User:** `demo@bookflow.com` / `demo123`
- **Admin:** `admin@bookflow.com` / `admin123` (can access the Admin panel)

## Running the tests

```bash
cd backend
npm test
```

This runs 25 API tests (auth, registration, password hashing, protected
routes, admin-only routes, booking ownership isolation, server-side pricing,
price-tampering rejection, seat double-booking and a concurrency race) against the
`bookflow_test` Postgres database (created automatically by Docker Compose,
or create it yourself: `createdb bookflow_test`). A `pretest` hook creates the
schema before tests run, and each test resets the data first — it never
touches your `bookflow` dev database.

The same test suite runs automatically in CI on every push (see
`.github/workflows/ci.yml`), against a fresh Postgres container.

## Project Structure

```
bookflow/
├── backend/
│   ├── app.js          # Express app: routes, middleware, error handling
│   ├── pricing.js      # Server-side price + validation rules for bookings
│   ├── server.js       # Loads .env, runs migrations, starts the HTTP server
│   ├── db.js           # Postgres pool, schema, seeding, test-reset helper
│   ├── scripts/
│   │   └── migrate.js  # One-shot schema creation (used standalone or as pretest)
│   ├── tests/          # Supertest API tests
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── apiBase.js   # API base URL (empty in dev, VITE_API_URL in prod)
│   │   ├── components/  # Layout, nav
│   │   ├── context/     # AuthContext
│   │   ├── pages/       # Login, Register, Home, Movies, Hotels, Travel, Admin, MyBookings, Receipt
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   └── package.json
├── docker-compose.yml    # Local Postgres for development + tests
├── docker/initdb/        # Creates the bookflow_test database on first boot
├── render.yaml           # One-click backend + managed Postgres deploy on Render
└── .github/workflows/ci.yml
```

## Deploying it

**Backend + database (Render, free tier):**
1. Push this repo to GitHub.
2. On [render.com](https://render.com), "New +" → "Blueprint" → point it at
   your repo. It reads `render.yaml` and provisions both a managed Postgres
   database and the web service automatically, wiring `DATABASE_URL` and
   generating `JWT_SECRET` for you.
3. Once deployed, note the URL Render gives you, e.g.
   `https://bookflow-api.onrender.com`.

**Frontend (Vercel or Netlify, free tier):**
1. Import the same repo, set the project root to `frontend/`.
2. Set build command `npm run build`, output directory `dist`.
3. Add an environment variable `VITE_API_URL` = your Render backend URL from
   above, then deploy.
4. Go back to your Render service's `CORS_ORIGIN` env var and set it to your
   new frontend URL, then redeploy the backend so CORS allows it.

Render's free Postgres tier is a real, always-persistent database (not
ephemeral like a container's local disk), so bookings and accounts survive
redeploys and restarts. It does expire after 30/90 days on the free tier
(check Render's current terms) — upgrading to a paid instance removes that
limit.

## Security & reliability notes

- Passwords are hashed with bcrypt before being stored — never stored or
  logged in plaintext.
- `JWT_SECRET` and `DATABASE_URL` are required at startup; the server refuses
  to boot without them, so a real secret can never accidentally ship via a
  hardcoded default.
- `helmet` sets standard security headers (HSTS, no-sniff, etc.).
- Login and registration are rate-limited (20 requests / 15 min per IP) to
  slow down brute-force attempts.
- Every route that touches the database is wrapped so a failed query returns
  a clean `500` instead of crashing the process or leaking a stack trace to
  the client.
- Foreign keys (`bookings.user_id`, `hotel_reviews.user_id`) and a `CHECK`
  constraint on review ratings are enforced by Postgres itself, not just
  application code.
- `GET /api/health` gives hosting platforms a cheap way to check the service
  is up.

## Known limitations (by design, for a learning/placement project)

- No email verification or password-reset flow.
- No refresh tokens — sessions are a single 7-day JWT.
- Single flat admin role (no fine-grained permissions).
- Payments are simulated (no real payment gateway).
- Hotel and travel seats/rooms have no inventory limits yet; only movie seats are reserved.
