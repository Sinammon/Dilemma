import React, { useEffect, useRef, useState } from 'react';
import { extractVehicleSpecs } from './vehicle-specs.js';
import { recallIdentity, RECALL_SOURCE, RECALL_LIMIT } from '../shared/recalls.js';

export default function RecallResearch({ car }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const task = useRef(null);
  useEffect(() => () => task.current?.abort(), []);
  const { specs } = extractVehicleSpecs(car);
  const identity = recallIdentity(Object.fromEntries(['year', 'make', 'model'].map(key => [key, specs[key].value])));
  async function check() {
    if (loading || !identity) return;
    const controller = new AbortController(); task.current = controller; setLoading(true);
    try {
      const response = await fetch('/api/recalls', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(identity), cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (!['available', 'unavailable'].includes(data.recalls?.status) || !Array.isArray(data.recalls.campaigns)) throw new Error();
      if (!controller.signal.aborted) setResult(data.recalls);
    } catch { if (!controller.signal.aborted) setResult({ status: 'unavailable', reason: 'Lookup unavailable. Try again later or check with the manufacturer.' }); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }
  return <details className="recall-research"><summary>Official model recall lookup · NHTSA</summary><p>{RECALL_LIMIT}</p>
    {!identity || car.enrichment?.vin?.mismatches?.length ? <p>Confirm the vehicle identity before checking campaigns.</p> : <><button type="button" onClick={check} disabled={loading}>{loading ? 'Checking official records…' : result ? 'Check again' : 'Check official recalls'}</button><div role="status">
      {result?.status === 'unavailable' && <p>{result.reason}</p>}
      {result?.status === 'available' && <><p>{result.count ? `${result.count} model-level campaign record(s) returned.` : 'No campaigns returned for this query. This does not establish that the car is recall-free.'} Checked {new Date(result.checked).toLocaleDateString('en-CA')}.</p><p>Results can include aftermarket equipment. Check the campaign scope, installed part and VIN with the manufacturer.</p>{result.campaigns.map(item => <details key={item.id}><summary>{item.id} · {item.component}</summary><p>{item.summary}</p>{item.remedy && <p><strong>Manufacturer remedy:</strong> {item.remedy}</p>}{item.notes && <p>{item.notes}</p>}<a href={item.source} target="_blank" rel="noopener noreferrer">NHTSA campaign source ↗</a></details>)}{result.count > result.campaigns.length && <p>First {result.campaigns.length} shown. Use the source for all records.</p>}</>}
    </div></>}
    <a href={RECALL_SOURCE} target="_blank" rel="noopener noreferrer">NHTSA official recall search ↗</a>
  </details>;
}
