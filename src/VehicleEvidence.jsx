import React from 'react';
import { extractVehicleSpecs, FIELD_LABELS } from './vehicle-specs.js';
import { safeUrl } from './vehicle-data.js';
import { VPIC_SOURCE } from '../shared/vin.js';
import { NRCAN_SOURCE, FUEL_LABELS, annualFuelCost } from './fuel-data.js';
import { modelScopeLabel } from '../shared/model-specs.js';

const statusLabel = { 'seller-reported': 'Seller-reported', 'vin-record': 'VIN record', 'factory-reference': 'Factory reference', 'model-reference': 'Typical model spec', 'model-context': 'Typical model · varies', corroborated: 'Sources agree', conflict: 'Conflicting evidence' };
const formatted = value => typeof value === 'number' ? Number(value.toFixed(2)).toLocaleString('en-CA') : String(value);
export function SpecCitations({ evidence = [], sourceUrl }) {
  return evidence.map((item, index) => <span className="spec-citation" key={index}>{item.type === 'vpic' ? <a href={VPIC_SOURCE} target="_blank" rel="noopener noreferrer">NHTSA vPIC ↗</a> : safeUrl(item.url || sourceUrl) ? <a href={safeUrl(item.url || sourceUrl)} target="_blank" rel="noopener noreferrer">{item.source} ↗</a> : item.source} · {item.type === 'model-reference' && 'Research excerpt: '}“{item.label ? `${item.label}: ` : ''}{item.quote}”{item.configuration && ` · ${['year', 'make', 'model', 'trim', 'market', 'transmission'].map(key => item.configuration[key]).filter(Boolean).join(' ')}`}</span>);
}
export function ModelSpecAttribution({ car }) {
  const html = car.enrichment?.modelSpecs?.searchSuggestions;
  // Google attribution is isolated: no scripts, same-origin access or top navigation.
  return typeof html === 'string' && html.length <= 50000 ? <iframe className="search-attribution" title="Google Search suggestions for vehicle specifications" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" srcDoc={html} /> : null;
}
export function SpecValue({ spec }) {
  if (!spec || spec.status === 'unknown') return spec?.reason ? <span className="spec-value">Unresolved<small className="spec-reason">{spec.reason}</small></span> : 'Unknown';
  const value = spec.kind === 'configuration' ? formatted(spec.referenceValue ?? spec.value) : spec.kind === 'range' ? `${formatted(spec.minimum)}–${formatted(spec.maximum)}` : spec.kind === 'alternatives' ? spec.alternatives.map(formatted).join(' / ') : spec.kind === 'optional' ? 'Optional' : spec.value == null ? 'Unknown' : formatted(spec.value);
  return <span className="spec-value">{value}<small className={`evidence-badge ${spec.status}`}>{spec.kind === 'configuration' ? 'Reference version · unconfirmed' : statusLabel[spec.status]}</small>{spec.status === 'model-context' && <small className="spec-reason">{spec.contextReason || `Configuration varies${modelScopeLabel(spec.scope) ? ` · ${modelScopeLabel(spec.scope)}` : ''}`} · excluded from scoring</small>}</span>;
}
export function ResearchAction({ car, retryResearch }) {
  if (car.demo || !retryResearch) return null;
  const busy = ['loading', 'loading-model'].includes(car.enrichment?.status);
  const research = car.enrichment?.modelSpecs;
  const specs = Object.keys(research?.fields || {}).length, notes = research?.insights?.length || 0;
  const ready = specs + notes > 0;
  const failed = research && !['matched', 'partial', 'complete', 'loading'].includes(research.status);
  function showResults() {
    const target = [...document.querySelectorAll('.vehicle-summary[data-research-car]')].find(element => element.dataset.researchCar === String(car.legacyItemId));
    if (!target) return;
    for (let parent = target.parentElement; parent; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true;
    if (notes) { const details = target.querySelector('.model-research'); if (details) details.open = true; }
    target.focus({ preventScroll: true });
    target.scrollIntoView?.({ block: 'start', behavior: 'instant' });
  }
  const action = ready ? 'Refresh research' : failed ? 'Retry research' : 'Research model';
  return <div className="research-control">{ready && <small role="status">Research ready: {specs} specifications · {notes} sourced notes</small>}<div>{ready && <button type="button" className="text-button" onClick={showResults}>View results</button>}<button type="button" data-action="model-research" className="text-button" disabled={busy} onClick={() => retryResearch(car)} aria-label={`${action} for ${car.year || ''} ${car.make || ''} ${car.model || ''}`}>{busy ? 'Researching...' : action}</button></div>{failed && <small>{research.reason}</small>}{research?.lastAttempt && <small>{research.lastAttempt.reason} Previous research is still available.</small>}</div>;
}
export function SourceStatus({ car, retryResearch }) {
  const enrichment = car.enrichment;
  if (enrichment?.status === 'loading') return <p className="source-status" role="status">Checking VIN and Canadian fuel data… Seller details are ready.</p>;
  if (!enrichment) return null;
  const { vin, fuel, factorySpecs, modelSpecs } = enrichment;
  return <div className="source-status"><p>{vin?.mismatches?.length ? 'VIN/listing mismatch — review before deciding.' : vin?.status === 'decoded' ? 'VIN decoded · Original vehicle specifications available' : vin?.reason || 'VIN data unavailable.'}</p>{factorySpecs && <p>{factorySpecs.status === 'matched' ? `Factory power reference matched · ${factorySpecs.configuration.market} market · Original ratings, not measured output` : factorySpecs.reason}</p>}<p>{fuel?.status === 'matched' ? `${fuel.combined.toFixed(1)} L/100 km combined · NRCan configuration match` : fuel?.reason || 'No verified fuel configuration match.'}</p>{modelSpecs && <p role={enrichment.status === 'loading-model' || modelSpecs.status === 'loading' ? 'status' : undefined}>{enrichment.status === 'loading-model' || modelSpecs.status === 'loading' ? 'Looking up model specifications and category insights… Existing details are ready.' : modelSpecs.reason}</p>}<ResearchAction car={car} retryResearch={retryResearch} /></div>;
}
export default function VehicleEvidence({ car, scenario, retryResearch }) {
  const { specs, features } = extractVehicleSpecs(car);
  const knownSpecs = Object.entries(FIELD_LABELS).filter(([key]) => key !== 'transmissionCode' && specs[key].status !== 'unknown');
  const unknownSpecs = Object.entries(FIELD_LABELS).filter(([key]) => key !== 'transmissionCode' && specs[key].status === 'unknown').map(([, label]) => label);
  const knownFeatures = Object.entries(features).filter(([, item]) => item.status !== 'unknown');
  const vin = car.enrichment?.vin, fuel = car.enrichment?.fuel;
  const cost = scenario && annualFuelCost(fuel, scenario);
  return <details className="vehicle-evidence"><summary>Specifications, amenities &amp; sources</summary><div className="evidence-content">
    <SourceStatus car={car} retryResearch={retryResearch} />
    {!!vin?.mismatches?.length && <div className="warning-details"><strong>Resolve VIN/listing differences</strong>{vin.mismatches.map(item => <p key={item.field}>{item.field}: seller lists {String(item.listing)}; VIN record lists {String(item.vin)}. VIN-derived fields and fuel matching are withheld.</p>)}</div>}
    <p className="evidence-legend">Seller-reported = a listing claim. VIN record = manufacturer-submitted original specifications. Factory reference = published original ratings for the matched configuration. Typical model spec = AI-researched original specifications with cited sources. Sources agree = the cited values agree. None verifies current condition, measured output or installed equipment.</p>
    <dl className="evidence-specs">{knownSpecs.map(([key, label]) => <div key={key}><dt>{label}</dt><dd><SpecValue spec={specs[key]} /><SpecCitations evidence={specs[key].evidence} sourceUrl={car.sourceUrl} /></dd></div>)}</dl>
    {!!unknownSpecs.length && <p className="evidence-legend">Not documented: {unknownSpecs.join(', ')}.</p>}
    <h3>Amenities and standard model equipment</h3><div className="feature-evidence">{knownFeatures.map(([label, item]) => <div key={label}><span>{label}</span>{['model-reference', 'model-context'].includes(item.status) ? <><SpecValue spec={item} /><SpecCitations evidence={item.evidence} /></> : <><strong className={item.value === true ? 'present' : ''}>{item.status === 'conflict' ? 'Conflicting claims' : item.value ? 'Reported present' : 'Reported absent / not working'}</strong><small>{[...new Set(item.evidence.map(e => e.source))].join(' · ')}</small></>}</div>)}</div><p className="evidence-legend">{Object.keys(features).length - knownFeatures.length} other amenity categories remain unknown. Typical standard equipment may differ on this used car; optional equipment does not receive points.</p>
    <ModelSpecAttribution car={car} />
    <div className="fuel-evidence"><h3>Canadian fuel-consumption reference</h3>{fuel?.status === 'matched' ? <><p>{fuel.row.year} {fuel.row.make} {fuel.row.model} · {fuel.row.displacement} L · {fuel.row.cylinders} cylinders · {fuel.row.transmission} · {FUEL_LABELS[fuel.fuel]}</p><p><strong>{fuel.combined.toFixed(1)} L/100 km combined</strong> · City {fuel.city} · Highway {fuel.highway}</p>{cost != null && <p>Fuel scenario: <strong>${cost.toLocaleString('en-CA', { maximumFractionDigits: 0 })} CAD/year</strong> at {scenario.annualKm.toLocaleString('en-CA')} km/year and ${scenario.pricePerLitre.toFixed(2)}/L. An editable assumption, not a current pump price or total ownership cost.</p>}<p>{fuel.reason} {fuel.adjusted && 'Pre-2015 values are adjusted estimates, not new 5-cycle tests.'} Actual use varies with driving and vehicle condition.</p></> : <p>{fuel?.reason || 'No reliable configuration match. No fuel rating or cost is assigned.'} Electric and plug-in hybrid consumption is not covered by this matcher.</p>}<a href={NRCAN_SOURCE} target="_blank" rel="noopener noreferrer">NRCan official dataset ↗</a><p>Reference snapshot: 29 October 2026. Contains information licensed under the <a href="https://open.canada.ca/en/open-government-licence-canada" target="_blank" rel="noopener noreferrer">Open Government Licence – Canada</a>. Adapted reference data; no government endorsement.</p></div>
    <p className="evidence-legend"><a href={VPIC_SOURCE} target="_blank" rel="noopener noreferrer">NHTSA vPIC ↗</a> decodes vehicle identity and supported original specifications. It provides no accident or ownership history. Empty decoded fields stay unknown.</p>
  </div></details>;
}
