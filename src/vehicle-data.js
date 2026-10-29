import { extractVehicleSpecs } from './vehicle-specs.js';
export { FEATURE_RULES, extractVehicleSpecs } from './vehicle-specs.js';
import { resolveMileage } from './mileage.js';
export { unitType, resolveMileage, mileageDisplay } from './mileage.js';

// Conservative interpretation of seller claims. Original listing fields are untouched.
export const unknown = value => value == null || value === '' || Array.isArray(value) && !value.length ? 'Unknown' : Array.isArray(value) ? value.join(' / ') : String(value);
export const vehicleName = car => { const { specs } = extractVehicleSpecs(car); return ['year', 'make', 'model'].map(key => unknown(specs[key].value)).join(' '); };
export const safeUrl = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; } };
export function specification(car, ...names) {
  const values = [...new Set((car.itemSpecifics || []).filter(a => names.includes(a.name?.trim().toLowerCase())).flatMap(a => Array.isArray(a.value) ? a.value : [a.value]).filter(v => v != null && v !== ''))];
  return values.length > 1 ? values : values[0] ?? null;
}
export function numeric(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== 'string' || !/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(value.trim())) return null;
  const amount = Number(value.replaceAll(',', ''));
  return Number.isFinite(amount) ? amount : null;
}
export function priceDisplay(car) {
  const price = car.priceCAD ?? car.returnedPrice;
  return price?.value != null && price.currency ? `${unknown(price.value)} ${price.currency}` : 'Unknown';
}
export function listedFeatures(car) {
  return Object.fromEntries(Object.entries(extractVehicleSpecs(car).features).map(([name, feature]) => [name, feature.value]));
}
export function powerHp(car) {
  return extractVehicleSpecs(car).specs.horsepower.value;
}

export function missingDetails(car) {
  const specs = extractVehicleSpecs(car).specs;
  const details = [
    ['Year', specs.year.value], ['Make', specs.make.value], ['Model', specs.model.value],
    ['Mileage / unit', resolveMileage(car).status === 'known' ? true : null],
    ['Transmission', specs.transmission.value],
    ['Fuel type', specs.fuelType.value],
    ['Engine displacement', specs.displacement.value], ['Horsepower', specs.horsepower.value],
    ['Body type', specs.bodyType.value], ['Seats', specs.seats.value],
    ['Condition', car.condition], ['Seller description', car.description],
  ];
  return details.filter(([, value]) => value == null || value === '' || Array.isArray(value)).map(([label]) => label);
}
