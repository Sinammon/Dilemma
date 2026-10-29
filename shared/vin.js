export const VPIC_SOURCE = 'https://vpic.nhtsa.dot.gov/api/';
export function validateVin(value) {
  if (value == null || value === '') return { status: 'missing', reason: 'No VIN supplied.' };
  if (typeof value !== 'string') return { status: 'invalid', reason: 'Conflicting or invalid VIN values.' };
  const vin = value.trim().toUpperCase();
  if (vin.length !== 17) return { status: 'unsupported', reason: 'Only full, standardized 17-character VINs are decoded. Older VINs remain unsupported.' };
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return { status: 'invalid', reason: 'VIN contains unsupported characters.' };
  const alphabet = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9, S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9 };
  const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
  const sum = [...vin].reduce((sum, letter, i) => sum + (alphabet[letter] ?? Number(letter)) * weights[i], 0) % 11;
  if (vin[8] !== (sum === 10 ? 'X' : String(sum))) return { status: 'invalid', reason: 'VIN check digit does not match. Verify it with the seller; some non-North-American VINs are unsupported.' };
  return { status: 'valid', vin };
}

const positive = value => typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value) && Number(value) > 0 ? Number(value) : null;
export function parseVinResponse(payload, vin) {
  const row = payload?.Results?.[0];
  if (!row || row.VIN?.toUpperCase() !== vin || String(row.ErrorCode).trim() !== '0') {
    return { status: 'unsupported', reason: 'vPIC did not return a clean decode for this VIN. No decoded values are used.', source: VPIC_SOURCE };
  }
  if (!row.Make || !row.Model || !/^\d{4}$/.test(row.ModelYear)) return { status: 'unsupported', reason: 'vPIC identity information is incomplete.', source: VPIC_SOURCE };
  return { status: 'decoded', vin, source: VPIC_SOURCE, fields: {
    year: row.ModelYear, make: row.Make, model: row.Model,
    displacement: positive(row.DisplacementL), cylinders: positive(row.EngineCylinders),
    horsepower: row.EngineHPTo && row.EngineHPTo !== row.EngineHP ? null : positive(row.EngineHP), engineType: row.EngineConfiguration || null,
    transmission: row.TransmissionStyle || null, transmissionSpeeds: positive(row.TransmissionSpeeds),
    drivetrain: row.DriveType || null, fuelType: row.FuelTypePrimary || null,
    bodyType: row.BodyClass || null, seats: positive(row.Seats),
  }, reason: 'Manufacturer-submitted VIN record. Not accident, ownership, condition, or installed-options history.' };
}

export async function decodeVin(vinValue, { fetcher = fetch, signal } = {}) {
  const validation = validateVin(vinValue);
  if (validation.status !== 'valid') return validation;
  try {
    const response = await fetcher(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${validation.vin}?format=json`, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(7000)]) : AbortSignal.timeout(7000), headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error('Unavailable');
    return parseVinResponse(await response.json(), validation.vin);
  } catch {
    return { status: 'unavailable', reason: 'VIN lookup unavailable or timed out. Seller details remain usable.', source: VPIC_SOURCE };
  }
}
