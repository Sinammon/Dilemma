import test from 'node:test';
import assert from 'node:assert/strict';
import { decisionSummary, entrySummary, keyFacts } from './src/decision-summary.js';
import { ratedCar } from './test-data/scoring-fixtures.mjs';
import { makeDemoCars } from './src/demo-cars.js';
import { researchForCar } from './src/model-research.js';
const cars = makeDemoCars();

test('sparse comfort and performance retain their category with guidance and no substitute score', () => {
  const before = structuredClone(cars);
  for (const mode of ['comfort', 'performance']) {
    const summary = decisionSummary(cars, mode, 2026);
    assert.equal(summary.kind, 'guidance');
    assert.equal(summary.requested.totalWeight, 0);
    assert.equal(summary.requested.best.length, 0);
    assert.equal(summary.ranking.best.length, 0);
    const notes = entrySummary(summary, summary.ranking.ranked[0]);
    assert.match(notes.explanation, /No price-based substitute/);
    assert.ok(notes.reasons.every(reason => !reason.source || reason.source.url.startsWith('https:')));
  }
  assert.deepEqual(cars, before);
});

test('condition and identity concerns never disappear through the fallback', () => {
  const bad = cars.map(car => ({ ...car, description: 'Engine problems. Not running.' }));
  const summary = decisionSummary(bad, 'comfort', 2026);
  assert.equal(summary.kind, 'guidance');
  assert.ok(summary.ranking.ranked.every(entry => entry.warnings.length));
  assert.equal(summary.ranking.best.length, 0);
  assert.match(entrySummary(summary, summary.ranking.ranked[0]).explanation, /No price-based substitute/);
  const mismatch = decisionSummary(cars.map(car => ({ ...car, enrichment: { vin: { mismatches: [{ field: 'Year' }] } } })), 'cost', 2026);
  assert.equal(mismatch.ranking.best.length, 0);
  assert.equal(mismatch.kind, 'guidance');
});

test('completely missing evidence stays unranked and equal matches stay equal', () => {
  const empty = decisionSummary([{ legacyItemId: 'A' }, { legacyItemId: 'B' }], 'comfort', 2026);
  assert.equal(empty.kind, 'guidance');
  assert.ok(empty.ranking.ranked.every(e => e.score === null));
  assert.equal(empty.ranking.best.length, 0);
  const equal = decisionSummary([ratedCar('first'), ratedCar('second')], 'value', 2026);
  assert.equal(equal.shared, true);
  assert.match(entrySummary(equal, equal.ranking.best[0]).explanation, /equal match/);
  assert.equal(decisionSummary([], 'value', 2026).kind, 'empty');
});

test('short facts include only actual supported claims and preserve provenance', () => {
  const facts = keyFacts(cars[0]);
  assert.deepEqual(facts.map(f => f.label), ['Engine', 'Mileage', 'Transmission']);
  assert.ok(!facts.some(f => f.label === 'Reported features'));
  assert.deepEqual(keyFacts({}), []);
  const documented = keyFacts({ ...cars[0], description: 'Heated seats. No backup camera.' });
  assert.equal(documented.find(f => f.label === 'Reported features').value, 'Heated seats');
  assert.match(documented.find(f => f.label === 'Reported features').source, /Seller-reported/);
  assert.deepEqual(keyFacts({ priceCAD: { currency: 'CAD', value: null } }), []);
});

test('the screenshot vehicles receive exact-year model context, never installed equipment', () => {
  for (const [year, make, model] of [[2002, 'Ford', 'Thunderbird'], [2005, 'Dodge', 'Sprinter']]) {
    const car = { year: String(year), make, model };
    const research = researchForCar(car);
    assert.equal(research.status, 'matched');
    assert.ok(research.claims.some(c => c.category === 'comfort'));
    assert.equal(researchForCar({ ...car, year: String(year + 1) }).status, 'unavailable');
    assert.deepEqual(keyFacts(car), []);
  }
});
