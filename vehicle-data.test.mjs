import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveMileage, mileageDisplay, vehicleName, specification, unknown, listedFeatures, powerHp } from './src/vehicle-data.js';

const vehicle = (description, unit = null, raw = '100000', extra = {}) => ({ description, mileage: { raw, unit }, ...extra });
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
