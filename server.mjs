import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { loadEnvFile } from 'node:process';
import { pathToFileURL } from 'node:url';
import { createHandler } from './backend/handler.mjs';

// Only local development reads .env. Vercel uses server-side environment variables.
try { loadEnvFile(new URL('.env', import.meta.url)); } catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

export function createApp(options) {
  const handler = createHandler(options);
  return createServer(async (req, res) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    const closed = () => { if (!res.writableEnded) abort(); };
    req.once('aborted', abort);
    res.once('close', closed);
    try {
      const request = new Request(new URL(req.url, `http://${req.headers.host}`), {
        method: req.method, headers: req.headers, signal: controller.signal,
        ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: Readable.toWeb(req), duplex: 'half' }),
      });
      const response = await handler(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      if (res.destroyed) return;
      res.writeHead(500, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: 'The request could not be processed. Please try again.' }));
    } finally { req.off('aborted', abort); res.off('close', closed); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createApp();
  server.listen(Number(process.env.PORT) || 3001, '127.0.0.1', () => console.log('Dilemma API ready at http://127.0.0.1:' + server.address().port));
}
