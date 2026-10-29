import React, { useEffect, useRef, useState } from 'react';
import { readImportResponse } from './import-response.js';
import { LazyMotion, domAnimation, m, MotionConfig, useReducedMotion } from 'motion/react';
import DecisionDashboard from './DecisionDashboard.jsx';
import VehicleComparison from './VehicleComparison.jsx';
import LandingPreview from './LandingPreview.jsx';
import Icon from './Icons.jsx';
import { enrichVehicle } from './enrichment.js';
import { makeDemoCars } from './demo-cars.js';

const route = () => ['compare', 'decide'].includes(window.location.hash.slice(1)) ? window.location.hash.slice(1) : 'import';
export default function App() {
  const reduced = useReducedMotion();
  // One owner keeps imported data in memory across all three pages.
  const [cars, setCars] = useState([]);
  const [page, setPage] = useState(route);
  const [mode, setMode] = useState('value');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const enrichmentTasks = useRef(new Set());
  useEffect(() => () => { for (const controller of enrichmentTasks.current) controller.abort(); }, []);
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
  function startImport() {
    navigate('import');
    requestAnimationFrame(() => {
      document.getElementById('listing-url')?.focus({ preventScroll: true });
      document.getElementById('listing-url')?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'center' });
    });
  }
  function showSteps() {
    navigate('import');
    requestAnimationFrame(() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'center' }));
  }
  function enrichImported(imported) {
    const controller = new AbortController();
    enrichmentTasks.current.add(controller);
    void enrichVehicle(imported, { signal: controller.signal }).then(enrichment => {
      if (!controller.signal.aborted) setCars(previous => previous.map(car => car === imported ? { ...car, enrichment } : car));
    }).catch(() => {
      if (!controller.signal.aborted) setCars(previous => previous.map(car => car === imported ? { ...car, enrichment: { status: 'unavailable' } } : car));
    }).finally(() => enrichmentTasks.current.delete(controller));
  }
  function loadDemo() {
    if (cars.length || loading) return;
    const demo = makeDemoCars().map(car => ({ ...car, enrichment: { status: 'loading' } }));
    setCars(demo);
    demo.forEach(enrichImported);
    setError(''); setNotice('Fictional demo loaded. No eBay request was made.');
    navigate('compare');
  }
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
      const imported = { ...data.vehicle, enrichment: { status: 'loading' } };
      setCars(previous => previous.some(car => car.legacyItemId === imported.legacyItemId) ? previous : [...previous, imported].slice(0, 4));
      enrichImported(imported);
      setUrl(''); setNotice('Listing imported. Compare the available seller details below.');
      navigate('compare');
    } catch (err) { setError(err.name === 'TimeoutError' ? 'eBay took too long to respond. Please try again.' : err instanceof TypeError ? 'Could not connect to Dilemma. Please check your connection and try again.' : err.message); }
    finally { setLoading(false); }
  }
  const importForm = <form className="url-form" onSubmit={handleSubmit} aria-busy={loading}>
    <label htmlFor="listing-url">{cars.length ? 'Add another car to your shortlist' : 'Your next car starts with a link'}</label>
    <div className="input-row"><Icon name="link" size={22} /><input id="listing-url" type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="Paste an eBay.ca car link…" required maxLength={2048} disabled={loading || cars.length >= 4} aria-invalid={!!error} aria-describedby="input-note import-error" /><button disabled={loading || cars.length >= 4} type="submit">{loading && <span className="loading-spinner" aria-hidden="true" />}{loading ? 'Importing…' : cars.length >= 4 ? 'Shortlist full' : 'Import car'}{!loading && cars.length < 4 && <Icon name="arrow" size={18} />}</button></div>
    <p id="input-note" className="input-note"><Icon name="check" size={14} /> No account needed <span>·</span> {cars.length ? `${cars.length}/4 cars added` : 'Compare up to 4 cars'}</p><p id="import-error" role="alert" className="error-message">{error}</p><p role="status" className="form-message">{loading ? 'Connecting to eBay and bringing in listing details…' : notice}</p>
    {!cars.length && <div className="demo-entry"><button type="button" className="text-button" onClick={loadDemo} disabled={loading}>Try fictional demo</button><p>Three example cars, real sourced research. Works without eBay credentials or internet research.</p></div>}
  </form>;
  const enter = { initial: { opacity: reduced ? 1 : 0, y: reduced ? 0 : 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: reduced ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] } };
  return <LazyMotion features={domAnimation} strict><MotionConfig reducedMotion="user"><div className={`site-shell ${page === 'import' ? 'landing-shell' : ''}`}>
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>Skip to content</a>
    <header className="site-header"><a className="brand" href="#import" aria-label="Dilemma home"><span className="brand-mark">d.</span>Dilemma<span className="brand-dot">.</span></a><nav aria-label="Main navigation"><button className="nav-link how-link" type="button" onClick={showSteps}>How it works</button><a className="shortlist-link" href="#compare" aria-current={page === 'compare' ? 'page' : undefined}>Your shortlist{cars.length > 0 && <span className="nav-count">{cars.length}</span>}</a><button className="nav-button" type="button" onClick={startImport}>Get started <Icon name="arrow" size={17} /></button></nav></header>
    {page !== 'import' && <div className="workflow" aria-label="Your progress">{[['import', '01', 'Import'], ['compare', '02', 'Compare'], ['decide', '03', 'Decide']].map(([id, n, label]) => <a href={`#${id}`} key={id} aria-current={page === id ? 'step' : undefined}><span>{n}</span>{label}</a>)}</div>}
    <main id="main-content" tabIndex={-1}><m.div key={page} className="page-transition" {...enter}>
      {page === 'import' && <>
        <section className="hero"><m.div className="hero-copy" {...enter}><p className="eyebrow"><span /> THE SHORTLIST. WITHOUT THE SECOND-GUESSING.</p><h1 tabIndex={-1}>Stop searching.<br /><span>Start deciding.</span></h1><p className="hero-description">Bring your eBay.ca finds together.<br className="desktop-break" /> Compare what matters. Choose with clarity.</p>{importForm}{!!cars.length && <a className="source-link" href="#compare">Return to your comparison →</a>}</m.div><m.div className="hero-preview" {...enter} transition={{ ...enter.transition, delay: reduced ? 0 : 0.12 }}><LandingPreview onStart={startImport} /></m.div></section>
        <section id="how-it-works" className="how-it-works" aria-labelledby="steps-heading"><div className="steps-intro"><p className="eyebrow">FROM OPEN TABS TO A CLEAR CHOICE</p><h2 id="steps-heading">Three steps. One confident decision.</h2></div><div className="steps">{[['link', '01', 'Import', 'Paste a listing. We’ll bring in the details.'], ['compare', '02', 'Compare', 'Your contenders, clearly side by side.'], ['spark', '03', 'Decide', 'Choose your priorities. See the trade-offs.']].map(([icon, n, title, text]) => <div key={n}><span className="step-icon"><Icon name={icon} size={24} /></span><div><span className="step-index">{n}</span><h3>{title}</h3><p>{text}</p></div></div>)}</div><div className="landing-note"><Icon name="shield" size={16} /><span>Real seller details. Transparent comparisons. The final call is always yours.</span><button type="button" onClick={startImport}>Start your shortlist <Icon name="arrow" size={16} /></button></div></section>
      </>}
      {page === 'compare' && <VehicleComparison cars={cars} importForm={importForm} navigate={navigate} removeCar={id => { setCars(previous => previous.filter(car => car.legacyItemId !== id)); setNotice('Car removed. You can import a replacement.'); }} clearCars={() => { setCars([]); setNotice('Comparison cleared.'); }} />}
      {page === 'decide' && <DecisionDashboard cars={cars} mode={mode} setMode={setMode} />}
    </m.div></main><footer><a className="footer-brand" href="#import">Dilemma<span>.</span></a><span>A clearer road to your next car.</span><span className="prototype-label">In memory only · Refresh clears your shortlist</span></footer>
  </div></MotionConfig></LazyMotion>;
}
