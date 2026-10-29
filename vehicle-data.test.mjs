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

test('matches seller mileage formats, including thousand shorthand and kms, without changing raw values', () => {
  for (const [description, raw, unit, amount] of [
    ['130,000 km', '130000', 'km', 130000],
    ['130000 kilometres', '130,000', 'km', 130000],
    ['130k km', '130000', 'km', 130000],
    ['130,000 kms', '130000', 'km', 130000],
    ['80,000 miles', '80000', 'mi', 80000],
    ['80k miles', '80,000', 'mi', 80000],
    ['80000 mi', '80000', 'mi', 80000],
    ['Mileage is in KM', '130000', 'km', 130000],
    ['Odometer reads 80,000 miles', '80000', 'mi', 80000],
    ['Odometer is in miles.', '80k', 'mi', 80000],
    ['Mileage units: kms.', '130K', 'km', 130000],
    ['Vehicle has only 130.5K KM.', '130500', 'km', 130500],
  ]) {
    const car = vehicle(description, null, raw);
    const before = structuredClone(car);
    const result = resolveMileage(car);
    assert.equal(result.unit, unit, description);
    assert.equal(result.amount, amount, description);
    assert.equal(result.raw, raw);
    assert.equal(result.sellerReported, true);
    assert.match(mileageDisplay(car), /Seller-reported unit/);
    assert.deepEqual(car, before);
  }
});

test('k means thousand while km remains a unit, including structured mileage', () => {
  for (const [raw, amount, unit] of [['130km', 130, 'km'], ['130k km', 130000, 'km'], ['80K miles', 80000, 'mi'], ['130,000 kms', 130000, 'km']]) {
    const result = resolveMileage(vehicle(null, null, raw));
    assert.equal(result.amount, amount, raw);
    assert.equal(result.unit, unit, raw);
    assert.equal(result.sellerReported, false);
    assert.equal(mileageDisplay(vehicle(null, null, raw)), raw);
  }
  assert.equal(resolveMileage(vehicle(null, 'km', '130k')).amount, 130000);
  assert.equal(resolveMileage(vehicle(null, null, '130k')).unit, null, 'k alone does not imply kilometres');
  const car = { itemSpecifics: [{ name: 'Odometer (kms)', value: '130k' }, { name: 'Mileage', value: '130000' }] };
  assert.equal(resolveMileage(car).unit, null);
  assert.equal(resolveMileage({ itemSpecifics: [{ name: 'Odometer (kms)', value: '130k' }] }).amount, 130000);
  assert.equal(resolveMileage(vehicle(null, null, '130000', { itemSpecifics: [{ name: 'Mileage', value: '130k kms' }] })).unit, 'km');
});

test('reads visible HTML and decodes numeric and named entities without executing or reading hidden code', () => {
  for (const description of [
    '<p>Odometer reads <b>130,000</b>&nbsp;<span>kms</span>.</p>',
    '<div>130k&#32;km</div>',
    '<p>Mileage is in &#75;&#77;.</p>',
    '<p>130,000&NonBreakingSpace;kilometres</p>',
    '<table><tr><td>Mileage</td><td>130000</td><td>km</td></tr></table>',
    '<p>Oil changed at 80000 miles.</p><p>Odometer reads 130k km.</p>',
    '<script>const text = "Mileage 130000 miles";</script><style>.mi { content: "130000 miles" }</style><p>130k km</p>',
  ]) {
    const result = resolveMileage(vehicle(description, null, '130000'));
    assert.equal(result.unit, 'km', description);
    assert.equal(result.sellerReported, true);
  }
  for (const description of [
    '<!-- Mileage 130000 miles -->', '<script>Mileage 130000 miles</script>', '<style>130000 km</style>',
    '<img src="https://example.test/130000km" alt="130000 km">', '<template>Mileage 130000 km</template>',
  ]) assert.equal(resolveMileage(vehicle(description, null, '130000')).unit, null, description);
});

test('shorthand conflicts and ambiguous unit statements never become a known unit', () => {
  for (const car of [
    vehicle('130k miles', 'km', '130000'),
    vehicle('Mileage is in KM. Odometer reads 130k miles.', null, '130000'),
    vehicle('130k km or miles', null, '130000'),
    vehicle('Mileage is in km or miles', null, '130000'),
    vehicle('Mileage is in km. Odometer is in miles.', null, '130000'),
    vehicle('Odometer reads 80k miles', 'km', '130000'),
    vehicle('<p>Odometer: 130k km.</p><p>Mileage: 130000 mi.</p>', null, '130000'),
    vehicle(null, null, '130000', { itemSpecifics: [{ name: 'Mileage (km)', value: '130k miles' }] }),
  ]) {
    const result = resolveMileage(car);
    assert.equal(result.unit, null);
    assert.equal(result.status, 'conflict');
    assert.match(mileageDisplay(car), /Unit unknown/);
    assert.equal(result.raw, car.mileage.raw);
  }
});

test('does not attach unrelated distances, wrong readings, negated claims or malformed numbers', () => {
  for (const description of [
    'Warranty 130k km.', 'Oil service every 130k km.', 'New tires at 130,000 kms.',
    '130k km warranty.', 'Driven 130k km since the rebuild.', 'Mileage: not 130k km.',
    'Mileage is not in KM.', 'Canada · 130k.', '80k miles.', '1,30,000 km.',
    'VIN130000km', '-130000 km', '130kkm',
  ]) assert.equal(resolveMileage(vehicle(description, null, '130000')).unit, null, description);
  assert.equal(resolveMileage(vehicle('Full service history, odometer reads 130k km.', null, '130000')).unit, 'km');
  assert.equal(resolveMileage(vehicle('Oil changed at 130k km. Odometer reads 130000 miles.', null, '130000')).unit, 'mi');
  assert.equal(resolveMileage({ description: 'Mileage is in KM. 130k km.' }).raw, null, 'a description does not invent a missing structured reading');
});
