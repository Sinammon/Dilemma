// Pure functions: no network, storage, mutation, or React dependency.
import { resolveMileage, listedFeatures, powerHp, numeric as number } from './vehicle-data.js';
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
  const clauses = sources.filter(v => typeof v === 'string').flatMap(v => v.split(/[.!?;\n]|\bbut\b/i));
  return WARNING_RULES.flatMap(([label, pattern]) => {
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
}

export function rankCars(cars, priorities = DEFAULT_PRIORITIES, currentYear = new Date().getFullYear(), options = {}) {
  if (cars.length > 4) throw new RangeError('Compare at most four cars.');
  const entries = cars.map(car => {
    const year = number(car.year);
    const mileage = resolveMileage(car);
    return { car, warnings: detectWarnings(car), values: {
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
  }).sort((a, b) => (options.priceOnly ? 0 : Number(a.warnings.length > 0) - Number(b.warnings.length > 0)) || (b.score ?? 0) - (a.score ?? 0));
  ranked.forEach((entry, index) => {
    const previous = ranked[index - 1];
    entry.rank = previous && (options.priceOnly || Boolean(previous.warnings.length) === Boolean(entry.warnings.length)) && previous.score === entry.score ? previous.rank : index + 1;
  });
  const best = totalWeight ? ranked.filter(e => (options.priceOnly || !e.warnings.length) && e.rank === 1) : [];
  return { ranked, criteria, best, totalWeight };
}

export const DECISION_MODES = [
  { id: 'value', title: 'BEST VALUE', description: 'Price, age and mileage, with mechanical caution first.', weights: { price: 45, age: 25, mileage: 30 } },
  { id: 'cost', title: 'LOWEST UPFRONT COST', description: 'Lowest asking price. Disclosed concerns stay visible.', weights: { price: 100 } },
  { id: 'practical', title: 'EVERYDAY PRACTICALITY', description: 'Age, mileage and explicitly listed everyday amenities.', weights: { age: 35, mileage: 45, features: 20 } },
  { id: 'performance', title: 'PERFORMANCE', description: 'Compare explicit power figures; inspect engine and drivetrain claims.', weights: { power: 100 } },
  { id: 'comfort', title: 'COMFORT & FEATURES', description: 'Compare amenities explicitly confirmed or denied for every car.', weights: { features: 100 } },
  { id: 'balanced', title: 'BALANCED CHOICE', description: 'An equal balance of price, age and comparable mileage.', weights: { price: 1, age: 1, mileage: 1 } },
];
export function rankDecisionMode(cars, modeId, year = new Date().getFullYear()) {
  const mode = DECISION_MODES.find(m => m.id === modeId) || DECISION_MODES[0];
  const features = cars.map(listedFeatures);
  // An unmentioned feature is unknown, never silently counted as absent.
  const commonFeatures = features.length ? Object.keys(features[0]).filter(key => features.every(f => f[key] !== null)) : [];
  const criteria = [...CRITERIA, { key: 'power', label: 'Listed power (hp)', higherBetter: true }, { key: 'features', label: 'Comparable listed amenities', higherBetter: true }];
  const result = rankCars(cars, mode.weights, year, {
    priceOnly: mode.id === 'cost', criteria,
    extraValues: car => ({ power: powerHp(car), features: commonFeatures.length ? commonFeatures.filter(key => listedFeatures(car)[key] === true).length : null }),
  });
  return { ...result, mode, commonFeatures,
    limitation: mode.id === 'performance' ? 'This is a listed-power comparison, not a prediction of acceleration or handling. Engine size and drivetrain are shown as context, not automatically rated better.'
      : mode.id === 'comfort' || mode.id === 'practical' ? `Only amenities explicitly confirmed or denied for every car can be scored. Comparable amenities: ${commonFeatures.join(', ') || 'none'}. Unmentioned features remain unknown.`
        : mode.id === 'cost' ? 'Lowest asking price is not lowest total cost. Disclosed problems may mean additional costs; no repair estimate is available.' : 'Preference fit within this shortlist, not a reliability, safety or market-value rating.',
  };
}
