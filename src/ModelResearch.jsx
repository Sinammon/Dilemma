import React from 'react';
import { researchForCar, liveResearchForCar, liveResearchClaim, dimensionRatingsForCar, RESEARCH_CATEGORIES, RESEARCH_METHOD, RESEARCH_LIMIT } from './model-research.js';
import { vehicleName } from './vehicle-data.js';
import RecallResearch from './RecallResearch.jsx';
import { DIMENSION_LABELS } from './capability-scoring.js';
import { RATING_ANCHORS } from '../shared/model-specs.js';
import { SpecCitations } from './VehicleEvidence.jsx';

export function ResearchClaim({ claim }) {
  return <div className={`research-claim ${claim.tone}`}><p>{claim.text}</p>{claim.contextOnly && <p className="spec-reason">{claim.contextReason} Context only; excluded from scoring.</p>}<div className="research-citations">{claim.sources.map(source => <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer" title={`${source.title} · ${source.locator} · Reviewed ${source.reviewed}`}>{source.publisher} · {source.kind} ↗</a>)}</div></div>;
}

export default function ModelResearch({ car }) {
  const research = researchForCar(car);
  const live = liveResearchForCar(car);
  const dimensionRatings = dimensionRatingsForCar(car);
  return <details className="model-research"><summary>Model research &amp; sources · {live.insights.length || Object.keys(live.dimensionRatings || {}).length ? 'live research ready' : Object.keys(dimensionRatings).length ? 'reviewed dimensions' : research.status === 'matched' ? 'reviewed profile' : 'coverage unavailable'}</summary><div className="research-content">
    <p className="evidence-legend">{RESEARCH_METHOD}</p>
    {!!Object.keys(dimensionRatings).length && <><h3>Comfort and space assessments</h3><p>One cross-class scale: {RATING_ANCHORS.map((label, index) => `${index} ${label.toLowerCase()}`).join(' · ')}. These are evidence-based model assessments, not the publisher's overall ratings.</p><dl className="capability-details">{Object.entries(dimensionRatings).map(([key, rating]) => <div key={key}><dt>{DIMENSION_LABELS[key]}</dt><dd><strong>{rating.rating} / 5</strong><p>{rating.rationale}</p><SpecCitations evidence={rating.evidence} /></dd></div>)}</dl></>}
    {!!live.insights.length && <><h3>What to keep in mind</h3><p>Model observations from successfully retrieved sources. Confirm applicability and condition on this car.</p>{live.insights.map(insight => <div key={insight.id}><small>{insight.categories.map(c => ({ value: 'Best Value', cost: 'Affordability', comfort: 'Comfort', balanced: 'Balanced', practical: 'Practicality', performance: 'Performance', safety: 'Safety equipment', issues: 'Issues to check', strengths: 'Strengths' })[c]).join(' · ')}</small><ResearchClaim claim={liveResearchClaim(insight, live.checked)} /></div>)}</>}
    {research.status === 'matched' ? <><h3>{research.title}</h3><p>{research.scope}</p><dl>{Object.entries(RESEARCH_CATEGORIES).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{research.claims.filter(c => c.category === key).map(claim => <ResearchClaim key={claim.id} claim={claim} />)}{!research.claims.some(c => c.category === key) && 'No sourced claim available.'}</dd></div>)}</dl>
      <details className="research-source-list"><summary>Source titles, sections &amp; review dates</summary>{[...new Map(research.claims.flatMap(c => c.sources).map(s => [s.id, s])).values()].map(source => <p key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a><br />{source.publisher} · {source.kind}<br />{source.locator}<br />Reviewed {source.reviewed}</p>)}</details></> : <p>{research.reason}</p>}
    <p className="evidence-legend">{RESEARCH_LIMIT}</p>
  </div></details>;
}

export function DecisionResearch({ result }) {
  if (!result.research.length) return null;
  const covered = result.research.filter(entry => entry.guidance.claims.length);
  return <section className="decision-research" aria-label="Model research guidance"><div className="table-heading"><h2>{result.totalWeight ? 'Model context for your decision' : covered.length ? 'Model research can still guide your test drives' : 'Model research coverage'}</h2><p>{RESEARCH_METHOD}</p></div>
    <p>{result.totalWeight ? 'Read these model-level trade-offs alongside the scored result.' : 'Vehicle data cannot support a numeric winner in this mode. The sourced notes below offer a useful next step.'} Cited dimension ratings and comparable specifications form category scores. Broad review sentiment adds no extra points. {covered.length} of {result.research.length} contenders have applicable research for this mode; missing coverage is not a disadvantage.</p>
    <div className="research-guidance-grid">{result.research.map(({ car, guidance, caution, worthTestDriving }) => <article key={car.legacyItemId}><h3>{vehicleName(car)}</h3><span className="evidence-badge">Typical model · {guidance.claims.length ? 'Sourced' : 'Not covered'}</span>
      {guidance.claims.map(claim => <ResearchClaim key={claim.id} claim={claim} />)}
      {!guidance.claims.length && <p>{guidance.reason || 'No sourced claim for this mode.'}</p>}
      {worthTestDriving && <p className="research-next-step"><strong>Worth a test drive for this priority:</strong> the cited review describes a relevant strength. Confirm it in this individual car; this is not a comparative win.</p>}
      {caution && <p className="research-next-step"><strong>Resolve listing concerns first.</strong> Model reputation does not override disclosed condition or identity issues.</p>}
      {guidance.checks.filter(c => !guidance.claims.some(item => item.id === c.id)).map(claim => <ResearchClaim key={claim.id} claim={claim} />)}
      <ModelResearch car={car} />
      <RecallResearch key={car.legacyItemId} car={car} />
    </article>)}</div><p className="evidence-legend">{RESEARCH_LIMIT}</p>
  </section>;
}
