import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

test('preview is manual, guards rapid navigation, supports keyboard steps and keeps priorities illustrative', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', pretendToBeVisual: true });
  const globals = ['window', 'document', 'HTMLElement', 'Element', 'SVGElement'];
  for (const name of globals) globalThis[name] = dom.window[name];
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
  globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.matchMedia = query => ({ matches: false, media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  let hidden = false;
  Object.defineProperty(document, 'hidden', { get: () => hidden, configurable: true });
  const intervals = new Map();
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  globalThis.setInterval = (callback, delay, ...args) => {
    if (delay !== 5500) return originalSetInterval(callback, delay, ...args);
    const handle = {};
    intervals.set(handle, callback);
    return handle;
  };
  globalThis.clearInterval = handle => intervals.delete(handle) || originalClearInterval(handle);
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { LazyMotion, domAnimation } = await import('motion/react');
  const { act } = React;
  const root = createRoot(document.getElementById('root'));
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: Preview } = await vite.ssrLoadModule('/src/LandingPreview.jsx');
    await act(async () => root.render(React.createElement(LazyMotion, { features: domAnimation }, React.createElement(Preview, { onStart() {} }))));
    assert.equal(intervals.size, 0, 'there is no autoplay timer');
    assert.equal(document.querySelectorAll('.preview-vehicle').length, 4);
    assert.equal(document.querySelector('.preview-vehicle.selected strong').textContent, '2018 Honda Civic');
    const click = async selector => act(async () => {
      document.querySelector(selector).click();
      await new Promise(resolve => setTimeout(resolve, 620));
    });
    await act(async () => {
      const next = document.querySelector('.showcase-next');
      next.click(); next.click(); next.click();
      await new Promise(resolve => setTimeout(resolve, 620));
    });
    assert.equal(document.querySelector('[role="tab"][aria-selected="true"]').id, 'preview-step-1', 'rapid clicks advance one stage');
    assert.ok(document.querySelector('.showcase-comparison'));
    assert.equal(document.querySelectorAll('.showcase-comparison thead img').length, 3);
    await click('.showcase-previous');
    assert.equal(document.querySelector('[role="tab"][aria-selected="true"]').id, 'preview-step-0');
    await act(async () => {
      document.querySelector('#preview-step-0').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
      await new Promise(resolve => setTimeout(resolve, 620));
    });
    assert.equal(document.activeElement.id, 'preview-step-2');
    assert.equal(document.querySelectorAll('.sample-priorities button').length, 4);
    await click('.sample-priorities button:nth-child(3)');
    assert.equal(document.querySelector('.preview-match h3').textContent, '2019 Toyota Corolla');
    assert.match(document.querySelector('.match-reason').textContent, /fictional scenario/);
    assert.equal(document.querySelectorAll('.preview-match li').length, 2);
    assert.ok(document.querySelector('.match-tradeoff'));
    assert.match(document.querySelector('.showcase-disclaimer').textContent, /Fictional details/);
    assert.equal(intervals.size, 0);
    await click('.showcase-progress button:first-child');
    assert.equal(document.querySelector('[role="tab"][aria-selected="true"]').id, 'preview-step-0');
    assert.equal(document.querySelectorAll('[role="tabpanel"][aria-hidden="false"]').length, 1);

  } finally {
    await act(async () => root.unmount());
    await new Promise(resolve => setTimeout(resolve, 60));
    await vite.close();
    dom.window.close();
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
    for (const name of [...globals, 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'IS_REACT_ACT_ENVIRONMENT']) delete globalThis[name];
  }
});
