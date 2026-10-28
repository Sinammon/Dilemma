import test from 'node:test';
import assert from 'node:assert/strict';
import { parseItemUrl, extractVehicle, importListing } from './ebay-feasibility.mjs';

// Synthetic fixtures only. No live eBay responses are stored in this file.
test('parses item URLs and strips tracking without accepting lookalike hosts', () => {
  for (const url of [
    'https://www.ebay.ca/itm/123456789012?tracking=example',
    'https://ebay.ca/itm/example-title/123456789012/',
    'http://m.ebay.ca/itm/123456789012',
  ]) assert.equal(parseItemUrl(url).legacyItemId, '123456789012');
  assert.equal(parseItemUrl('https://ebay.ca/itm/123456789012?var=987654321012').variationId, '987654321012');
  for (const input of ['garbage', 'https://ebay.ca.evil.test/itm/123456789012',
    'https://evil.test/ebay.ca/itm/123456789012', 'https://www.ebay.com/itm/123456789012',
    'https://user@ebay.ca/itm/123456789012', 'https://ebay.ca/sch/cars',
    'https://ebay.ca/itm/123456789012?var=invalid']) assert.throws(() => parseItemUrl(input));
});

const source = parseItemUrl('https://ebay.ca/itm/123456789012');
test('preserves missing values, currencies and raw mileage without inference', () => {
  const item = extractVehicle({
    title: '2020 Example Sedan 100000 km',
    price: {value: '5000', currency: 'USD'},
    localizedAspects: [{name: 'Mileage', value: '100000'}],
  }, source);
  assert.equal(item.year, null); // No title parsing.
  assert.equal(item.make, null);
  assert.equal(item.model, null);
  assert.equal(item.vin, null);
  assert.equal(item.description, null);
  assert.equal(item.priceCAD, null); // Never label USD as CAD.
  assert.deepEqual(item.returnedPrice, {value: '5000', currency: 'USD'});
  assert.deepEqual(item.mileage, {raw: '100000', unit: null});
  assert.deepEqual(item.images, []);
  assert.deepEqual(extractVehicle({price: {value:'10', currency:'CAD'}}, source).priceCAD,
    {value:'10', currency:'CAD'});
  assert.deepEqual(extractVehicle({price: {value:'7', currency:'USD', convertedFromValue:'10', convertedFromCurrency:'CAD'}}, source).priceCAD,
    {value:'10', currency:'CAD'});
});

test('imports via legacy-ID endpoint and extracts available data', async t => {
  t.mock.method(console, 'log', () => {});
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    calls++;
    const url = new URL(input);
    assert.equal(url.origin, 'https://api.ebay.com');
    assert.equal(url.pathname, '/buy/browse/v1/item/get_item_by_legacy_id');
    assert.equal(url.searchParams.get('legacy_item_id'), '123456789012');
    assert.equal(url.searchParams.get('legacy_variation_id'), '987654321012');
    assert.equal(options.headers['X-EBAY-C-MARKETPLACE-ID'], 'EBAY_CA');
    return Response.json({
      itemId: 'v1|123456789012|987654321012', title: 'Synthetic vehicle',
      price: {value:'10.00', currency:'CAD'}, condition:'Used',
      itemLocation: {country:'CA'}, description:'<p>Synthetic description</p>',
      image:{imageUrl:'https://example.test/one.jpg'},
      additionalImages:[{imageUrl:'https://example.test/one.jpg'}, {imageUrl:'https://example.test/two.jpg'}],
      localizedAspects: [
        {name:'Year', value:'2020'}, {name:'Make', value:'Example'},
        {name:'Model', value:'Sedan'}, {name:'Mileage', value:'100 km'},
        {name:'VIN (Vehicle Identification Number)', value:'SYNTHETIC'},
      ],
    });
  });
  const vehicle = await importListing('https://ebay.ca/itm/123456789012?var=987654321012',
    {'X-EBAY-C-MARKETPLACE-ID':'EBAY_CA'});
  assert.equal(calls, 1);
  assert.equal(vehicle.year, '2020');
  assert.equal(vehicle.make, 'Example');
  assert.equal(vehicle.model, 'Sedan');
  assert.equal(vehicle.vin, 'SYNTHETIC');
  assert.deepEqual(vehicle.mileage, {raw:'100 km', unit:'km'});
  assert.equal(vehicle.images.length, 2);
  assert.equal(vehicle.description, '<p>Synthetic description</p>');
});

test('does not report successful import for an unavailable item', async t => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(globalThis, 'fetch', async () => Response.json(
    {errors:[{errorId:11001, message:'Synthetic unavailable item'}]}, {status:404}));
  await assert.rejects(importListing(source.canonicalUrl, {}), /HTTP 404/);
});
