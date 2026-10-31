import { extractVehicleSpecs, normalized } from './vehicle-specs.js';
export const NRCAN_SOURCE = 'https://open.canada.ca/data/en/dataset/98f1a129-f628-4ce4-b24d-6f16bf24dd64';
const family = code => /^AV/.test(code) ? 'CVT' : /^AM/.test(code) ? 'Dual-clutch / automated manual' : /^A/.test(code) ? 'Automatic' : /^M/.test(code) ? 'Manual' : null;
const fuelFamily = code => ['X', 'Z'].includes(code) ? 'Gasoline' : code === 'D' ? 'Diesel' : code === 'E' ? 'Ethanol / flex fuel' : null;
export const FUEL_LABELS = { X: 'Regular gasoline', Z: 'Premium gasoline', D: 'Diesel', E: 'Ethanol / flex fuel' };

export function matchFuelEconomy(car, rows) {
  const none = reason => ({ status: 'unmatched', reason, source: NRCAN_SOURCE });
  const { specs } = extractVehicleSpecs({ ...car, enrichment: { ...car.enrichment, modelSpecs: undefined } });
  const get = key => specs[key].value;
  if (['year', 'make', 'model', 'displacement', 'cylinders', 'transmission', 'fuelType'].some(key => get(key) == null)) return none('Exact year, make, model, engine size, cylinders, transmission and fuel type are required.');
  if (get('transmission') !== 'CVT' && get('transmissionSpeeds') == null && get('transmissionCode') == null) return none('Transmission speed count or an explicit configuration code is missing.');
  const names = [String(get('model'))];
  if (get('bodyType')) names.push(`${get('model')} ${get('bodyType')}`);
  // Explicit NRCan naming aliases; body evidence is required, never inferred.
  if (normalized(get('make')) === 'mazda' && ['3', 'mazda3', 'mazda3sport'].includes(normalized(get('model')))) {
    if (get('bodyType') === 'Sedan') names.push('Mazda3 4-Door');
    if (get('bodyType') === 'Hatchback') names.push('Mazda3 5-Door');
  }
  // Only add configuration tokens explicitly supported by the listing/VIN.
  if (['AWD', '4WD'].includes(get('drivetrain'))) names.push(`${get('model')} ${get('drivetrain')}`, `${get('model')} ${get('drivetrain') === '4WD' ? '4X4' : 'AWD'}`);
  const trim = (car.itemSpecifics || []).find(a => /^trim$/i.test(a.name?.trim()))?.value;
  if (typeof trim === 'string') names.push(`${get('model')} ${trim}`);
  const candidates = rows.filter(row => {
    const body = row.model.match(/\b(Sedan|Coupe|Hatchback|Wagon|Convertible)\b/i)?.[1] || (/\b4-Door\b/i.test(row.model) ? 'Sedan' : /\b5-Door\b/i.test(row.model) ? 'Hatchback' : null);
    if (body && get('bodyType') && normalized(body) !== normalized(get('bodyType'))) return false;
    const drive = row.model.match(/\b(AWD|4WD|4X4|FWD|RWD)\b/i)?.[1]?.toUpperCase().replace('4X4', '4WD');
    if (drive && (!get('drivetrain') || drive !== get('drivetrain'))) return false;
    if (['AWD', '4WD'].includes(get('drivetrain')) && !drive) return false;
    return Number(row.year) === Number(get('year')) && normalized(row.make) === normalized(get('make'))
      && names.some(name => normalized(name) === normalized(row.model))
      && Math.abs(Number(row.displacement) - get('displacement')) < 0.06
      && Number(row.cylinders) === get('cylinders') && family(row.transmission) === get('transmission')
      && (get('transmissionCode') == null || row.transmission === get('transmissionCode'))
      && (get('transmissionSpeeds') == null || Number(row.transmission.match(/\d+/)?.[0]) === get('transmissionSpeeds'))
      && fuelFamily(row.fuel) === get('fuelType') && Number.isFinite(Number(row.combined)) && Number(row.combined) > 0;
  });
  // Even different configurations with the same rating stay ambiguous.
  const unique = [...new Map(candidates.map(row => [JSON.stringify(row), row])).values()];
  if (unique.length !== 1) return none(unique.length ? 'Multiple NRCan configurations remain possible. No rating is assigned.' : 'No exact supported NRCan configuration was found.');
  const row = unique[0];
  return { status: 'matched', source: NRCAN_SOURCE, row, combined: Number(row.combined), city: Number(row.city), highway: Number(row.highway), fuel: row.fuel, reason: 'Unique match on exact year, make, model, engine, cylinders, transmission and fuel. No fuzzy model matching.', adjusted: Number(row.year) < 2015 };
}

export function annualFuelCost(fuel, { annualKm, pricePerLitre }) {
  if (fuel?.status !== 'matched' || !Number.isFinite(fuel.combined) || fuel.combined <= 0 || !Number.isFinite(annualKm) || annualKm <= 0 || !Number.isFinite(pricePerLitre) || pricePerLitre <= 0) return null;
  return fuel.combined / 100 * annualKm * pricePerLitre;
}

export async function loadFuelYear(year, { fetcher = fetch, signal } = {}) {
  if (!Number.isInteger(Number(year)) || Number(year) < 1995 || Number(year) > 2026) return [];
  const response = await fetcher(`/data/fuel/${Number(year)}.json`, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000), cache: 'no-store' });
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Fuel reference unavailable');
  const data = await response.json();
  if (!Array.isArray(data.columns) || !Array.isArray(data.rows)) throw new Error('Fuel reference invalid');
  return data.rows.map(row => Object.fromEntries(data.columns.map((key, index) => [key, row[index]])));
}
