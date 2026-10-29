import test from 'node:test';
import assert from 'node:assert/strict';
import { rankCars, mileageKm, detectWarnings, rankDecisionMode, DECISION_MODES } from './src/decision-engine.js';

// All fixtures are fictional; no eBay listing data is saved.
const car = (id, price, year, raw = '100000', unit = 'km', extra = {}) => ({ legacyItemId: id, title: `Fictional car ${id}`, priceCAD: { value: String(price), currency: 'CAD' }, year: String(year), mileage: { raw, unit }, ...extra });
const pair = [car('A', 10000, 2016), car('B', 20000, 2021)];
test('weighted scores match a hand calculation and do not mutate inputs', () => {
  const original = structuredClone(pair);
  const result = rankCars(pair, { price: 60, age: 30, mileage: 10 }, 2026);
  assert.equal(result.best[0].car.legacyItemId, 'A');
  assert.equal(result.best[0].score, 65); // 100*.6 + 0*.3 + 50*.1
  assert.equal(result.ranked[1].score, 35);
  assert.deepEqual(pair, original);
});
test('changing preferences changes the winner immediately', () => {
  assert.equal(rankCars(pair, { price: 100 }).best[0].car.legacyItemId, 'A');
  assert.equal(rankCars(pair, { age: 100 }).best[0].car.legacyItemId, 'B');
});
test('normalization uses intermediate values and supports four cars', () => {
  const result = rankCars([10, 20, 30, 40].map((p, i) => car(String(i), p, 2020)), { price: 100 });
  assert.deepEqual(result.ranked.map(c => c.score), [100, 66.67, 33.33, 0]);
  assert.throws(() => rankCars(Array(5).fill(pair[0])), RangeError);
});
test('missing information excludes a criterion for everyone and renormalizes', () => {
  const result = rankCars([pair[0], { ...pair[1], priceCAD: null }], { price: 90, age: 10 }, 2026);
  assert.equal(result.best[0].car.legacyItemId, 'B');
  assert.equal(result.best[0].score, 100);
  assert.equal(result.criteria[0].active, false);
  assert.equal(result.best[0].breakdown[0].share, 1);
});
test('unknown, conflicting and invalid units are never assumed', () => {
  for (const mileage of [null, { raw: '1000', unit: null }, { raw: ['1000', '2000'], unit: 'km' }, { raw: '1000 mi', unit: 'km' }, { raw: '1000', unit: ['km', 'mi'] }, { raw: '100-200', unit: 'km' }, { raw: '-5', unit: 'km' }]) assert.equal(mileageKm(mileage), null);
  assert.equal(mileageKm({ raw: '1,000 miles', unit: null }), 1609.344);
  assert.equal(mileageKm({ raw: 0, unit: 'km' }), 0);
  assert.equal(rankCars([pair[0], car('C', 10000, 2020, '1000', null)]).criteria[2].active, false);
});
test('non-CAD prices, conflicting years and invalid numeric data are excluded', () => {
  const result = rankCars([pair[0], { ...pair[1], priceCAD: { value: '100', currency: 'USD' }, year: ['2020', '2021'] }]);
  assert.equal(result.criteria[0].active, false);
  assert.equal(result.criteria[1].active, false);
  for (const value of ['', '-1', '1e4', 'approx 5000', Infinity]) assert.equal(rankCars([{ ...pair[0], priceCAD: { value, currency: 'CAD' } }]).criteria[0].active, false);
});
test('ties share ranks, including after input order changes', () => {
  for (const input of [pair, pair.toReversed()]) {
    const result = rankCars(input, { price: 50, age: 50 }, 2026);
    assert.equal(result.best.length, 2);
    assert.deepEqual(result.ranked.map(c => c.rank), [1, 1]);
  }
  assert.equal(rankCars([pair[0]]).best[0].score, 50);
});
test('empty, zero priorities and all missing data produce no endorsement', () => {
  for (const result of [rankCars([]), rankCars(pair, {}), rankCars([{ title: 'Unknown' }])]) {
    assert.equal(result.best.length, 0);
    assert.equal(result.totalWeight, 0);
  }
});
test('serious mechanical warnings override even maximum price preference', () => {
  const cheap = car('C', 100, 2024, '500', 'km', { description: 'Engine problems. Coolant leak. Does not run.' });
  const result = rankCars([cheap, pair[1]], { price: 100 });
  assert.equal(result.ranked[0].car.legacyItemId, 'B');
  assert.equal(result.ranked[1].score, 100);
  assert.equal(result.ranked[1].warnings.length, 3);
  assert.equal(rankCars([cheap]).best.length, 0);
});
test('warning evidence, supported variants, negation and repair handling', () => {
  for (const text of ['Non-running', "Won’t start", 'Needs a new engine', 'Blown head gasket', 'Leaking coolant', 'Engine issues', 'Engine is blown', 'Coolant is leaking', 'Not currently running']) assert.ok(detectWarnings({ title: text }).length, text);
  for (const text of ['No engine problems. No coolant leaks.', 'Without any engine issues.', 'Coolant leak has been repaired.', 'New engine cover. Runs well.']) assert.equal(detectWarnings({ description: text }).length, 0, text);
  assert.equal(detectWarnings({ description: 'No engine problems but coolant leak.' }).length, 1);
  assert.equal(detectWarnings({ itemSpecifics: [{ name: 'Engine', value: 'Problems' }] })[0].evidence, 'Engine Problems');
});

test('six modes are deterministic and cost mode explicitly differs from mechanical-first modes', () => {
  assert.equal(DECISION_MODES.length, 6);
  const cheap = car('C', 100, 2024, '500', 'km', { description: 'Needs repairs. Not running.' });
  assert.equal(rankDecisionMode([cheap, pair[1]], 'cost').best[0].car.legacyItemId, 'C');
  for (const mode of ['value', 'balanced', 'practical']) {
    assert.equal(rankDecisionMode([cheap, pair[1]], mode).best[0].car.legacyItemId, 'B');
    assert.equal(rankDecisionMode([cheap], mode).best.length, 0);
  }
  for (const mode of DECISION_MODES) assert.deepEqual(rankDecisionMode(pair, mode.id), rankDecisionMode(pair, mode.id));
  assert.equal(detectWarnings({ description: 'Sold as is.' }).length, 0);
  assert.equal(detectWarnings({ description: 'Needs repairs.' })[0].label, 'Repairs disclosed');
});
test('balanced numerical example, preference changes, and ties remain explainable', () => {
  const value = rankDecisionMode(pair, 'value', 2026);
  assert.equal(value.best[0].score, 60); // 100*.45 + 0*.25 + 50*.30
  const balanced = rankDecisionMode(pair, 'balanced', 2026);
  assert.equal(balanced.best.length, 2);
  assert.equal(balanced.best[0].score, 50);
});
test('performance uses compatible power only, not engine size, and abstains on missing evidence', () => {
  const power = (base, value) => ({ ...base, itemSpecifics: [{ name: 'Power', value }] });
  assert.equal(rankDecisionMode(pair, 'performance').best.length, 0);
  assert.equal(rankDecisionMode([power(pair[0], '200 hp'), power(pair[1], '100 kW')], 'performance').best[0].car.legacyItemId, 'A');
  assert.equal(rankDecisionMode([power(pair[0], '200 hp'), pair[1]], 'performance').totalWeight, 0);
});
test('comfort scores only common explicitly known amenities and never model-based assumptions', () => {
  const cars = [{ ...pair[0], description: 'Heated seats. Leather seats.' }, { ...pair[1], description: 'No heated seats.' }];
  const result = rankDecisionMode(cars, 'comfort');
  assert.deepEqual(result.commonFeatures, ['Heated seats']);
  assert.equal(result.best[0].car.legacyItemId, 'A');
  assert.equal(result.best[0].score, 100);
  assert.equal(rankDecisionMode(pair, 'comfort').best.length, 0);
});
test('mileage evidence conflicts remove the factor for everyone in every mode', () => {
  const result = rankDecisionMode([pair[0], { ...pair[1], description: 'Odometer 100000 miles.' }], 'balanced');
  assert.equal(result.criteria.find(c => c.key === 'mileage').active, false);
  assert.equal(result.ranked.every(c => c.breakdown.every(b => b.key !== 'mileage')), true);
});
