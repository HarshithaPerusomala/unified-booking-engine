import 'dotenv/config';
import app from './app.js';
import { initDb } from './db.js';

const PORT = process.env.PORT || 3001;

async function main() {
  await initDb();
  app.listen(PORT, () => console.log(`Backend running at http://localhost:${PORT}`));
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
