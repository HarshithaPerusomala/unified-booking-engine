import { test, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app, resetDbForTests } from './setup.js';

beforeEach(async () => {
  await resetDbForTests();
});

describe('POST /api/auth/login', () => {
  test('logs the seeded demo user in with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'demo@bookflow.com', password: 'demo123' });

    assert.equal(res.status, 200);
    assert.ok(res.body.token, 'expected a JWT to be returned');
    assert.equal(res.body.user.email, 'demo@bookflow.com');
    assert.equal(res.body.user.isAdmin, false);
  });

  test('rejects an incorrect password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'demo@bookflow.com', password: 'wrong-password' });

    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Invalid email or password');
  });

  test('rejects an unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@bookflow.com', password: 'demo123' });

    assert.equal(res.status, 401);
  });
});

describe('POST /api/auth/register', () => {
  test('creates a new user with a hashed password and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new.user@bookflow.com', password: 'super-secret', name: 'New User' });

    assert.equal(res.status, 201);
    assert.ok(res.body.token);
    assert.equal(res.body.user.email, 'new.user@bookflow.com');

    // The password must never be stored or returned in plaintext.
    const raw = JSON.stringify(res.body);
    assert.ok(!raw.includes('super-secret'), 'plaintext password leaked in response');

    // And the new user should be able to log in with it afterwards.
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'new.user@bookflow.com', password: 'super-secret' });
    assert.equal(login.status, 200);
  });

  test('rejects registering an email that already exists', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'demo@bookflow.com', password: 'whatever1' });

    assert.equal(res.status, 400);
  });

  test('rejects a password shorter than 6 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'short@bookflow.com', password: '123' });

    assert.equal(res.status, 400);
  });
});

describe('protected routes', () => {
  test('rejects a request with no token', async () => {
    const res = await request(app).get('/api/bookings');
    assert.equal(res.status, 401);
  });

  test('rejects a request with a garbage token', async () => {
    const res = await request(app).get('/api/bookings').set('Authorization', 'Bearer not-a-real-token');
    assert.equal(res.status, 401);
  });

  test('rejects a non-admin user hitting an admin-only route', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'demo@bookflow.com', password: 'demo123' });
    const token = login.body.token;

    const res = await request(app)
      .post('/api/admin/movies')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Test Movie', genre: 'Drama', duration: '2h', rating: 'PG', showtimes: ['1:00 PM'], price: 10 });

    assert.equal(res.status, 403);
  });

  test('allows the admin user to add a movie', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@bookflow.com', password: 'admin123' });
    const token = login.body.token;

    const res = await request(app)
      .post('/api/admin/movies')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Test Movie', genre: 'Drama', duration: '2h', rating: 'PG', showtimes: ['1:00 PM'], price: 10 });

    assert.equal(res.status, 201);
    assert.equal(res.body.title, 'Test Movie');
  });
});
