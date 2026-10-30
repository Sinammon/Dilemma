import React from 'react';
import { researchForCar, RESEARCH_CATEGORIES, RESEARCH_METHOD, RESEARCH_LIMIT } from './model-research.js';
import { vehicleName } from './vehicle-data.js';
import RecallResearch from './RecallResearch.jsx';

export function ResearchClaim({ claim }) {
  return <div className={`research-claim ${claim.tone}`}><p>{claim.text}</p><div className="research-citations">{claim.sources.map(source => <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer" title={`${source.title} · ${source.locator} · Reviewed ${source.reviewed}`}>{source.publisher} · {source.kind} ↗</a>)}</div></div>;
}

export default function ModelResearch({ car }) {
  const research = researchForCar(car);
  return <details className="model-research"><summary>Typical model research · {research.status === 'matched' ? 'sourced profile' : 'coverage unavailable'}</summary><div className="research-content">
    <p className="evidence-legend">{RESEARCH_METHOD}</p>
    {research.status === 'matched' ? <><h3>{research.title}</h3><p>{research.scope}</p><dl>{Object.entries(RESEARCH_CATEGORIES).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{research.claims.filter(c => c.category === key).map(claim => <ResearchClaim key={claim.id} claim={claim} />)}{!research.claims.some(c => c.category === key) && 'No sourced claim available.'}</dd></div>)}</dl>
      <details className="research-source-list"><summary>Source titles, sections &amp; review dates</summary>{[...new Map(research.claims.flatMap(c => c.sources).map(s => [s.id, s])).values()].map(source => <p key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a><br />{source.publisher} · {source.kind}<br />{source.locator}<br />Reviewed {source.reviewed}</p>)}</details></> : <p>{research.reason}</p>}
    <p className="evidence-legend">{RESEARCH_LIMIT}</p>
  </div></details>;
}

export function DecisionResearch({ result }) {
  if (!result.research.length) return null;
  const covered = result.research.filter(entry => entry.guidance.claims.length);
  return <section className="decision-research" aria-label="Model research guidance"><div className="table-heading"><h2>{result.totalWeight ? 'Model context for your decision' : covered.length ? 'Model research can still guide your test drives' : 'Model research coverage'}</h2><p>{RESEARCH_METHOD}</p></div>
    <p>{result.totalWeight ? 'Read these model-level trade-offs alongside the scored result.' : 'Vehicle data cannot support a numeric winner in this mode. The sourced notes below offer a useful next step.'} Research adds no specification values or preference points. {covered.length} of {result.research.length} contenders have applicable research for this mode; missing coverage is not a disadvantage.</p>
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
