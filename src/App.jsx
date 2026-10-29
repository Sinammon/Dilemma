import React, { useState } from 'react';
import { readImportResponse } from './import-response.js';
import DecisionDashboard from './DecisionDashboard.jsx';

const show = value => Array.isArray(value) ? value.join(', ') || 'Not provided' : value || 'Not provided';
function price(car) {
  const p = car.priceCAD ?? car.returnedPrice;
  if (!p?.value || !p.currency) return 'Price not provided';
  const amount = Number(p.value);
  return Number.isFinite(amount) ? `${new Intl.NumberFormat('en-CA', { maximumFractionDigits: 2 }).format(amount)} ${p.currency}` : `${p.value} ${p.currency}`;
}
function mileage(car) {
  if (!car.mileage) return 'Not provided';
  const raw = show(car.mileage.raw);
  const unit = car.mileage.unit;
  if (!unit) return `${raw} (unit not provided)`;
  return raw.toLowerCase().includes(String(unit).toLowerCase()) ? raw : `${raw} ${show(unit)}`;
}
const location = car => [car.location?.city, car.location?.stateOrProvince, car.location?.postalCode, car.location?.country].filter(Boolean).join(', ') || 'Not provided';
const safeUrl = value => { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : null; } catch { return null; } };

function VehicleImage({ car }) {
  const [index, setIndex] = useState(0);
  const url = safeUrl(car.images[index]);
  return <div className="vehicle-image">{url ? <img src={url} alt={car.title || 'Vehicle listing'} referrerPolicy="no-referrer" onError={() => setIndex(i => i + 1)} /> : <div className="image-placeholder"><span aria-hidden="true">◇</span>Image unavailable</div>}
    <span className="source-pill">eBay listing</span>
    {car.images.length > 1 && url && <button className="photo-next" aria-label={`Next photo of ${car.title}`} onClick={() => setIndex(i => (i + 1) % car.images.length)}>›</button>}
  </div>;
}

export default function App() {
  // React state is temporary: refreshing the page clears this comparison.
  const [cars, setCars] = useState([]);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
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
      setUrl(''); setNotice('Listing imported. Scroll down to compare the details.');
    } catch (err) { setError(err.name === 'TimeoutError' ? 'eBay took too long to respond. Please try again.' : err instanceof TypeError ? 'Could not connect to Dilemma. Please check your connection and try again.' : err.message); }
    finally { setLoading(false); }
  }
  const rows = [
    ['Price', price], ['Year', car => show(car.year)], ['Make', car => show(car.make)], ['Model', car => show(car.model)],
    ['Mileage', mileage], ['Condition', car => show(car.condition)], ['Location', location], ['VIN', car => show(car.vin)],
  ];
  const aspectNames = [...new Set(cars.flatMap(car => car.itemSpecifics.map(a => a.name).filter(Boolean)))];
  return <div className="site-shell">
    <header className="site-header"><a className="brand" href="#" aria-label="Dilemma home"><span className="brand-mark">d.</span>Dilemma<span className="brand-dot">.</span></a><nav aria-label="Main navigation"><a href="#how-it-works">How it works</a><a className="nav-button" href="#comparison">Your comparison <span>{cars.length}/4</span></a></nav></header>
    <main>
      <section className="hero">
        <div className="hero-copy"><p className="eyebrow"><span /> A clearer road to your next car</p><h1>Stop searching.<br /><span>Start deciding.</span></h1><p className="hero-description">Your shortlist, all in one place. Bring up to four eBay.ca used-car listings together and see the details side by side.</p>
          <form className="url-form" onSubmit={handleSubmit} aria-busy={loading}><label htmlFor="listing-url">Found a contender? Paste its eBay.ca link.</label><div className="input-row"><input id="listing-url" type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.ebay.ca/itm/..." required maxLength={2048} disabled={loading || cars.length >= 4} aria-describedby="input-note import-error" /><button disabled={loading || cars.length >= 4} type="submit">{loading ? 'Importing…' : cars.length >= 4 ? 'Shortlist full' : 'Import car'} {!loading && <span>→</span>}</button></div><p id="input-note" className="input-note">{cars.length}/4 cars added · Temporary comparison · No account needed</p><p id="import-error" role="alert" className="error-message">{error}</p><p role="status" className="form-message">{loading ? 'Connecting to eBay and bringing in the listing details…' : notice}</p></form>
        </div>
        <div className="hero-art"><div className="art-topline"><span>LESS GUESSWORK. MORE CLARITY.</span><span>↗</span></div><p className="art-heading">Your next<br /><em>chapter.</em></p><svg className="car-scene" viewBox="0 0 520 310" role="img" aria-label="Blue car on the road ahead"><ellipse cx="268" cy="267" rx="199" ry="22" fill="#bdcbed"/><path d="M-20 310 Q130 175 250 274 T560 245" fill="none" stroke="#fff" strokeWidth="42" opacity=".65"/><path d="M-20 310 Q130 175 250 274 T560 245" fill="none" stroke="#a3b5dd" strokeWidth="2" strokeDasharray="12 14"/><path d="M84 194 132 126 Q142 112 161 112 H305 Q326 112 344 133 L394 180 439 196 Q450 200 450 215 V243 H67 V215 Q67 199 84 194Z" fill="#2458e6"/><path d="m148 132-36 53h107v-53ZM232 132v53h135l-50-47q-6-6-16-6Z" fill="#dcecff"/><path d="M76 211h31M412 211h28" stroke="#e1efff" strokeWidth="9" strokeLinecap="round"/><path d="M182 202h20m58 0h20" stroke="#173caa" strokeWidth="5" strokeLinecap="round"/><circle cx="143" cy="241" r="34" fill="#172e57"/><circle cx="143" cy="241" r="17" fill="#e0e9fa"/><circle cx="369" cy="241" r="34" fill="#172e57"/><circle cx="369" cy="241" r="17" fill="#e0e9fa"/></svg><div className="art-bottomline"><span>A little clarity. A lot of possibility.</span><span>✦</span></div></div>
      </section>
      <section id="how-it-works" className="steps" aria-label="How it works">{[['01', 'Find your contenders', 'Copy a used-car listing link from eBay.ca.'], ['02', 'Bring them together', 'Import up to four cars into your shortlist.'], ['03', 'See the whole picture', 'Compare seller details. You make the call.']].map(([n,title,text]) => <div key={n}><span className="step-number">{n}</span><div><h3>{title}</h3><p>{text}</p></div></div>)}</section>
      <DecisionDashboard cars={cars} />
      <section id="comparison" className="comparison-section"><div className="section-heading"><div><p className="eyebrow">YOUR NEXT MOVE STARTS HERE</p><h2>Your shortlist<span className="count">{cars.length} / 4</span></h2></div>{cars.length > 0 && <button className="text-button" onClick={() => { setCars([]); setNotice('Comparison cleared.'); }}>Clear comparison</button>}</div>
        {cars.length === 0 ? <div className="empty-state"><span className="empty-icon" aria-hidden="true">⇄</span><h3>Good decisions start with a little perspective.</h3><p>Import your first car above. Its photos, price and seller details will appear here.</p><a href="#listing-url">Add your first contender <span>↗</span></a></div> : <>
          <div className="car-grid" style={{ '--columns': Math.min(cars.length, 4) }}>{cars.map((car, i) => <article className="car-card" key={car.legacyItemId}><VehicleImage car={car}/><div className="car-card-body"><div className="card-topline"><span>CONTENDER {String(i + 1).padStart(2, '0')}</span><button className="remove-button" aria-label={`Remove ${car.title || 'car'}`} onClick={() => { setCars(prev => prev.filter(c => c.legacyItemId !== car.legacyItemId)); setNotice('Car removed from comparison.'); }}>×</button></div><h3>{show(car.title)}</h3><p className="car-price">{price(car)}</p><p className="car-meta">{mileage(car)} · {show(car.condition)}</p><p className="car-meta">{location(car)}</p><a className="source-link" href={car.sourceUrl} target="_blank" rel="noopener noreferrer">View original on eBay ↗</a></div></article>)}</div>
          <div className="table-heading"><h3>The details, side by side</h3><p>Seller-provided information. Missing details stay marked as “Not provided”.</p></div><div className="table-scroll" role="region" aria-label="Vehicle comparison table, scroll horizontally on small screens" tabIndex={0}><table><caption className="sr-only">Comparison of imported eBay vehicle listings</caption><thead><tr><th scope="col">At a glance</th>{cars.map((car,i) => <th key={car.legacyItemId} scope="col"><small>CONTENDER {i + 1}</small>{[car.year,car.make,car.model].filter(Boolean).map(show).join(' ') || car.title || 'Vehicle'}</th>)}</tr></thead><tbody>{rows.map(([label, fn]) => <tr key={label}><th scope="row">{label}</th>{cars.map(car => <td key={car.legacyItemId}>{fn(car)}</td>)}</tr>)}</tbody></table></div>
          <details className="specifics"><summary>All available vehicle specifications</summary><div className="table-scroll" tabIndex={0}><table><thead><tr><th scope="col">Seller specification</th>{cars.map((car,i) => <th scope="col" key={car.legacyItemId}>Contender {i + 1}</th>)}</tr></thead><tbody>{aspectNames.length ? aspectNames.map(name => <tr key={name}><th scope="row">{name}</th>{cars.map(car => <td key={car.legacyItemId}>{show(car.itemSpecifics.filter(a => a.name === name).map(a => a.value).filter(Boolean))}</td>)}</tr>) : <tr><td colSpan={cars.length+1}>No additional specifications were provided.</td></tr>}</tbody></table></div></details>
          <h3 className="description-heading">From the sellers</h3><div className="description-grid">{cars.map((car,i) => <details key={car.legacyItemId}><summary>Contender {i + 1} · Seller description</summary><p>{car.description || 'The seller description was not returned by eBay.'}</p></details>)}</div>
          <p className="data-note">Source: eBay. Details reflect what eBay returned at import time and may change. Confirm vehicle identity and details with the seller. No mileage units or missing specifications are assumed.</p>
        </>}
      </section>
    </main><footer><a className="footer-brand" href="#">Dilemma.</a><span>Made for the road ahead.</span><span className="prototype-label">Powered by eBay listing data · Refreshing clears your shortlist</span></footer>
  </div>;
}
