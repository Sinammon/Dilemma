import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';

test('three-page journey preserves imports, supports all modes, removes and replaces cars, and handles unknown data', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', pretendToBeVisual: true });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.SVGElement = dom.window.SVGElement;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
  globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
  // Use the accessible no-animation path for deterministic functional tests.
  dom.window.matchMedia = query => ({ matches: query.includes('prefers-reduced-motion'), media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  dom.window.Element.prototype.scrollIntoView = () => {};
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.scrollTo = () => {};
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { act } = React;
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const root = createRoot(document.getElementById('root'));
  const originalFetch = globalThis.fetch;
  try {
    const { default: App } = await vite.ssrLoadModule('/src/App.jsx');
    await act(async () => root.render(React.createElement(App)));
    assert.match(document.querySelector('h1').textContent, /Find the right car/);
    assert.equal(document.querySelector('.mode-grid'), null);
    assert.equal(document.querySelectorAll('.preview-vehicle').length, 4);
    assert.equal(document.querySelectorAll('.car-card').length, 0);
    const clickPreview = async selector => act(async () => {
      document.querySelector(selector).click();
      await new Promise(resolve => setTimeout(resolve, 50));
    });
    await clickPreview('.preview-advance');
    assert.match(document.querySelector('.showcase-comparison').textContent, /Civic.*Corolla.*Mazda3/);
    await clickPreview('.preview-advance');
    assert.equal(document.querySelector('.preview-match h3').textContent, '2018 Honda Civic');
    await clickPreview('.sample-priorities button:nth-child(2)');
    assert.equal(document.querySelector('.preview-match h3').textContent, '2017 Mazda3');
    await clickPreview('.preview-advance');
    assert.equal(document.activeElement.id, 'listing-url');
    assert.equal(document.querySelectorAll('.car-card').length, 0, 'sample data never enters the real shortlist');
    const change = async (selector, value) => {
      const input = document.querySelector(selector);
      await act(async () => {
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, String(value));
        input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      });
    };
    const go = async page => {
      await act(async () => {
        window.location.hash = page;
        window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));
        await new Promise(resolve => setTimeout(resolve, 10));
      });
    };
    const submit = async () => act(async () => {
      document.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    const add = async (id, price, year, description = '', unit = 'km') => {
      globalThis.fetch = async () => new Response(JSON.stringify({ vehicle: {
        legacyItemId: id, title: `SELLER HEADLINE ${id}`, make: 'Example', model: id.slice(0, 1), priceCAD: { value: String(price), currency: 'CAD' }, year: String(year),
        mileage: { raw: '100000', unit }, images: ['https://images.example.test/front.jpg', 'https://images.example.test/rear.jpg'], itemSpecifics: [], description, sourceUrl: `https://www.ebay.ca/itm/${id}`,
      } }), { headers: { 'Content-Type': 'application/json' } });
      await change('#listing-url', `https://www.ebay.ca/itm/${id}`);
      await submit();
    };
    await change('#listing-url', 'https://example.com/itm/111111111111');
    await submit();
    assert.match(document.querySelector('#import-error').textContent, /eBay.ca/);
    assert.notEqual(window.location.hash, '#compare');
    await add('111111111111', 10000, 2016, 'Odometer: 100k kms. Heated seats.', null);
    assert.equal(window.location.hash, '#compare');
    assert.equal(document.querySelector('h1').textContent, 'Compare Your Vehicles');
    assert.equal(document.querySelector('.vehicle-name').textContent, '2016 Example 1');
    assert.match(document.querySelector('.car-meta').textContent, /100000 km/);
    assert.match(document.querySelector('.car-meta').textContent, /Seller-reported unit/);
    assert.equal(document.querySelector('.vehicle-image img').getAttribute('src'), 'https://images.example.test/front.jpg');
    await act(async () => document.querySelector('.photo-next').click());
    assert.equal(document.querySelector('.vehicle-image img').getAttribute('src'), 'https://images.example.test/rear.jpg');
    await act(async () => document.querySelector('.photo-next').click());
    assert.equal(document.querySelector('.vehicle-image img').getAttribute('src'), 'https://images.example.test/front.jpg');
    assert.equal(document.querySelectorAll('table:first-of-type tbody tr').length >= 2, true);
    assert.equal(document.querySelectorAll('.table-scroll')[0].querySelectorAll('tbody tr').length, 2, 'fully unknown specification rows are omitted');
    assert.match(document.querySelector('.shared-gaps').textContent, /Transmission/);
    assert.equal(document.querySelectorAll('.feature-evidence > div').length, 1, 'only explicit amenity claims appear');
    assert.equal(document.querySelector('.mode-grid'), null);
    await add('222222222222', 20000, 2021, 'No heated seats.', null);
    assert.equal(document.querySelectorAll('.car-card').length, 2);
    assert.match(document.querySelector('tbody').textContent, /Unit unknown/);
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error('Should not fetch duplicate'); };
    await change('#listing-url', 'https://www.ebay.ca/itm/111111111111');
    await submit();
    assert.equal(calls, 0);
    assert.match(document.querySelector('#import-error').textContent, /already/);
    await act(async () => {
      document.querySelector('.decide-cta button').click();
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    assert.equal(document.querySelector('h1').textContent, "Let's Find Your Best Match");
    assert.equal(window.location.hash, '#decide');
    await act(async () => document.querySelector('.skip-link').click());
    assert.equal(window.location.hash, '#decide', 'skip navigation preserves the current stage');
    assert.equal(document.activeElement.id, 'main-content');
    assert.equal(document.querySelectorAll('input[type="range"]').length, 0);
    assert.equal(document.querySelectorAll('.mode-grid .mode-card').length, 4);
    assert.equal(document.querySelectorAll('.mode-card').length, 6);
    assert.equal(document.querySelector('.best-match h2').textContent, '2016 Example 1');
    await act(async () => document.querySelector('.mode-card[data-mode="practical"]').click());
    assert.equal(document.querySelector('.best-match h2').textContent, '2021 Example 2');
    await act(async () => document.querySelector('.mode-card[data-mode="performance"]').click());
    assert.equal(document.querySelector('.decision-match').dataset.basis, 'starting-point');
    assert.match(document.querySelector('.decision-reason').textContent, /starting point/);
    await act(async () => document.querySelector('.mode-card[data-mode="comfort"]').click());
    assert.equal(document.querySelector('.best-match h2').textContent, '2016 Example 1');
    await go('compare');
    await add('333333333333', 100, 2025, 'Engine problems. Coolant leak. Not running.');
    await go('decide');
    await act(async () => document.querySelector('.mode-card[data-mode="cost"]').click());
    assert.equal(document.querySelector('.best-match h2').textContent, '2025 Example 3');
    assert.equal(document.querySelectorAll('.best-match .warning-details b').length, 3);
    await act(async () => document.querySelector('.mode-card[data-mode="value"]').click());
    assert.notEqual(document.querySelector('.best-match h2').textContent, '2025 Example 3');
    assert.equal(document.querySelector('.ranking-row:last-child h3').textContent, '2025 Example 3');
    await act(async () => document.querySelector('.mode-card[data-mode="balanced"]').click());
    assert.equal(document.querySelector('.mode-card[data-mode="balanced"]').getAttribute('aria-pressed'), 'true');
    await go('compare');
    await add('444444444444', 25000, 2023);
    assert.equal(document.querySelectorAll('.car-card').length, 4);
    assert.equal(document.querySelector('.url-form button').disabled, true);
    assert.equal(document.querySelector('table thead').querySelectorAll('th').length, 5);
    await act(async () => document.querySelector('.remove-button').click());
    assert.equal(document.querySelectorAll('.car-card').length, 3);
    assert.equal(document.querySelector('.url-form button').disabled, false);
    await add('555555555555', 15000, 2020);
    assert.equal(document.querySelectorAll('.car-card').length, 4);
    assert.equal(document.querySelector('.vehicle-name').textContent, '2021 Example 2');
    await go('decide');
    assert.equal(document.querySelectorAll('.ranking-row').length, 4);
    assert.equal(document.querySelector('.mode-card[data-mode="balanced"]').getAttribute('aria-pressed'), 'true');
    await go('compare');
    await act(async () => document.querySelector('.section-heading button').click());
    assert.equal(document.querySelectorAll('.car-card').length, 0);
    await go('decide');
    assert.match(document.querySelector('.result-banner').textContent, /shortlist comes first/);
    // A new app instance behaves like refresh: no browser storage is used.
    await act(async () => root.render(null));
    await act(async () => root.render(React.createElement(App)));
    assert.equal(document.querySelectorAll('.ranking-row').length, 0);
    // A late VIN response must not bring back a removed car or overwrite a replacement.
    await go('compare');
    let finishVin, importCount = 0;
    const pendingVin = new Promise(resolve => { finishVin = resolve; });
    globalThis.fetch = async input => {
      if (input === '/api/vehicle-data') return pendingVin;
      if (String(input).startsWith('/data/fuel/')) return Response.json({ columns: [], rows: [] });
      importCount++;
      return Response.json({ vehicle: { legacyItemId: '666666666666', year: importCount === 1 ? '2003' : '2020', make: 'Example', model: importCount === 1 ? 'Original' : 'Replacement', vin: importCount === 1 ? '1HGCM82633A004352' : null, images: [], itemSpecifics: [] } });
    };
    await change('#listing-url', 'https://www.ebay.ca/itm/666666666666');
    await submit();
    assert.match(document.querySelector('.source-status').textContent, /Checking VIN/);
    await act(async () => document.querySelector('.remove-button').click());
    await change('#listing-url', 'https://www.ebay.ca/itm/666666666666');
    await submit();
    assert.equal(document.querySelector('.vehicle-name').textContent, '2020 Example Replacement');
    await act(async () => {
      finishVin(Response.json({ vin: { status: 'decoded', fields: { year: '2003', make: 'Example', model: 'Original' } } }));
      await new Promise(resolve => setTimeout(resolve, 40));
    });
    assert.equal(document.querySelectorAll('.car-card').length, 1);
    assert.equal(document.querySelector('.vehicle-name').textContent, '2020 Example Replacement');
    // Demo is explicit, uses only public bundled reference files, and supports sparse data.
    await act(async () => document.querySelector('.section-heading button').click());
    const demoRequests = [];
    globalThis.fetch = async url => {
      demoRequests.push(url);
      assert.match(url, /^\/data\/fuel\//);
      return Response.json(JSON.parse(await readFile(`public${url}`, 'utf8')));
    };
    await act(async () => {
      document.querySelector('.demo-entry button').click();
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    assert.equal(document.querySelectorAll('.car-card').length, 3);
    assert.equal(demoRequests.length, 3);
    assert.match(document.querySelector('.demo-notice').textContent, /fictional/);
    assert.match(document.querySelector('.source-status-grid').textContent, /Documented original specifications.*Seller-reported claims.*Typical model information.*Still to verify on this car/s);
    assert.ok(document.querySelector('.model-research a[href="https://www.caranddriver.com/honda/civic-2018"]'));
    assert.equal(document.querySelector('.table-scroll').querySelectorAll('tbody tr').length, 7);
    await go('decide');
    await act(async () => document.querySelector('.mode-card[data-mode="performance"]').click());
    assert.equal(document.querySelector('.decision-match').dataset.basis, 'starting-point');
    assert.match(document.querySelector('.decision-reason').textContent, /starting point/);
    assert.equal(document.querySelectorAll('.research-guidance-grid > article').length, 3);
    assert.equal(document.querySelectorAll('.research-next-step').length, 2);
    assert.match(document.querySelector('.decision-research').textContent, /General AI web research is not connected/);
    assert.match(document.querySelector('.score-basis').textContent, /not a score for the selected priority/);
    await act(async () => document.querySelector('.mode-card[data-mode="comfort"]').click());
    assert.match(document.querySelector('.decision-research').textContent, /sound isolation/);
    await act(async () => document.querySelector('.mode-card[data-mode="value"]').click());
    assert.ok(document.querySelector('.best-match'));
    assert.match(document.querySelector('.score-parts').textContent, /Seller-reported/);
    const beforeLookup = document.querySelector('.decision-match h2').textContent;
    let recallCalls = 0;
    globalThis.fetch = async (url, options) => {
      recallCalls++;
      assert.equal(url, '/api/recalls');
      assert.equal(options.cache, 'no-store');
      assert.deepEqual(Object.keys(JSON.parse(options.body)).sort(), ['make', 'model', 'year']);
      return Response.json({ recalls: { status: 'available', count: 0, campaigns: [], checked: '2026-10-29T12:00:00Z' } });
    };
    await act(async () => {
      document.querySelector('.recall-research button').click();
      await new Promise(resolve => setTimeout(resolve, 20));
    });
    assert.equal(recallCalls, 1);
    assert.match(document.querySelector('.recall-research [role="status"]').textContent, /does not establish.*recall-free/);
    assert.equal(document.querySelector('.decision-match h2').textContent, beforeLookup, 'recalls do not alter ranking');
    globalThis.fetch = async () => { throw new TypeError('offline'); };
    await act(async () => {
      document.querySelector('.recall-research button').click();
      await new Promise(resolve => setTimeout(resolve, 20));
    });
    assert.match(document.querySelector('.recall-research [role="status"]').textContent, /Lookup unavailable/);

  } finally {
    await act(async () => root.unmount());
    await new Promise(resolve => setTimeout(resolve, 50));
    await vite.close();
    dom.window.close();
    globalThis.fetch = originalFetch;
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.HTMLElement;
    delete globalThis.Element;
    delete globalThis.SVGElement;
    delete globalThis.getComputedStyle;
    delete globalThis.requestAnimationFrame;
    delete globalThis.cancelAnimationFrame;
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
