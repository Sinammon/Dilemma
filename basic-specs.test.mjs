import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveMileage, mileageDisplay, missingDetails } from './src/vehicle-data.js';
import { extractVehicleSpecs } from './src/vehicle-specs.js';
import { FACTORY_SPECS, matchFactorySpecs } from './src/factory-specs.js';
import { enrichVehicle } from './src/enrichment.js';
import { rankDecisionMode } from './src/decision-engine.js';
import { makeDemoCars } from './src/demo-cars.js';

test('power and torque accept prose, structured unit labels, unicode units and original evidence', () => {
  for (const description of ['158 horsepower', 'Horsepower: 158', 'Power (hp): 158', '158-hp engine']) {
    const spec = extractVehicleSpecs({ description }).specs.horsepower;
    assert.equal(spec.value, 158, description);
    assert.ok(spec.evidence.some(e => e.quote));
  }
  for (const unit of ['lb-ft', 'lb.-ft.', 'lbs ft', 'ft-lbs', 'pound-feet', 'foot-pounds']) {
    assert.ok(Math.abs(extractVehicleSpecs({ description: `138 ${unit} of torque` }).specs.torque.value - 187.102876824) < 0.001, unit);
  }
  for (const unit of ['Nm', 'N m', 'N·m', 'N-m', 'newton-metres']) assert.equal(extractVehicleSpecs({ description: `200 ${unit}` }).specs.torque.value, 200, unit);
  for (const [name, value, field, expected] of [
    ['Power (kW)', '100', 'horsepower', 134.102209], ['Torque (lb-ft)', '138 @ 4200 rpm', 'torque', 187.102876824],
    ['Torque (Nm)', '200', 'torque', 200], ['Horsepower', '158 @ 6,500 rpm', 'horsepower', 158],
  ]) assert.ok(Math.abs(extractVehicleSpecs({ itemSpecifics: [{ name, value }] }).specs[field].value - expected) < 0.001);
  for (const description of ['Power: 200', 'Optional power (hp): 300', 'Torque: 200', '-200 hp', 'No horsepower: 300']) {
    const { specs } = extractVehicleSpecs({ description });
    assert.equal(specs.horsepower.value, null, description);
    assert.equal(specs.torque.value, null, description);
  }
});

const attach = car => ({ ...car, enrichment: { factorySpecs: matchFactorySpecs(car) } });
test('manufacturer references match demo configurations, supply both fields, and leave source listings untouched', () => {
  const cars = makeDemoCars(), before = structuredClone(cars);
  for (const [index, car] of cars.entries()) {
    const factory = matchFactorySpecs(car);
    assert.equal(factory.status, 'matched');
    assert.equal(factory.values.horsepower, [158, 132, 155][index]);
    assert.equal(factory.configuration.market, 'CA');
    assert.ok(factory.source.url.startsWith('https://'));
    const { specs } = extractVehicleSpecs(attach(car));
    assert.equal(specs.horsepower.status, 'factory-reference');
    assert.equal(specs.torque.status, 'factory-reference');
    assert.ok(!missingDetails(attach(car)).includes('Horsepower'));
    assert.ok(!missingDetails(attach(car)).includes('Torque'));
  }
  assert.deepEqual(cars, before);
  assert.ok(FACTORY_SPECS.every(r => r.source.reviewed && r.source.locator && r.source.publisher));
});

test('factory lookup requires market and all discriminators, rejects variants and never breaks ties arbitrarily', () => {
  const [civic, corolla] = makeDemoCars();
  assert.equal(matchFactorySpecs({ ...civic, market: undefined, location: { country: 'CA' } }).status, 'insufficient');
  assert.equal(matchFactorySpecs({ ...civic, year: '2019' }).status, 'unavailable');
  assert.equal(matchFactorySpecs({ ...civic, market: 'JP' }).status, 'unmatched');
  for (const name of ['Engine', 'Transmission', 'Body type', 'Fuel type', 'Drivetrain']) assert.notEqual(matchFactorySpecs({ ...civic, itemSpecifics: civic.itemSpecifics.filter(a => a.name !== name) }).status, 'matched', name);
  assert.equal(matchFactorySpecs({ ...corolla, itemSpecifics: corolla.itemSpecifics.filter(a => a.name !== 'Trim') }).status, 'insufficient');
  const eco = { ...corolla, itemSpecifics: corolla.itemSpecifics.map(a => a.name === 'Trim' ? { ...a, value: 'LE ECO' } : a) };
  assert.equal(matchFactorySpecs(eco).values.horsepower, 140);
  assert.equal(matchFactorySpecs({ ...civic, title: '2018 Civic Si' }).status, 'unmatched');
  assert.equal(matchFactorySpecs({ ...civic, description: 'Engine swap; tuned.' }).status, 'unavailable');
  assert.equal(matchFactorySpecs(civic, [...FACTORY_SPECS, FACTORY_SPECS[0]]).status, 'ambiguous');
});

test('factory coverage includes exact configurations for Thunderbird and Sprinter research vehicles', () => {
  for (const id of ['thunderbird-us-2002', 'sprinter-us-2005']) {
    const row = FACTORY_SPECS.find(r => r.id === id);
    const car = { year: row.year, make: row.make, model: row.models[0], market: row.market,
      itemSpecifics: Object.entries(row.requirements).map(([key, values]) => ({ name: ({ displacement: 'Engine size (L)', cylinders: 'Cylinders', fuelType: 'Fuel type', bodyType: 'Body type', transmission: 'Transmission', transmissionSpeeds: 'Transmission speeds', drivetrain: 'Drivetrain' })[key], value: String(values[0]) })) };
    assert.equal(matchFactorySpecs(car).status, 'matched', id);
    assert.equal(extractVehicleSpecs(attach(car)).specs.horsepower.value, row.values.horsepower);
  }
});

test('factory conflicts preserve all evidence and prevent unsupported power from entering scoring', () => {
  const [car] = makeDemoCars();
  const conflicting = attach({ ...car, description: '300 hp. 400 Nm.' });
  const { specs } = extractVehicleSpecs(conflicting);
  assert.equal(specs.horsepower.status, 'conflict');
  assert.equal(specs.torque.status, 'conflict');
  assert.equal(specs.horsepower.evidence.length, 2);
  assert.equal(rankDecisionMode([attach(car), conflicting], 'performance').ranked[1].score, null);
  const agreeing = extractVehicleSpecs(attach({ ...car, description: '158 hp' })).specs;
  assert.equal(agreeing.horsepower.status, 'corroborated');
  assert.equal(extractVehicleSpecs(attach({ ...car, description: '187 Nm' })).specs.torque.status, 'corroborated', 'whole-unit rounding should not invent a conflict');
  const badVin = { ...car, enrichment: { vin: { status: 'decoded', mismatches: [{ field: 'Year' }] } } };
  assert.equal(matchFactorySpecs(badVin).status, 'conflict');
  assert.equal(extractVehicleSpecs({ ...conflicting, enrichment: { ...badVin.enrichment, factorySpecs: matchFactorySpecs(car) } }).specs.horsepower.value, 300);
});

test('recovered mileage and factory output drive the same comparable decision values with source labels', () => {
  const cars = makeDemoCars().map(car => attach({ ...car, mileage: null, description: `Odometer reads ${car.mileage.raw} km.` }));
  const performance = rankDecisionMode(cars, 'performance');
  assert.equal(performance.totalWeight, 100);
  assert.ok(performance.ranked.every(entry => entry.breakdown.every(factor => /factory reference/.test(factor.evidenceLabel))));
  const value = rankDecisionMode(cars, 'value');
  assert.ok(value.criteria.find(c => c.key === 'mileage').active);
  assert.deepEqual(value.ranked.map(e => e.values.mileage).sort((a,b) => a-b), [80000,100000,115000]);
});

test('offline enrichment supplies local factory references; lookup failures leave seller evidence usable', async () => {
  const [car] = makeDemoCars();
  const fetcher = async url => Response.json(JSON.parse(await readFile(`public${url}`, 'utf8')));
  const result = await enrichVehicle(car, { fetcher });
  assert.equal(result.factorySpecs.status, 'matched');
  assert.equal(result.fuel.status, 'matched');
  const failure = await enrichVehicle({ ...car, description: '158 hp' }, { fetcher: async () => { throw new Error('offline'); }, factoryMatcher: () => { throw new Error('unavailable'); } });
  assert.equal(failure.factorySpecs.status, 'unavailable');
  assert.equal(failure.fuel.status, 'unavailable');
  assert.equal(extractVehicleSpecs({ ...car, description: '158 hp', enrichment: failure }).specs.horsepower.value, 158);
});
