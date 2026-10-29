import { validateVin } from '../shared/vin.js';
import { extractVehicleSpecs, vinMismatches } from './vehicle-specs.js';
import { loadFuelYear, matchFuelEconomy, NRCAN_SOURCE } from './fuel-data.js';

// This work is optional and never blocks the eBay import or writes to storage.
export async function enrichVehicle(car, { fetcher = fetch, signal } = {}) {
  let vin = validateVin(car.vin);
  if (vin.status === 'valid') {
    try {
      const response = await fetcher('/api/vehicle-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vin: vin.vin }), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(9000)]) : AbortSignal.timeout(9000), cache: 'no-store' });
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Unavailable');
      const data = await response.json();
      vin = data?.vin && ['decoded', 'unsupported', 'unavailable', 'invalid', 'missing'].includes(data.vin.status) ? data.vin : { status: 'unavailable', reason: 'Invalid VIN lookup response.' };
      if (vin.status === 'decoded') vin = { ...vin, mismatches: vinMismatches(car, vin) };
    } catch { vin = { status: 'unavailable', reason: 'VIN lookup unavailable. Seller details remain usable.' }; }
  }
  const candidate = { ...car, enrichment: { vin } };
  let fuel;
  try {
    const year = extractVehicleSpecs(candidate).specs.year.value;
    const rows = await loadFuelYear(year, { fetcher, signal });
    fuel = matchFuelEconomy(candidate, rows);
  } catch { fuel = { status: 'unavailable', reason: 'NRCan reference data could not be loaded. No fuel rating is assigned.', source: NRCAN_SOURCE }; }
  return { status: 'complete', vin, fuel };
}
