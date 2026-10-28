import { loadEnvFile } from 'node:process';
import { pathToFileURL } from 'node:url';

const API = 'https://api.ebay.com';
const CATEGORY = '6001'; // Cars & Trucks on EBAY_CA; excludes Parts & Accessories.
const LIMITATIONS = `Motors feasibility: EBAY_CA Browse support does not guarantee complete vehicle coverage.
The documented vehicle compatibility feature searches PARTS that fit a vehicle.
This probe searches actual Cars & Trucks, using Browse's default FIXED_PRICE inventory.
Auction-only listings are excluded by default. CLASSIFIED_AD is a documented buying option,
but neither auction nor classified coverage is established by this probe.
Zero results do not prove vehicles are unsupported or that Canada has no used cars.
Vehicle specifics are seller-provided and may be missing. See README.md for sources.`;

// Only error messages are printed, never request headers, credentials, or token responses.
const secrets = [];
function safe(value) {
  let result = String(value);
  for (const secret of secrets) result = result.split(secret).join('[REDACTED]');
  return result;
}

async function request(label, url, options = {}) {
  let response;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(30_000) });
  } catch (error) {
    throw new Error(`${label}: network/timeout failure (${error.cause?.code ?? error.name}).`);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.errors?.length) {
    const messages = data?.errors?.map(e => `${e.errorId}: ${e.message}`).join('; ')
      || data?.error_description || data?.error || 'No JSON error details returned';
    const hint = response.status === 401 ? ' Check Production keys/token and scope.'
      : response.status === 403 ? ' Check application permissions and Production access with eBay.'
      : response.status === 429 ? ' Rate limit reached; try later.' : '';
    throw new Error(`${label}: HTTP ${response.status}: ${safe(messages)}.${hint}`);
  }
  if (!data) throw new Error(`${label}: expected a JSON response.`);
  for (const warning of data.warnings ?? []) {
    console.warn(safe(`eBay warning ${warning.errorId}: ${warning.message}`));
  }
  return data;
}

const money = price => price ? `${price.value} ${price.currency}` : 'Not returned';

export function parseItemUrl(input) {
  let url;
  try { url = new URL(input); } catch { throw new Error('Provide a full eBay.ca item URL.'); }
  if (!['https:', 'http:'].includes(url.protocol)
      || !['ebay.ca', 'www.ebay.ca', 'm.ebay.ca'].includes(url.hostname)
      || url.username || url.password || url.port) {
    throw new Error('Only eBay.ca item URLs are accepted (for example https://www.ebay.ca/itm/123456789012).');
  }
  const match = url.pathname.match(/^\/itm\/(?:[^/]+\/)?(\d{9,15})\/?$/i);
  const legacyItemId = match?.[1];
  if (!legacyItemId) throw new Error('Cannot extract an item ID. Use an eBay.ca /itm/ID or /itm/title/ID URL.');
  const variationId = url.searchParams.get('var');
  if (variationId && !/^\d{9,15}$/.test(variationId)) throw new Error('Invalid eBay variation ID in URL.');
  return { legacyItemId, variationId, canonicalUrl: `https://www.ebay.ca/itm/${legacyItemId}` };
}

export function extractVehicle(item, source) {
  const aspects = item.localizedAspects ?? [];
  function aspect(...names) {
    const values = [...new Set(aspects
      .filter(a => names.includes(a.name?.trim().toLowerCase()))
      .map(a => a.value?.trim()).filter(Boolean))];
    return values.length > 1 ? values : values[0] ?? null;
  }
  const price = item.price;
  // Use only CAD explicitly supplied by eBay; never relabel USD or invent an FX rate.
  const priceCAD = price?.currency === 'CAD' && price.value != null
    ? { value: price.value, currency: 'CAD' }
    : price?.convertedFromCurrency === 'CAD' && price.convertedFromValue != null
      ? { value: price.convertedFromValue, currency: 'CAD' } : null;
  const mileage = aspect('mileage', 'odometer', 'kilométrage', 'kilometrage');
  const embeddedUnit = typeof mileage === 'string'
    ? mileage.match(/\b(km|kilometers?|kilometres?|mi|miles?)\b/i)?.[0] : null;
  return {
    sourceUrl: source.canonicalUrl,
    legacyItemId: source.legacyItemId,
    itemId: item.itemId ?? null,
    listingUrl: item.itemWebUrl ?? null,
    title: item.title ?? null,
    priceCAD,
    returnedPrice: price ?? null,
    year: aspect('year', 'model year', 'année', 'année du modèle'),
    make: aspect('make', 'marque'),
    model: aspect('model', 'modèle'),
    mileage: mileage == null ? null : {
      raw: mileage,
      unit: aspect('mileage unit', 'mileage units', 'odometer unit', 'odometer units') ?? embeddedUnit ?? null,
    },
    vin: aspect('vin', 'vin (vehicle identification number)', 'vehicle identification number'),
    condition: item.condition ?? null,
    conditionId: item.conditionId ?? null,
    location: item.itemLocation ?? null,
    images: [...new Set([item.image, ...(item.additionalImages ?? [])]
      .map(image => image?.imageUrl).filter(Boolean))],
    description: item.description ?? null, // Seller HTML, printed as JSON; never rendered/executed.
    categoryIdPath: item.categoryIdPath ?? null,
    itemSpecifics: aspects,
  };
}

export async function importListing(input, headers, { quiet = false } = {}) {
  const source = parseItemUrl(input);
  // A web URL contains a legacy listing ID, not a Browse REST item ID.
  const url = new URL(`${API}/buy/browse/v1/item/get_item_by_legacy_id`);
  url.searchParams.set('legacy_item_id', source.legacyItemId);
  if (source.variationId) url.searchParams.set('legacy_variation_id', source.variationId);
  if (!quiet) console.log(`\nURL import: ${source.canonicalUrl}`);
  const item = await request('URL import (getItemByLegacyId)', url, { headers });
  if (!item.itemId) throw new Error('URL import: API returned no item ID; import could not be confirmed.');
  const vehicle = extractVehicle(item, source);
  if (quiet) return vehicle;
  const required = ['title', 'priceCAD', 'year', 'make', 'model', 'mileage', 'vin', 'condition', 'location', 'images', 'description'];
  const missing = required.filter(key => vehicle[key] == null || vehicle[key] === ''
    || (Array.isArray(vehicle[key]) && !vehicle[key].length));
  console.log(JSON.stringify(vehicle, null, 2));
  console.log('URL IMPORT WORKS: Browse resolved the pasted listing ID and returned item details.');
  console.log(`Missing requested fields: ${missing.join(', ') || 'none'}.`);
  if (vehicle.mileage && !vehicle.mileage.unit) console.log('Mileage unit: not returned; do not assume kilometres.');
  if (!vehicle.priceCAD) console.log('CAD price unavailable: returned price preserved; no currency conversion performed.');
  console.log('Vehicle identity, seller values and condition need review; URL retrieval does not validate a usable used car.');
  console.log('All listing data stays in memory and console output; no files or database records written.');
  return vehicle;
}

// Shared Production authentication. Credentials and tokens stay on the server.
export async function authenticate() {
  const clientId = process.env.EBAY_CLIENT_ID?.trim();
  const clientSecret = process.env.EBAY_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error('Set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET in the local .env file.');
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  secrets.push(clientId, clientSecret, basic);
  const auth = await request('OAuth token', `${API}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'https://api.ebay.com/oauth/api_scope' }),
  });
  if (!auth.access_token) throw new Error('OAuth response did not contain an access token.');
  secrets.push(auth.access_token);
  return auth;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Usage: node ebay-feasibility.mjs ["https://www.ebay.ca/itm/ITEM_ID" | --test-import]');
    console.log('No argument: search five listings. --test-import: search, then import the first returned eBay.ca URL.');
    return;
  }
  if (args.length > 1) throw new Error('Supply one quoted item URL or --test-import.');
  const inputUrl = args[0] && args[0] !== '--test-import' ? args[0] : null;
  if (inputUrl) parseItemUrl(inputUrl); // Reject invalid input before requesting a token.
  console.log(`Dilemma - eBay Production Browse feasibility test\n\n${LIMITATIONS}\n`);
  try {
    loadEnvFile(new URL('.env', import.meta.url));
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('Missing .env. Copy .env.example to .env and add Production credentials.');
    throw error;
  }
  const auth = await authenticate();
  console.log(`OAuth succeeded (expires in ${auth.expires_in ?? 'unknown'} seconds). Token kept in memory.\n`);

  const headers = {
    Authorization: `Bearer ${auth.access_token}`,
    'X-EBAY-C-MARKETPLACE-ID': 'EBAY_CA',
    Accept: 'application/json',
  };
  if (inputUrl) {
    await importListing(inputUrl, headers);
    return;
  }
  const url = new URL(`${API}/buy/browse/v1/item_summary/search`);
  url.search = new URLSearchParams({
    category_ids: CATEGORY,
    filter: 'conditions:{USED},itemLocationCountry:CA',
    limit: '5',
  });
  console.log(`Marketplace: EBAY_CA; category: ${CATEGORY} (Cars & Trucks); used; item location: Canada`);
  console.log(`GET ${url}\n`);
  const search = await request('Browse search', url, { headers });
  const items = (search.itemSummaries ?? []).slice(0, 5);
  console.log(`Reported total: ${search.total ?? 'not returned'}; returned: ${items.length}\n`);
  if (!items.length) {
    if (args[0] === '--test-import') console.log('URL IMPORT NOT TESTED: Search returned no listing to import.');
    console.log('INCONCLUSIVE: No matching vehicles returned. Authentication/search worked, but vehicle inventory feasibility is unproven.');
    console.log('Check eBay warnings, category support and inventory coverage with eBay before building Dilemma.');
    return;
  }
  let detailFailures = 0;
  for (const [index, summary] of items.entries()) {
    let detail = {};
    try {
      detail = await request('Browse item details',
        `${API}/buy/browse/v1/item/${encodeURIComponent(summary.itemId)}`, { headers });
    } catch (error) {
      console.warn(safe(error.message));
      detailFailures++;
    }
    const item = { ...summary, ...detail };
    console.log(`${index + 1}. ${item.title ?? 'Title not returned'}`);
    console.log(`   Price: ${money(item.price)}`);
    console.log(`   Condition: ${item.condition ?? 'Not returned'} (ID: ${item.conditionId ?? 'not returned'})`);
    console.log(`   URL: ${item.itemWebUrl ?? 'Not returned'}`);
    console.log(`   Location: ${JSON.stringify(item.itemLocation ?? {})}`);
    console.log(`   Buying options: ${(item.buyingOptions ?? []).join(', ') || 'Not returned'}`);
    // Print all item specifics to preserve VIN, mileage units and unfamiliar/localized names.
    console.log(`   Vehicle details / item specifics: ${JSON.stringify(item.localizedAspects ?? [], null, 2)}`);
    console.log();
  }
  console.log('CANDIDATES RETURNED: Inspect titles, category and specifics to confirm these are complete vehicles.');
  console.log('This sample does not establish comprehensive Motors inventory or reliable VIN/mileage coverage.');
  if (args[0] === '--test-import') {
    const candidate = items.find(item => {
      try { parseItemUrl(item.itemWebUrl); return true; } catch { return false; }
    });
    if (!candidate) throw new Error('URL IMPORT NOT TESTED: None of the five results has a supported eBay.ca item URL.');
    await importListing(candidate.itemWebUrl, headers);
  }
  if (detailFailures) {
    console.log(`PARTIAL: ${detailFailures} item detail request(s) failed; summaries were printed where available.`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => {
  console.error(`\nTEST FAILED: ${safe(error.message)}`);
  if (process.argv[2]) console.error('URL IMPORT NOT CONFIRMED: See the error above; this does not prove all eBay URL imports are unsupported.');
  console.error('No feasibility conclusion can be drawn from an authentication, permission, request or network failure.');
  process.exitCode = 1;
});
