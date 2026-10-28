import { createHandler } from '../backend/handler.mjs';

// Vercel's Node.js Web Request entry point; no local server or .env is bundled.
export default { fetch: createHandler() };
