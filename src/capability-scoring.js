import { extractVehicleSpecs, specEvidenceLabel, researchVinMismatches } from './vehicle-specs.js';
import { resolveMileage, numeric } from './vehicle-data.js';
import { dimensionRatingsForCar, researchGuidance } from './model-research.js';
import { annualFuelCost } from './fuel-data.js';
import { CONFIG_FIELDS, sameConfigurationValue, approximateScopeMatches } from '../shared/model-specs.js';

export const COMFORT_WEIGHTS = { rideQuality: 35, cabinQuietness: 30, seatComfort: 25, passengerSpace: 10 };
export const DIMENSION_LABELS = { rideQuality: 'Ride quality', cabinQuietness: 'Cabin quietness', seatComfort: 'Seat comfort · front and rear', passengerSpace: 'Passenger space · front and rear', frontSeatComfort: 'Front-seat comfort', rearSeatComfort: 'Rear-seat comfort', frontPassengerSpace: 'Front passenger space', rearPassengerSpace: 'Rear passenger space', cargoSpace: 'Usable cargo space' };
const round = n => Math.round(n * 100) / 100;
const known = value => typeof value === 'number' && Number.isFinite(value);
const averagePair = (a, b) => known(a) && known(b) ? (a + b) / 2 : null;
const criterion = (key, label, weight, extra = {}) => ({ key, label, weight, ...extra });

// Same factors and normalization for every eligible contender. Unknowns are never
// zeroes; a car with no category evidence remains unranked, rather than winning
// on a different priority. Nested coverage retains missing original weight.
function scoreGroup(records, definitions, eligible) {
  const contenders = records.filter(eligible);
  const intendedWeight = definitions.reduce((sum, c) => sum + c.weight, 0);
  const criteria = definitions.map(c => {
    const values = contenders.map(r => r.values[c.key]);
    const active = !!values.length && values.every(known) && c.weight > 0;
    return { ...c, active, min: active ? Math.min(...values) : null, max: active ? Math.max(...values) : null,
      reason: active ? 'Same factor compared for every eligible contender.' : 'Missing or incompatible evidence; excluded from this comparison.' };
  });
  const active = criteria.filter(c => c.active);
  const totalWeight = active.reduce((sum, c) => sum + c.weight, 0);
  const coverage = intendedWeight ? active.reduce((sum, c) => sum + c.weight * Math.min(...contenders.map(r => r.coverage[c.key] ?? 1)), 0) / intendedWeight : 0;
  const entries = records.map(record => {
    const breakdown = eligible(record) && totalWeight ? active.map(c => {
      const value = record.values[c.key];
      const points = c.absolute ? value * (c.scale ?? 1) : c.min === c.max ? 50 : 100 * (c.higherBetter ? value - c.min : c.max - value) / (c.max - c.min);
      return { ...c, value, points, share: c.weight / totalWeight, contribution: points * c.weight / totalWeight,
        evidenceLabel: record.labels[c.key] || 'Supported comparable evidence', evidence: record.evidence[c.key] || [] };
    }) : [];
    return { ...record, breakdown, score: breakdown.length ? round(breakdown.reduce((sum, c) => sum + c.contribution, 0)) : null };
  });
  return { entries, criteria, totalWeight, coverage };
}

export function supportedPowerToWeight(specs) {
  if (!known(specs.horsepower.value) || !known(specs.curbWeightKg.value) || specs.curbWeightKg.value <= 0) return null;
  const scopes = [specs.horsepower, specs.curbWeightKg].flatMap(s => [s.scope, ...(s.evidence || []).map(e => e.configuration)].filter(Boolean));
  const approximate = [specs.horsepower, specs.curbWeightKg].some(s => ['typical', 'estimated'].includes(s.quality));
  if (scopes.some(a => scopes.some(b => CONFIG_FIELDS.some(key => a[key] != null && b[key] != null && !sameConfigurationValue(a[key], b[key])) && !(approximate && approximateScopeMatches(a, b, { adjacentYear: true }))))) return null;
  return specs.horsepower.value / (specs.curbWeightKg.value / 1000);
}

export function rankCapabilities(cars, mode, year, scenario, detectWarnings) {
  if (cars.length > 4) throw new RangeError('Compare at most four cars.');
  const records = cars.map(car => {
    const { specs } = extractVehicleSpecs(car);
    const ratings = dimensionRatingsForCar(car);
    const mileage = resolveMileage(car);
    const identityMismatch = researchVinMismatches(car).length > 0 || CONFIG_FIELDS.some(key => specs[key]?.status === 'conflict');
    const values = {
      price: car.priceCAD?.currency === 'CAD' && numeric(car.priceCAD.value) > 0 ? numeric(car.priceCAD.value) : null,
      age: specs.year.value == null ? null : Math.max(0, year - specs.year.value),
      mileage: mileage.amount == null || !mileage.unit ? null : mileage.amount * (mileage.unit === 'mi' ? 1.609344 : 1),
      power: specs.horsepower.value, torque: specs.torque.value, powerToWeight: supportedPowerToWeight(specs),
      seats: specs.seats.value == null || !Number.isFinite(scenario.minSeats) || scenario.minSeats < 1 ? null : Number(specs.seats.value >= scenario.minSeats),
      body: !scenario.bodyType || specs.bodyType.value == null ? null : Number(specs.bodyType.value === scenario.bodyType),
      fuel: annualFuelCost(car.enrichment?.fuel, scenario),
      ...Object.fromEntries(Object.entries(ratings).map(([key, rating]) => [key, rating.rating])),
    };
    values.seatComfort = averagePair(values.frontSeatComfort, values.rearSeatComfort);
    values.passengerSpace = averagePair(values.frontPassengerSpace, values.rearPassengerSpace);
    const labels = { price: 'Seller-reported asking price', age: specEvidenceLabel(specs.year), mileage: mileage.assumedUnit ? 'Seller reading · kilometres assumed' : 'Seller-reported mileage', fuel: 'NRCan configuration reference + your scenario', seats: specEvidenceLabel(specs.seats), body: specEvidenceLabel(specs.bodyType), power: specEvidenceLabel(specs.horsepower), torque: specEvidenceLabel(specs.torque), powerToWeight: `Derived hp/tonne · ${specEvidenceLabel(specs.horsepower)} + ${specEvidenceLabel(specs.curbWeightKg)}` };
    const evidence = { power: specs.horsepower.evidence, torque: specs.torque.evidence, powerToWeight: [...specs.horsepower.evidence, ...specs.curbWeightKg.evidence] };
    for (const key of ['rideQuality', 'cabinQuietness', 'cargoSpace', 'seatComfort', 'passengerSpace']) {
      labels[key] = 'Cited professional review · cross-class 0–5 rubric';
      evidence[key] = key === 'seatComfort' ? [...(ratings.frontSeatComfort?.evidence || []), ...(ratings.rearSeatComfort?.evidence || [])]
        : key === 'passengerSpace' ? [...(ratings.frontPassengerSpace?.evidence || []), ...(ratings.rearPassengerSpace?.evidence || [])] : ratings[key]?.evidence || [];
    }
    const warnings = detectWarnings(car);
    const reviewRequired = identityMismatch || warnings.some(w => w.label !== 'VIN/listing mismatch');
    return { car, specs, ratings, identityMismatch, reviewRequired, warnings, values, labels, evidence, coverage: {} };
  });
  const valid = r => !r.identityMismatch;
  const comfortDefinitions = Object.entries(COMFORT_WEIGHTS).map(([key, weight]) => criterion(key, DIMENSION_LABELS[key], weight, { absolute: true, scale: 20, higherBetter: true }));
  const comfort = scoreGroup(records, comfortDefinitions, r => valid(r) && comfortDefinitions.some(c => known(r.values[c.key])));

  const performanceContenders = records.filter(r => valid(r) && (['power', 'torque', 'powerToWeight'].some(key => known(r.values[key])) || ['zeroTo100KphSeconds', 'zeroTo60MphSeconds'].some(key => known(r.specs[key].value) && ['manufacturer', 'instrumented-test'].includes(r.specs[key].measurementMethod))));
  const accelerationMetric = ['zeroTo100KphSeconds', 'zeroTo60MphSeconds'].find(key => performanceContenders.length && performanceContenders.every(r => known(r.specs[key].value) && ['manufacturer', 'instrumented-test'].includes(r.specs[key].measurementMethod)) && new Set(performanceContenders.map(r => r.specs[key].measurementMethod)).size === 1);
  for (const record of records) {
    record.values.acceleration = accelerationMetric ? record.specs[accelerationMetric].value : null;
    record.labels.acceleration = accelerationMetric ? `${specEvidenceLabel(record.specs[accelerationMetric])} · ${record.specs[accelerationMetric].measurementMethod}` : '';
    record.evidence.acceleration = accelerationMetric ? record.specs[accelerationMetric].evidence : [];
  }
  const ratioComparable = performanceContenders.length && performanceContenders.every(r => known(r.values.powerToWeight));
  const performanceWeights = accelerationMetric ? { acceleration: 50, powerToWeight: 30, torque: 20 } : ratioComparable ? { powerToWeight: 70, power: 20, torque: 10 } : { power: 70, torque: 30 };
  const performanceLabels = { acceleration: accelerationMetric === 'zeroTo100KphSeconds' ? '0–100 km/h (seconds)' : '0–60 mph (seconds)', powerToWeight: 'Power-to-weight (hp/tonne)', power: 'Supported power (hp)', torque: 'Supported torque (Nm)' };
  const performance = scoreGroup(records, Object.entries(performanceWeights).map(([key, weight]) => criterion(key, performanceLabels[key], weight, { higherBetter: key !== 'acceleration' })), r => performanceContenders.includes(r));
  // A proxy-based result cannot claim the coverage of a measured acceleration comparison.
  performance.coverage *= accelerationMetric ? 1 : ratioComparable ? 0.7 : 0.5;

  const practical = scoreGroup(records, [criterion('seats', `Meets ${scenario.minSeats}-seat need`, 40, { absolute: true, scale: 100 }), ...(scenario.bodyType ? [criterion('body', `Preferred body: ${scenario.bodyType}`, 20, { absolute: true, scale: 100 })] : []), criterion('passengerSpace', DIMENSION_LABELS.passengerSpace, 20, { absolute: true, scale: 20 }), criterion('cargoSpace', DIMENSION_LABELS.cargoSpace, 20, { absolute: true, scale: 20 })], r => valid(r) && ['seats', 'body', 'passengerSpace', 'cargoSpace'].some(key => known(r.values[key])));
  for (const [key, group] of Object.entries({ comfort, performance, practical })) for (const [index, entry] of group.entries.entries()) {
    records[index].values[key] = entry.score;
    records[index].coverage[key] = group.coverage;
    records[index].labels[key] = `${key === 'practical' ? 'Practicality' : key[0].toUpperCase() + key.slice(1)} · ${(group.coverage * 100).toFixed(0)}% evidence coverage`;
    records[index].evidence[key] = entry.breakdown.flatMap(f => f.evidence);
  }
  const capability = scoreGroup(records, [criterion('comfort', 'Comfort capability', 40, { absolute: true }), criterion('performance', 'Performance capability', 35, { absolute: true }), criterion('practical', 'Practicality capability', 25, { absolute: true })], r => valid(r) && ['comfort', 'performance', 'practical'].some(key => known(r.values[key])));
  const sameFuel = records.length && records.every(r => r.car.enrichment?.fuel?.status === 'matched' && r.car.enrichment.fuel.fuel === records[0].car.enrichment.fuel.fuel);
  if (!sameFuel) for (const r of records) r.values.fuel = null;
  const affordability = scoreGroup(records, [criterion('price', 'Purchase price', 80), criterion('fuel', 'Annual fuel cost (scenario)', 20)], r => valid(r) && known(r.values.price));
  for (const [index, record] of records.entries()) {
    record.values.capability = capability.entries[index].score;
    record.coverage.capability = capability.coverage;
    record.labels.capability = 'Comfort 40% · Performance 35% · Practicality 25%';
    record.evidence.capability = capability.entries[index].breakdown.flatMap(f => f.evidence);
    record.values.affordability = affordability.entries[index].score;
    record.coverage.affordability = affordability.coverage;
    record.labels.affordability = 'Asking price and comparable fuel scenario';
  }
  let result;
  if (mode.id === 'comfort') result = comfort;
  else if (mode.id === 'performance') result = performance;
  else if (mode.id === 'practical') result = practical;
  else if (mode.id === 'cost') result = affordability;
  else result = scoreGroup(records, Object.entries(mode.weights).map(([key, weight]) => criterion(key, ({ capability: 'Supported capability', affordability: 'Affordability', price: 'Purchase price', age: 'Vehicle age', mileage: 'Mileage' })[key], weight, { absolute: ['capability', 'affordability'].includes(key) })), r => valid(r) && known(r.values.capability) && (mode.id !== 'value' || known(r.values.price)));
  const ranked = result.entries.map(entry => ({ ...entry, evidenceCoverage: result.coverage })).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  ranked.forEach((entry, index) => { entry.rank = entry.score == null ? null : index && ranked[index - 1].score === entry.score ? ranked[index - 1].rank : index + 1; });
  const best = ranked.filter(entry => entry.score != null && entry.rank === 1);
  const research = cars.map(car => { const guidance = researchGuidance(car, mode.id), caution = detectWarnings(car).length > 0; return { car, guidance, caution, worthTestDriving: !caution && ['comfort', 'practical', 'performance'].includes(mode.id) && guidance.claims.some(c => c.tone === 'positive' && !c.contextOnly) }; });
  const approximate = spec => spec?.stale || ['typical', 'estimated'].includes(spec?.quality);
  const approximatePerformance = r => performance.criteria.some(c => c.active && (c.key === 'powerToWeight' ? approximate(r.specs.horsepower) || approximate(r.specs.curbWeightKg) : approximate(r.specs[({ power: 'horsepower', torque: 'torque', acceleration: accelerationMetric })[c.key]])));
  const approximatePractical = r => practical.criteria.some(c => c.active && approximate(r.specs[({ seats: 'seats', body: 'bodyType' })[c.key]]));
  const usesApproximation = records.some(r => mode.id === 'performance' ? approximatePerformance(r) : mode.id === 'practical' ? approximatePractical(r) : ['value', 'balanced'].includes(mode.id) && capability.criteria.some(c => c.active && (c.key === 'performance' ? approximatePerformance(r) : c.key === 'practical' && approximatePractical(r))));
  return { ranked, criteria: result.criteria, totalWeight: result.totalWeight, best, mode, scenario, research, commonFeatures: [], researchWeight: 0,
    evidenceCoverage: result.coverage, usesApproximation, provisional: usesApproximation || result.coverage < 0.8 || ranked.some(e => e.score == null) || cars.length < 2,
    accelerationMetric: accelerationMetric || null, performanceStrategy: accelerationMetric ? 'acceleration' : ratioComparable ? 'power-to-weight' : 'power-and-torque',
    componentScores: { comfort, performance, practical, capability, affordability },
    basis: result.totalWeight ? 'supported-specs' : research.some(e => e.guidance.claims.length) ? 'model-research-only' : 'insufficient',
    limitation: mode.id === 'comfort' ? 'Ride 35%, quietness 30%, seat comfort 25%, passenger space 10%. Front and rear occupants count equally within seating and space. Cited review assessments describe the model, not current condition.'
      : mode.id === 'performance' ? 'Acceleration and power capability, not track handling. Same acceleration metric and measurement method only. Power-to-weight uses compatible curb weight; original ratings do not measure this used car’s current output. Proxy-based results are provisional.'
        : mode.id === 'value' ? 'Capability 50%, asking price 35%, age 10%, mileage 5%. Capability combines Comfort 40%, Performance 35% and Practicality 25%. A preference score, not a market valuation.'
          : mode.id === 'balanced' ? 'Capability 75%, affordability 15%, age 5%, mileage 5%. Affordability uses price and comparable fuel scenarios. Capability combines Comfort 40%, Performance 35% and Practicality 25%.'
            : mode.id === 'practical' ? 'Supported seating-needs fit, preferred body style, passenger space and usable cargo capacity. Missing evidence is excluded, never treated as absent capability.'
              : 'Asking price 80%, comparable fuel scenario 20%. Not total ownership cost; no invented repair or insurance costs. Purchase warnings remain separate from category scores.' };
}
