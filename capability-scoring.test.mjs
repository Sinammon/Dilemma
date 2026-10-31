import test from 'node:test';
import assert from 'node:assert/strict';
import { rankDecisionMode } from './src/decision-engine.js';
import { decisionSummary, entrySummary, PRIMARY_MODES } from './src/decision-summary.js';
import { extractVehicleSpecs } from './src/vehicle-specs.js';
import { supportedPowerToWeight } from './src/capability-scoring.js';
import { DISCRIMINATORS, RATING_DIMENSIONS, modelSpecsInput, validatedResearch } from './shared/model-specs.js';
import { parseModelResearch, parseModelFindings } from './backend/model-specs.mjs';
import { comfortReferenceCars } from './test-data/comfort-reference.mjs';
import { dimensionRatingsForCar } from './src/model-research.js';

import { ratedCar, addAcceleration } from './test-data/scoring-fixtures.mjs';

test('reviewed Maybach refinement outranks mainstream cars despite seating discrepancy, price and gadgets', () => {
  const cars = comfortReferenceCars();
  cars[0].enrichment.vin = { status: 'decoded', fields: { seats: 5 }, mismatches: [{ field: 'Seating capacity', listing: 4, vin: 5 }] };
  cars[0].itemSpecifics.push({ name: 'Seats', value: '4' });
  for (const car of cars.slice(1)) car.description = 'Heated seats. Leather seats. Navigation. Bluetooth. Sunroof. Backup camera. 700 hp.';
  const before = structuredClone(cars);
  const result = rankDecisionMode(cars, 'comfort');
  assert.equal(result.best[0].car.legacyItemId, 'maybach');
  assert.equal(result.best[0].score, 100);
  assert.equal(result.best[0].warnings.length, 1);
  assert.equal(result.provisional, true, 'only ride evidence is comparable across all four');
  assert.equal(result.evidenceCoverage, 0.35);
  assert.deepEqual(cars, before);
  const renamed = cars.map(car => ({ ...car, title: 'Anonymous contender' }));
  assert.equal(rankDecisionMode(renamed, 'comfort').best[0].car.legacyItemId, 'maybach');
});

test('comfort uses absolute cross-class anchors and front/rear occupants equally, never price or feature counts', () => {
  const a = ratedCar('A', 5, 'No heated seats. 100 hp.', 500000), b = ratedCar('B', 3, 'Heated seats. Leather seats. Navigation. 900 hp.', 100);
  a.enrichment.modelSpecs.dimensionRatings.frontSeatComfort.rating = 3;
  const result = rankDecisionMode([a, b], 'comfort');
  assert.equal(result.best[0].values.seatComfort, 4);
  assert.equal(result.best[0].score, 95); // 35 + 30 + 20 + 10
  assert.equal(result.evidenceCoverage, 1);
  assert.equal(result.provisional, false);
  assert.deepEqual(result.criteria.map(c => c.weight), [35, 30, 25, 10]);
});

test('reviewed refinement fallback survives provider failures and stays limited to the supported year/body/variant', () => {
  const car = comfortReferenceCars()[0];
  car.enrichment.modelSpecs = { status: 'quota', fields: {}, reason: 'Quota reached' };
  assert.equal(dimensionRatingsForCar(car).rideQuality.origin, 'reviewed-reference');
  assert.equal(dimensionRatingsForCar(car).rideQuality.rating, 5);
  assert.equal(dimensionRatingsForCar({ ...car, year: '2024' }).rideQuality, undefined);
  assert.equal(dimensionRatingsForCar({ ...car, itemSpecifics: [{ name: 'Body type', value: 'Sedan' }, { name: 'Trim', value: 'S 500' }] }).rideQuality, undefined);
  assert.equal(dimensionRatingsForCar({ ...car, itemSpecifics: [{ name: 'Body type', value: 'SUV' }, { name: 'Trim', value: 'Maybach S 680' }] }).rideQuality, undefined);
  const result = rankDecisionMode([car, ratedCar('mainstream', 3)], 'comfort');
  assert.equal(result.best[0].car.legacyItemId, 'maybach');
  assert.equal(result.provisional, true);
});

test('missing rear-seat evidence excludes the seating dimension for everyone, not a guessed average', () => {
  const cars = [ratedCar('A', 5), ratedCar('B', 3)];
  delete cars[0].enrichment.modelSpecs.dimensionRatings.rearSeatComfort;
  const result = rankDecisionMode(cars, 'comfort');
  assert.equal(result.criteria.find(c => c.key === 'seatComfort').active, false);
  assert.equal(result.evidenceCoverage, 0.75);
  assert.equal(result.provisional, true);
});

test('unsupported contenders stay unranked; empty overlap never substitutes another priority', () => {
  const a = ratedCar('A', 4), b = { legacyItemId: 'B', priceCAD: { currency: 'CAD', value: '1' } };
  const result = rankDecisionMode([a, b], 'comfort');
  assert.equal(result.ranked[1].score, null);
  assert.equal(result.provisional, true);
  const c = ratedCar('C'); c.enrichment.modelSpecs.dimensionRatings = { cabinQuietness: c.enrichment.modelSpecs.dimensionRatings.cabinQuietness };
  a.enrichment.modelSpecs.dimensionRatings = { rideQuality: a.enrichment.modelSpecs.dimensionRatings.rideQuality };
  assert.equal(rankDecisionMode([a, c], 'comfort').best.length, 0);
  const summary = decisionSummary([b], 'comfort');
  assert.equal(summary.ranking.mode.id, 'comfort');
  assert.equal(summary.kind, 'guidance');
  assert.match(entrySummary(summary, summary.ranking.ranked[0]).explanation, /No price-based substitute/);
});

test('power-to-weight can favor a lighter car over a more powerful heavy car', () => {
  const a = ratedCar('light', 3, '300 hp. 300 Nm. Curb weight: 1200 kg.');
  const b = ratedCar('heavy', 3, '400 hp. 400 Nm. Curb weight: 2400 kg.');
  const result = rankDecisionMode([a, b], 'performance');
  assert.equal(result.performanceStrategy, 'power-to-weight');
  assert.equal(result.best[0].car.legacyItemId, 'light');
  assert.equal(result.best[0].values.powerToWeight, 250);
  assert.equal(result.best[0].score, 70);
  assert.equal(result.provisional, true);
});

test('same-metric, same-method acceleration takes priority; distinct metrics and methods are not merged', () => {
  const a = addAcceleration(ratedCar('A', 3, '300 hp. 300 Nm. Curb weight: 1500 kg.'), 'zeroTo100KphSeconds', 5);
  const b = addAcceleration(ratedCar('B', 3, '400 hp. 400 Nm. Curb weight: 2000 kg.'), 'zeroTo100KphSeconds', 8);
  const result = rankDecisionMode([a, b], 'performance');
  assert.equal(result.best[0].car.legacyItemId, 'A');
  assert.deepEqual(result.criteria.map(c => c.weight), [50, 30, 20]);
  assert.equal(result.provisional, false);
  b.enrichment.modelSpecs.fields.zeroTo100KphSeconds.measurementMethod = 'instrumented-test';
  assert.equal(rankDecisionMode([a, b], 'performance').accelerationMetric, null);
  delete b.enrichment.modelSpecs.fields.zeroTo100KphSeconds;
  addAcceleration(b, 'zeroTo60MphSeconds', 4);
  assert.equal(rankDecisionMode([a, b], 'performance').accelerationMetric, null);
});

test('hp/torque fallback is provisional and scope-incompatible ratios are rejected', () => {
  const cars = [ratedCar('A', 3, '300 hp. 300 Nm.'), ratedCar('B', 3, '200 hp. 200 Nm.')];
  const result = rankDecisionMode(cars, 'performance');
  assert.equal(result.performanceStrategy, 'power-and-torque');
  assert.equal(result.evidenceCoverage, 0.5);
  const { specs } = extractVehicleSpecs(ratedCar('scope'));
  specs.horsepower.evidence[0].configuration = { year: 2018, make: 'Honda', model: 'Civic', trim: 'LX' };
  specs.curbWeightKg.evidence[0].configuration = { year: 2018, make: 'Honda', model: 'Civic', trim: 'Type R' };
  assert.equal(supportedPowerToWeight(specs), null);
});

test('weight and acceleration parsers retain definitions and units without inventing metric conversions', () => {
  const specs = extractVehicleSpecs({ description: 'Curb weight: 4000 lbs. 0-100 km/h in 6.2 seconds. 0-60 mph: 5.8 seconds.' }).specs;
  assert.equal(specs.curbWeightKg.value, 1814.36948);
  assert.equal(specs.zeroTo100KphSeconds.value, 6.2);
  assert.equal(specs.zeroTo60MphSeconds.value, 5.8);
  assert.equal(extractVehicleSpecs({ itemSpecifics: [{ name: 'Curb weight (kg)', value: '1500' }] }).specs.curbWeightKg.value, 1500);
  assert.equal(extractVehicleSpecs({ description: 'Gross weight: 4000 kg. GVWR: 5000 kg. Dry weight: 1400 kg.' }).specs.curbWeightKg.value, null);
});

test('numeric research requires manufacturer or independent corroboration, proper weight and acceleration method', () => {
  const scope = { year: 2025, make: 'Mercedes-Benz', model: 'S-Class' };
  const input = modelSpecsInput({ ...scope, fields: ['curbWeightKg', 'zeroTo60MphSeconds', 'zeroTo100KphSeconds'] });
  const source = { id: 's0', url: 'https://www.mbusa.com/specifications', publisher: 'Mercedes-Benz', group: 'manufacturer', manufacturer: true, retrieved: true };
  const finding = (field, value, label, quote, extra = {}) => ({ field, kind: 'value', value: String(value), scope, sharedAcross: DISCRIMINATORS, measurementMethod: 'manufacturer', evidence: [{ sourceId: 's0', label, quote }], ...extra });
  const fields = parseModelFindings({ findings: [finding('curbWeightKg', 1814.36948, 'Curb weight (pounds)', '4000'), finding('zeroTo60MphSeconds', 4.5, '0-60 mph (seconds)', '4.5')] }, [source], input);
  assert.equal(fields.curbWeightKg.value, 1814.36948);
  assert.equal(fields.zeroTo60MphSeconds.value, 4.5);
  assert.equal(fields.zeroTo100KphSeconds, undefined);
  assert.deepEqual(parseModelFindings({ findings: [finding('curbWeightKg', 4000, 'Gross vehicle weight (kg)', '4000')] }, [source], input), {});
  assert.deepEqual(parseModelFindings({ findings: [finding('zeroTo60MphSeconds', 4.5, '0-60 mph (seconds)', '4.5', { measurementMethod: 'instrumented-test' })] }, [source], input), {});
  assert.equal(parseModelFindings({ findings: [finding('curbWeightKg', 1814.36948, 'Curb weight (pounds)', '4000')] }, [{ ...source, manufacturer: false, group: 'hearst' }], input).curbWeightKg.quality, 'typical');
});

test('rating validation rejects marketing, wrong scope, unbounded ratings and class-relative premium claims', () => {
  const scope = { year: 2018, make: 'Honda', model: 'Civic' }, input = { ...scope, fields: [] };
  const source = { id: 's0', retrieved: true, url: 'https://www.caranddriver.com/honda/civic-2018', publisher: 'Car and Driver', manufacturer: false, group: 'hearst' };
  const raw = { dimension: 'rideQuality', rating: 3, scope, rationale: 'A good mainstream ride supported by the reviewed observation.', evidence: [{ sourceId: 's0', quote: 'Synthetic review text for validator test.' }] };
  const parse = (rating = raw, sources = [source]) => parseModelResearch({ dimensionRatings: [rating] }, sources, input).dimensionRatings;
  assert.equal(parse().rideQuality.rating, 3);
  assert.deepEqual(parse(raw, [{ ...source, manufacturer: true }]), {});
  assert.deepEqual(parse({ ...raw, rating: 6 }), {});
  assert.deepEqual(parse({ ...raw, scope: { ...scope, year: 2019 } }), {});
  assert.deepEqual(parse({ ...raw, scope: { ...scope, trim: 'Type R' } }), {});
  assert.deepEqual(parse({ ...raw, rating: 5, rationale: 'An excellent ride for its class.' }), {});
  assert.deepEqual(validatedResearch({ dimensionRatings: { rideQuality: { ...raw, evidence: [] } } }, input).dimensionRatings, {});
});

test('Best Value and Balanced select different winners and retain explicit weights and explanations', () => {
  const a = ratedCar('value', 3, '200 hp. 300 Nm. Curb weight: 1500 kg.', 10000);
  const b = ratedCar('balanced', 5, '200 hp. 300 Nm. Curb weight: 1500 kg.', 50000);
  assert.equal(rankDecisionMode([a, b], 'value').best[0].car.legacyItemId, 'value');
  assert.equal(rankDecisionMode([a, b], 'balanced').best[0].car.legacyItemId, 'balanced');
  assert.deepEqual(rankDecisionMode([a, b], 'value').criteria.map(c => c.weight), [50, 35, 10, 5]);
  assert.match(rankDecisionMode([a, b], 'value').limitation, /not a market valuation/);
  assert.equal(rankDecisionMode([a, b], 'balanced').criteria[0].weight, 75);
});

test('purchase warnings do not reorder capability; genuine identity conflicts remain unranked', () => {
  const a = ratedCar('capable', 5), b = ratedCar('other', 3);
  a.description += ' Engine problems. Not running.';
  const summary = decisionSummary([a, b], 'comfort');
  assert.equal(summary.ranking.best[0].car.legacyItemId, 'capable');
  assert.equal(summary.kind, 'review');
  assert.match(entrySummary(summary, summary.ranking.best[0]).explanation, /purchase concerns/);
  a.enrichment.vin = { mismatches: [{ field: 'Year', listing: 2018, vin: 2019 }] };
  assert.equal(rankDecisionMode([a, b], 'comfort').best[0].car, a, 'listing-based comfort stays available despite VIN mismatch');
  delete a.enrichment.vin;
  a.itemSpecifics.push({ name: 'Transmission', value: ['Automatic', 'Manual'] });
  assert.equal(rankDecisionMode([a, b], 'comfort').ranked.find(e => e.car === a).score, null, 'conflicting seller configuration is also excluded');
});

test('ties and equal-factor arithmetic are stable, legacy sentiment adds no points, Performance is primary', () => {
  const a = ratedCar('A'), b = ratedCar('B');
  b.enrichment.modelSpecs.assessments = { comfort: { assessment: 'favourable', value: 2, insightIds: [] } };
  const result = rankDecisionMode([a, b], 'comfort');
  assert.deepEqual(result.ranked.map(e => e.score), [60, 60]);
  assert.equal(result.best.length, 2);
  assert.equal(result.researchWeight, 0);
  assert.ok(!result.criteria.some(c => c.key === 'research'));
  assert.ok(PRIMARY_MODES.some(mode => mode.id === 'performance'));
});
