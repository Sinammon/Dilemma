import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchModelRecalls, recallIdentity } from './shared/recalls.js';
import { createHandler } from './backend/handler.mjs';
import deployed from './api/recalls.js';
const identity = { year: 2002, make: 'Ford', model: 'Thunderbird' };
const campaign = { Make: 'FORD', Model: 'THUNDERBIRD', ModelYear: '2002', NHTSACampaignNumber: '06E056000', Component: 'FUEL SYSTEM', Summary: 'Certain aftermarket filters may leak.', Remedy: 'Replace affected filters.', Notes: 'Aftermarket filters only; not factory equipment.' };

test('official lookup uses a fixed NHTSA destination, exact identity and identifiable campaign sources', async () => {
  let calls = 0;
  const result = await fetchModelRecalls(identity, { fetcher: async (url, options) => {
    calls++; const target = new URL(url);
    assert.equal(target.origin, 'https://api.nhtsa.gov');
    assert.equal(target.searchParams.get('modelYear'), '2002');
    assert.equal(options.cache, 'no-store');
    return Response.json({ Count: 1, results: [campaign] });
  } });
  assert.equal(calls, 1);
  assert.equal(result.status, 'available');
  assert.match(result.campaigns[0].source, /06E056000/);
  assert.match(result.campaigns[0].notes, /not factory/);
  assert.match(result.limitation, /not a VIN recall check/);
  assert.ok(result.checked);
});

test('malformed, mismatched and failed recall responses never look like an empty successful search', async () => {
  for (const response of [
    { Count: 0 }, { Count: 2, results: [] }, { Count: 1, results: [null] },
    { Count: 1, results: [{ ...campaign, Model: 'Mustang' }] },
    { Count: 1, results: [{ ...campaign, Summary: '' }] },
    { Count: 1, results: [{ ...campaign, NHTSACampaignNumber: 'javascript:bad' }] },
  ]) assert.equal((await fetchModelRecalls(identity, { fetcher: async () => Response.json(response) })).status, 'unavailable');
  assert.equal((await fetchModelRecalls(identity, { fetcher: async () => { throw new Error('offline'); } })).status, 'unavailable');
  assert.equal((await fetchModelRecalls(identity, { fetcher: async () => new Response('', { status: 503 }) })).status, 'unavailable');
  const zero = await fetchModelRecalls(identity, { fetcher: async () => Response.json({ Count: 0, results: [] }) });
  assert.equal(zero.status, 'available');
  assert.equal(zero.count, 0);
  for (const invalid of [{ ...identity, year: 1900 }, { ...identity, make: 'https://evil.test' }, { ...identity, model: '' }, null]) assert.equal(recallIdentity(invalid), null);
});

test('local and deployed recall routes validate before lookup, require same origin, avoid eBay auth and never cache', async () => {
  let lookups = 0;
  const handler = createHandler({ auth: () => { throw new Error('must not authenticate'); }, recallLookup: async value => { lookups++; assert.deepEqual(value, identity); return { status: 'available', count: 0, campaigns: [] }; } });
  const request = (body, headers = {}) => new Request('https://dilemma.example/api/recalls', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  assert.equal((await handler(request({ year: 2002 }))).status, 400);
  assert.equal((await handler(request(identity, { origin: 'https://evil.example' }))).status, 403);
  assert.equal(lookups, 0);
  const response = await handler(request(identity));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(lookups, 1);
  assert.equal((await response.json()).recalls.status, 'available');
  assert.equal((await deployed.fetch(request({ year: 2002 }))).status, 400);
  assert.equal((await handler(new Request('https://dilemma.example/api/recalls'))).status, 405);
});
