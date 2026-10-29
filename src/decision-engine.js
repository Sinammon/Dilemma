// Pure functions: no network, storage, mutation, or React dependency.
export const DEFAULT_PRIORITIES = { price: 50, age: 30, mileage: 20 };
export const CRITERIA = [
  { key: 'price', label: 'Purchase price' },
  { key: 'age', label: 'Vehicle age' },
  { key: 'mileage', label: 'Mileage' },
];

function number(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  // Reject ranges, conflicting arrays, estimates and ambiguous decimal separators.
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(text)) return null;
  const amount = Number(text.replaceAll(',', ''));
  return Number.isFinite(amount) ? amount : null;
}
const unitType = unit => typeof unit !== 'string' ? null
  : /^(km|kilomet(?:er|re)s?)$/i.test(unit.trim()) ? 'km'
    : /^(mi|miles?)$/i.test(unit.trim()) ? 'mi' : null;

export function mileageKm(mileage) {
  if (!mileage || typeof mileage.raw !== 'string' && typeof mileage.raw !== 'number') return null;
  const raw = String(mileage.raw).trim();
  const embedded = raw.match(/\s*(km|kilomet(?:er|re)s?|mi|miles?)$/i);
  const declared = unitType(mileage.unit);
  const embeddedType = unitType(embedded?.[1]);
  if (mileage.unit != null && !declared || declared && embeddedType && declared !== embeddedType) return null;
  const unit = declared || embeddedType;
  const amount = number(embedded ? raw.slice(0, embedded.index).trim() : raw);
  return unit && amount !== null ? amount * (unit === 'mi' ? 1.609344 : 1) : null;
}

const WARNING_RULES = [
  ['Not running', /\b(?:not (?:currently )?running|non[- ]running|does(?:n['’]t| not) (?:run|start)|won['’]t (?:run|start)|will not (?:run|start)|cannot (?:run|start)|can['’]t (?:run|start))\b/i],
  ['Engine concern', /\b(?:engine (?:is |has )?(?:problems?|issues?|failure|damage|knock(?:ing)?|seized|blown)|(?:blown|seized|damaged) engine|(?:needs?|requires?) (?:a |an )?(?:new |replacement )?engine|head gasket (?:leak|failure|blown)|blown head gasket|overheating)\b/i],
  ['Coolant leak', /\b(?:coolant (?:is )?leak(?:s|ing)?|leak(?:s|ing)? coolant|losing coolant|antifreeze leak(?:s|ing)?)\b/i],
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

export function rankCars(cars, priorities = DEFAULT_PRIORITIES, currentYear = new Date().getFullYear()) {
  if (cars.length > 4) throw new RangeError('Compare at most four cars.');
  const entries = cars.map(car => {
    const year = number(car.year);
    return { car, warnings: detectWarnings(car), values: {
      price: car.priceCAD?.currency === 'CAD' ? number(car.priceCAD.value) : null,
      age: year !== null && Number.isInteger(year) && year >= 1886 && year <= currentYear + 1 ? Math.max(0, currentYear - year) : null,
      mileage: mileageKm(car.mileage),
    } };
  });
  const criteria = CRITERIA.map(criterion => {
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
      const points = c.max === c.min ? 50 : 100 * (c.max - entry.values[c.key]) / (c.max - c.min);
      return { ...c, value: entry.values[c.key], points, share: c.weight / totalWeight, contribution: points * c.weight / totalWeight };
    });
    return { ...entry, breakdown, score: totalWeight ? Math.round(breakdown.reduce((sum, c) => sum + c.contribution, 0) * 100) / 100 : null };
  }).sort((a, b) => Number(a.warnings.length > 0) - Number(b.warnings.length > 0) || (b.score ?? 0) - (a.score ?? 0));
  ranked.forEach((entry, index) => {
    const previous = ranked[index - 1];
    entry.rank = previous && Boolean(previous.warnings.length) === Boolean(entry.warnings.length) && previous.score === entry.score ? previous.rank : index + 1;
  });
  const best = totalWeight ? ranked.filter(e => !e.warnings.length && e.rank === 1) : [];
  return { ranked, criteria, best, totalWeight };
}
