export const RECALL_SOURCE = 'https://www.nhtsa.gov/recalls';
export const RECALL_LIMIT = 'US model-level campaigns, not a VIN recall check. Canadian applicability and completed repairs must be confirmed with the manufacturer. Campaign counts are not reliability ratings.';
const clean = value => typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, ' ').trim() : '';
const normalized = value => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
export function recallIdentity(input) {
  const year = Number(input?.year), make = clean(input?.make), model = clean(input?.model);
  return Number.isInteger(year) && year >= 1966 && year <= new Date().getFullYear() + 1
    && make.length > 0 && make.length <= 50 && model.length > 0 && model.length <= 80
    && /^[\p{L}\p{N} .&/()-]+$/u.test(make + model) ? { year, make, model } : null;
}
export async function fetchModelRecalls(identity, { fetcher = fetch, signal } = {}) {
  const valid = recallIdentity(identity);
  if (!valid) return { status: 'unavailable', reason: 'A supported model year, make and model are needed.', campaigns: [] };
  const source = new URL('https://api.nhtsa.gov/recalls/recallsByVehicle');
  source.search = new URLSearchParams({ make: valid.make, model: valid.model, modelYear: String(valid.year) });
  const unavailable = () => ({ status: 'unavailable', reason: 'Official recall lookup is unavailable. Try again later or check with the manufacturer.', campaigns: [], source: RECALL_SOURCE });
  try {
    const response = await fetcher(source.href, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000), cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!response.ok) return unavailable();
    const data = await response.json();
    if (!Array.isArray(data?.results) || Number(data.Count) !== data.results.length) return unavailable();
    const matching = data.results.filter(row => row && normalized(row.Make) === normalized(valid.make) && normalized(row.Model) === normalized(valid.model) && Number(row.ModelYear) === valid.year);
    // Unexpected identity or malformed records must never become a reassuring empty result.
    if (matching.length !== data.results.length || matching.some(row => !/^\d{2}[VE]\d{6}$/.test(row.NHTSACampaignNumber) || !clean(row.Component) || !clean(row.Summary))) return unavailable();
    const campaigns = matching.slice(0, 30).map(row => ({ id: row.NHTSACampaignNumber, component: clean(row.Component), summary: clean(row.Summary), remedy: clean(row.Remedy), notes: clean(row.Notes), source: `https://www.nhtsa.gov/recalls?nhtsaId=${encodeURIComponent(row.NHTSACampaignNumber)}` }));
    return { status: 'available', identity: valid, campaigns, count: matching.length, source: source.href, checked: new Date().toISOString(), limitation: RECALL_LIMIT };
  } catch { return unavailable(); }
}
