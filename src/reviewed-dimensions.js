import { extractVehicleSpecs, normalized, researchVinMismatches } from './vehicle-specs.js';
import { CONFIG_FIELDS } from '../shared/model-specs.js';

// Manually reviewed, exact-year fallback. Same rubric as live research, never a
// brand bonus or an assertion of this used car's current condition.
const REFERENCES = [{
  year: 2025, make: 'Mercedes-Benz', model: 'S-Class', body: 'Sedan', trim: /\bmaybach\s+s\s*680\b/i,
  url: 'https://www.caranddriver.com/mercedes-maybach/s580-s680-2025',
  quote: 'supremely supple ride quality and the nearly silent cabin',
  ratings: { rideQuality: 5, cabinQuietness: 5 },
  rationale: 'The review describes unusually strong isolation and refinement, beyond good mainstream comfort. Seat and space ratings remain unknown in this reviewed fallback.',
}];

export function reviewedDimensionsForCar(car) {
  if (researchVinMismatches(car).length) return {};
  const { specs } = extractVehicleSpecs({ ...car, enrichment: { ...car.enrichment, modelSpecs: undefined } });
  if (CONFIG_FIELDS.some(key => specs[key].status === 'conflict')) return {};
  const profile = REFERENCES.find(p => specs.year.value === p.year && normalized(specs.make.value) === normalized(p.make) && normalized(specs.model.value) === normalized(p.model) && specs.bodyType.value === p.body && p.trim.test(specs.trim.value || ''));
  if (!profile) return {};
  const scope = { year: profile.year, make: profile.make, model: profile.model, trim: specs.trim.value, bodyType: profile.body };
  return Object.fromEntries(Object.entries(profile.ratings).map(([dimension, rating]) => [dimension, {
    rating, rationale: profile.rationale, scope, reviewed: '2026-10-31', origin: 'reviewed-reference',
    evidence: [{ source: 'Car and Driver · reviewed reference', url: profile.url, quote: profile.quote, editorial: true, configuration: scope }],
  }]));
}
