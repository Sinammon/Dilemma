// Live checks keep all eBay data in memory; print only status and field counts.
import { createApp } from './server.mjs';
import { authenticate } from './ebay-feasibility.mjs';
import vercelImport from './api/import.js';
const token = await authenticate();
const searchUrl = new URL('https://api.ebay.com/buy/browse/v1/item_summary/search');
searchUrl.search = new URLSearchParams({ category_ids: '6001', filter: 'conditions:{USED},itemLocationCountry:CA', limit: '5' });
const response = await fetch(searchUrl, { headers: { Authorization: `Bearer ${token.access_token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_CA' }, signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`Search returned HTTP ${response.status}`);
const data = await response.json();
const candidates = (data.itemSummaries ?? []).filter(item => /^https:\/\/(www\.)?ebay\.ca\/itm\//.test(item.itemWebUrl));
if (!candidates.length) throw new Error('Search supplied no testable eBay.ca URLs.');
const server = createApp({ auth: async () => token });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  let success = false;
  for (const item of candidates) {
    const imported = await fetch(`http://127.0.0.1:${server.address().port}/api/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: item.itemWebUrl }) });
    if (imported.status === 422) continue;
    if (!imported.ok) throw new Error(`Import returned HTTP ${imported.status}`);
    const { vehicle } = await imported.json();
    // Execute the actual Vercel Web entry with real eBay calls, still locally.
    const viaVercelHandler = await vercelImport.fetch(new Request('https://dilemma-smoke.example.test/api/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://dilemma-smoke.example.test' },
      body: JSON.stringify({ url: item.itemWebUrl }),
    }));
    if (!viaVercelHandler.ok) throw new Error('Vercel handler returned HTTP ' + viaVercelHandler.status);
    const viaVercelVehicle = (await viaVercelHandler.json()).vehicle;
    if (viaVercelVehicle.legacyItemId !== vehicle.legacyItemId) throw new Error('Adapters returned different listing IDs.');
    if (viaVercelHandler.headers.get('cache-control') !== 'no-store') throw new Error('Vercel handler missing no-store.');
    console.log(JSON.stringify({ liveImport: 'passed', localHttp: 'passed', vercelHandlerLocally: 'passed', noStore: imported.headers.get('cache-control'), imageCount: vehicle.images.length, specificationCount: vehicle.itemSpecifics.length, hasDescription: Boolean(vehicle.description), mileageUnitReturned: Boolean(vehicle.mileage?.unit), demoUrl: vehicle.sourceUrl }));
    success = true;
    break;
  }
  if (!success) throw new Error('None of the test candidates passed vehicle validation.');
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
