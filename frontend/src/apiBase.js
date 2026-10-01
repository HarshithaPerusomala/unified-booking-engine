// In local dev this stays empty and Vite's dev-server proxy (see vite.config.js)
// forwards /api/* to the backend on localhost:3001.
//
// In production, set VITE_API_URL to your deployed backend's URL
// (e.g. https://bookflow-api.onrender.com) at build time, and every
// fetch('/api/...') call below will target that host instead.
export const API_BASE = import.meta.env.VITE_API_URL || '';
