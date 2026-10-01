// NODE_ENV, JWT_SECRET and DATABASE_URL are set by the "test" npm script
// (see package.json) rather than here, because ES module imports are
// hoisted above other statements — setting them in this file would run
// too late for db.js's top-of-module checks.

// Importing these here means every test file that imports from ./setup.js
// shares the same Postgres test database (see DATABASE_URL in package.json
// and the README).
export { default as app } from '../app.js';
export { resetDbForTests } from '../db.js';
