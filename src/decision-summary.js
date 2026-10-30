import { rankDecisionMode } from './decision-engine.js';
import { extractVehicleSpecs } from './vehicle-specs.js';
import { resolveMileage, numeric } from './vehicle-data.js';

export const PRIMARY_MODES = [
  { id: 'value', label: 'Best Value', icon: 'trophy' },
  { id: 'cost', label: 'Lowest Cost', icon: 'dollar' },
  { id: 'comfort', label: 'Comfort', icon: 'seat' },
  { id: 'balanced', label: 'Balanced', icon: 'balance' },
];
const money = n => `$${n.toLocaleString('en-CA', { maximumFractionDigits: 0 })} CAD`;
const number = n => n.toLocaleString('en-CA', { maximumFractionDigits: 0 });

// A fallback is a different decision basis, never a fabricated score for the requested priority.
export function decisionSummary(cars, mode, year, scenario) {
  const requested = rankDecisionMode(cars, mode, year, scenario);
  let ranking = requested;
  let kind = 'supported';
  if (cars.length && !requested.totalWeight) {
    ranking = rankDecisionMode(cars, 'value', year, scenario);
    kind = ranking.totalWeight ? 'starting-point' : 'guidance';
  }
  if (!cars.length) kind = 'empty';
  else if (!ranking.best.length && ranking.ranked.every(e => e.identityMismatch || e.warnings.length)) kind = 'review';
  else if (!ranking.totalWeight) kind = 'guidance';
  return { requested, ranking, kind, shared: ranking.best.length > 1, single: cars.length === 1 };
}

export function entrySummary(summary, entry) {
  const { ranking, requested, kind } = summary;
  const active = ranking.criteria.filter(c => c.active).map(c => c.label.toLowerCase());
  const model = requested.research.find(item => item.car === entry.car)?.guidance;
  const reasons = [];
  for (const factor of entry.breakdown.filter(f => f.points > 50)) {
    const text = factor.key === 'price' ? `Lower asking price: ${money(factor.value)}`
      : factor.key === 'mileage' ? `Lower mileage: ${number(factor.value)} km`
        : factor.key === 'age' ? `Newer model year than another contender`
          : factor.key === 'features' ? `${factor.value} seller-documented amenities`
            : factor.key === 'fuel' ? `Lower fuel scenario: ${money(factor.value)}/year`
              : factor.key === 'seats' ? 'Meets your stated seating need'
                : factor.key === 'body' ? 'Matches your preferred body style'
                  : factor.key === 'power' ? `Higher documented power: ${number(factor.value)} hp`
                    : `Higher documented torque: ${number(factor.value)} Nm`;
    reasons.push({ text, label: factor.evidenceLabel });
  }
  if (!reasons.length) {
    if (entry.values.price != null) reasons.push({ text: `Asking price: ${money(entry.values.price)}`, label: 'Seller-reported' });
    if (entry.values.mileage != null) reasons.push({ text: `Listed mileage: ${number(entry.values.mileage)} km`, label: 'Seller-reported' });
  }
  const researchClaim = model?.claims.find(c => c.tone === 'positive') || model?.claims[0];
  const lowerPrice = ranking.ranked.filter(e => e.values.price != null).map(e => e.values.price);
  const minPrice = lowerPrice.length ? Math.min(...lowerPrice) : null;
  const weaker = entry.breakdown.find(f => f.points < 50 && f.key !== 'price');
  let tradeoff = entry.values.price != null && minPrice != null && entry.values.price > minPrice ? `${money(entry.values.price - minPrice)} more than the lowest asking price.`
    : weaker?.key === 'mileage' ? `More kilometres than another contender: ${number(weaker.value)} km.`
      : weaker?.key === 'age' ? 'An older model year than another contender.'
        : 'Condition and service history still need checking.';
  if (kind === 'starting-point' && requested.mode.id === 'comfort') tradeoff = 'Ride comfort and unlisted equipment still need a test drive.';
  if (kind === 'starting-point' && requested.mode.id === 'performance') tradeoff = 'Performance is unverified; compare power and driving behaviour in person.';
  const explanation = kind === 'starting-point' ? `A starting point using ${active.join(', ')}. ${requested.mode.id === 'comfort' ? 'Comfort is not comparable from these listings.' : 'Your selected priority is not fully documented.'}`
    : kind === 'review' ? 'Resolve the disclosed condition or identity concerns before choosing.'
      : kind === 'guidance' ? 'Use the available details and cited model context to plan your checks. There is no comparative winner yet.'
        : summary.single ? 'Your only contender so far. Add another car for a relative comparison.'
          : summary.shared ? `An equal match on ${active.join(', ')}. There is no clear winner on these factors.`
            : `Best fit on the comparable ${active.join(', ')} in your shortlist.`;
  return { reasons: reasons.slice(0, 2), researchClaim, tradeoff, explanation };
}

export function keyFacts(car) {
  const { specs, features } = extractVehicleSpecs(car);
  const facts = [];
  const engine = [specs.displacement.value != null && `${specs.displacement.value.toFixed(1)} L`, specs.cylinders.value != null && `${specs.cylinders.value}-cylinder`].filter(Boolean).join(' · ');
  const engineFields = [specs.displacement, specs.cylinders].filter(s => s.value != null);
  if (engine) facts.push({ icon: 'engine', label: 'Engine', value: engine, source: engineFields.every(s => s.status === 'vin-record') ? 'Original VIN record' : engineFields.every(s => s.status === 'seller-reported') ? 'Seller-reported' : 'Seller / original VIN evidence' });
  const mileage = resolveMileage(car);
  if (mileage.unit && mileage.amount != null) facts.push({ icon: 'mileage', label: 'Mileage', value: `${number(mileage.amount)} ${mileage.unit}`, source: 'Seller-reported' });
  const amenities = Object.entries(features).filter(([, f]) => f.value === true).map(([label]) => label);
  if (amenities.length) facts.push({ icon: 'seat', label: 'Reported features', value: amenities.slice(0, 3).join(', '), source: 'Seller-reported · confirm on this car' });
  else if (specs.transmission.value) facts.push({ icon: 'transmission', label: 'Transmission', value: specs.transmission.value, source: specs.transmission.status === 'vin-record' ? 'Original VIN record' : specs.transmission.status === 'corroborated' ? 'Seller + original VIN record' : 'Seller-reported' });
  if (!facts.length && car.priceCAD?.currency === 'CAD' && numeric(car.priceCAD.value) != null) facts.push({ icon: 'dollar', label: 'Asking price', value: money(numeric(car.priceCAD.value)), source: 'Seller-reported' });
  return facts;
}
