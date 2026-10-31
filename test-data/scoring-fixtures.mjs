import { DISCRIMINATORS, RATING_DIMENSIONS } from '../shared/model-specs.js';
// Synthetic evidence below exercises arithmetic and validation, not real specs.
export function ratedCar(id, rating = 3, description = '200 hp. 300 Nm. Curb weight: 1500 kg.', price = 20000) {
  const scope = { year: 2018, make: 'Honda', model: 'Civic' };
  return { legacyItemId: id, ...scope, year: '2018', description, priceCAD: { currency: 'CAD', value: String(price) }, mileage: { raw: '100000', unit: 'km' }, itemSpecifics: [{ name: 'Seats', value: '5' }],
    enrichment: { modelSpecs: { status: 'partial', fields: {}, insights: [], dimensionRatings: Object.fromEntries(RATING_DIMENSIONS.map(key => [key, { rating, rationale: 'Synthetic assessment for arithmetic testing only.', scope, evidence: [{ source: 'Synthetic editorial fixture', url: 'https://reviews.example.test/fixture', quote: 'Synthetic evidence, not a real review.', editorial: true }] }])) } } };
}
export const addAcceleration = (car, field, value, method = 'manufacturer') => {
  const scope = { year: Number(car.year), make: car.make, model: car.model };
  car.enrichment.modelSpecs.fields[field] = { kind: 'value', value, scope, sharedAcross: DISCRIMINATORS, measurementMethod: method, evidence: [{ source: 'Synthetic factory fixture', url: 'https://manufacturer.example.test/fixture', quote: `${value} seconds`, configuration: scope }] };
  return car;
};
