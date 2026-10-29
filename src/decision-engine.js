// Pure functions: no network, storage, mutation, or React dependency.
import { resolveMileage, numeric as number } from './vehicle-data.js';
import { extractVehicleSpecs } from './vehicle-specs.js';
import { sellerText } from './mileage.js';
import { annualFuelCost } from './fuel-data.js';
export const DEFAULT_PRIORITIES = { price: 50, age: 30, mileage: 20 };
export const CRITERIA = [
  { key: 'price', label: 'Purchase price' },
  { key: 'age', label: 'Vehicle age' },
  { key: 'mileage', label: 'Mileage' },
];

export function mileageKm(mileage) {
  const result = resolveMileage({ mileage });
  return result.unit ? result.amount * (result.unit === 'mi' ? 1.609344 : 1) : null;
}

const WARNING_RULES = [
  ['Not running', /\b(?:not (?:currently )?running|isn['’]t running|non[- ]running|does(?:n['’]t| not) (?:run|start)|won['’]t (?:run|start)|will not (?:run|start)|cannot (?:run|start)|can['’]t (?:run|start))\b/i],
  ['Engine concern', /\b(?:engine (?:is |has )?(?:problems?|issues?|failure|damage|knock(?:ing)?|seized|blown)|(?:blown|seized|damaged) engine|(?:needs?|requires?) (?:a |an )?(?:new |replacement )?engine|head gasket (?:leak|failure|blown)|blown head gasket|overheating)\b/i],
  ['Coolant leak', /\b(?:coolant (?:is )?leak(?:s|ing)?|leak(?:s|ing)? coolant|losing coolant|antifreeze leak(?:s|ing)?)\b/i],
  ['Repairs disclosed', /\b(?:(?:needs?|requires?) (?:mechanical |major |some )?repairs?|repairs? (?:needed|required))\b/i],
];

export function detectWarnings(car) {
  const sources = [car.title, car.description, ...(car.itemSpecifics || []).map(a => `${a.name} ${a.value}`)];
  const clauses = sources.filter(v => typeof v === 'string').flatMap(v => sellerText(v).split(/[.!?;\n]|\bbut\b/i));
  const warnings = WARNING_RULES.flatMap(([label, pattern]) => {
    const evidence = clauses.find(clause => {
      const match = pattern.exec(clause);
      if (!match) return false;
      const before = clause.slice(0, match.index);
      const after = clause.slice(match.index + match[0].length);
      // Narrow, explicit negation/repair handling; never claim diagnosis from text.
      return !/\b(?:no|without|never had)\s+(?:known\s+|any\s+)?$/i.test(before)
        && !/^\s+(?:was |has been |is )?(?:fixed|repaired|resolved)\b/i.test(after);
    });
    return evidence ? [{ label, evidence: evidence.trim() }] : [];
  });
  for (const mismatch of car.enrichment?.vin?.mismatches || []) warnings.push({ label: 'VIN/listing mismatch', evidence: `${mismatch.field}: listing ${mismatch.listing}; VIN record ${mismatch.vin}` });
  return warnings;
}

export function rankCars(cars, priorities = DEFAULT_PRIORITIES, currentYear = new Date().getFullYear(), options = {}) {
  if (cars.length > 4) throw new RangeError('Compare at most four cars.');
  const entries = cars.map(car => {
    const year = options.yearForCar ? options.yearForCar(car) : extractVehicleSpecs(car).specs.year.value;
    const mileage = resolveMileage(car);
    return { car, identityMismatch: !!car.enrichment?.vin?.mismatches?.length, warnings: detectWarnings(car), values: {
      price: car.priceCAD?.currency === 'CAD' ? number(car.priceCAD.value) : null,
      age: year !== null && Number.isInteger(year) && year >= 1886 && year <= currentYear + 1 ? Math.max(0, currentYear - year) : null,
      mileage: mileage.unit ? mileage.amount * (mileage.unit === 'mi' ? 1.609344 : 1) : null,
      ...options.extraValues?.(car),
    } };
  });
  const criteria = (options.criteria || CRITERIA).map(criterion => {
    const weight = Number.isFinite(priorities[criterion.key]) ? Math.max(0, priorities[criterion.key]) : 0;
    const missing = entries.filter(e => e.values[criterion.key] === null).length;
    const values = entries.map(e => e.values[criterion.key]);
    return { ...criterion, weight, active: entries.length > 0 && !missing && weight > 0,
      reason: missing ? `${missing} car(s) have missing or incompatible data; excluded for everyone.` : weight === 0 ? 'Priority set to zero.' : 'Comparable for every car.',
      min: Math.min(...values), max: Math.max(...values) };
  });
  const totalWeight = criteria.filter(c => c.active).reduce((sum, c) => sum + c.weight, 0);
  const ranked = entries.map(entry => {
    const breakdown = criteria.filter(c => c.active).map(c => {
      const points = c.max === c.min ? 50 : 100 * (c.higherBetter ? entry.values[c.key] - c.min : c.max - entry.values[c.key]) / (c.max - c.min);
      return { ...c, value: entry.values[c.key], points, share: c.weight / totalWeight, contribution: points * c.weight / totalWeight };
    });
    return { ...entry, breakdown, score: totalWeight ? Math.round(breakdown.reduce((sum, c) => sum + c.contribution, 0) * 100) / 100 : null };
  }).sort((a, b) => Number(a.identityMismatch) - Number(b.identityMismatch) || (options.priceOnly ? 0 : Number(a.warnings.length > 0) - Number(b.warnings.length > 0)) || (b.score ?? 0) - (a.score ?? 0));
  ranked.forEach((entry, index) => {
    const previous = ranked[index - 1];
    entry.rank = previous && previous.identityMismatch === entry.identityMismatch && (options.priceOnly || Boolean(previous.warnings.length) === Boolean(entry.warnings.length)) && previous.score === entry.score ? previous.rank : index + 1;
  });
  const best = totalWeight ? ranked.filter(e => !e.identityMismatch && (options.priceOnly || !e.warnings.length) && e.rank === 1) : [];
  return { ranked, criteria, best, totalWeight };
}

export const DECISION_MODES = [
  { id: 'value', title: 'BEST VALUE', description: 'Price, age and mileage, with mechanical caution first.', weights: { price: 45, age: 25, mileage: 30 } },
  { id: 'cost', title: 'AFFORDABILITY', description: 'Asking price and supported fuel-cost scenarios. Always review disclosed concerns.', weights: { price: 80, fuel: 20 } },
  { id: 'practical', title: 'EVERYDAY PRACTICALITY', description: 'Age, mileage, seating needs, body preference, fuel and amenities.', weights: { age: 35, mileage: 45, features: 20, seats: 20, body: 20, fuel: 20 } },
  { id: 'performance', title: 'PERFORMANCE', description: 'Explicit horsepower and torque, with engine and drivetrain context.', weights: { power: 70, torque: 30 } },
  { id: 'comfort', title: 'COMFORT & FEATURES', description: 'More documented amenities. Unknown equipment stays unknown.', weights: { features: 100 } },
  { id: 'balanced', title: 'BALANCED CHOICE', description: 'Price, age and mileage, plus supported fuel, seating, amenities and power.', weights: { price: 1, age: 1, mileage: 1, fuel: 0.6, features: 0.6, seats: 0.3, power: 0.3 } },
];
export const DEFAULT_SCENARIO = { annualKm: 15000, pricePerLitre: 1.70, minSeats: 5, bodyType: '' };
export function rankDecisionMode(cars, modeId, year = new Date().getFullYear(), scenario = DEFAULT_SCENARIO) {
  const mode = DECISION_MODES.find(m => m.id === modeId) || DECISION_MODES[0];
  const vehicleSpecs = cars.map(extractVehicleSpecs);
  const features = vehicleSpecs.map(record => Object.fromEntries(Object.entries(record.features).map(([label, item]) => [label, item.value])));
  // Missing mentions stay unknown. Counts describe documentation, not installed equipment.
  const commonFeatures = features.length ? Object.keys(features[0]).filter(key => features.every(f => f[key] !== null)) : [];
  const sameFuel = cars.length > 0 && cars.every(car => car.enrichment?.fuel?.status === 'matched' && car.enrichment.fuel.fuel === cars[0].enrichment.fuel.fuel);
  const criteria = [...CRITERIA, { key: 'power', label: 'Supported power (hp)', higherBetter: true }, { key: 'torque', label: 'Supported torque (Nm)', higherBetter: true }, { key: 'features', label: 'Documented amenities', higherBetter: true }, { key: 'seats', label: `Meets ${scenario.minSeats}-seat need`, higherBetter: true }, { key: 'body', label: `Preferred body: ${scenario.bodyType || 'none'}`, higherBetter: true }, { key: 'fuel', label: 'Annual fuel cost (scenario)' }];
  const weights = { ...mode.weights, body: scenario.bodyType ? mode.weights.body || 0 : 0 };
  const result = rankCars(cars, weights, year, {
    priceOnly: mode.id === 'cost', criteria,
    yearForCar: car => vehicleSpecs[cars.indexOf(car)].specs.year.value,
    extraValues: car => {
      const index = cars.indexOf(car), specs = vehicleSpecs[index].specs, amenities = Object.values(features[index]);
      return { power: specs.horsepower.value, torque: specs.torque.value,
        features: amenities.some(value => value !== null) ? amenities.filter(value => value === true).length : null,
        seats: specs.seats.value == null || !Number.isFinite(scenario.minSeats) || scenario.minSeats < 1 ? null : Number(specs.seats.value >= scenario.minSeats),
        body: specs.bodyType.value == null || !scenario.bodyType ? null : Number(specs.bodyType.value === scenario.bodyType),
        fuel: sameFuel ? annualFuelCost(car.enrichment.fuel, scenario) : null };
    },
  });
  return { ...result, mode, commonFeatures, scenario,
    limitation: mode.id === 'performance' ? 'Ranks comparable explicit horsepower and torque, not acceleration or handling. Larger engines, AWD and automatic transmissions are not automatically better. Engine configuration and drivetrain are context; missing power cannot be invented.'
      : mode.id === 'comfort' ? 'Counts explicitly documented working amenities. A lower count can mean less documentation, not fewer installed features. Unknown and conflicting equipment is never called absent. This is a documentation comparison, not a ride-comfort rating.'
        : mode.id === 'practical' ? 'Seating and body scores reflect your stated needs. Age, comparable mileage, documented amenities and matched fuel data are weighted only when everyone has evidence.'
          : mode.id === 'cost' ? 'An affordability scenario, not total ownership cost. Mechanical cautions remain visible but do not change this price/fuel ordering. No repair or insurance costs are estimated.' : 'Preference fit within this shortlist, not a reliability, safety or market-value rating. Unsupported factors are excluded for everyone.',
  };
}
