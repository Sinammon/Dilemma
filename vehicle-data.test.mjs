import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveMileage, mileageDisplay, vehicleName, specification, unknown, listedFeatures, powerHp } from './src/vehicle-data.js';

const vehicle = (description, unit = null, raw = '100000', extra = {}) => ({ description, mileage: { raw, unit }, ...extra });
test('recognizes explicit kilometre and mile variants tied to the actual odometer number', () => {
  for (const unit of ['km', 'kilometres', 'kilometers', 'kilometre', 'kilometer']) {
    assert.equal(resolveMileage(vehicle(`Odometer reads 100,000 ${unit}.`)).unit, 'km');
  }
  for (const unit of ['miles', 'mi', 'mile']) assert.equal(resolveMileage(vehicle(`Mileage: 100000 ${unit}.`)).unit, 'mi');
  assert.equal(resolveMileage(vehicle(null, 'miles')).unit, 'mi');
  assert.equal(resolveMileage(vehicle(null, null, '100,000 km')).unit, 'km');
  assert.equal(resolveMileage(vehicle(null, null, '100000', { title: 'Example sedan 100000 miles' })).unit, 'mi');
});
test('uses structured units, including units in mileage field names, and preserves original numbers', () => {
  const car = { itemSpecifics: [{ name: 'Mileage (km)', value: '100,000' }] };
  const before = structuredClone(car);
  const result = resolveMileage(car);
  assert.equal(result.raw, '100,000');
  assert.equal(result.unit, 'km');
  assert.deepEqual(car, before);
  assert.equal(mileageDisplay(car), '100,000 km');
  assert.equal(resolveMileage(vehicle(null, null, '100000', { itemSpecifics: [{ name: 'Mileage Unit', value: 'mi' }] })).unit, 'mi');
});
test('unknown units stay unknown, even in Canada; unrelated distances do not become mileage', () => {
  for (const description of [null, 'Located in Canada.', 'Warranty 100000 km.', 'Oil service every 100000 km.', 'Mileage 99000 miles.', '100000 km warranty.']) {
    assert.equal(resolveMileage(vehicle(description)).unit, null, description);
  }
  assert.match(mileageDisplay(vehicle(null)), /100000 · Unit unknown/);
  assert.equal(mileageDisplay({}), 'Unknown · Unit unknown');
  assert.equal(resolveMileage({ description: 'Mileage 100000 km' }).raw, null);
});
test('conflicting units, odometer statements, alternative units and arrays are excluded', () => {
  for (const car of [vehicle('Mileage 100000 mi', 'km'), vehicle('Mileage 100000 km. Odometer 100000 mi.'), vehicle('Mileage 100000 km or miles.'), vehicle('Odometer 90000 km', 'km'), vehicle(null, ['km', 'mi']), vehicle(null, null, ['100000', '200000'])]) {
    const result = resolveMileage(car);
    assert.equal(result.unit, null);
    assert.equal(result.status, 'conflict');
    assert.match(mileageDisplay(car), /Unit unknown/);
  }
  assert.equal(resolveMileage(vehicle(null, 'km', '100000', { itemSpecifics: [{ name: 'Mileage', value: '200000' }] })).status, 'conflict');
});
test('structured names never fall back to seller headlines; missing specifications are Unknown', () => {
  assert.equal(vehicleName({ year: '2013', make: 'Chevrolet', model: 'Impala', title: 'BEST DEAL' }), '2013 Chevrolet Impala');
  assert.equal(vehicleName({ title: '2013 Chevrolet Impala' }), 'Unknown Unknown Unknown');
  assert.equal(unknown(specification({}, 'transmission')), 'Unknown');
  assert.deepEqual(specification({ itemSpecifics: [{ name: 'Transmission', value: 'Manual' }, { name: 'Transmission', value: 'Automatic' }] }, 'transmission'), ['Manual', 'Automatic']);
});
test('amenities require explicit claims and unknown does not mean absent', () => {
  assert.equal(listedFeatures({ model: 'Luxury', description: '' })['Leather seats'], null);
  assert.equal(listedFeatures({ description: 'Heated seats. No navigation. Leather seats optional.' })['Heated seats'], true);
  assert.equal(listedFeatures({ description: 'Heated seats. No navigation.' }).Navigation, false);
  assert.equal(listedFeatures({ description: 'Leather seats optional.' })['Leather seats'], null);
  assert.equal(listedFeatures({ description: 'Navigation. No navigation.' }).Navigation, null);
  assert.equal(listedFeatures({ itemSpecifics: [{ name: 'Heated seats', value: 'No' }] })['Heated seats'], false);
  assert.equal(listedFeatures({ description: 'Does not have navigation.' }).Navigation, false);
  assert.equal(listedFeatures({ description: 'No heated seats or navigation.' }).Navigation, false);
});
test('power requires an explicit supported unit and does not infer from engine size', () => {
  assert.equal(powerHp({ itemSpecifics: [{ name: 'Engine', value: '5.7 L V8' }] }), null);
  assert.equal(powerHp({ itemSpecifics: [{ name: 'Power', value: '200' }] }), null);
  assert.equal(powerHp({ itemSpecifics: [{ name: 'Power', value: '200 hp' }] }), 200);
  assert.ok(Math.abs(powerHp({ itemSpecifics: [{ name: 'Power', value: '100 kW' }] }) - 134.102209) < 0.000001);
});
