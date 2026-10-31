import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveMileage, mileageDisplay } from './src/mileage.js';

test('all requested distance formats parse without conflict checks or mutation', () => {
  for (const [description, amount, unit] of [
    ['2000 km', 2000, 'km'], ['2000kms', 2000, 'km'], ['2k kms', 2000, 'km'], ['2kkms', 2000, 'km'],
    ['120,000km', 120000, 'km'], ['120 000 kilometres', 120000, 'km'], ['75k miles', 75000, 'mi'],
    ['2.5K KMS', 2500, 'km'], ['2000miles', 2000, 'mi'], ['100 km', 100, 'km'], ['0 miles', 0, 'mi'],
    ['Kilometres: odometer reads 2000 kilometers', 2000, 'km'], ['<p>2k&nbsp;<b>kms</b></p>', 2000, 'km'],
  ]) {
    const car = { description, title: '9999 miles', mileage: { raw: '90000', unit: 'mi' } }, before = structuredClone(car);
    const result = resolveMileage(car);
    assert.equal(result.status, 'known', description);
    assert.equal(result.amount, amount, description);
    assert.equal(result.unit, unit, description);
    assert.equal(result.source, 'Seller description');
    assert.equal(result.originalRaw, '90000');
    assert.ok(result.evidence[0].quote);
    assert.deepEqual(car, before);
  }
});

test('description then title then attached structured units, always first match', () => {
  assert.equal(resolveMileage({ description: '80k miles. 2000kms.', title: '4000km' }).amount, 80000);
  assert.equal(resolveMileage({ description: 'Oil changed 5000 km ago. Odometer 80000 km.' }).amount, 5000);
  assert.equal(resolveMileage({ description: 'Warranty 120000 km. 80k miles.' }).unit, 'km');
  assert.equal(resolveMileage({ description: 'Mileage: 5000', title: '2000km' }).amount, 2000);
  assert.equal(resolveMileage({ title: '75k miles', mileage: { raw: '90000km' } }).unit, 'mi');
  assert.equal(resolveMileage({ mileage: { raw: ['bad', '75k miles', '120000km'], unit: 'km' } }).amount, 75000);
  assert.equal(resolveMileage({ mileage: { raw: '100000' }, itemSpecifics: [{ name: 'Mileage', value: '2k kms' }] }).amount, 2000);
});

test('labelled and structured bare readings use explicit declarations or default kilometres', () => {
  for (const car of [{ mileage: { raw: '2000' } }, { description: 'Odometer: 2k.' }, { description: 'Mileage reads 2000' }, { itemSpecifics: [{ name: 'Mileage', value: ['bad', '2k', '3k'] }] }]) {
    const result = resolveMileage(car);
    assert.equal(result.amount, 2000);
    assert.equal(result.unit, 'km');
    assert.equal(result.assumedUnit, true);
    assert.match(mileageDisplay(car), /km assumed/);
  }
  assert.equal(resolveMileage({ description: 'Mileage units: miles. Odometer 2k' }).unit, 'mi');
  assert.equal(resolveMileage({ description: 'Mileage in miles or km.', mileage: { raw: '2000', unit: 'km' } }).unit, 'mi');
  assert.equal(resolveMileage({ itemSpecifics: [{ name: 'Odometer (mi)', value: '2k' }] }).unit, 'mi');
  assert.equal(resolveMileage({ description: 'Odometer: 2k', mileage: { raw: '3k miles' } }).amount, 3000);
});

test('missing and malformed readings stay unknown; hidden HTML is not evidence', () => {
  for (const description of ['No mileage supplied. Built in 2000.', '1,20,000 km', '-2000km', 'VIN2000km', '<!--2000km-->', '<script>2000km</script>', '<template>2000km</template>', '<img alt="2000km">']) {
    assert.equal(resolveMileage({ description }).status, 'unknown', description);
  }
  assert.equal(mileageDisplay({}), 'Unknown');
  assert.equal(resolveMileage({ description: '<script>2000 miles</script><p>2k kms</p>' }).unit, 'km');
});
