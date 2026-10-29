import React from 'react';
import { extractVehicleSpecs, FIELD_LABELS } from './vehicle-specs.js';
import { safeUrl } from './vehicle-data.js';
import { VPIC_SOURCE } from '../shared/vin.js';
import { NRCAN_SOURCE, FUEL_LABELS, annualFuelCost } from './fuel-data.js';

const statusLabel = { 'seller-reported': 'Seller-reported', 'vin-record': 'VIN record', corroborated: 'Corroborated', conflict: 'Conflicting evidence' };
export function SpecValue({ spec }) {
  if (!spec || spec.status === 'unknown') return 'Unknown';
  return <span className="spec-value">{spec.value == null ? 'Unknown' : typeof spec.value === 'number' ? Number(spec.value.toFixed(2)).toLocaleString('en-CA') : String(spec.value)}<small className={`evidence-badge ${spec.status}`}>{statusLabel[spec.status]}</small></span>;
}
export function SourceStatus({ car }) {
  const enrichment = car.enrichment;
  if (enrichment?.status === 'loading') return <p className="source-status" role="status">Checking VIN and Canadian fuel data… Seller details are ready.</p>;
  if (!enrichment) return null;
  const { vin, fuel } = enrichment;
  return <div className="source-status"><p>{vin?.mismatches?.length ? 'VIN/listing mismatch — review before deciding.' : vin?.status === 'decoded' ? 'VIN decoded · Original vehicle specifications available' : vin?.reason || 'VIN data unavailable.'}</p><p>{fuel?.status === 'matched' ? `${fuel.combined.toFixed(1)} L/100 km combined · NRCan configuration match` : fuel?.reason || 'No verified fuel configuration match.'}</p></div>;
}
export default function VehicleEvidence({ car, scenario }) {
  const { specs, features } = extractVehicleSpecs(car);
  const vin = car.enrichment?.vin, fuel = car.enrichment?.fuel;
  const cost = scenario && annualFuelCost(fuel, scenario);
  return <details className="vehicle-evidence"><summary>Specifications, amenities &amp; sources</summary><div className="evidence-content">
    <SourceStatus car={car} />
    {!!vin?.mismatches?.length && <div className="warning-details"><strong>Resolve VIN/listing differences</strong>{vin.mismatches.map(item => <p key={item.field}>{item.field}: seller lists {String(item.listing)}; VIN record lists {String(item.vin)}. VIN-derived fields and fuel matching are withheld.</p>)}</div>}
    <p className="evidence-legend">Seller-reported = a listing claim. VIN record = manufacturer-submitted original specifications. Corroborated = the two agree. None verifies current condition or installed equipment.</p>
    <dl className="evidence-specs">{Object.entries(FIELD_LABELS).filter(([key]) => !['transmissionCode'].includes(key)).map(([key, label]) => <div key={key}><dt>{label}</dt><dd><SpecValue spec={specs[key]} />{specs[key].evidence.map((item, index) => <span className="spec-citation" key={index}>{item.type === 'vpic' ? <a href={VPIC_SOURCE} target="_blank" rel="noopener noreferrer">NHTSA vPIC ↗</a> : safeUrl(car.sourceUrl) ? <a href={safeUrl(car.sourceUrl)} target="_blank" rel="noopener noreferrer">{item.source} ↗</a> : item.source} · “{item.quote}”</span>)}</dd></div>)}</dl>
    <h3>Documented comfort amenities</h3><div className="feature-evidence">{Object.entries(features).map(([label, item]) => <div key={label}><span>{label}</span><strong className={item.value === true ? 'present' : ''}>{item.status === 'conflict' ? 'Conflicting claims' : item.value === null ? 'Unknown' : item.value ? 'Reported present' : 'Reported absent / not working'}</strong>{!!item.evidence.length && <small>{[...new Set(item.evidence.map(e => e.source))].join(' · ')}</small>}</div>)}</div>
    <div className="fuel-evidence"><h3>Canadian fuel-consumption reference</h3>{fuel?.status === 'matched' ? <><p>{fuel.row.year} {fuel.row.make} {fuel.row.model} · {fuel.row.displacement} L · {fuel.row.cylinders} cylinders · {fuel.row.transmission} · {FUEL_LABELS[fuel.fuel]}</p><p><strong>{fuel.combined.toFixed(1)} L/100 km combined</strong> · City {fuel.city} · Highway {fuel.highway}</p>{cost != null && <p>Fuel scenario: <strong>${cost.toLocaleString('en-CA', { maximumFractionDigits: 0 })} CAD/year</strong> at {scenario.annualKm.toLocaleString('en-CA')} km/year and ${scenario.pricePerLitre.toFixed(2)}/L. An editable assumption, not a current pump price or total ownership cost.</p>}<p>{fuel.reason} {fuel.adjusted && 'Pre-2015 values are adjusted estimates, not new 5-cycle tests.'} Actual use varies with driving and vehicle condition.</p></> : <p>{fuel?.reason || 'No reliable configuration match. No fuel rating or cost is assigned.'} Electric and plug-in hybrid consumption is not covered by this matcher.</p>}<a href={NRCAN_SOURCE} target="_blank" rel="noopener noreferrer">NRCan official dataset ↗</a><p>Reference snapshot: 29 October 2026. Contains information licensed under the <a href="https://open.canada.ca/en/open-government-licence-canada" target="_blank" rel="noopener noreferrer">Open Government Licence – Canada</a>. Adapted reference data; no government endorsement.</p></div>
    <p className="evidence-legend"><a href={VPIC_SOURCE} target="_blank" rel="noopener noreferrer">NHTSA vPIC ↗</a> decodes vehicle identity and supported original specifications. It provides no accident or ownership history. Empty decoded fields stay unknown.</p>
  </div></details>;
}
