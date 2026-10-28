import { authenticate, importListing, parseItemUrl } from '../ebay-feasibility.mjs';

const MAX_BODY_BYTES = 4096;
const UPSTREAM_TIMEOUT_MS = 25000; // OAuth + Browse fit inside Vercel's 60-second limit.
const localOrigins = new Set(['http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:4173', 'http://localhost:4173']);
const responseHeaders = {
  'Cache-Control': 'no-store',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  Pragma: 'no-cache',
  'X-Content-Type-Options': 'nosniff',
};
const json = (status, body, headers = {}) => Response.json(body, { status, headers: { ...responseHeaders, ...headers } });
const plainText = html => html == null ? null : String(html)
  .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
  .replace(/<\/(p|div|li|h[1-6])\s*>|<br\s*\/?>/gi, '\n')
  .replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'").trim();

async function readBody(request) {
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) return null;
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks).toString('utf8');
}

// Both the local server and Vercel call this stateless handler. No environment-file reads here.
export function createHandler({ auth = authenticate, importer = importListing } = {}) {
  return async function handleRequest(request) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health' && request.method === 'GET') return json(200, { ok: true });
    if (url.pathname !== '/api/import') return json(404, { error: 'Endpoint not found.' });
    if (request.method !== 'POST') return json(405, { error: 'Use POST to import a listing.' }, { Allow: 'POST' });
    const origin = request.headers.get('origin');
    const local = !process.env.VERCEL && ['localhost', '127.0.0.1'].includes(url.hostname) && localOrigins.has(origin);
    // Relative frontend requests work on production, preview and custom domains.
    // Do not allow arbitrary *.vercel.app origins or reflect CORS headers.
    if (origin && origin !== url.origin && !local) return json(403, { error: 'This origin is not allowed.' });
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return json(415, { error: 'Send a JSON request.' });
    try {
      const body = await readBody(request);
      if (body === null) return json(413, { error: 'The listing URL is too long.' });
      let input;
      try { input = JSON.parse(body); } catch { return json(400, { error: 'Invalid JSON request.' }); }
      if (typeof input?.url !== 'string' || input.url.length > 2048) return json(400, { error: 'Provide one eBay.ca listing URL.' });
      try { parseItemUrl(input.url); } catch (error) { return json(400, { error: error.message }); }
      const token = await auth({ timeoutMs: UPSTREAM_TIMEOUT_MS, quiet: true });
      const car = await importer(input.url, {
        Authorization: `Bearer ${token.access_token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_CA', Accept: 'application/json',
      }, { quiet: true, timeoutMs: UPSTREAM_TIMEOUT_MS });
      if (car.categoryIdPath && !car.categoryIdPath.split('|').includes('6001')) return json(422, { error: 'This listing is outside Cars & Trucks. Please import a complete used vehicle.' });
      if (/\baccessories\b/i.test(car.title ?? '')) return json(422, { error: 'This listing is titled as accessories. Please choose a complete used vehicle.' });
      if (String(car.conditionId) === '1000' || /^new$/i.test(car.condition ?? '')) return json(422, { error: 'This listing is marked New. Please choose a used vehicle.' });
      return json(200, { vehicle: { ...car, description: plainText(car.description) } });
    } catch (error) {
      // No listing payloads, credentials, URLs or upstream response bodies in logs/errors.
      const message = String(error.message);
      if (/network\/timeout|TimeoutError|AbortError/.test(message)) return json(504, { error: 'eBay did not respond in time or could not be reached. Please try again.' });
      if (/HTTP 404|HTTP 410/.test(message)) return json(404, { error: 'This listing is unavailable or eBay cannot return it. Try another listing.' });
      if (/HTTP 429/.test(message)) return json(429, { error: 'eBay is busy or its request limit was reached. Please try again later.' });
      if (/EBAY_CLIENT|OAuth|HTTP 401|HTTP 403/.test(message)) return json(503, { error: 'eBay authentication is unavailable. Check the backend Production credentials and permissions.' });
      return json(502, { error: 'Could not reach eBay or retrieve this listing. Please try again shortly.' });
    }
  };
}
