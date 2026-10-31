import React, { useState } from 'react';
import { unknown, vehicleName, safeUrl, specification, mileageDisplay, priceDisplay, resolveMileage } from './vehicle-data.js';
import { m } from 'motion/react';
import { extractVehicleSpecs, FIELD_LABELS } from './vehicle-specs.js';
import { SpecValue, ResearchAction } from './VehicleEvidence.jsx';
import VehicleSummary from './VehicleSummary.jsx';
import Icon from './Icons.jsx';
import { detectWarnings } from './decision-engine.js';

export function vehicleImageUrl(car, index = 0) {
  const value = (car.images || [])[index];
  return safeUrl(value) || (car.demo === true && /^\/images\/preview\/(civic|corolla|mazda3|jetta)\.jpg$/.test(value) ? value : null);
}
export function VehicleImage({ car }) {
  const [index, setIndex] = useState(0);
  const images = car.images || [];
  const url = vehicleImageUrl(car, index);
  return <div className="vehicle-image">{url ? <img src={url} alt={car.demo ? `${car.make} ${car.model} model-example photo; fictional vehicle details` : vehicleName(car)} referrerPolicy="no-referrer" onError={() => setIndex(i => i + 1)} /> : <div className="image-placeholder"><Icon name="engine" size={32} />Image unavailable</div>}
    <span className="source-pill">{car.demo ? 'Model photo · fictional details' : 'Seller listing · eBay'}</span>
    {images.length > 1 && url && <button className="photo-next" aria-label={`Next photo of ${vehicleName(car)}`} onClick={() => setIndex(i => (i + 1) % images.length)}><Icon name="chevron" size={20} /></button>}
  </div>;
}
export const locationDisplay = car => [car.location?.city, car.location?.stateOrProvince, car.location?.postalCode, car.location?.country].filter(Boolean).join(', ') || 'Unknown';
export function ListingLink({ car }) {
  if (car.demo) return <span className="car-meta">Fictional demo · not an eBay listing</span>;
  const url = safeUrl(car.sourceUrl);
  return url ? <a className="source-link" href={url} target="_blank" rel="noopener noreferrer">Original eBay listing ↗</a> : <span className="car-meta">Listing link unknown</span>;
}
function ComparisonWarnings({ car }) {
  const warnings = detectWarnings(car);
  return warnings.length > 0 && <div className="warning-details" role="note"><strong>Review before choosing</strong>{warnings.map(warning => <p key={warning.label}>{warning.label}: {warning.evidence}</p>)}</div>;
}
export default function VehicleComparison({ cars, removeCar, clearCars, importForm, navigate, retryResearch, clearSavedSpecs }) {
  const records = new Map(cars.map(car => [car, extractVehicleSpecs(car)]));
  const spec = (car, key) => <SpecValue spec={records.get(car).specs[key]} />;
  const keyFields = ['transmission', 'transmissionSpeeds', 'displacement', 'engineType', 'induction', 'cylinders', 'horsepower', 'torque', 'curbWeightKg', 'zeroTo100KphSeconds', 'zeroTo60MphSeconds', 'drivetrain', 'fuelType', 'bodyType', 'seats'];
  const sharedGaps = keyFields.filter(key => cars.every(car => records.get(car).specs[key].status === 'unknown'));
  const rows = [
    ['Asking price · seller', priceDisplay], ['Mileage and unit · seller', mileageDisplay],
    ...keyFields.filter(key => !sharedGaps.includes(key)).map(key => [FIELD_LABELS[key], c => spec(c, key)]),
    ...(cars.some(c => c.enrichment?.fuel?.status === 'matched') ? [['NRCan combined reference', c => c.enrichment?.fuel?.status === 'matched' ? `${c.enrichment.fuel.combined} L/100 km · configuration match` : 'No reliable configuration match']] : []),
  ];
  const aspectNames = [...new Set(cars.flatMap(car => (car.itemSpecifics || []).map(a => a.name).filter(Boolean)))];
  return <section className="comparison-section page-section">
    <div className="section-heading"><div><h1 tabIndex={-1}>Compare Your Vehicles</h1><p className="page-intro">Key facts, sourced model context and the questions still worth asking.</p><p className="shortlist-count">{cars.length} of 4 contenders</p></div>{!!cars.length && <button className="text-button" onClick={clearCars}>Clear comparison</button>}</div>
    {clearSavedSpecs && <button type="button" className="text-button" data-action="clear-saved-specs" onClick={clearSavedSpecs}>Clear saved model specs</button>}
    <p className="evidence-legend">Model specifications may be saved on this device. Listing details remain temporary.</p>
    <div className="comparison-import">{importForm}</div>
    {!cars.length ? <div className="empty-state"><h2>Your shortlist is ready for its first car.</h2><p>Import an eBay.ca listing above. Missing specifications will stay Unknown.</p></div> : <>
      <div className="car-grid" style={{ '--columns': cars.length }}>{cars.map((car, i) => <m.article className="car-card" key={car.legacyItemId}><VehicleImage car={car} /><div className="car-card-body"><div className="card-topline"><span>Contender {i + 1}</span><button className="remove-button" aria-label={`Remove ${vehicleName(car)}`} onClick={() => removeCar(car.legacyItemId)}><Icon name="close" size={18} /></button></div><h2 className="vehicle-name">{vehicleName(car)}</h2><p className="car-price">{priceDisplay(car)}</p><p className="car-meta">{mileageDisplay(car)}</p><p className="car-meta">{locationDisplay(car)}</p><ComparisonWarnings car={car} /><ResearchAction car={car} retryResearch={retryResearch} /><ListingLink car={car} /></div></m.article>)}</div>
      {cars.some(car => car.demo) && <p className="demo-notice" role="status">Demo mode: prices, mileage and listing claims are fictional. Model research and NRCan reference data are real. No live eBay listing or VIN history is represented.</p>}
      <div className="table-heading"><h2>Key differences, side by side</h2><p>Only available comparison factors appear here. Sources are labeled; seller claims need confirmation.</p></div>
      <p className="scroll-hint">Scroll the table sideways to compare every contender.</p>
      <div className="table-scroll" role="region" aria-label="Vehicle comparison table" tabIndex={0}><table><caption className="sr-only">Source-labeled key specifications for shortlisted vehicles</caption><thead><tr><th scope="col">Specification</th>{cars.map(car => <th scope="col" key={car.legacyItemId}>{vehicleName(car)}</th>)}</tr></thead><tbody>{rows.map(([label, format]) => <tr key={label}><th scope="row">{label}</th>{cars.map(car => <td key={car.legacyItemId}>{format(car)}</td>)}</tr>)}</tbody></table></div>
      {!!sharedGaps.length && <p className="shared-gaps">Not documented for any contender: {sharedGaps.map(key => FIELD_LABELS[key]).join(', ')}. Typical model lookup fills gaps when applicable sources are available.</p>}
      <div className="table-heading"><h2>What we know, and what to check</h2><p>Open a vehicle's evidence to review its original records, seller claims and typical model information.</p></div><div className="source-status-grid">{cars.map(car => <details className="vehicle-review" key={car.legacyItemId}><summary>{vehicleName(car)}</summary><VehicleSummary car={car} retryResearch={retryResearch} /></details>)}</div>
      <details className="specifics"><summary>All available seller specifications</summary><div className="table-scroll" tabIndex={0}><table><thead><tr><th scope="col">Specification</th>{cars.map(car => <th scope="col" key={car.legacyItemId}>{vehicleName(car)}</th>)}</tr></thead><tbody>{aspectNames.length ? aspectNames.map(name => <tr key={name}><th scope="row">{name}</th>{cars.map(car => <td key={car.legacyItemId}>{unknown(specification(car, name.trim().toLowerCase()))}</td>)}</tr>) : <tr><td colSpan={cars.length + 1}>No item specifics supplied.</td></tr>}</tbody></table></div></details>
      <h2 className="description-heading">From the sellers</h2><div className="description-grid">{cars.map(car => { const mileage = resolveMileage(car); return <details key={car.legacyItemId}><summary>{vehicleName(car)} · Seller description &amp; mileage evidence</summary><div className="seller-context"><ListingLink car={car} /><p><strong>Original headline:</strong> {unknown(car.title)}</p><p>{car.description || 'Unknown'}</p><p><strong>Mileage:</strong> {mileage.reason}</p>{mileage.evidence.map((e, i) => <p key={i}>{e.source}: “{e.quote}” → {e.amount ?? ''} {e.unit || 'unit unclear'}</p>)}</div></details>; })}</div>
      <div className="decide-cta"><div><h2>Turn your shortlist into a decision.</h2><p>Choose a decision mode and see an explainable recommendation.</p></div><button onClick={() => navigate('decide')}>Help Me Decide <Icon name="arrow" size={20} /></button></div>
    </>}
    <p className="data-note">eBay data is temporary and may change. Confirm identity, mileage and seller claims. Refreshing clears this shortlist.</p>
  </section>;
}
