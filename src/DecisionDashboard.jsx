import React, { useRef, useState } from 'react';
import { DEFAULT_SCENARIO } from './decision-engine.js';
import { decisionSummary, entrySummary, keyFacts, PRIMARY_MODES } from './decision-summary.js';
import VehicleEvidence from './VehicleEvidence.jsx';
import { priceDisplay, vehicleName } from './vehicle-data.js';
import { ListingLink, VehicleImage, vehicleImageUrl } from './VehicleComparison.jsx';
import { DecisionResearch } from './ModelResearch.jsx';
import Icon from './Icons.jsx';

function ModeButton({ item, mode, setMode }) {
  return <button type="button" className={`mode-card ${mode === item.id ? 'selected' : ''}`} data-mode={item.id} aria-pressed={mode === item.id} onClick={() => setMode(item.id)}><Icon name={item.icon || 'compare'} size={25} /><strong>{item.label || item.title}</strong></button>;
}
function ListingWarnings({ entry }) {
  return !!entry.warnings.length && <div className="warning-details" role="note"><strong>Review before choosing</strong>{entry.warnings.map((warning, index) => <p key={index}><b>{warning.label}:</b> {warning.evidence}</p>)}</div>;
}
function MatchCard({ summary }) {
  const [index, setIndex] = useState(0);
  const dialog = useRef(null);
  const entry = summary.ranking.ranked[index % summary.ranking.ranked.length];
  const { car } = entry;
  const endorsed = summary.ranking.best.includes(entry);
  const notes = entrySummary(summary, entry);
  const facts = keyFacts(car, summary.requested.mode.id);
  const label = summary.kind === 'review' || entry.identityMismatch || (entry.warnings.length && summary.requested.mode.id !== 'cost') ? 'Review required'
    : entry.warnings.length ? 'Low cost · review concerns'
      : summary.kind === 'starting-point' ? endorsed ? 'Starting point' : 'Another option'
      : summary.kind === 'guidance' ? 'Explore this contender'
        : !endorsed ? 'Other contender' : summary.single ? 'Provisional match' : summary.shared ? 'Equal match' : 'Recommended match';
  const explanation = endorsed || ['review', 'guidance'].includes(summary.kind) ? notes.explanation : 'Another contender in your shortlist. Compare its supported details and trade-offs.';
  const canView = (car.images || []).some((_, i) => vehicleImageUrl(car, i));
  return <>
    <article className={`decision-match ${endorsed ? 'best-match' : ''}`} data-basis={summary.kind}>
      <div className="decision-photo"><VehicleImage key={car.legacyItemId} car={car} />{canView && <button type="button" className="view-photo" onClick={() => dialog.current?.showModal()}><Icon name="expand" size={17} />View larger photo</button>}</div>
      <div className="decision-match-copy"><div className="match-topline"><span className={`recommendation-badge ${!endorsed ? 'neutral' : ''} ${entry.warnings.length ? 'caution' : ''}`}><Icon name={endorsed && summary.kind === 'supported' && !entry.warnings.length ? 'trophy' : 'info'} size={18} />{summary.requested.mode.title.toLowerCase()} &middot; {label}</span></div>
        <h2>{vehicleName(car)}</h2><p className="decision-reason">{explanation}</p>
        <ul className="decision-reasons">{notes.reasons.map(reason => <li key={reason.text} className={reason.source ? 'model-context' : ''}><Icon name={reason.source ? 'book' : 'check-circle'} size={21} /><span>{reason.text}<small>{reason.label}{reason.source && <> &middot; <a href={reason.source.url} target="_blank" rel="noopener noreferrer">{reason.source.publisher} <Icon name="arrow" size={14} /></a></>}</small></span></li>)}</ul>
        <div className="decision-tradeoff"><Icon name="balance" size={23} /><b>Trade-off</b><span>{notes.tradeoff}{notes.tradeoffSource && <small><a href={notes.tradeoffSource.url} target="_blank" rel="noopener noreferrer">{notes.tradeoffSource.publisher} <Icon name="arrow" size={14} /></a></small>}</span></div>
        <ListingWarnings entry={entry} />
      </div>
      {!!facts.length && <div className="decision-key-facts">{facts.map(fact => <div key={fact.label}><span className="fact-icon"><Icon name={fact.icon} size={28} /></span><div><span>{fact.label}</span><strong>{fact.value}</strong><small>{fact.source}</small></div></div>)}</div>}
      {summary.ranking.ranked.length > 1 && <div className="contender-controls"><button type="button" className="decision-arrow previous" aria-label="Previous contender" onClick={() => setIndex(i => (i + summary.ranking.ranked.length - 1) % summary.ranking.ranked.length)}><Icon name="chevron" size={20} />Previous</button><button type="button" className="decision-arrow next" aria-label="Next contender" onClick={() => setIndex(i => (i + 1) % summary.ranking.ranked.length)}>Next<Icon name="chevron" size={20} /></button></div>}
      <div className="decision-card-foot"><span>{index % summary.ranking.ranked.length + 1} of {summary.ranking.ranked.length} contenders</span>{car.demo && <a href="/images/preview/credits.html" target="_blank" rel="noreferrer">Photo credits</a>}<ListingLink car={car} /></div>
    </article>
    <dialog className="decision-photo-dialog" ref={dialog} aria-label={`Larger photos of ${vehicleName(car)}`} onClick={e => { if (e.target === e.currentTarget) dialog.current.close(); }}><button type="button" autoFocus onClick={() => dialog.current.close()} aria-label="Close larger photo">Close ×</button><VehicleImage key={`large-${car.legacyItemId}`} car={car} /></dialog>
  </>;
}

export default function DecisionDashboard({ cars, mode = 'value', setMode, retryResearch }) {
  const [scenario, setScenario] = useState(DEFAULT_SCENARIO);
  const summary = decisionSummary(cars, mode, new Date().getFullYear(), scenario);
  const result = summary.requested;
  const missing = result.criteria.filter(c => c.weight > 0 && !c.active);
  return <section className="page-section decision-page">
    <div className="decision-heading"><div><h1 tabIndex={-1}>Let's Find Your Best Match</h1><p className="page-intro">Choose what matters most. See your match, the reasons, and the trade-off.</p></div><a className="back-link" href="#compare">Back to comparison <Icon name="arrow" size={18} /></a></div>
    <div className="mode-grid" role="group" aria-label="Decision priority">{PRIMARY_MODES.map(item => <ModeButton key={item.id} item={item} mode={mode} setMode={setMode} />)}</div>
    <details className="more-mode-options" open={['practical', 'performance'].includes(mode) || undefined}><summary>More priorities</summary><div className="additional-mode-grid" role="group" aria-label="Additional decision priorities">{[{ id: 'practical', label: 'Practicality', icon: 'compare' }, { id: 'performance', label: 'Performance', icon: 'engine' }].map(item => <ModeButton key={item.id} item={item} mode={mode} setMode={setMode} />)}</div></details>
    {cars.some(car => car.demo) && <p className="decision-demo-note">Fictional demo cars · Listing details are examples; linked model research is real.</p>}
    {cars.some(car => ['loading', 'loading-model'].includes(car.enrichment?.status)) && <p className="decision-status" role="status">Checking specifications and typical model sources… Your result may update.</p>}
    <div className="decision-result" aria-live="polite" aria-atomic="false">
      {summary.kind === 'empty' ? <div className="decision-empty result-banner"><Icon name="compare" size={35} /><h2>Your shortlist comes first.</h2><p>Add a vehicle or use the fictional demo to explore your options.</p><a className="primary-link" href="#compare">Choose your cars <Icon name="arrow" size={18} /></a></div>
        : <MatchCard key={`${mode}:${JSON.stringify(scenario)}`} summary={summary} />}
    </div>
    {!!cars.length && <>
      <div className="decision-actions"><a className="decision-primary" href="#compare">Compare Your Cars <Icon name="arrow" size={21} /></a></div>
      <details className="decision-details"><summary>Why this result? Sources &amp; checks</summary><div className="decision-detail-content">
        <p>{result.limitation}</p>{summary.kind === 'starting-point' && <p><strong>Starting-point basis:</strong> {summary.ranking.criteria.filter(c => c.active).map(c => c.label).join(', ')}. No score or winner is claimed for {result.mode.title.toLowerCase()}.</p>}
        {!!missing.length && <p className="missing-measurements"><strong>Not compared:</strong> {missing.map(c => c.label).join(', ')}. Missing details never count as absent equipment.</p>}
        <DecisionResearch result={result} />
        <div className="ranking-list">{summary.ranking.ranked.map(entry => <article className="ranking-row" key={entry.car.legacyItemId}><div className="ranking-main"><div><h3>{vehicleName(entry.car)}</h3><p>{priceDisplay(entry.car)}</p></div><strong className="ranking-score">{entry.score == null ? 'Unscored' : `${entry.score.toFixed(2)} / 100`}</strong></div><p className="score-basis">{summary.kind === 'starting-point' ? 'Best Value starting-point score; not a score for the selected priority.' : 'Shortlist preference points; not a reliability or condition rating.'}</p><div className="score-parts">{entry.breakdown.map(c => <span key={c.key}>{c.label}: {c.points.toFixed(1)} × {(c.share * 100).toFixed(1)}% = {c.contribution.toFixed(2)} · {c.evidenceLabel}</span>)}</div><ListingWarnings entry={entry} /><VehicleEvidence car={entry.car} scenario={scenario} retryResearch={retryResearch} /><details><summary>Original seller description</summary><p className="inline-description">{entry.car.description || 'No description supplied.'}</p><ListingLink car={entry.car} /></details></article>)}</div>
        <p className="evidence-legend">Model reviews describe tested or typical configurations. They do not verify equipment, condition, accident history or recall completion on these cars.</p>
      </div></details>
      <details className="decision-details scenario-panel"><summary>Adjust fuel assumptions &amp; practical needs</summary><div className="scenario-fields"><label>Annual driving (km)<input type="number" min="1" max="200000" value={scenario.annualKm || ''} onChange={e => setScenario({ ...scenario, annualKm: Number(e.target.value) })} /></label><label>Fuel price (CAD/L)<input type="number" min="0.01" max="10" step="0.01" value={scenario.pricePerLitre || ''} onChange={e => setScenario({ ...scenario, pricePerLitre: Number(e.target.value) })} /></label><label>Seats needed<select value={scenario.minSeats} onChange={e => setScenario({ ...scenario, minSeats: Number(e.target.value) })}>{[2, 4, 5, 6, 7, 8].map(n => <option key={n}>{n}</option>)}</select></label><label>Preferred body<select value={scenario.bodyType} onChange={e => setScenario({ ...scenario, bodyType: e.target.value })}><option value="">No preference</option>{['Sedan', 'Hatchback', 'SUV', 'Wagon', 'Coupe', 'Convertible', 'Pickup', 'Van'].map(body => <option key={body}>{body}</option>)}</select></label></div><p>Editable assumptions, not current pump prices or total ownership cost. Fuel cost uses a unique NRCan configuration match and the same fuel grade for every car.</p></details>
    </>}
    <details className="decision-details more-priorities"><summary>How the scoring works</summary><p>Only comparable, supported measurements receive points. A missing factor is excluded for all cars; remaining weights are rescaled. Equal values score equally. Detected mechanical concerns prevent a recommendation outside Affordability; identity conflicts prevent it in every mode. Affordability compares asking price and supported fuel scenarios, so always review its visible condition warnings.</p><p>Measurable factors contribute 75% and sourced model assessments 25% when every contender has both. The review rubric is favourable (2), mixed (1), or unfavourable (0), based on cited observations. Missing research is excluded for everyone. Research alone gives guidance, without a numeric winner. Cited model specs and standard equipment can fill missing factors; ranges and optional equipment receive no points. When a priority cannot be compared, a clearly labeled Best Value starting point uses the available price, age and mileage. Without those, contenders remain unranked for your review.</p></details>
    <p className="decision-footnote">Confirm seller claims and arrange an independent inspection before buying.</p>
  </section>;
}
