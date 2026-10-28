// Single source of truth for the backend base URL.
// Production builds bake in VITE_API_BASE_URL (.env.production);
// dev falls back to the Vite proxy at /api (vite.config.js).
export const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
