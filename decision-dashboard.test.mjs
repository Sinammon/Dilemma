import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

test('React dashboard responds to priorities, reset, imports, removal, warnings and clearing', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { act } = React;
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  const root = createRoot(document.getElementById('root'));
  const originalFetch = globalThis.fetch;
  try {
    const { default: App } = await vite.ssrLoadModule('/src/App.jsx');
    await act(async () => root.render(React.createElement(App)));
    assert.match(document.querySelector('.recommendation-panel').textContent, /Import up to four/);
    const change = async (selector, value) => {
      const input = document.querySelector(selector);
      await act(async () => {
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, String(value));
        input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
        input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
      });
    };
    const add = async (id, price, year, description = '') => {
      globalThis.fetch = async () => new Response(JSON.stringify({ vehicle: {
        legacyItemId: id, title: `Fictional ${id}`, priceCAD: { value: String(price), currency: 'CAD' }, year: String(year),
        mileage: { raw: '100000', unit: 'km' }, images: [], itemSpecifics: [], description, sourceUrl: `https://www.ebay.ca/itm/${id}`,
      } }), { headers: { 'Content-Type': 'application/json' } });
      await change('#listing-url', `https://www.ebay.ca/itm/${id}`);
      await act(async () => document.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
    };
    await add('111111111111', 10000, 2016);
    assert.match(document.querySelector('.recommendation-panel').textContent, /Provisional/);
    await add('222222222222', 20000, 2021);
    assert.equal(document.querySelector('.recommendation-panel h3').textContent, 'Fictional 111111111111');
    await change('#priority-price', 0);
    assert.equal(document.querySelector('#priority-price').value, '0');
    assert.equal(document.querySelector('.recommendation-panel h3').textContent, 'Fictional 222222222222');
    await act(async () => document.querySelector('.priority-panel button').click());
    assert.equal(document.querySelector('.recommendation-panel h3').textContent, 'Fictional 111111111111');
    await add('333333333333', 100, 2025, 'Engine problems. Coolant leak. Not running.');
    assert.equal(document.querySelectorAll('.warning-details b').length, 3);
    assert.equal(document.querySelector('.ranking-row:last-child h3').textContent, 'Fictional 333333333333');
    await add('444444444444', 25000, 2023);
    assert.equal(document.querySelectorAll('.ranking-row').length, 4);
    assert.equal(document.querySelector('.url-form button').disabled, true);
    assert.equal(document.querySelectorAll('.car-card').length, 4);
    assert.equal(document.querySelectorAll('.table-scroll table')[0].querySelectorAll('thead th').length, 5);
    await act(async () => document.querySelector('.remove-button').click());
    assert.equal(document.querySelectorAll('.ranking-row').length, 3);
    assert.equal(document.querySelector('.url-form button').disabled, false);
    await act(async () => document.querySelector('.section-heading button').click());
    assert.equal(document.querySelectorAll('.ranking-row').length, 0);
    assert.match(document.querySelector('.recommendation-panel').textContent, /Import up to four/);
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
