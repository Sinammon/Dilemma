import React, { useState } from 'react';
import { CRITERIA, DEFAULT_PRIORITIES, rankCars } from './decision-engine.js';

const decimal = value => value.toLocaleString('en-CA', { maximumFractionDigits: 1 });
const measurement = (key, value) => key === 'price' ? `$${decimal(value)} CAD` : key === 'age' ? `${value} years old` : `${decimal(value)} km`;

export default function DecisionDashboard({ cars }) {
  const [priorities, setPriorities] = useState({ ...DEFAULT_PRIORITIES });
  // Derived on every render: changing a slider immediately updates the ranking.
  const result = rankCars(cars, priorities);
  const best = result.best[0];
  return <section className="decision-dashboard" aria-labelledby="decision-title">
    <div className="decision-heading"><div><p className="eyebrow">YOUR PRIORITIES. YOUR NEXT MOVE.</p><h2 id="decision-title">Find your Best Match</h2></div><span className="decision-tag">Live decision engine</span></div>
    <div className="decision-layout">
      <div className="priority-panel"><h3>What matters to you?</h3><p>Higher means more influence. Lower price, newer age and lower mileage score better.</p>
        {CRITERIA.map(({ key, label }) => <div className="priority-control" key={key}><label htmlFor={`priority-${key}`}>{label}<output htmlFor={`priority-${key}`}>{priorities[key]} / 100</output></label><input id={`priority-${key}`} type="range" min="0" max="100" step="1" value={priorities[key]} onChange={event => setPriorities(previous => ({ ...previous, [key]: Number(event.target.value) }))} /><div className="range-labels"><span>Ignore</span><span>Very important</span></div></div>)}
        <button className="text-button" onClick={() => setPriorities({ ...DEFAULT_PRIORITIES })}>Reset priorities</button>
      </div>
      <div className="recommendation-panel" aria-live="polite" aria-atomic="true">
        <p className="eyebrow">{result.best.length > 1 ? 'JOINT BEST MATCHES' : 'BEST MATCH'}</p>
        {!cars.length ? <><h3>Your next decision starts here.</h3><p>Import up to four cars to unlock a recommendation shaped by your priorities.</p></>
          : !result.totalWeight ? <><h3>Not enough comparable information</h3><p>Turn up a priority with complete data, or confirm missing details with the sellers. No numerical recommendation is available.</p></>
          : !best ? <><h3>No Best Match recommended</h3><p>Every car has a detected mechanical warning. Scores are shown for comparison, but none receives a Best Match endorsement.</p></>
          : <><h3>{result.best.map(e => e.car.title || 'Untitled vehicle').join(' • ')}</h3><div className="match-score">{best.score.toFixed(1)}<span>/ 100 preference points</span></div>
            <p>{cars.length === 1 ? 'Provisional: add another car for a relative comparison.' : result.best.length > 1 ? 'Equal scores in the same warning group share a rank; import order does not decide a winner.' : 'Highest preference score among cars without detected mechanical warnings.'}</p>
            {result.best.map(entry => <div className="match-explanation" key={entry.car.legacyItemId}>{result.best.length > 1 && <h4>{entry.car.title}</h4>}<p><strong>Strengths: </strong>{entry.breakdown.filter(c => c.points > 50).map(c => `${c.label}: ${measurement(c.key, c.value)} (${Math.round(c.points)}/100)`).join('; ') || 'No scored measurement stands above the shared midpoint.'}</p><p><strong>Trade-offs: </strong>{entry.breakdown.filter(c => c.points < 50).map(c => `${c.label}: ${measurement(c.key, c.value)} (${Math.round(c.points)}/100)`).join('; ') || 'No scored measurement falls below the shared midpoint.'}</p></div>)}
          </>}
        <p className="recommendation-caution">Preference fit, not vehicle quality or a safety rating. No detected warning does not mean problem-free. Confirm seller claims and arrange an independent inspection.</p>
      </div>
    </div>
    {!!cars.length && <div className="ranking-list">{result.ranked.map(entry => <article className={`ranking-row ${entry.warnings.length ? 'has-warning' : ''}`} key={entry.car.legacyItemId}>
      <div className="ranking-main"><span className="rank-number">{result.totalWeight ? `#${entry.rank}` : '—'}</span><div><h3>{entry.car.title || 'Untitled vehicle'}</h3><p>{entry.warnings.length ? 'Mechanical review required • ranked below cars without detected warnings' : 'No mechanical warning detected in supported phrases'}</p></div><strong className="ranking-score">{entry.score === null ? 'Unscored' : `${entry.score.toFixed(1)} / 100`}</strong></div>
      <div className="score-parts">{entry.breakdown.map(c => <span key={c.key}>{c.label}: {c.points.toFixed(0)} × {(c.share * 100).toFixed(0)}% = {c.contribution.toFixed(1)}</span>)}</div>
      {CRITERIA.some(c => entry.values[c.key] === null) && <p className="missing-measurements">Missing or incompatible for this car: {CRITERIA.filter(c => entry.values[c.key] === null).map(c => c.label).join(', ')}. These criteria are excluded for everyone.</p>}
      {!!entry.warnings.length && <div className="warning-details"><strong>Seller text needs review</strong>{entry.warnings.map(w => <p key={w.label}><b>{w.label}:</b> “{w.evidence}”</p>)}<p>Possible mechanical work and usability concerns take priority over price. This rule changes the ranking group, not the preference score; no repair cost is assumed.</p></div>}
    </article>)}</div>}
    <details className="scoring-method"><summary>How the scores work &amp; what is missing</summary><div><p>Within this shortlist, the lowest comparable value earns 100 and the highest earns 0. Intermediate values use a straight line. Equal values earn 50. Each score is multiplied by its share of the active priorities, then added. Scores are relative to this shortlist and may change when a car is added or removed.</p><p>A criterion missing or incompatible for any car is excluded for every car; remaining priorities are renormalized. Unknown data never earns bonus points. Explicit miles convert to kilometres using 1 mile = 1.609344 km; unknown or conflicting units are excluded. Only explicitly CAD prices are compared. Age uses the current year minus model year, with next-year models counted as zero.</p><ul>{result.criteria.map(c => <li key={c.key}><strong>{c.label}:</strong> {c.reason}{c.active && ` Active weight: ${(c.weight / result.totalWeight * 100).toFixed(1)}%.`}</li>)}</ul><p>Mechanical warnings use English phrase matching in seller titles, descriptions and specifications, with limited negation and repair handling. They can miss issues or misread context. Read the original description. No reliability, accident history or repair estimate is inferred. Ties use scores rounded to two decimals.</p></div></details>
  </section>;
}
