import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

test('three-page journey preserves imports, supports all modes, removes and replaces cars, and handles unknown data', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.scrollTo = () => {};
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { act } = React;
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  const root = createRoot(document.getElementById('root'));
  const originalFetch = globalThis.fetch;
  try {
    const { default: App } = await vite.ssrLoadModule('/src/App.jsx');
    await act(async () => root.render(React.createElement(App)));
    assert.match(document.querySelector('h1').textContent, /Start deciding/);
    assert.equal(document.querySelector('.mode-grid'), null);
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
        mileage: { raw: '100000', unit }, images: [], itemSpecifics: [], description, sourceUrl: `https://www.ebay.ca/itm/${id}`,
      } }), { headers: { 'Content-Type': 'application/json' } });
      await change('#listing-url', `https://www.ebay.ca/itm/${id}`);
      await submit();
    };
    await change('#listing-url', 'https://example.com/itm/111111111111');
    await submit();
    assert.match(document.querySelector('#import-error').textContent, /eBay.ca/);
    assert.notEqual(window.location.hash, '#compare');
    await add('111111111111', 10000, 2016, 'Odometer: 100000 kilometres. Heated seats.', null);
    assert.equal(window.location.hash, '#compare');
    assert.equal(document.querySelector('h1').textContent, 'Compare Your Vehicles');
    assert.equal(document.querySelector('.vehicle-name').textContent, '2016 Example 1');
    assert.match(document.querySelector('.car-meta').textContent, /100000 km/);
    assert.match(document.querySelector('tbody').textContent, /TransmissionUnknownFuel typeUnknown/);
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
    assert.equal(document.querySelectorAll('input[type="range"]').length, 0);
    assert.equal(document.querySelectorAll('.mode-card').length, 6);
    assert.equal(document.querySelector('.best-match h2').textContent, '2016 Example 1');
    await act(async () => document.querySelectorAll('.mode-card')[2].click());
    assert.equal(document.querySelector('.best-match h2').textContent, '2021 Example 2');
    await act(async () => document.querySelectorAll('.mode-card')[3].click());
    assert.equal(document.querySelector('.best-match'), null);
    assert.match(document.querySelector('.result-banner').textContent, /trustworthy performance recommendation cannot be made/);
    await act(async () => document.querySelectorAll('.mode-card')[4].click());
    assert.equal(document.querySelector('.best-match h2').textContent, '2016 Example 1');
    await go('compare');
    await add('333333333333', 100, 2025, 'Engine problems. Coolant leak. Not running.');
    await go('decide');
    await act(async () => document.querySelectorAll('.mode-card')[1].click());
    assert.equal(document.querySelector('.best-match h2').textContent, '2025 Example 3');
    assert.equal(document.querySelectorAll('.best-match .warning-details b').length, 3);
    await act(async () => document.querySelectorAll('.mode-card')[0].click());
    assert.notEqual(document.querySelector('.best-match h2').textContent, '2025 Example 3');
    assert.equal(document.querySelector('.ranking-row:last-child h3').textContent, '2025 Example 3');
    await act(async () => document.querySelectorAll('.mode-card')[5].click());
    assert.equal(document.querySelectorAll('.mode-card')[5].getAttribute('aria-pressed'), 'true');
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
    assert.equal(document.querySelectorAll('.mode-card')[5].getAttribute('aria-pressed'), 'true');
    await go('compare');
    await act(async () => document.querySelector('.section-heading button').click());
    assert.equal(document.querySelectorAll('.car-card').length, 0);
    await go('decide');
    assert.match(document.querySelector('.result-banner').textContent, /shortlist comes first/);
    // A new app instance behaves like refresh: no browser storage is used.
    await act(async () => root.render(null));
    await act(async () => root.render(React.createElement(App)));
    assert.equal(document.querySelectorAll('.ranking-row').length, 0);
  } finally {
    await act(async () => root.unmount());
    await vite.close();
    dom.window.close();
    globalThis.fetch = originalFetch;
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.HTMLElement;
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
