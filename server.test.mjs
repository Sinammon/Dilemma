import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './server.mjs';
import { authenticate, importListing } from './ebay-feasibility.mjs';

const url = 'https://www.ebay.ca/itm/123456789012';
const fixture = { legacyItemId: '123456789012', categoryIdPath: '6000|6001', condition: 'Used', images: [], itemSpecifics: [], description: '<script>alert(1)</script><p>Hello &amp; welcome</p>' };
async function start(t, options = {}) {
  const server = createApp({ auth: async () => ({ access_token: 'synthetic-token' }), importer: async () => fixture, ...options });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return (body, headers = {}, method = 'POST', path = '/api/import') => fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { 'Content-Type': 'application/json', ...headers }, ...(method === 'GET' ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
}

test('API rejects invalid inputs before authentication and never caches responses', async t => {
  const post = await start(t, { auth: () => { throw new Error('Authentication must not run'); } });
  for (const body of [{ url: 'https://evil.test/itm/123456789012' }, { url: 5 }, '{bad json', null, { urls: [url,url] }]) {
    const response = await post(body);
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal((await post({ url: 'a'.repeat(5000) })).status, 413);
  assert.equal((await post({ url }, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await post({ url }, { Origin: 'https://evil.test' })).status, 403);
  assert.equal((await post(null, {}, 'GET')).status, 405);
  assert.equal((await post(null, {}, 'GET', '/api/missing')).status, 404);
});

test('API forwards marketplace and quiet mode, returns plain text without tokens', async t => {
  const post = await start(t, { importer: async (input, headers, options) => {
    assert.equal(input, url);
    assert.equal(headers.Authorization, 'Bearer synthetic-token');
    assert.equal(headers['X-EBAY-C-MARKETPLACE-ID'], 'EBAY_CA');
    assert.equal(options.quiet, true);
    return fixture;
  } });
  const response = await post({ url });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.vehicle.description, 'Hello & welcome');
  assert.ok(!JSON.stringify(body).includes('synthetic-token'));
});

test('upstream errors become useful messages without leaking details', async t => {
  for (const [message, status] of [['HTTP 404: private payload',404], ['HTTP 429: private payload',429], ['OAuth token failed: private payload',503], ['HTTP 403: private payload',503], ['network failure: private payload',502]]) {
    await t.test(String(status) + message.slice(0,9), async t => {
      const post = await start(t, { importer: async () => { throw new Error(message); } });
      const response = await post({ url });
      assert.equal(response.status, status);
      assert.ok(!(await response.text()).includes('private payload'));
    });
  }
});

test('rejects known nonvehicle and new listings', async t => {
  for (const vehicle of [{ ...fixture, categoryIdPath: '6000|6028' }, { ...fixture, conditionId: '1000' }, { ...fixture, title: 'Car accessories' }]) {
    const post = await start(t, { importer: async () => vehicle });
    assert.equal((await post({ url })).status, 422);
  }
});

test('shared OAuth and quiet legacy importer work together without listing logs', async t => {
  const previousId = process.env.EBAY_CLIENT_ID;
  const previousSecret = process.env.EBAY_CLIENT_SECRET;
  process.env.EBAY_CLIENT_ID = 'synthetic-id'; process.env.EBAY_CLIENT_SECRET = 'synthetic-secret';
  t.after(() => { if (previousId === undefined) delete process.env.EBAY_CLIENT_ID; else process.env.EBAY_CLIENT_ID = previousId; if (previousSecret === undefined) delete process.env.EBAY_CLIENT_SECRET; else process.env.EBAY_CLIENT_SECRET = previousSecret; });
  const log = t.mock.method(console, 'log', () => {});
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    calls++;
    if (String(input).includes('/oauth2/token')) {
      assert.equal(options.method, 'POST');
      assert.ok(options.headers.Authorization.startsWith('Basic '));
      assert.equal(options.body.get('grant_type'), 'client_credentials');
      return Response.json({ access_token: 'test-token' });
    }
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    return Response.json({ itemId: 'synthetic', localizedAspects: [{ name: 'Mileage', value: '100000' }] });
  });
  const auth = await authenticate();
  const car = await importListing(url, { Authorization: `Bearer ${auth.access_token}` }, { quiet: true });
  assert.equal(calls, 2);
  assert.deepEqual(car.mileage, { raw: '100000', unit: null });
  assert.equal(log.mock.calls.length, 0);
});

