// Manually reviewed model observations, 31 October 2026. Prices and mileages in
// tests are fictional. These anchors are our rubric, not the publisher's scores.
export const COMFORT_REFERENCE = [
  { id: 'maybach', year: 2025, make: 'Mercedes-Benz', model: 'S-Class', trim: 'Maybach S 680 4MATIC Sedan',
    url: 'https://www.caranddriver.com/mercedes-maybach/s580-s680-2025',
    ratings: { rideQuality: 5, cabinQuietness: 5 },
    quote: 'supremely supple ride quality and the nearly silent cabin',
    rationale: 'The review describes unusually strong isolation and refinement.' },
  { id: 'civic', year: 2018, make: 'Honda', model: 'Civic',
    url: 'https://www.caranddriver.com/honda/civic-2018', ratings: { rideQuality: 3 },
    quote: 'Its smooth ride, responsive steering, and athletic chassis dynamics',
    rationale: 'Smooth mainstream ride, without a cross-class luxury claim.' },
  { id: 'corolla', year: 2019, make: 'Toyota', model: 'Corolla', trim: 'SE',
    url: 'https://www.caranddriver.com/toyota/corolla-2019', ratings: { rideQuality: 2 },
    quote: 'Their larger 17-inch wheels and tires improve handling but have a harsher ride as a result.',
    rationale: 'The SE wheel configuration compromises ride isolation.' },
  { id: 'mazda3', year: 2017, make: 'Mazda', model: 'Mazda3',
    url: 'https://www.caranddriver.com/mazda/mazda-3-2017', ratings: { rideQuality: 3 },
    quote: 'ride comfort is decent', rationale: 'Adequate mainstream comfort with rough-road compromises.' },
];

export function comfortReferenceCars() {
  return COMFORT_REFERENCE.map(({ id, year, make, model, trim, url, ratings, quote, rationale }) => ({
    legacyItemId: id, year: String(year), make, model,
    itemSpecifics: [{ name: 'Body type', value: 'Sedan' }, ...(trim ? [{ name: 'Trim', value: trim }] : [])],
    enrichment: { modelSpecs: { status: 'partial', fields: {}, insights: [], dimensionRatings: Object.fromEntries(Object.entries(ratings).map(([dimension, rating]) => [dimension, {
      rating, rationale, scope: { year, make, model, bodyType: 'Sedan', ...(trim ? { trim } : {}) },
      evidence: [{ source: 'Car and Driver', url, quote, editorial: true }],
    }])) } },
  }));
}
