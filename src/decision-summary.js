import { rankDecisionMode } from './decision-engine.js';
import { extractVehicleSpecs, specEvidenceLabel } from './vehicle-specs.js';
import { DIMENSION_LABELS, supportedPowerToWeight } from './capability-scoring.js';
import { dimensionRatingsForCar } from './model-research.js';
import { resolveMileage, numeric } from './vehicle-data.js';

export const PRIMARY_MODES = [
  { id: 'value', label: 'Best Value', icon: 'trophy' },
  { id: 'cost', label: 'Affordability', icon: 'dollar' },
  { id: 'comfort', label: 'Comfort', icon: 'seat' },
  { id: 'balanced', label: 'Balanced', icon: 'balance' },
  { id: 'performance', label: 'Performance', icon: 'engine' },
];
const money = n => `$${n.toLocaleString('en-CA', { maximumFractionDigits: 0 })} CAD`;
const number = n => n.toLocaleString('en-CA', { maximumFractionDigits: 0 });

// The requested category always owns its result; missing evidence never switches priorities.
export function decisionSummary(cars, mode, year, scenario) {
  const requested = rankDecisionMode(cars, mode, year, scenario);
  const kind = !cars.length ? 'empty' : !requested.best.length ? 'guidance' : requested.best[0].reviewRequired ? 'review' : 'supported';
  return { requested, ranking: requested, kind, provisional: requested.provisional, shared: requested.best.length > 1, single: cars.length === 1 };
}

export function entrySummary(summary, entry) {
  const { ranking, requested, kind } = summary;
  const model = requested.research.find(item => item.car === entry.car)?.guidance;
  const describe = factor => {
    const value = factor.key === 'price' ? money(factor.value)
      : factor.key === 'mileage' ? `${number(factor.value)} km`
      : factor.key === 'power' ? `${number(factor.value)} hp`
      : factor.key === 'torque' ? `${number(factor.value)} Nm`
      : factor.key === 'powerToWeight' ? `${number(factor.value)} hp/tonne`
      : factor.key === 'acceleration' ? `${factor.value} s`
      : ['rideQuality', 'cabinQuietness', 'seatComfort', 'passengerSpace', 'cargoSpace'].includes(factor.key) ? `${factor.value} / 5`
      : ['capability', 'affordability', 'comfort', 'performance', 'practical'].includes(factor.key) ? `${factor.value.toFixed(1)} / 100`
      : factor.key === 'fuel' ? `${money(factor.value)}/year` : factor.key === 'seats' || factor.key === 'body' ? factor.value ? 'Yes' : 'No' : `${factor.value} years`;
    const evidence = factor.evidence?.find(e => e.url);
    return { text: `${factor.label}: ${value}`, label: factor.evidenceLabel, source: evidence ? { url: evidence.url, publisher: evidence.source } : undefined };
  };
  const factors = [...entry.breakdown].sort((a, b) => b.contribution - a.contribution);
  let reasons = factors.slice(0, 3).map(describe);
  if (!reasons.length) reasons = (model?.claims || []).filter(c => !c.contextOnly).slice(0, 2).map(c => ({ text: c.text, label: 'Model context | not a comparative score', source: c.sources[0] }));
  const weaker = [...entry.breakdown].sort((a, b) => a.points - b.points)[0];
  const modelDrawback = model?.claims.find(c => c.tone === 'caution' && !c.contextOnly);
  const tradeoff = modelDrawback?.text || (weaker && weaker.points < 50 ? `${weaker.label} is a weaker factor in this comparison.` : summary.provisional ? 'Some category evidence is missing. This result may change as research completes.' : 'Model assessments do not establish the condition of this used car; confirm on a test drive.');
  const active = ranking.criteria.filter(c => c.active).map(c => c.label.toLowerCase());
  const explanation = entry.identityMismatch ? 'Resolve conflicting identity or configuration details before ranking this car.'
    : entry.score == null ? 'This car does not have enough comparable category evidence to rank. No price-based substitute is used.'
    : !ranking.best.includes(entry) ? 'Another contender in your shortlist, scored on the same supported category factors.'
    : kind === 'review' ? `Highest supported ${requested.mode.title.toLowerCase()} score, with purchase concerns to review. The warning does not change its category capability.`
      : summary.single ? 'Your only contender so far. Add another car for a relative comparison.'
        : summary.shared ? `An equal match on ${active.join(', ')}.`
          : `${summary.provisional ? 'Provisional best fit' : 'Best fit'} for ${requested.mode.title.toLowerCase()} on the supported comparable factors.`;
  return { reasons, tradeoff, tradeoffSource: modelDrawback?.sources[0], explanation };
}

export function keyFacts(car, mode = 'value') {
  const { specs, features } = extractVehicleSpecs(car);
  const facts = [];
  const engine = [specs.displacement.value != null && `${specs.displacement.value.toFixed(1)} L`, specs.cylinders.value != null && `${specs.cylinders.value}-cylinder`].filter(Boolean).join(' · ');
  const engineFields = [specs.displacement, specs.cylinders].filter(s => s.value != null);
  if (engine) facts.push({ icon: 'engine', label: 'Engine', value: engine, source: engineFields.some(s => s.quality === 'estimated') ? 'Includes estimated model specs; unverified' : engineFields.some(s => s.status === 'model-reference') ? 'Includes typical model specs · cited sources' : engineFields.every(s => s.status === 'vin-record') ? 'Original VIN record' : engineFields.every(s => s.status === 'seller-reported') ? 'Seller-reported' : 'Seller / original VIN evidence' });
  const mileage = resolveMileage(car);
  if (mileage.unit && mileage.amount != null) facts.push({ icon: 'mileage', label: 'Mileage', value: `${number(mileage.amount)} ${mileage.unit}`, source: mileage.assumedUnit ? 'Seller reading · kilometres assumed' : 'Seller-reported' });
  const amenities = Object.entries(features).filter(([, f]) => f.value === true).map(([label]) => label);
  if (amenities.length) facts.push({ icon: 'seat', label: 'Reported features', value: amenities.slice(0, 3).join(', '), source: amenities.some(name => features[name].status === 'model-reference') ? 'Includes typical standard equipment · confirm on this car' : 'Seller-reported · confirm on this car' });
  else if (specs.transmission.value) facts.push({ icon: 'transmission', label: 'Transmission', value: specs.transmission.value, source: specEvidenceLabel(specs.transmission) });
  if (!facts.length && car.priceCAD?.currency === 'CAD' && numeric(car.priceCAD.value) != null) facts.push({ icon: 'dollar', label: 'Asking price', value: money(numeric(car.priceCAD.value)), source: 'Seller-reported' });
  if (mode !== 'value') {
    const specFact = (key, label, unit, icon) => { if (specs[key].value != null) facts.push({ icon, label, value: `${specs[key].value}${unit}`, source: specEvidenceLabel(specs[key]) }); };
    specFact('horsepower', 'Power', ' hp', 'engine');
    specFact('torque', 'Torque', ' Nm', 'engine');
    specFact('curbWeightKg', 'Curb weight', ' kg', 'engine');
    const ratio = supportedPowerToWeight(specs);
    if (ratio != null) facts.push({ icon: 'engine', label: 'Power-to-weight', value: `${number(ratio)} hp/tonne`, source: 'Derived from compatible power and curb weight' });
    specFact('seats', 'Seats', '', 'seat');
    specFact('bodyType', 'Body style', '', 'compare');
    specFact('fuelType', 'Fuel type', '', 'dollar');
    if (car.enrichment?.fuel?.status === 'matched') facts.push({ icon: 'dollar', label: 'Fuel reference', value: `${car.enrichment.fuel.combined.toFixed(1)} L/100 km`, source: 'NRCan configuration reference' });
    if (car.priceCAD?.currency === 'CAD' && numeric(car.priceCAD.value) != null && !facts.some(f => f.label === 'Asking price')) facts.push({ icon: 'dollar', label: 'Asking price', value: money(numeric(car.priceCAD.value)), source: 'Seller-reported' });
    if (mode === 'comfort') {
      const ratings = dimensionRatingsForCar(car);
      for (const key of ['rideQuality', 'cabinQuietness']) if (ratings[key]) facts.push({ icon: 'seat', label: DIMENSION_LABELS[key], value: `${ratings[key].rating} / 5`, source: 'Cited professional review assessment' });
      if (ratings.frontSeatComfort && ratings.rearSeatComfort) facts.push({ icon: 'seat', label: 'Seat comfort', value: `${(ratings.frontSeatComfort.rating + ratings.rearSeatComfort.rating) / 2} / 5`, source: 'Front and rear occupants weighted equally' });
    }
    const order = ({ cost: ['Asking price', 'Fuel reference', 'Fuel type', 'Engine', 'Mileage'], comfort: ['Ride quality', 'Cabin quietness', 'Seat comfort', 'Passenger space'], practical: ['Seats', 'Body style', 'Reported features', 'Mileage'], performance: ['Power-to-weight', 'Power', 'Torque', 'Curb weight'], balanced: ['Engine', 'Fuel reference', 'Fuel type', 'Reported features', 'Mileage'] })[mode] || [];
    return order.flatMap(label => facts.filter(f => f.label === label)).slice(0, 3);
  }
  return facts.slice(0, 3);
}
