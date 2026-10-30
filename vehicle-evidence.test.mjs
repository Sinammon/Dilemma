import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { extractVehicleSpecs, vinMismatches } from './src/vehicle-specs.js';
import { validateVin, parseVinResponse, decodeVin } from './shared/vin.js';
import { matchFuelEconomy, annualFuelCost, loadFuelYear } from './src/fuel-data.js';
import { enrichVehicle } from './src/enrichment.js';
import { rankDecisionMode } from './src/decision-engine.js';
import { createHandler } from './backend/handler.mjs';
import { JSDOM } from 'jsdom';

const vin = '1HGCM82633A004352'; // Public NHTSA example, not a user listing.
const vinRow = { VIN: vin, ErrorCode: '0', Make: 'HONDA', Model: 'Accord', ModelYear: '2003', DisplacementL: '2.998832712', EngineCylinders: '6', EngineHP: '240', EngineConfiguration: 'V-Shaped', TransmissionStyle: 'Automatic', TransmissionSpeeds: '5', FuelTypePrimary: 'Gasoline', BodyClass: 'Coupe', Seats: '' };
const decoded = () => parseVinResponse({ Results: [vinRow] }, vin);
const aspects = values => Object.entries(values).map(([name, value]) => ({ name, value }));
const listing = (extra = {}) => ({ legacyItemId: 'fixture', year: '2018', make: 'Honda', model: 'Civic', priceCAD: { value: '16000', currency: 'CAD' }, mileage: { raw: '100000', unit: 'km' }, itemSpecifics: aspects({ Engine: '2.0 L I4', Transmission: '6-speed manual', Drivetrain: 'FWD', 'Fuel type': 'Gasoline', 'Body type': 'Sedan', 'Seating capacity': '5' }), ...extra });
const row = { year: 2018, make: 'Honda', model: 'Civic', displacement: 2, cylinders: 4, transmission: 'M6', fuel: 'X', combined: 7.7, city: 9, highway: 6.3, vehicleClass: 'Compact', sourceIndex: 0 };

test('extracts explicit engine, power, drivetrain, body and seating from HTML and specifics with provenance', () => {
  const car = listing({ description: '<p>158&nbsp;hp. 138 lb-ft. Heated <b>seats</b>. Leather seats. Navigation. Adaptive cruise control. Dual-zone climate control. Backup camera.</p><script>900 hp; 8.0 L V12</script>' });
  const before = structuredClone(car), { specs, features } = extractVehicleSpecs(car);
  assert.equal(specs.displacement.value, 2);
  assert.equal(specs.cylinders.value, 4);
  assert.equal(specs.engineType.value, 'Inline');
  assert.equal(specs.horsepower.value, 158);
  assert.ok(Math.abs(specs.torque.value - 187.102876824) < 0.001);
  assert.equal(specs.transmission.value, 'Manual');
  assert.equal(specs.transmissionSpeeds.value, 6);
  assert.equal(specs.drivetrain.value, 'FWD');
  assert.equal(specs.bodyType.value, 'Sedan');
  assert.equal(specs.seats.value, 5);
  assert.equal(specs.horsepower.status, 'seller-reported');
  assert.equal(specs.horsepower.evidence[0].source, 'Seller description');
  for (const label of ['Heated seats', 'Leather seats', 'Navigation', 'Cruise control', 'Climate control', 'Backup camera']) assert.equal(features[label].value, true, label);
  assert.deepEqual(car, before);
});

test('unknown, absent, optional and conflicting features remain different states', () => {
  const { features } = extractVehicleSpecs(listing({ description: 'No heated seats or navigation. Leather seats optional. Bluetooth. No Bluetooth. Backup camera does not work. Apple CarPlay.', itemSpecifics: aspects({ 'Climate control': ['Yes', 'No'], 'Power seats': null }) }));
  assert.equal(features['Heated seats'].value, false);
  assert.equal(features.Navigation.value, false);
  assert.equal(features['Leather seats'].value, null);
  assert.equal(features.Bluetooth.status, 'conflict');
  assert.equal(features['Climate control'].status, 'conflict');
  assert.equal(features['Backup camera'].value, false);
  assert.equal(features['Apple CarPlay'].value, true);
  assert.equal(features['Power seats'].status, 'unknown');
  assert.equal(extractVehicleSpecs({ model: 'Luxury Sport Premium' }).specs.horsepower.value, null);
  assert.equal(extractVehicleSpecs({ model: 'Luxury Sport Premium' }).features['Leather seats'].value, null);
});

test('explicit power units and unit-bearing field names are required; conflicts are withheld', () => {
  assert.equal(extractVehicleSpecs({ itemSpecifics: aspects({ Horsepower: '200' }) }).specs.horsepower.value, 200);
  assert.equal(extractVehicleSpecs({ itemSpecifics: aspects({ Power: '200' }) }).specs.horsepower.value, null);
  assert.ok(Math.abs(extractVehicleSpecs({ description: '150 kW' }).specs.horsepower.value - 201.1533135) < 0.0001);
  assert.equal(extractVehicleSpecs({ description: '200 hp. 300 hp.' }).specs.horsepower.status, 'conflict');
  assert.equal(extractVehicleSpecs({ description: 'Optional 300 hp engine.' }).specs.horsepower.value, null);
  assert.equal(extractVehicleSpecs({ itemSpecifics: aspects({ Engine: '2.0' }) }).specs.displacement.value, null);
  assert.equal(extractVehicleSpecs({ itemSpecifics: aspects({ 'Engine size (L)': '2.0' }) }).specs.displacement.value, 2);
  assert.equal(extractVehicleSpecs({ description: '300 hp optional.' }).specs.horsepower.value, null);
  assert.equal(extractVehicleSpecs({ description: 'Automatic with manual mode.' }).specs.transmission.value, 'Automatic');
  assert.equal(extractVehicleSpecs({ description: 'I wish it had heated seats.' }).features['Heated seats'].value, null);
  assert.equal(extractVehicleSpecs({ description: 'Not leather seats.' }).features['Leather seats'].value, false);
  assert.equal(extractVehicleSpecs({ description: 'Navigation: N/A' }).features.Navigation.value, null);
});

test('VIN validation and decoding handle missing, older, malformed, partial and erroneous records', async () => {
  assert.equal(validateVin(vin.toLowerCase()).status, 'valid');
  assert.equal(validateVin(null).status, 'missing');
  assert.equal(validateVin('OLD123').status, 'unsupported');
  assert.equal(validateVin('1HGCM82643A004352').status, 'invalid');
  assert.equal(validateVin(vin.replace('H', 'I')).status, 'invalid');
  const result = decoded();
  assert.equal(result.status, 'decoded');
  assert.equal(result.fields.horsepower, 240);
  assert.equal(result.fields.seats, null);
  assert.match(result.reason, /Not accident, ownership/);
  for (const payload of [{}, { Results: [] }, { Results: [{ ...vinRow, ErrorCode: '1,5' }] }, { Results: [{ ...vinRow, VIN: 'OTHER' }] }, { Results: [{ ...vinRow, Model: '' }] }]) assert.equal(parseVinResponse(payload, vin).status, 'unsupported');
  assert.equal(parseVinResponse({ Results: [{ ...vinRow, EngineHPTo: '300' }] }, vin).fields.horsepower, null);
  let calls = 0;
  assert.equal((await decodeVin('OLD123', { fetcher: () => { calls++; } })).status, 'unsupported');
  assert.equal(calls, 0);
  assert.equal((await decodeVin(vin, { fetcher: async () => { throw new Error('private response'); } })).status, 'unavailable');
  const viaFetch = await decodeVin(vin, { fetcher: async (url, options) => { assert.ok(url.startsWith('https://vpic.nhtsa.dot.gov/')); assert.equal(options.cache, 'no-store'); return Response.json({ Results: [vinRow] }); } });
  assert.equal(viaFetch.status, 'decoded');
});

test('VIN/listing mismatches are flagged and never overwrite original identity or enter scoring', () => {
  const car = listing({ vin });
  const mismatch = vinMismatches(car, decoded());
  assert.ok(mismatch.some(item => item.field === 'Year'));
  assert.ok(mismatch.some(item => item.field === 'Model'));
  const enriched = { ...car, enrichment: { vin: { ...decoded(), mismatches: mismatch } } };
  assert.equal(extractVehicleSpecs(enriched).specs.horsepower.value, null);
  assert.equal(enriched.model, 'Civic');
  assert.equal(matchFuelEconomy(enriched, [row]).status, 'unmatched');
  for (const mode of ['value', 'cost', 'performance', 'comfort', 'practical', 'balanced']) assert.equal(rankDecisionMode([enriched], mode).best.length, 0);
  const agreement = { year: '2003', make: 'Honda', model: 'Accord', itemSpecifics: aspects({ Engine: '3.0 L V6', Transmission: '5-speed Automatic', 'Body type': 'Coupe', 'Fuel type': 'Gasoline' }), enrichment: { vin: decoded() } };
  assert.equal(vinMismatches(agreement, decoded()).length, 0);
  assert.equal(extractVehicleSpecs(agreement).specs.displacement.status, 'corroborated');
  assert.equal(extractVehicleSpecs(agreement).specs.horsepower.status, 'vin-record');
});

test('fuel matches exact supported configurations only, with no arbitrary or fuzzy fallback', () => {
  const car = listing();
  assert.equal(matchFuelEconomy(car, [row]).combined, 7.7);
  assert.equal(annualFuelCost(matchFuelEconomy(car, [row]), { annualKm: 15000, pricePerLitre: 1.70 }), 1963.5);
  for (const mismatch of [{ year: 2019 }, { make: 'Toyota' }, { model: 'Civic Coupe' }, { displacement: 1.5 }, { cylinders: 6 }, { transmission: 'A6' }, { fuel: 'D' }, { model: 'Civic AWD' }]) assert.equal(matchFuelEconomy(car, [{ ...row, ...mismatch }]).status, 'unmatched');
  assert.equal(matchFuelEconomy(car, [row, { ...row, transmission: 'M5' }]).status, 'matched');
  assert.equal(matchFuelEconomy(car, [row, { ...row, combined: 8.1 }]).status, 'unmatched');
  assert.equal(matchFuelEconomy(listing({ itemSpecifics: aspects({ Engine: '2.0 L I4', Transmission: 'Manual', 'Fuel type': 'Gasoline' }) }), [row]).status, 'unmatched');
  assert.equal(matchFuelEconomy({}, [row]).status, 'unmatched');
  assert.equal(annualFuelCost({ status: 'unmatched' }, { annualKm: 15000, pricePerLitre: 1.7 }), null);
  assert.equal(annualFuelCost(matchFuelEconomy(car, [row]), { annualKm: 0, pricePerLitre: 1.7 }), null);
});

test('bundled NRCan data has official attribution, expected coverage and valid original rows', async () => {
  const manifest = JSON.parse(await readFile('public/data/fuel/manifest.json', 'utf8'));
  assert.equal(manifest.publisher, 'Natural Resources Canada');
  assert.equal(manifest.years.length, 32);
  assert.match(manifest.licence, /open-government-licence/);
  for (const source of manifest.sources) { assert.ok(source.url.startsWith('https://open.canada.ca/')); assert.match(source.sha256, /^[a-f0-9]{64}$/); }
  const data = JSON.parse(await readFile('public/data/fuel/2018.json', 'utf8'));
  assert.ok(data.rows.length > 500);
  const rows = await loadFuelYear(2018, { fetcher: async url => { assert.equal(url, '/data/fuel/2018.json'); return Response.json(data); } });
  assert.ok(rows.every(row => row.year === 2018 && row.combined > 0));
  const actualMatch = matchFuelEconomy(listing(), rows);
  assert.equal(actualMatch.status, 'matched');
  assert.equal(actualMatch.row.model, 'Civic Sedan');
  assert.equal(actualMatch.combined, 7.4);
  assert.equal((await loadFuelYear(1980)).length, 0);
  await assert.rejects(() => loadFuelYear(2018, { fetcher: async () => new Response('<html>', { headers: { 'Content-Type': 'text/html' } }) }));
});

test('enrichment gracefully handles missing VIN, API outages and static-data failures without altering imports', async () => {
  const car = listing();
  const before = structuredClone(car);
  const data = { columns: Object.keys(row), rows: [Object.values(row)] };
  let calls = [];
  const result = await enrichVehicle(car, { fetcher: async url => { calls.push(url); return Response.json(data); } });
  assert.equal(result.vin.status, 'missing');
  assert.equal(result.fuel.status, 'matched');
  assert.deepEqual(calls, ['/data/fuel/2018.json']);
  assert.deepEqual(car, before);
  const outage = await enrichVehicle({ ...car, vin }, { fetcher: async () => new Response('Unavailable', { status: 503 }) });
  assert.equal(outage.vin.status, 'unavailable');
  assert.equal(outage.fuel.status, 'unavailable');
});

test('VIN endpoint validates input and origin, avoids eBay auth, and never caches data', async () => {
  let called = 0;
  const handler = createHandler({ auth: () => { throw new Error('Must not authenticate with eBay'); }, vinDecoder: async value => { assert.equal(value, vin); called++; return decoded(); } });
  const request = (body, origin = 'https://dilemma.example') => new Request('https://dilemma.example/api/vehicle-data', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body) });
  assert.equal((await handler(request({ vin: 'bad' }))).status, 400);
  assert.equal((await handler(request({ vin }, 'https://other.example'))).status, 403);
  assert.equal(called, 0);
  const response = await handler(request({ vin }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).vin.status, 'decoded');
  assert.equal(called, 1);
});

test('image CSS preserves whole-image scaling, consistent frames and neutral letterboxing', async () => {
  const css = await readFile('src/styles.css', 'utf8');
  const dom = new JSDOM(`<style>${css}</style><div class="car-grid"><article class="car-card"><div class="vehicle-image"><img width="1600" height="900" /></div></article><article class="car-card"><div class="vehicle-image"><img width="900" height="1600" /></div></article></div>`);
  try {
    const frames = dom.window.document.querySelectorAll('.vehicle-image');
    assert.equal(dom.window.getComputedStyle(frames[0]).height, dom.window.getComputedStyle(frames[1]).height);
    assert.notEqual(dom.window.getComputedStyle(frames[0]).backgroundColor, 'rgba(0, 0, 0, 0)');
    for (const image of dom.window.document.querySelectorAll('img')) {
      const style = dom.window.getComputedStyle(image);
      assert.equal(style.objectFit, 'contain');
      assert.equal(style.objectPosition, 'center');
      assert.equal(style.width, '100%');
      assert.equal(style.height, '100%');
    }
    assert.equal(dom.window.getComputedStyle(dom.window.document.querySelector('.car-grid')).alignItems, 'stretch');
  } finally { dom.window.close(); }
});

test('performance ranks explicit power or torque, not engine size or drivetrain names', () => {
  const a = listing({ legacyItemId: 'A', description: '158 hp. 140 Nm.' });
  const b = listing({ legacyItemId: 'B', description: '180 hp. 200 Nm.', itemSpecifics: aspects({ Engine: '1.5 L I4', Drivetrain: 'FWD' }) });
  assert.equal(rankDecisionMode([a, b], 'performance').best[0].car.legacyItemId, 'B');
  const noPower = [listing(), listing({ legacyItemId: 'B', itemSpecifics: aspects({ Engine: '6.2 L V8', Drivetrain: 'AWD' }) })];
  assert.equal(rankDecisionMode(noPower, 'performance').best.length, 0);
  assert.equal(rankDecisionMode([listing({ description: '200 Nm' }), listing({ legacyItemId: 'B', description: '300 Nm' })], 'performance').best[0].car.legacyItemId, 'B');
});

test('comfort compares only shared documented feature categories while unknown equipment is never absent', () => {
  const a = listing({ legacyItemId: 'A', description: 'Heated seats. Backup camera.' });
  const b = listing({ legacyItemId: 'B', description: 'Leather seats. Navigation. Climate control.' });
  const result = rankDecisionMode([a, b], 'comfort');
  assert.equal(result.best.length, 0, 'disjoint feature lists cannot establish comfort superiority');
  assert.equal(result.ranked[0].values.features, null);
  assert.equal(result.ranked[1].values.features, null);
  assert.match(result.limitation, /less documentation/);
  assert.equal(extractVehicleSpecs(b).features['Heated seats'].value, null);
  assert.equal(rankDecisionMode([a, listing()], 'comfort').best.length, 0);
});

test('fuel, seating and body factors are comparable and transparent; missing evidence disables each for everyone', () => {
  const a = listing({ legacyItemId: 'A', enrichment: { fuel: { ...matchFuelEconomy(listing(), [row]) } } });
  const b = listing({ legacyItemId: 'B', enrichment: { fuel: { ...matchFuelEconomy(listing(), [{ ...row, combined: 6 }]) } } });
  const result = rankDecisionMode([a, b], 'cost');
  assert.equal(result.best[0].car.legacyItemId, 'B');
  assert.equal(result.best[0].score, 60); // equal price: 50 × .8; best fuel: 100 × .2
  assert.equal(rankDecisionMode([a, listing({ legacyItemId: 'B' })], 'cost').criteria.find(c => c.key === 'fuel').active, false);
  assert.equal(rankDecisionMode([a, { ...b, enrichment: { fuel: { ...b.enrichment.fuel, fuel: 'Z' } } }], 'cost').criteria.find(c => c.key === 'fuel').active, false);
  const suv = listing({ legacyItemId: 'SUV', itemSpecifics: aspects({ 'Body type': 'SUV', Seats: '7' }) });
  const practical = rankDecisionMode([listing(), suv], 'practical', 2026, { annualKm: 15000, pricePerLitre: 1.7, minSeats: 7, bodyType: 'SUV' });
  assert.equal(practical.best[0].car.legacyItemId, 'SUV');
  assert.equal(practical.best[0].values.seats, 1);
  assert.equal(practical.best[0].values.body, 1);
});

test('worked example gives 45 versus 55, explains trade-offs, and condition warnings override the higher score', () => {
  const a = listing({ legacyItemId: 'A', priceCAD: { value: '16000', currency: 'CAD' } });
  const b = listing({ legacyItemId: 'B', year: '2020', priceCAD: { value: '19000', currency: 'CAD' }, mileage: { raw: '70000', unit: 'km' } });
  const result = rankDecisionMode([a, b], 'value', 2026);
  assert.equal(result.best[0].car.legacyItemId, 'B');
  assert.equal(result.ranked[0].score, 55);
  assert.equal(result.ranked[1].score, 45);
  assert.equal(result.ranked[0].breakdown.find(f => f.key === 'price').points, 0);
  const concerns = rankDecisionMode([a, { ...b, description: '<p>Engine problems. Coolant leak.</p>' }], 'value', 2026);
  assert.equal(concerns.best[0].car.legacyItemId, 'A');
  assert.equal(concerns.ranked[1].warnings.length, 2);
  assert.equal(rankDecisionMode([listing({ description: 'Not running.' })], 'value').best.length, 0);
});
