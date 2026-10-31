import test from 'node:test';
import assert from 'node:assert/strict';
import { extractVehicleSpecs, vinMismatches } from './src/vehicle-specs.js';
import { modelResearchRequest, loadModelSpecs } from './src/model-specs.js';
import { enrichVehicle } from './src/enrichment.js';
import { bundledModelSpecs } from './src/bundled-model-specs.js';
import { createSpecCache } from './src/spec-cache.js';
import { createSpecScheduler } from './src/spec-scheduler.js';
import { rankDecisionMode } from './src/decision-engine.js';
import { estimateModelSpecs, parseModelFindings } from './backend/model-specs.mjs';
import { researchCaller } from './backend/research-request.mjs';
import { createHandler } from './backend/handler.mjs';
import { CORE_SPEC_FIELDS, mergeResearch, validatedResearch } from './shared/model-specs.js';

const input = { year: 1999, make: 'BMW', model: 'Z3', trim: 'm sport', displacement: 2.8, cylinders: 6, bodyType: 'Coupe', transmission: 'Automatic', drivetrain: 'RWD', fuelType: 'Gasoline', fields: CORE_SPEC_FIELDS };
const bmw = () => ({ legacyItemId: 'fictional-bmw', year: '1999', make: 'BMW', model: 'Z3', itemSpecifics: Object.entries({ Trim: 'm sport', Engine: '2.8 L I6', 'Body type': 'Coupe', Transmission: 'Automatic', Drivetrain: 'RWD', 'Fuel type': 'Gasoline' }).map(([name, value]) => ({ name, value })) });
const estimate = (field, value, scope = input) => ({ kind: 'value', value, quality: 'estimated', origin: 'model-estimate', scope: Object.fromEntries(Object.entries(scope).filter(([key]) => key !== 'fields')), assumptions: ['Synthetic unverified model estimate.'], evidence: [] });
const memoryStorage = () => { const data = new Map(); return { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key), data }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('listing identity/configuration wins over VIN and no longer blocks research or ranking', () => {
  const car = bmw();
  car.description = '193 hp. Curb weight: 1375 kg.';
  const vin = { status: 'decoded', fields: { year: '2005', make: 'Ford', model: 'Mustang', displacement: 4.6, cylinders: 8, transmission: 'Manual', horsepower: 300, seats: 4 } };
  vin.mismatches = vinMismatches(car, vin); car.enrichment = { vin };
  const { specs } = extractVehicleSpecs(car);
  assert.equal(specs.year.value, 1999); assert.equal(specs.make.value, 'BMW'); assert.equal(specs.displacement.value, 2.8); assert.equal(specs.transmission.value, 'Automatic');
  assert.equal(specs.horsepower.value, 193); assert.equal(specs.seats.value, null); assert.equal(specs.year.listingPreferred, true);
  assert.equal(modelResearchRequest(car).make, 'BMW');
  const result = rankDecisionMode([car], 'performance');
  assert.equal(result.best.length, 1); assert.equal(result.best[0].reviewRequired, false); assert.ok(result.best[0].warnings.length);
});

test('VIN only fills missing compatible fields, and conflicting powertrains cannot donate horsepower', () => {
  const car = bmw();
  car.enrichment = { vin: { status: 'decoded', fields: { year: '1999', make: 'BMW', model: 'Z3', displacement: 2.8, cylinders: 6, horsepower: 193, transmissionSpeeds: 4 } } };
  assert.equal(extractVehicleSpecs(car).specs.horsepower.status, 'vin-record');
  car.description = '200 hp.';
  assert.equal(extractVehicleSpecs(car).specs.horsepower.value, 200);
  car.description = ''; car.enrichment.vin.fields.displacement = 3.2;
  car.enrichment.vin.fields.curbWeightKg = 1500;
  assert.equal(extractVehicleSpecs(car).specs.horsepower.value, null);
  assert.equal(extractVehicleSpecs(car).specs.transmissionSpeeds.value, null);
  assert.equal(extractVehicleSpecs(car).specs.curbWeightKg.value, null);
  car.enrichment.vin.fields.displacement = 2.8; car.enrichment.vin.fields.engineType = 'V';
  assert.equal(extractVehicleSpecs(car).specs.horsepower.value, null);
});

test('BMW reviewed core specs are published immediately and survive AI failure without manual retry', async () => {
  const car = bmw(), snapshots = [], calls = [];
  const result = await enrichVehicle(car, { cache: createSpecCache({ storage: null }), onUpdate: value => snapshots.push(value), fetcher: async (url, options) => {
    calls.push(url);
    if (url === '/api/model-specs') return Response.json({ modelSpecs: { status: 'unavailable', fields: {}, reason: 'Provider offline.' } });
    return Response.json({ columns: [], rows: [] });
  } });
  for (const state of [snapshots[0], result]) {
    const specs = extractVehicleSpecs({ ...car, enrichment: state }).specs;
    assert.equal(CORE_SPEC_FIELDS.filter(key => specs[key].value != null).length, 8);
    assert.equal(specs.horsepower.value, 193); assert.equal(specs.transmissionSpeeds.value, 4); assert.equal(specs.curbWeightKg.value, 1375);
    assert.equal(specs.curbWeightKg.quality, 'typical'); assert.match(specs.curbWeightKg.assumptions.join(' '), /Adjacent model-year/);
  }
  assert.equal(calls.filter(url => url === '/api/model-specs').length, 1);
  assert.equal(rankDecisionMode([{ ...car, enrichment: result }], 'performance').ranked[0].values.powerToWeight, 193 / 1.375);
  const reference = bundledModelSpecs(car), weakerWeight = { ...reference.fields.curbWeightKg, value: 1320, origin: 'reference' };
  assert.equal(mergeResearch(reference, { fields: { curbWeightKg: weakerWeight } }).fields.curbWeightKg.value, 1375, 'manually reviewed reference outranks an automatic typical estimate of equal quality');
  assert.equal(Object.keys(bundledModelSpecs({ ...car, itemSpecifics: car.itemSpecifics.map(a => a.name === 'Engine' ? { ...a, value: '3.2 L I6' } : a) }).fields).length, 0);
});

test('quick API is compact, tool-free, bounded and explicitly unverified without fake citations', async () => {
  let request;
  const result = await estimateModelSpecs({ ...input, vin: 'PRIVATE', price: 99999, description: 'PRIVATE' }, { apiKey: 'test', fetcher: async (url, options) => {
    request = JSON.parse(options.body);
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ findings: [{ field: 'horsepower', value: '193', assumptions: ['North American original ratings assumed.'] }, { field: 'feature:Heated seats', value: 'true' }, { field: 'curbWeightKg', value: '-1' }] }) }] } }] });
  } });
  assert.equal(request.tools, undefined); assert.doesNotMatch(JSON.stringify(request), /PRIVATE|99999/);
  assert.equal(result.fields.horsepower.quality, 'estimated'); assert.equal(result.fields.horsepower.origin, 'model-estimate');
  assert.deepEqual(result.fields.horsepower.evidence, []); assert.deepEqual(Object.keys(result.fields), ['horsepower']);
  const cvt = { ...input, transmission: 'CVT' };
  assert.deepEqual(validatedResearch({ fields: { transmissionSpeeds: estimate('transmissionSpeeds', 7, cvt) } }, cvt).fields, {}, 'CVT virtual steps must not become a fixed gear estimate');
});

test('one readable professional source supports compatible typical specs; conflicting engine variants stay rejected', () => {
  const source = { id: 's0', retrieved: true, url: 'https://www.caranddriver.com/reviews/bmw', publisher: 'Car and Driver', group: 'hearst', manufacturer: false };
  const finding = { field: 'horsepower', kind: 'value', value: '193', scope: { ...input, trim: '2.8', market: 'US' }, sharedAcross: [], evidence: [{ sourceId: 's0', label: 'Horsepower (hp)', quote: '193' }] };
  const fields = parseModelFindings({ findings: [finding] }, [source], input);
  assert.equal(fields.horsepower.value, 193); assert.equal(fields.horsepower.quality, 'typical'); assert.ok(fields.horsepower.assumptions.length);
  assert.deepEqual(parseModelFindings({ findings: [{ ...finding, scope: { ...finding.scope, displacement: 3.2 } }] }, [source], input), {});
});

test('merging preserves stronger fields and all useful results through partial or failed attempts', () => {
  const strong = { ...estimate('horsepower', 193), quality: 'exact', origin: 'manufacturer', evidence: [{ source: 'BMW', url: 'https://www.bmw.com/specs', quote: '193 hp' }] };
  const result = mergeResearch({ status: 'partial', fields: { horsepower: strong }, dimensionRatings: { rideQuality: { rating: 3 } } }, { status: 'partial', fields: { horsepower: estimate('horsepower', 190), torque: estimate('torque', 280) } });
  assert.equal(result.fields.horsepower, strong); assert.equal(result.fields.torque.value, 280);
  const failed = mergeResearch(result, { status: 'quota', fields: {}, reason: 'Daily limit reached' });
  assert.equal(failed.fields.horsepower.value, 193); assert.equal(failed.dimensionRatings.rideQuality.rating, 3); assert.equal(failed.lastAttempt.status, 'quota');
  assert.equal(mergeResearch(result, {}).lastAttempt, undefined);
});

test('cache persists only model fields, revalidates configurations, and supports fresh/stale expiry and clear', () => {
  const storage = memoryStorage(); let now = 1000000000;
  const cache = createSpecCache({ storage, now: () => now });
  cache.save({ ...input, vin: 'PRIVATE-VIN', description: 'PRIVATE-SELLER', price: 'PRIVATE-PRICE' }, { fields: { horsepower: { ...estimate('horsepower', 193), privateExtra: 'PRIVATE-LISTING' } } });
  assert.doesNotMatch([...storage.data.values()].join(''), /PRIVATE/);
  assert.equal(createSpecCache({ storage, now: () => now }).read(input).fields.horsepower.value, 193);
  now += 6 * 86400000;
  cache.save(input, cache.read(input));
  now += 2 * 86400000;
  assert.equal(cache.read(input), null); assert.equal(cache.read(input, { allowStale: true }).fields.horsepower.stale, true);
  now += 23 * 86400000; assert.equal(cache.read(input, { allowStale: true }), null);
  cache.save(input, { fields: { horsepower: { ...estimate('horsepower', 193), quality: 'typical', origin: 'reference', evidence: [{ source: 'BMW', url: 'https://www.bmw.com/specs', quote: '193 hp' }] } } });
  now += 31 * 86400000; assert.equal(cache.read(input), null); assert.equal(cache.read(input, { allowStale: true }).fields.horsepower.stale, true);
  now += 60 * 86400000; assert.equal(cache.read(input, { allowStale: true }), null);
  assert.equal(cache.read({ ...input, displacement: 3.2 }), null);
  cache.clear(); assert.equal(storage.data.size, 0); assert.equal(cache.read(input, { allowStale: true }), null);
});

test('cache storage failures and malformed saved data cannot break lookup, and capacity is bounded', () => {
  const blocked = createSpecCache({ storage: { getItem() { throw Error(); }, setItem() { throw Error(); }, removeItem() { throw Error(); } } });
  blocked.save(input, { fields: { horsepower: estimate('horsepower', 193) } }); assert.equal(blocked.read(input).fields.horsepower.value, 193); blocked.clear();
  const storage = memoryStorage(); storage.setItem('dilemma:model-specs:v1', JSON.stringify([{ input, savedAt: 1, fields: { horsepower: null } }]));
  assert.equal(createSpecCache({ storage, now: () => 2 }).read(input), null);
  const cache = createSpecCache({ storage, maxEntries: 2 });
  for (const model of ['Z3', 'Z4', 'Z8']) { const config = { ...input, model }; cache.save(config, { fields: { horsepower: estimate('horsepower', 193, config) } }); }
  assert.equal(cache.read(input), null); assert.equal(JSON.parse([...storage.data.values()][0]).length, 2);
});

test('scheduler limits phases, deduplicates requests and cancels only unsubscribed work', async () => {
  const scheduler = createSpecScheduler(), gates = [], started = [];
  const run = id => signal => { started.push(id); const gate = deferred(); gates.push({ ...gate, signal }); return gate.promise; };
  const a = new AbortController(), b = new AbortController();
  const first = scheduler.schedule('same', 'quick', run('q1'), a.signal).catch(e => e.name);
  const shared = scheduler.schedule('same', 'quick', run('duplicate'), b.signal);
  const second = scheduler.schedule('q2', 'quick', run('q2'));
  const third = scheduler.schedule('q3', 'quick', run('q3'));
  const research = scheduler.schedule('r1', 'research', run('r1'));
  const queuedResearch = scheduler.schedule('r2', 'research', run('r2'));
  await tick(); assert.deepEqual(started, ['q1', 'q2', 'r1']);
  a.abort(); assert.equal(await first, 'AbortError'); assert.equal(gates[0].signal.aborted, false);
  gates[0].resolve('shared'); assert.equal(await shared, 'shared'); await tick(); assert.ok(started.includes('q3'));
  for (const gate of gates) gate.resolve('done');
  await Promise.all([second, third, research]); await tick(); assert.ok(started.includes('r2')); gates.at(-1).resolve('done'); await queuedResearch;
});

test('provider retries a transient failure once, respects deadlines and never retries daily quota or auth', async () => {
  let calls = 0;
  const provider = researchCaller({ endpoint: 'https://provider.example.test', apiKey: 'test', timeoutMs: 3000, fetcher: async () => ++calls === 1 ? new Response('', { status: 503 }) : Response.json({ ok: true }) });
  assert.equal((await provider.call({})).ok, true); assert.equal(calls, 2);
  for (const status of [400, 401, 403, 429]) {
    calls = 0;
    const caller = researchCaller({ endpoint: 'https://provider.example.test', apiKey: 'test', timeoutMs: 3000, fetcher: async () => { calls++; return Response.json({ error: { details: [{ violations: [{ quotaId: 'GenerateRequestsPerDay' }] }, { retryDelay: '1s' }] } }, { status }); } });
    await assert.rejects(caller.call({})); assert.equal(calls, 1);
  }
  calls = 0;
  const short = researchCaller({ endpoint: 'https://provider.example.test', apiKey: 'test', timeoutMs: 10, fetcher: async () => { calls++; return new Response('', { status: 503 }); } });
  await assert.rejects(short.call({})); assert.equal(calls, 1);
});

test('VIN and source verification cannot delay quick estimates or overwrite them on failure', async () => {
  const vin = deferred(), research = deferred(), snapshots = [], car = { year: '2018', make: 'Honda', model: 'Civic', vin: '1HGCM82633A004352' };
  const scope = { year: 2018, make: 'Honda', model: 'Civic' };
  const result = enrichVehicle(car, { cache: createSpecCache({ storage: null }), scheduler: createSpecScheduler(), onUpdate: state => snapshots.push(state), fetcher: async (url, options) => {
    if (url === '/api/vehicle-data') return vin.promise;
    if (url === '/api/model-specs') return JSON.parse(options.body).phase === 'quick' ? Response.json({ modelSpecs: { status: 'partial', fields: { horsepower: estimate('horsepower', 158, scope) } } }) : research.promise;
    return Response.json({ columns: [], rows: [] });
  } });
  await tick(); await tick();
  assert.ok(snapshots.some(state => state.modelSpecs.fields.horsepower?.value === 158));
  assert.ok(!snapshots.some(state => state.vin.status === 'decoded'));
  research.resolve(Response.json({ modelSpecs: { status: 'unavailable', fields: {}, reason: 'Research failed' } }));
  vin.resolve(Response.json({ vin: { status: 'decoded', fields: { year: '2003', make: 'Honda', model: 'Accord', horsepower: 240 } } }));
  const final = await result;
  assert.equal(extractVehicleSpecs({ ...car, enrichment: final }).specs.horsepower.value, 158);
  assert.ok(final.vin.mismatches.length);
});

test('clearing cache during lookup prevents a late result from saving itself again', async () => {
  const cache = createSpecCache({ storage: memoryStorage() }), gate = deferred();
  const lookup = loadModelSpecs(bmw(), { cache, scheduler: createSpecScheduler(), phase: 'quick', fetcher: () => gate.promise });
  await tick(); cache.clear();
  gate.resolve(Response.json({ modelSpecs: { status: 'partial', fields: { horsepower: estimate('horsepower', 193) } } }));
  assert.equal((await lookup).fields.horsepower.value, 193); assert.equal(cache.read(input), null);
  const phaseGate = deferred(), phases = [], car = { year: '2018', make: 'Honda', model: 'Civic' };
  const data = { modelSpecs: { status: 'partial', fields: { horsepower: estimate('horsepower', 158, { year: 2018, make: 'Honda', model: 'Civic' }) } } };
  const staged = enrichVehicle(car, { cache, scheduler: createSpecScheduler(), skipVin: true, force: true, fetcher: (url, options) => {
    const phase = JSON.parse(options.body).phase; phases.push(phase);
    return phase === 'quick' ? phaseGate.promise : Response.json(data);
  } });
  await tick(); cache.clear();
  phaseGate.resolve(Response.json(data));
  await staged; assert.deepEqual(phases, ['quick', 'research']); assert.equal(cache.read(modelResearchRequest(car)), null, 'later phases from an already-cleared run cannot repopulate the cache');
});

test('browser retries transport failures once, never retries authentication and recovers stale specs during outage', async () => {
  let calls = 0;
  const result = await loadModelSpecs(bmw(), { phase: 'quick', scheduler: createSpecScheduler(), fetcher: async () => {
    if (++calls === 1) throw new TypeError('Network disconnected');
    return Response.json({ modelSpecs: { status: 'partial', fields: { horsepower: estimate('horsepower', 193) } } });
  } });
  assert.equal(calls, 2); assert.equal(result.fields.horsepower.value, 193);
  calls = 0;
  await loadModelSpecs(bmw(), { scheduler: createSpecScheduler(), fetcher: async () => { calls++; return new Response('', { status: 401 }); } });
  assert.equal(calls, 1);
  let now = Date.now(); const cache = createSpecCache({ storage: null, now: () => now });
  cache.save(input, { fields: { horsepower: estimate('horsepower', 193) } }); now += 8 * 86400000;
  const recovered = await loadModelSpecs(bmw(), { cache, scheduler: createSpecScheduler(), fetcher: async () => Response.json({ modelSpecs: { status: 'unavailable', fields: {} } }) });
  assert.equal(recovered.fields.horsepower.value, 193); assert.equal(recovered.fields.horsepower.stale, true);
});

test('cancelling the final subscriber releases a scheduler slot even if transport ignores abort', async () => {
  const scheduler = createSpecScheduler({ quickLimit: 1 }), controller = new AbortController();
  const abandoned = scheduler.schedule('old', 'quick', () => new Promise(() => {}), controller.signal).catch(e => e.name);
  await tick(); const replacement = scheduler.schedule('new', 'quick', async () => 'replacement');
  controller.abort(); assert.equal(await abandoned, 'AbortError'); assert.equal(await replacement, 'replacement');
});

test('endpoint phase is validated, passed to lookup, defaults to research and preserves origin checks', async () => {
  const phases = [];
  const handler = createHandler({ modelSpecsLookup: async (input, options) => { phases.push(options.phase); return { status: 'partial', fields: {} }; } });
  const request = body => new Request('https://app.example.test/api/model-specs', { method: 'POST', headers: { origin: 'https://app.example.test', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await handler(request({ ...input, phase: 'quick' }))).status, 200);
  assert.equal((await handler(request(input))).status, 200); assert.deepEqual(phases, ['quick', 'research']);
  assert.equal((await handler(request({ ...input, phase: 'invalid' }))).status, 400);
});

test('daily quota stops subsequent phases and requests while retaining useful specs', async () => {
  for (const status of [400, 401]) {
    let invalidCalls = 0;
    await enrichVehicle({ year: '2018', make: 'Honda', model: 'Accord' }, { cache: createSpecCache({ storage: null }), skipVin: true, scheduler: createSpecScheduler(), fetcher: async () => { invalidCalls++; return new Response('', { status }); } });
    assert.equal(invalidCalls, 1, 'invalid/auth failures must stop subsequent phases');
  }
  let calls = 0;
  const car = { year: '2018', make: 'Honda', model: 'Civic', enrichment: { modelSpecs: { status: 'partial', fields: { horsepower: estimate('horsepower', 158, { year: 2018, make: 'Honda', model: 'Civic' }) } } } };
  const state = await enrichVehicle(car, { cache: createSpecCache({ storage: null }), skipVin: true, scheduler: createSpecScheduler(), fetcher: async () => {
    calls++; return Response.json({ modelSpecs: { status: 'quota', dailyQuota: true, fields: {}, reason: 'Daily quota exhausted' } });
  } });
  assert.equal(calls, 1); assert.equal(state.modelSpecs.fields.horsepower.value, 158); assert.equal(state.modelSpecs.lastAttempt.status, 'quota');
  await loadModelSpecs(bmw(), { fetcher: () => assert.fail('Daily quota must stop new provider requests') });
});
