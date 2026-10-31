// Pure functions: no network, storage, mutation, or React dependency.
import { resolveMileage, numeric as number } from './vehicle-data.js';
import { extractVehicleSpecs } from './vehicle-specs.js';
import { sellerText } from './mileage.js';
import { rankCapabilities } from './capability-scoring.js';
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
  { id: 'value', title: 'BEST VALUE', description: 'Supported capability for the asking price.', weights: { capability: 50, price: 35, age: 10, mileage: 5 } },
  { id: 'cost', title: 'AFFORDABILITY', description: 'Asking price and supported fuel-cost scenarios.', weights: { price: 80, fuel: 20 } },
  { id: 'practical', title: 'EVERYDAY PRACTICALITY', description: 'Seating needs, passenger space, body preference and usable cargo capacity.' },
  { id: 'performance', title: 'PERFORMANCE', description: 'Acceleration, power-to-weight and supported engine output.' },
  { id: 'comfort', title: 'COMFORT', description: 'Ride quality, cabin quietness, seats and passenger space.' },
  { id: 'balanced', title: 'BALANCED CHOICE', description: 'Overall capability and everyday usability, with less emphasis on price.', weights: { capability: 75, affordability: 15, age: 5, mileage: 5 } },
];
export const DEFAULT_SCENARIO = { annualKm: 15000, pricePerLitre: 1.70, minSeats: 5, bodyType: '' };
export function rankDecisionMode(cars, modeId, year = new Date().getFullYear(), scenario = DEFAULT_SCENARIO) {
  return rankCapabilities(cars, DECISION_MODES.find(mode => mode.id === modeId) || DECISION_MODES[0], year, scenario, detectWarnings);
}
