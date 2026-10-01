import { test, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app, resetDbForTests } from './setup.js';

let demoToken;

// Builds a valid movie booking request for the first showing of m1.
async function movieBody(seats) {
  const movies = (await request(app).get('/api/movies')).body;
  const m1 = movies.find((m) => m.id === 'm1');
  const date = m1.availableDates[0];
  return { type: 'movie', details: { movieId: 'm1', date, showtime: m1.showtimesByDate[date][0], seats } };
}

beforeEach(async () => {
  await resetDbForTests();
  const login = await request(app).post('/api/auth/login').send({ email: 'demo@bookflow.com', password: 'demo123' });
  demoToken = login.body.token;
});

describe('POST /api/bookings', () => {
  test('creates a booking for the authenticated user', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${demoToken}`)
      .send(await movieBody(['A1', 'A2']));

    assert.equal(res.status, 201);
    assert.ok(res.body.id.startsWith('BKG-'));
    assert.ok(res.body.paymentId.startsWith('PAY-'));
    assert.equal(res.body.totalAmount, 20); // two front-zone seats at (12 - 2) each
  });

  test('rejects a booking missing required fields', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${demoToken}`)
      .send({ type: 'movie' });

    assert.equal(res.status, 400);
  });

  test('rejects an unauthenticated booking attempt', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .send(await movieBody(['A1']));

    assert.equal(res.status, 401);
  });
});

describe('GET /api/bookings and /api/bookings/:id', () => {
  test('only returns bookings belonging to the requesting user', async () => {
    await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${demoToken}`)
      .send(await movieBody(['E1']));

    const other = await request(app)
      .post('/api/auth/register')
      .send({ email: 'other@bookflow.com', password: 'password1' });
    const otherToken = other.body.token;
    await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ type: 'hotel', details: { hotelId: 'h1', nights: 1 } });

    const demoBookings = await request(app).get('/api/bookings').set('Authorization', `Bearer ${demoToken}`);
    assert.equal(demoBookings.status, 200);
    assert.equal(demoBookings.body.length, 1);
    assert.equal(demoBookings.body[0].type, 'movie');

    const otherBookings = await request(app).get('/api/bookings').set('Authorization', `Bearer ${otherToken}`);
    assert.equal(otherBookings.body.length, 1);
    assert.equal(otherBookings.body[0].type, 'hotel');
  });

  test('returns 404 for a booking that belongs to someone else', async () => {
    const created = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${demoToken}`)
      .send(await movieBody(['E1']));

    const other = await request(app)
      .post('/api/auth/register')
      .send({ email: 'stranger@bookflow.com', password: 'password1' });

    const res = await request(app)
      .get(`/api/bookings/${created.body.id}`)
      .set('Authorization', `Bearer ${other.body.token}`);

    assert.equal(res.status, 404);
  });
});

describe('GET /api/receipt/:bookingId', () => {
  test('returns booking + user details for the owner', async () => {
    const created = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${demoToken}`)
      .send(await movieBody(['E1']));

    const res = await request(app)
      .get(`/api/receipt/${created.body.id}`)
      .set('Authorization', `Bearer ${demoToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.booking.id, created.body.id);
    assert.equal(res.body.user.email, 'demo@bookflow.com');
  });
});

describe('server-side pricing', () => {
  test('ignores a tampered totalAmount sent by the client', async () => {
    const body = { ...(await movieBody(['E1', 'E2'])), totalAmount: 0.01 };
    const res = await request(app).post('/api/bookings').set('Authorization', `Bearer ${demoToken}`).send(body);
    assert.equal(res.status, 201);
    assert.equal(res.body.totalAmount, 24); // 2 middle-zone seats x 12
  });

  test('prices seats by zone (front -2, middle base, back +3)', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${demoToken}`)
      .send(await movieBody(['A1', 'E1', 'I1']));
    assert.equal(res.body.totalAmount, 10 + 12 + 15);
  });

  test('calculates hotel totals from the catalogue price and nights', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${demoToken}`)
      .send({ type: 'hotel', details: { hotelId: 'h1', nights: 3 }, totalAmount: 1 });
    assert.equal(res.status, 201);
    assert.equal(res.body.totalAmount, 189 * 3);
  });

  test('rejects invalid nights, unknown hotels and unknown booking types', async () => {
    const post = (b) => request(app).post('/api/bookings').set('Authorization', `Bearer ${demoToken}`).send(b);
    assert.equal((await post({ type: 'hotel', details: { hotelId: 'h1', nights: 0 } })).status, 400);
    assert.equal((await post({ type: 'hotel', details: { hotelId: 'h1', nights: 999 } })).status, 400);
    assert.equal((await post({ type: 'hotel', details: { hotelId: 'nope', nights: 1 } })).status, 404);
    assert.equal((await post({ type: 'spaceship', details: {} })).status, 400);
  });

  test('rejects invalid or duplicate movie seats', async () => {
    const post = async (seats) =>
      request(app).post('/api/bookings').set('Authorization', `Bearer ${demoToken}`).send(await movieBody(seats));
    assert.equal((await post(['Z9'])).status, 400);
    assert.equal((await post(['A99'])).status, 400);
    assert.equal((await post(['A1', 'A1'])).status, 400);
    assert.equal((await post([])).status, 400);
  });

  test('applies weekend and infant-discount rules to travel fares', async () => {
    const travels = (await request(app).get('/api/travels')).body;
    const train = travels.find((t) => t.id === 't2'); // base 89
    // find the next Saturday and the next Tuesday (UTC) in the future
    const next = (weekday) => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + 1);
      while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().slice(0, 10);
    };
    const book = (date, children = []) =>
      request(app).post('/api/bookings').set('Authorization', `Bearer ${demoToken}`)
        .send({ type: 'travel', details: { travelId: train.id, date, children, seats: [] } });

    assert.equal((await book(next(2))).body.totalAmount, 89);
    assert.equal((await book(next(6))).body.totalAmount, 106.8); // 89 x 1.2
    assert.equal((await book(next(2), [{ name: 'Baby', age: 1 }])).body.totalAmount, 133.5); // 89 + 89 x 0.5
    assert.equal((await book('2020-01-01')).status, 400); // past dates rejected
  });
});

describe('seat double-booking protection', () => {
  test('a taken seat cannot be booked again and shows up as taken', async () => {
    const body = await movieBody(['E5']);
    const first = await request(app).post('/api/bookings').set('Authorization', `Bearer ${demoToken}`).send(body);
    assert.equal(first.status, 201);

    const other = await request(app).post('/api/auth/register').send({ email: 'late@bookflow.com', password: 'password1' });
    const second = await request(app).post('/api/bookings').set('Authorization', `Bearer ${other.body.token}`).send(body);
    assert.equal(second.status, 409);

    const { movieId, date, showtime } = body.details;
    const taken = await request(app).get(`/api/movies/${movieId}/seats`).query({ date, showtime });
    assert.deepEqual(taken.body.taken, ['E5']);
  });

  test('a failed multi-seat booking reserves nothing (transaction rollback)', async () => {
    await request(app).post('/api/bookings').set('Authorization', `Bearer ${demoToken}`).send(await movieBody(['F2']));
    const res = await request(app).post('/api/bookings').set('Authorization', `Bearer ${demoToken}`).send(await movieBody(['F1', 'F2']));
    assert.equal(res.status, 409);
    const { movieId, date, showtime } = (await movieBody([])).details;
    const taken = await request(app).get(`/api/movies/${movieId}/seats`).query({ date, showtime });
    assert.deepEqual(taken.body.taken, ['F2']); // F1 was rolled back
    const mine = await request(app).get('/api/bookings').set('Authorization', `Bearer ${demoToken}`);
    assert.equal(mine.body.length, 1);
  });

  test('10 simultaneous requests for the same seat produce exactly one booking', async () => {
    const body = await movieBody(['G7']);
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app).post('/api/bookings').set('Authorization', `Bearer ${demoToken}`).send(body)
      )
    );
    const statuses = results.map((r) => r.status).sort();
    assert.equal(statuses.filter((s) => s === 201).length, 1);
    assert.equal(statuses.filter((s) => s === 409).length, 9);
  });
});
