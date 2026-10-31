import React, { useEffect, useRef, useState } from 'react';
import { readImportResponse } from './import-response.js';
import { LazyMotion, domAnimation, m, MotionConfig, useReducedMotion } from 'motion/react';
import DecisionDashboard from './DecisionDashboard.jsx';
import VehicleComparison from './VehicleComparison.jsx';
import LandingPreview from './LandingPreview.jsx';
import Icon from './Icons.jsx';
import { enrichVehicle } from './enrichment.js';
import { loadModelSpecs } from './model-specs.js';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuToggle = useRef(null);
  const enrichmentTasks = useRef(new Set());
  useEffect(() => () => { for (const controller of enrichmentTasks.current) controller.abort(); }, []);
  useEffect(() => {
    const onHashChange = () => setPage(route());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  useEffect(() => {
    setMenuOpen(false);
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
    controller.vehicleId = imported.legacyItemId;
    enrichmentTasks.current.add(controller);
    // A per-import token survives partial updates and cannot match a removed/replaced car.
    const applyEnrichment = enrichment => {
      if (!controller.signal.aborted) setCars(previous => previous.map(car => car === imported || car.enrichmentToken === controller ? { ...car, enrichmentToken: controller, enrichment } : car));
    };
    void enrichVehicle(imported, { signal: controller.signal, onUpdate: applyEnrichment }).then(applyEnrichment).catch(() => {
      applyEnrichment({ status: 'unavailable' });
    }).finally(() => enrichmentTasks.current.delete(controller));
  }
  function retryResearch(car) {
    for (const previous of enrichmentTasks.current) if (previous.vehicleId === car.legacyItemId) previous.abort();
    const controller = new AbortController();
    controller.vehicleId = car.legacyItemId;
    enrichmentTasks.current.add(controller);
    const previous = car.enrichment || {};
    const apply = enrichment => { if (!controller.signal.aborted) setCars(current => current.map(item => item === car || item.enrichmentToken === controller ? { ...item, enrichmentToken: controller, enrichment } : item)); };
    apply({ ...previous, status: 'loading-model' });
    const finish = modelSpecs => {
      const usable = Object.keys(modelSpecs.fields || {}).length || modelSpecs.insights?.length || Object.keys(modelSpecs.dimensionRatings || {}).length;
      const hasPrevious = ['matched', 'partial'].includes(previous.modelSpecs?.status);
      const research = usable ? { ...modelSpecs, fields: { ...previous.modelSpecs?.fields, ...modelSpecs.fields }, dimensionRatings: { ...previous.modelSpecs?.dimensionRatings, ...modelSpecs.dimensionRatings }, insights: modelSpecs.insights?.length ? modelSpecs.insights : previous.modelSpecs?.insights || [], assessments: modelSpecs.insights?.length ? modelSpecs.assessments : previous.modelSpecs?.assessments || {} }
        : hasPrevious ? { ...previous.modelSpecs, lastAttempt: { status: modelSpecs.status, reason: modelSpecs.reason } } : modelSpecs;
      apply({ ...previous, status: 'complete', modelSpecs: research });
    };
    void loadModelSpecs(car, { signal: controller.signal }).then(finish).catch(() => {
      if (!controller.signal.aborted) finish({ status: 'unavailable', fields: {}, reason: 'AI research could not finish. Retry research to search again.' });
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
    <div className="input-row"><Icon name="link" size={22} /><input id="listing-url" type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="Paste an eBay.ca car link…" required maxLength={2048} disabled={loading || cars.length >= 4} aria-invalid={!!error} aria-describedby="input-note import-error" /><button disabled={loading || cars.length >= 4} type="submit">{loading && <span className="loading-spinner" aria-hidden="true" />}{loading ? 'Importing…' : cars.length >= 4 ? 'Shortlist full' : page === 'import' ? 'Import' : 'Import car'}{!loading && cars.length < 4 && <Icon name="arrow" size={18} />}</button></div>
    <p id="input-note" className="input-note"><Icon name="check" size={14} /> No account needed <span>·</span> {cars.length ? `${cars.length}/4 cars added` : '4 cars at a time'}</p><p id="import-error" role="alert" className="error-message">{error}</p><p role="status" className="form-message">{loading ? 'Connecting to eBay and bringing in listing details…' : notice}</p>
    {!cars.length && <div className="demo-entry"><button type="button" className="text-button" onClick={loadDemo} disabled={loading}>Try fictional demo</button>{page !== 'import' && <p>Three example cars, real sourced research. Works without eBay credentials or internet research.</p>}</div>}
  </form>;
  const enter = { initial: { opacity: reduced ? 1 : 0, y: reduced ? 0 : 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: reduced ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] } };
  return <LazyMotion features={domAnimation} strict><MotionConfig reducedMotion="user"><div className={`site-shell ${page === 'import' ? 'landing-shell' : page === 'decide' ? 'decision-shell' : ''}`}>
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>Skip to content</a>
    <header className="site-header" onKeyDown={event => { if (event.key === 'Escape' && menuOpen) { setMenuOpen(false); menuToggle.current?.focus(); } }}><a className="brand" href="#import" aria-label="Dilemma home"><span className="brand-mark">d.</span>Dilemma<span className="brand-dot">.</span></a><button className="nav-menu-toggle" type="button" ref={menuToggle} aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={() => setMenuOpen(open => !open)}><Icon name={menuOpen ? 'close' : 'menu'} size={22} />{menuOpen ? 'Close' : 'Menu'}</button><nav id="primary-navigation" className={menuOpen ? 'is-open' : ''} aria-label="Main navigation">{[['import', 'Import'], ['compare', 'Compare'], ['decide', 'Help Me Decide']].map(([id, label]) => <a className="nav-link" key={id} href={`#${id}`} aria-current={page === id ? 'page' : undefined} onClick={() => setMenuOpen(false)}>{label}{id === 'compare' && <span className="nav-count" aria-label={`${cars.length} cars in shortlist`}>{cars.length}</span>}</a>)}<button className="nav-button" type="button" onClick={() => { setMenuOpen(false); startImport(); }}>Import a car <Icon name="arrow" size={17} /></button></nav></header>
    {page !== 'import' && <nav className="workflow" aria-label="Your progress">{[['import', '1', 'Import'], ['compare', '2', 'Compare'], ['decide', '3', 'Decide']].map(([id, n, label]) => <a href={`#${id}`} key={id} aria-current={page === id ? 'step' : undefined}><span>{n}</span>{label}</a>)}</nav>}
    <main id="main-content" tabIndex={-1}><m.div key={page} className="page-transition" {...enter}>
      {page === 'import' && <>
        <section className="landing-layout" aria-label="Find your next car">
          <div className="landing-copy"><h1 tabIndex={-1}>Find the right car.<br /><span>Without the guesswork.</span></h1><p className="hero-intro">Your shortlist. A clearer picture. Bring your eBay.ca finds together and see which car fits what matters to you.</p>{importForm}{!!cars.length && <a className="source-link" href="#compare">Return to your comparison →</a>}<button className="how-link text-button" type="button" onClick={showSteps}>How it works <Icon name="chevron" size={16} /></button></div>
          <div className="landing-preview"><div className="preview-intro"><h2>From a few tabs to a clear choice.</h2><p>Explore the workflow with fictional examples.</p></div><LandingPreview onStart={startImport} /></div>
          <section id="how-it-works" className="how-section" aria-labelledby="steps-heading"><h2 id="steps-heading">Less back and forth.<br />More perspective.</h2><div className="landing-steps">{[['link', 'Import your finds', 'Paste an eBay.ca vehicle link. Keep up to four contenders together in one shortlist.'], ['compare', 'See the full picture', 'Compare asking prices, mileage and supported specifications, with sources close at hand.'], ['spark', 'Choose your priorities', 'Find your match on value, cost, comfort and more. Understand the reasons and the trade-off.']].map(([icon, title, text], index) => <div key={title}><span className="landing-step-icon"><Icon name={icon} size={28} /></span><span className="step-label">Step {index + 1}</span><h3>{title}</h3><p>{text}</p></div>)}</div></section>
          <section className="final-cta"><h2>Make room for a better decision.</h2><p>Start with a car you already have your eye on.</p><button type="button" onClick={startImport}>Import your first car <Icon name="arrow" size={20} /></button></section>
        </section>
      </>}
      {page === 'compare' && <VehicleComparison cars={cars} retryResearch={retryResearch} importForm={importForm} navigate={navigate} removeCar={id => { for (const controller of enrichmentTasks.current) if (controller.vehicleId === id) controller.abort(); setCars(previous => previous.filter(car => car.legacyItemId !== id)); setNotice('Car removed. You can import a replacement.'); }} clearCars={() => { for (const controller of enrichmentTasks.current) controller.abort(); setCars([]); setNotice('Comparison cleared.'); }} />}
      {page === 'decide' && <DecisionDashboard cars={cars} retryResearch={retryResearch} mode={mode} setMode={setMode} />}
    </m.div></main><footer><a className="footer-brand" href="#import">Dilemma<span>.</span></a><span>A clearer road to your next car.</span><span className="prototype-label">In memory only · Refresh clears your shortlist</span></footer>
  </div></MotionConfig></LazyMotion>;
}
