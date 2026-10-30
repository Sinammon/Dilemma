import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MODEL_PROFILES } from './src/model-profiles.js';
import { supportedClaims, researchForCar, RESEARCH_CATEGORIES } from './src/model-research.js';
import { extractVehicleSpecs } from './src/vehicle-specs.js';
import { rankDecisionMode } from './src/decision-engine.js';
import { enrichVehicle } from './src/enrichment.js';
import { makeDemoCars } from './src/demo-cars.js';
import { matchFuelEconomy } from './src/fuel-data.js';

const [civic, corolla, mazda] = makeDemoCars();
const noSpecs = car => ({ ...car, itemSpecifics: [] });

test('every curated profile covers all requested topics with identifiable reviewed sources', () => {
  assert.equal(MODEL_PROFILES.length, 5);
  for (const profile of MODEL_PROFILES) {
    const claims = supportedClaims(profile);
    assert.equal(claims.length, profile.claims.length, profile.id);
    for (const category of Object.keys(RESEARCH_CATEGORIES)) assert.ok(claims.some(c => c.category === category), category);
    for (const claim of claims) for (const source of claim.sources) {
      assert.ok(source.title && source.publisher && source.locator && source.reviewed);
      assert.equal(new URL(source.url).protocol, 'https:');
    }
  }
});

test('claims with absent, dangling, insecure or unidentified sources are withheld', () => {
  const profile = MODEL_PROFILES.find(p => p.id === 'civic-2018');
  for (const change of [
    { sources: [] },
    { sources: profile.sources.map(s => ({ ...s, publisher: '' })) },
    { sources: profile.sources.map(s => ({ ...s, url: 'javascript:alert(1)' })) },
    { sources: profile.sources.map(s => ({ ...s, reviewed: '' })) },
    { claims: profile.claims.map(c => ({ ...c, sourceIds: [] })) },
    { claims: profile.claims.map(c => ({ ...c, sourceIds: ['invented'] })) },
    { claims: profile.claims.map(c => ({ ...c, sourceIds: 'civic-review' })) },
    { claims: profile.claims.map(c => ({ ...c, category: 'constructor' })) },
    { sources: [null], claims: [null] },
  ]) assert.equal(supportedClaims({ ...profile, ...change }).length, 0);
  assert.deepEqual(supportedClaims(null), []);
  assert.equal(researchForCar(civic, [{ ...profile, sources: [] }]).status, 'unavailable');
});

test('profiles require exact identity and appropriate body/variant scope', () => {
  for (const car of [civic, corolla, mazda]) assert.equal(researchForCar(car).status, 'matched');
  for (const car of [
    { ...civic, year: '2019' }, { ...civic, make: 'Toyota' }, { ...civic, model: 'Civic Type R' },
    { ...civic, year: ['2018', '2019'] }, { ...civic, title: '2018 Honda Civic Si' },
    { ...civic, enrichment: { vin: { mismatches: [{ field: 'Year' }] } } },
    noSpecs(corolla), { ...corolla, itemSpecifics: [{ name: 'Body type', value: 'Hatchback' }] },
    { ...corolla, itemSpecifics: [{ name: 'Body type', value: ['Sedan', 'Hatchback'] }] },
  ]) assert.equal(researchForCar(car).status, 'unavailable', JSON.stringify(car));
  assert.equal(researchForCar({ ...noSpecs(corolla), model: 'Corolla Sedan' }).status, 'matched');
  assert.equal(researchForCar({ ...noSpecs(corolla), model: 'Corolla Sedan', itemSpecifics: [{ name: 'Body type', value: 'Hatchback' }] }).status, 'unavailable');
  assert.equal(researchForCar({ ...noSpecs(civic), enrichment: { vin: { status: 'decoded', fields: { year: '2018', make: 'Honda', model: 'Civic', bodyType: 'Sedan' } } } }).status, 'matched');
});

test('sparse listings still receive useful mode-specific research without invented scores or equipment', () => {
  const sparse = [noSpecs(civic), noSpecs(mazda)];
  const before = structuredClone(sparse);
  for (const mode of ['comfort', 'performance']) {
    const result = rankDecisionMode(sparse, mode, 2026);
    assert.equal(result.basis, 'model-research-only');
    assert.equal(result.totalWeight, 0);
    assert.equal(result.best.length, 0);
    assert.ok(result.ranked.every(e => e.score === null));
    assert.equal(result.research.length, 2);
    assert.ok(result.research.every(e => e.guidance.claims.length));
    assert.ok(result.research.flatMap(e => e.guidance.claims).every(c => c.category === mode));
  }
  const specs = extractVehicleSpecs(sparse[0]);
  for (const key of ['horsepower', 'displacement', 'seats']) assert.equal(specs.specs[key].value, null);
  assert.ok(Object.values(specs.features).every(f => f.value === null));
  assert.deepEqual(sparse, before);
});

test('research never affects numeric ranking, creates diagnoses, or rewards missing coverage', () => {
  const value = rankDecisionMode([civic, corolla, mazda], 'value', 2026);
  const uncovered = rankDecisionMode([civic, corolla, mazda].map(c => ({ ...c, make: 'Uncovered' })), 'value', 2026);
  assert.deepEqual(value.ranked.map(e => e.score), uncovered.ranked.map(e => e.score));
  assert.ok(value.ranked.every(e => !e.warnings.length));
  const mixed = rankDecisionMode([noSpecs(civic), { ...noSpecs(mazda), year: '2016' }], 'performance', 2026);
  assert.equal(mixed.best.length, 0);
  assert.equal(mixed.research[1].guidance.claims.length, 0);
  const caution = rankDecisionMode([{ ...noSpecs(civic), description: 'Engine problems.' }], 'performance', 2026);
  assert.equal(caution.research[0].worthTestDriving, false);
  assert.equal(caution.research[0].caution, true);
  const untrusted = { ...noSpecs(mazda), enrichment: { research: { horsepower: 400, features: ['Leather seats'] } } };
  assert.equal(extractVehicleSpecs(untrusted).specs.horsepower.value, null);
});

test('offline demo uses bundled Canadian data only and preserves ambiguous configurations', async () => {
  const calls = [];
  const fetcher = async url => {
    calls.push(url);
    assert.match(url, /^\/data\/fuel\/\d{4}\.json$/);
    return Response.json(JSON.parse(await readFile(`public${url}`, 'utf8')));
  };
  const before = structuredClone(makeDemoCars());
  const cars = makeDemoCars();
  const results = await Promise.all(cars.map(car => enrichVehicle(car, { fetcher })));
  assert.deepEqual(cars, before);
  assert.equal(calls.length, 3);
  assert.ok(results.every(r => r.vin.status === 'missing'));
  assert.equal(results[0].fuel.status, 'matched');
  assert.equal(results[0].fuel.combined, 7.4);
  assert.equal(results[1].fuel.status, 'unmatched');
  assert.match(results[1].fuel.reason, /Multiple/);
  assert.equal(results[2].fuel.status, 'matched');
  assert.equal(results[2].fuel.combined, 7.5);
  const rows = [results[2].fuel.row];
  assert.equal(matchFuelEconomy({ ...mazda, itemSpecifics: mazda.itemSpecifics.filter(a => a.name !== 'Body type') }, rows).status, 'unmatched');
  assert.equal(matchFuelEconomy({ ...mazda, itemSpecifics: mazda.itemSpecifics.map(a => a.name === 'Body type' ? { ...a, value: 'Sedan' } : a) }, rows).status, 'unmatched');
});
