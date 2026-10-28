import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import deployedImport from './api/import.js';
import deployedHealth from './api/health.js';
import { createHandler } from './backend/handler.mjs';

const listingUrl = 'https://www.ebay.ca/itm/123456789012';
const vehicle = { legacyItemId: '123456789012', title: 'Synthetic vehicle', images: [], itemSpecifics: [], mileage: { raw: '100000', unit: null }, returnedPrice: { value: '10', currency: 'USD' }, description: '<style>bad</style><script>bad</script><p>Seller &amp; text</p>' };
const request = (origin, body = { url: listingUrl }, extraHeaders = {}) => new Request(`${origin}/api/import?source=test`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...extraHeaders }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const fakeHandler = options => createHandler({ auth: async () => ({ access_token: 'synthetic-token' }), importer: async () => vehicle, ...options });

function syntheticCredentials(t) {
  for (const [name, value] of Object.entries({ EBAY_CLIENT_ID: 'synthetic-client', EBAY_CLIENT_SECRET: 'synthetic-secret', VERCEL: '1' })) {
    const previous = process.env[name];
    process.env[name] = value;
    t.after(() => { if (previous === undefined) delete process.env[name]; else process.env[name] = previous; });
  }
}

test('actual Vercel Web entry point imports using shared Production code without logs', async t => {
  syntheticCredentials(t);
  const logs = ['log', 'warn', 'error'].map(name => t.mock.method(console, name, () => {}));
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    calls++;
    const url = new URL(input);
    assert.equal(url.origin, 'https://api.ebay.com');
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal instanceof AbortSignal);
    if (url.pathname === '/identity/v1/oauth2/token') {
      assert.equal(options.body.get('grant_type'), 'client_credentials');
      return Response.json({ access_token: 'synthetic-token', warnings: [{errorId:1,message:'Synthetic warning'}] });
    }
    assert.equal(url.pathname, '/buy/browse/v1/item/get_item_by_legacy_id');
    assert.equal(url.searchParams.get('legacy_item_id'), '123456789012');
    assert.equal(options.headers.Authorization, 'Bearer synthetic-token');
    assert.equal(options.headers['X-EBAY-C-MARKETPLACE-ID'], 'EBAY_CA');
    return Response.json({ itemId: 'synthetic', description: '<script>bad</script><p>Seller text</p>', localizedAspects: [{ name: 'Mileage', value: '100000' }], warnings: [{errorId:2,message:'Synthetic warning'}] });
  });
  const response = await deployedImport.fetch(request('https://dilemma-preview-example.vercel.app'));
  assert.equal(response.status, 200);
  for (const header of ['cache-control', 'cdn-cache-control', 'vercel-cdn-cache-control']) assert.equal(response.headers.get(header), 'no-store');
  const data = await response.json();
  assert.equal(data.vehicle.description, 'Seller text');
  assert.deepEqual(data.vehicle.mileage, { raw: '100000', unit: null });
  assert.equal(calls, 2);
  assert.ok(!JSON.stringify(data).includes('synthetic-token'));
  for (const log of logs) assert.equal(log.mock.calls.length, 0);
});

test('same-origin production, previews and custom domains work; other origins are denied', async t => {
  syntheticCredentials(t);
  const handler = fakeHandler();
  for (const origin of ['https://dilemma.vercel.app', 'https://dilemma-preview.vercel.app', 'https://cars.example.test']) {
    const response = await handler(request(origin));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    const car = (await response.json()).vehicle;
    assert.equal(car.description, 'Seller & text');
    assert.deepEqual(car.returnedPrice, { value: '10', currency: 'USD' });
  }
  for (const origin of ['https://unrelated.vercel.app', 'https://dilemma.vercel.app.evil.test', 'http://127.0.0.1:5173', 'null']) {
    assert.equal((await handler(request('https://dilemma.vercel.app', { url: listingUrl }, { Origin: origin }))).status, 403);
  }
});

test('Vercel request validation runs before OAuth, including body byte limits', async () => {
  const handler = fakeHandler({ auth: () => { throw new Error('Must not authenticate'); } });
  for (const body of ['broken JSON', null, { url: 'https://evil.test/itm/123456789012' }, { url: 'x'.repeat(2049) }]) assert.equal((await handler(request('https://dilemma.vercel.app', body))).status, 400);
  // Multi-byte input must be bounded by bytes, not character count.
  assert.equal((await handler(request('https://dilemma.vercel.app', { url: 'é'.repeat(2200) }))).status, 413);
  assert.equal((await handler(request('https://dilemma.vercel.app', { url: listingUrl }, { 'Content-Type': 'text/plain' }))).status, 415);
  const get = await deployedImport.fetch(new Request('https://dilemma.vercel.app/api/import'));
  assert.equal(get.status, 405);
  assert.equal(get.headers.get('allow'), 'POST');
  assert.equal((await get.json()).vehicle, undefined);
});

test('deployment budgets bound both upstream calls and timeout errors stay safe', async () => {
  let calls = 0;
  const handler = fakeHandler({ auth: async options => { assert.equal(options.timeoutMs, 25000); assert.equal(options.quiet, true); calls++; return { access_token: 'test' }; }, importer: async (_url, _headers, options) => { assert.equal(options.timeoutMs, 25000); assert.equal(options.quiet, true); calls++; throw new Error('URL import: network/timeout failure (TimeoutError). private payload'); } });
  const response = await handler(request('https://dilemma.vercel.app'));
  assert.equal(response.status, 504);
  assert.ok(!(await response.text()).includes('private payload'));
  assert.equal(calls, 2);
});

test('actual deployment entry maps missing credentials and upstream failures safely', async t => {
  syntheticCredentials(t);
  process.env.EBAY_CLIENT_SECRET = '';
  let response = await deployedImport.fetch(request('https://dilemma.vercel.app'));
  assert.equal(response.status, 503);
  process.env.EBAY_CLIENT_SECRET = 'synthetic-secret';
  for (const [status, expected] of [[404,404], [429,429], [401,503], [403,503], [500,502]]) {
    const mock = t.mock.method(globalThis, 'fetch', async input => String(input).includes('/oauth2/token') ? Response.json({ access_token: 'test' }) : Response.json({ errors: [{errorId:1,message:'private payload'}] }, {status}));
    response = await deployedImport.fetch(request('https://dilemma.vercel.app'));
    assert.equal(response.status, expected);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.ok(!(await response.text()).includes('private payload'));
    mock.mock.restore();
  }
});

test('health is safe and Vercel config preserves API routes without an SPA catch-all', async () => {
  const response = await deployedHealth.fetch(new Request('https://dilemma.vercel.app/api/health'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  assert.equal(config.framework, 'vite');
  assert.equal(config.outputDirectory, 'dist');
  assert.ok(config.functions['api/import.js'].maxDuration >= 60);
  assert.equal(config.rewrites, undefined); // Hash links need no SPA rewrite that might swallow /api.
});
