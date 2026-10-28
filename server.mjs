import { createServer } from 'node:http';
import { loadEnvFile } from 'node:process';
import { pathToFileURL } from 'node:url';
import { authenticate, importListing, parseItemUrl } from './ebay-feasibility.mjs';

try { loadEnvFile(new URL('.env', import.meta.url)); } catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const plainText = html => html == null ? null : String(html)
  .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
  .replace(/<\/(p|div|li|h[1-6])\s*>|<br\s*\/?>/gi, '\n')
  .replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'").trim();

export function createApp({ auth = authenticate, importer = importListing } = {}) {
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const send = (status, body) => { res.writeHead(status); res.end(JSON.stringify(body)); };
    if (req.url === '/api/health' && req.method === 'GET') return send(200, { ok: true });
    if (req.url !== '/api/import') return send(404, { error: 'Endpoint not found.' });
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(405, { error: 'Use POST to import a listing.' }); }
    // The Vite proxy keeps browser requests on one origin. No open CORS access.
    if (req.headers.origin && !['http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:4173', 'http://localhost:4173'].includes(req.headers.origin)) {
      return send(403, { error: 'This origin is not allowed.' });
    }
    if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'Send a JSON request.' });
    let body = '';
    try {
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 4096) return send(413, { error: 'The listing URL is too long.' });
      }
      let input;
      try { input = JSON.parse(body); } catch { return send(400, { error: 'Invalid JSON request.' }); }
      if (typeof input?.url !== 'string' || input.url.length > 2048) return send(400, { error: 'Provide one eBay.ca listing URL.' });
      try { parseItemUrl(input.url); } catch (error) { return send(400, { error: error.message }); }
      const token = await auth();
      const car = await importer(input.url, {
        Authorization: `Bearer ${token.access_token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_CA', Accept: 'application/json',
      }, { quiet: true });
      if (car.categoryIdPath && !car.categoryIdPath.split('|').includes('6001')) {
        return send(422, { error: 'This listing is outside Cars & Trucks. Please import a complete used vehicle.' });
      }
      if (/\baccessories\b/i.test(car.title ?? '')) return send(422, { error: 'This listing is titled as accessories. Please choose a complete used vehicle.' });
      if (String(car.conditionId) === '1000' || /^new$/i.test(car.condition ?? '')) return send(422, { error: 'This listing is marked New. Please choose a used vehicle.' });
      // Return seller content as inert text. Never send executable seller HTML to React.
      return send(200, { vehicle: { ...car, description: plainText(car.description) } });
    } catch (error) {
      // Do not log listing payloads, credentials, URLs or upstream error bodies.
      const message = String(error.message);
      if (/HTTP 404|HTTP 410/.test(message)) return send(404, { error: 'This listing is unavailable or eBay cannot return it. Try another listing.' });
      if (/HTTP 429/.test(message)) return send(429, { error: 'eBay is busy or its request limit was reached. Please try again later.' });
      if (/EBAY_CLIENT|OAuth|HTTP 401|HTTP 403/.test(message)) return send(503, { error: 'eBay authentication is unavailable. Check the backend Production credentials and permissions.' });
      return send(502, { error: 'Could not reach eBay or retrieve this listing. Please try again shortly.' });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createApp();
  server.listen(Number(process.env.PORT) || 3001, '127.0.0.1', () => console.log('Dilemma API ready at http://127.0.0.1:' + server.address().port));
}
