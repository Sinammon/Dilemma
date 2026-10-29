import React, { useEffect, useState } from 'react';
import { readImportResponse } from './import-response.js';
import DecisionDashboard from './DecisionDashboard.jsx';
import VehicleComparison from './VehicleComparison.jsx';

const route = () => ['compare', 'decide'].includes(window.location.hash.slice(1)) ? window.location.hash.slice(1) : 'import';
export default function App() {
  // One owner keeps imported data in memory across all three pages.
  const [cars, setCars] = useState([]);
  const [page, setPage] = useState(route);
  const [mode, setMode] = useState('value');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const onHashChange = () => setPage(route());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  useEffect(() => {
    document.querySelector('main h1')?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [page]);
  function navigate(next) { window.location.hash = next; setPage(next); }
  async function handleSubmit(event) {
    event.preventDefault();
    if (loading || cars.length >= 4) return;
    setError(''); setNotice('');
    let id;
    try {
      const parsed = new URL(url.trim());
      if (!['ebay.ca', 'www.ebay.ca', 'm.ebay.ca'].includes(parsed.hostname)) throw new Error();
      id = parsed.pathname.match(/\/(\d{9,15})\/?$/)?.[1];
    } catch { setError('Paste a full eBay.ca vehicle listing URL.'); return; }
    if (id && cars.some(car => car.legacyItemId === id)) { setError('That car is already in your comparison.'); return; }
    setLoading(true);
    try {
      const response = await fetch('/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url.trim() }), cache: 'no-store', signal: AbortSignal.timeout(70000) });
      const data = await readImportResponse(response);
      setCars(previous => previous.some(car => car.legacyItemId === data.vehicle.legacyItemId) ? previous : [...previous, data.vehicle].slice(0, 4));
      setUrl(''); setNotice('Listing imported. Compare the available seller details below.');
      navigate('compare');
    } catch (err) { setError(err.name === 'TimeoutError' ? 'eBay took too long to respond. Please try again.' : err instanceof TypeError ? 'Could not connect to Dilemma. Please check your connection and try again.' : err.message); }
    finally { setLoading(false); }
  }
  const importForm = <form className="url-form" onSubmit={handleSubmit} aria-busy={loading}><label htmlFor="listing-url">{cars.length ? 'Add another contender. Paste its eBay.ca link.' : 'Found a contender? Paste its eBay.ca link.'}</label><div className="input-row"><input id="listing-url" type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.ebay.ca/itm/..." required maxLength={2048} disabled={loading || cars.length >= 4} aria-describedby="input-note import-error" /><button disabled={loading || cars.length >= 4} type="submit">{loading ? 'Importing…' : cars.length >= 4 ? 'Shortlist full' : 'Import car →'}</button></div><p id="input-note" className="input-note">{cars.length}/4 cars added · In memory only · No account needed</p><p id="import-error" role="alert" className="error-message">{error}</p><p role="status" className="form-message">{loading ? 'Connecting to eBay and bringing in listing details…' : notice}</p></form>;
  return <div className="site-shell">
    <header className="site-header"><a className="brand" href="#import" aria-label="Dilemma home"><span className="brand-mark">d.</span>Dilemma<span className="brand-dot">.</span></a><nav aria-label="Main navigation"><a href="#import" aria-current={page === 'import' ? 'page' : undefined}>Import</a><a href="#compare" aria-current={page === 'compare' ? 'page' : undefined}>Compare <span className="nav-count">{cars.length}/4</span></a><a href="#decide" aria-current={page === 'decide' ? 'page' : undefined}>Decide</a></nav></header>
    <div className="workflow" aria-label="Your progress">{[['import', '01', 'Import'], ['compare', '02', 'Compare'], ['decide', '03', 'Decide']].map(([id, n, label]) => <a href={`#${id}`} key={id} aria-current={page === id ? 'step' : undefined}><span>{n}</span>{label}</a>)}</div>
    <main>
      {page === 'import' && <><section className="hero"><div className="hero-copy"><p className="eyebrow"><span /> A clearer road to your next car</p><h1 tabIndex={-1}>Stop searching.<br /><span>Start deciding.</span></h1><p className="hero-description">Four contenders. One clearer decision. Bring real eBay.ca listings together, compare the facts and find a match for what matters to you.</p>{importForm}{!!cars.length && <a className="source-link" href="#compare">Return to your comparison →</a>}</div><div className="hero-art"><div className="art-topline"><span>LESS GUESSWORK. MORE CLARITY.</span><span>↗</span></div><p className="art-heading">Your next<br /><em>chapter.</em></p><svg className="car-scene" viewBox="0 0 520 310" role="img" aria-label="Blue car on the road ahead"><ellipse cx="268" cy="267" rx="199" ry="22" fill="#bdcbed"/><path d="M-20 310 Q130 175 250 274 T560 245" fill="none" stroke="#fff" strokeWidth="42" opacity=".65"/><path d="M84 194 132 126 Q142 112 161 112 H305 Q326 112 344 133 L394 180 439 196 Q450 200 450 215 V243 H67 V215 Q67 199 84 194Z" fill="#2458e6"/><path d="m148 132-36 53h107v-53ZM232 132v53h135l-50-47q-6-6-16-6Z" fill="#dcecff"/><circle cx="143" cy="241" r="34" fill="#172e57"/><circle cx="143" cy="241" r="17" fill="#e0e9fa"/><circle cx="369" cy="241" r="34" fill="#172e57"/><circle cx="369" cy="241" r="17" fill="#e0e9fa"/></svg><div className="art-bottomline"><span>A little clarity. A lot of possibility.</span><span>✦</span></div></div></section><section className="steps" aria-label="How it works">{[['01', 'Import real listings', 'Add up to four eBay.ca used vehicles.'], ['02', 'Compare the facts', 'See seller details and missing information.'], ['03', 'Decide your way', 'Six modes. Clear reasons and trade-offs.']].map(([n, title, text]) => <div key={n}><span className="step-number">{n}</span><div><h2>{title}</h2><p>{text}</p></div></div>)}</section></>}
      {page === 'compare' && <VehicleComparison cars={cars} importForm={importForm} navigate={navigate} removeCar={id => { setCars(previous => previous.filter(car => car.legacyItemId !== id)); setNotice('Car removed. You can import a replacement.'); }} clearCars={() => { setCars([]); setNotice('Comparison cleared.'); }} />}
      {page === 'decide' && <DecisionDashboard cars={cars} mode={mode} setMode={setMode} />}
    </main><footer><a className="footer-brand" href="#import">Dilemma.</a><span>Made for the road ahead.</span><span className="prototype-label">Seller claims, clearly compared · Refresh clears your shortlist</span></footer>
  </div>;
}
