import { extractVehicleSpecs } from './vehicle-specs.js';
import { CORE_SPEC_FIELDS, cosmeticTrim, modelKey } from '../shared/model-specs.js';

// Reviewed model data, never a saved listing. Approximate original market/year
// and the manufacturer's weight definition are intentionally retained.
export function bundledModelSpecs(car) {
  const { specs } = extractVehicleSpecs({ ...car, enrichment: { ...car.enrichment, modelSpecs: undefined } });
  const get = key => specs[key]?.value;
  const empty = { status: 'partial', fields: {}, insights: [], dimensionRatings: {} };
  if (modelKey(get('make')) !== 'bmw' || modelKey(get('model')) !== 'z3' || get('year') !== 1999 || get('bodyType') !== 'Coupe' || get('displacement') !== 2.8 || get('cylinders') !== 6 || get('transmission') !== 'Automatic') return empty;
  if (get('trim') && !cosmeticTrim(get('trim')) && !/^2\.?8(?:i)?$/i.test(get('trim'))) return empty;
  const scope = { year: 1999, make: 'BMW', model: 'Z3', bodyType: 'Coupe', displacement: 2.8, cylinders: 6, transmission: 'Automatic', drivetrain: 'RWD', fuelType: 'Gasoline' };
  const review = 'https://www.caranddriver.com/reviews/a68119699/1999-bmw-z3-coupe-archive-test/';
  const manual = 'https://manualzz.com/doc/o/1705tt/bmw-z3-roadster-owner-s-manual-data';
  const data = { horsepower: [193, review, 'Power (hp)', '193-horsepower'], torque: [206 * 1.355817948, review, 'Torque (lb-ft)', '206 lb-ft @ 3500 rpm'],
    curbWeightKg: [1375, manual, 'Z3 coupe 2.8 curb weight · automatic (kg)', '3,031 (1,375)'], displacement: [2.8, review, 'Displacement (L)', '2.8-liter six-cylinder engine'],
    cylinders: [6, review, 'Engine cylinders', 'six-cylinder engine'], engineType: ['Inline', manual, 'Engine configuration', '6-cylinder inline engine'],
    transmission: ['Automatic', review, 'Transmission option', 'four-speed automatic transmission'], transmissionSpeeds: [4, review, 'Automatic transmission speeds', 'four-speed automatic transmission'] };
  const fields = Object.fromEntries(CORE_SPEC_FIELDS.map(key => {
    const [value, url, label, quote] = data[key];
    return [key, { kind: 'value', value, quality: 'typical', origin: 'reviewed-reference', scope: key === 'curbWeightKg' ? { ...scope, year: 2000, market: 'US' } : { ...scope, market: 'US' },
      assumptions: ['North American 2.8 automatic coupe reference; original market is unconfirmed. M Sport is not an M Coupe engine.', ...(key === 'curbWeightKg' ? ['Adjacent model-year manual reference; BMW weight includes one person and a full tank. Actual unladen mass and options can differ.'] : [])],
      evidence: [{ type: 'model-reference', source: url === manual ? 'BMW owner manual · archived' : 'Car and Driver', url, label, quote, configuration: key === 'curbWeightKg' ? { ...scope, year: 2000, market: 'US' } : { ...scope, market: 'US' } }], retrievedAt: '2026-10-31T00:00:00Z' }];
  }));
  return { ...empty, fields, reason: 'Reviewed BMW Z3 2.8 automatic-coupe specifications are available. Original market and weight-reference assumptions are shown.' };
}
