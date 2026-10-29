import React, { useState } from 'react';
import { unknown, vehicleName, safeUrl, specification, mileageDisplay, priceDisplay, resolveMileage } from './vehicle-data.js';
import { m, useReducedMotion } from 'motion/react';
import { extractVehicleSpecs } from './vehicle-specs.js';
import VehicleEvidence, { SpecValue, SourceStatus } from './VehicleEvidence.jsx';

export function VehicleImage({ car }) {
  const [index, setIndex] = useState(0);
  const images = car.images || [];
  const url = safeUrl(images[index]);
  return <div className="vehicle-image">{url ? <img src={url} alt={vehicleName(car)} referrerPolicy="no-referrer" onError={() => setIndex(i => i + 1)} /> : <div className="image-placeholder"><span aria-hidden="true">◇</span>Image unavailable</div>}
    <span className="source-pill">Seller listing · eBay</span>
    {images.length > 1 && url && <button className="photo-next" aria-label={`Next photo of ${vehicleName(car)}`} onClick={() => setIndex(i => (i + 1) % images.length)}>›</button>}
  </div>;
}
export const locationDisplay = car => [car.location?.city, car.location?.stateOrProvince, car.location?.postalCode, car.location?.country].filter(Boolean).join(', ') || 'Unknown';
export function ListingLink({ car }) {
  const url = safeUrl(car.sourceUrl);
  return url ? <a className="source-link" href={url} target="_blank" rel="noopener noreferrer">Original eBay listing ↗</a> : <span className="car-meta">Listing link unknown</span>;
}
export default function VehicleComparison({ cars, removeCar, clearCars, importForm, navigate }) {
  const reduced = useReducedMotion();
  const records = new Map(cars.map(car => [car, extractVehicleSpecs(car)]));
  const spec = (car, key) => <SpecValue spec={records.get(car).specs[key]} />;
  const rows = [
    ['Asking price', priceDisplay], ['Year', c => spec(c, 'year')], ['Make', c => spec(c, 'make')], ['Model', c => spec(c, 'model')],
    ['Mileage and unit', mileageDisplay],
    ['Transmission', c => spec(c, 'transmission')],
    ['Fuel type', c => spec(c, 'fuelType')],
    ['Engine', c => unknown(specification(c, 'engine', 'engine size', 'engine displacement'))],
    ['Body type', c => unknown(specification(c, 'body type', 'body style'))],
    ['Power', c => unknown(specification(c, 'horsepower', 'horse power', 'power', 'engine power'))],
    ['Drivetrain', c => unknown(specification(c, 'drivetrain', 'drive type'))],
    ['Condition', c => unknown(c.condition)], ['Location', locationDisplay], ['VIN', c => unknown(c.vin)],
    ['Engine displacement (L)', c => spec(c, 'displacement')], ['Engine configuration', c => spec(c, 'engineType')],
    ['Cylinders', c => spec(c, 'cylinders')], ['Power (hp)', c => spec(c, 'horsepower')], ['Torque (Nm)', c => spec(c, 'torque')],
    ['Drivetrain (supported)', c => spec(c, 'drivetrain')], ['Body type (supported)', c => spec(c, 'bodyType')], ['Seats', c => spec(c, 'seats')],
    ['NRCan combined fuel', c => c.enrichment?.fuel?.status === 'matched' ? `${c.enrichment.fuel.combined} L/100 km · NRCan` : 'Unknown · No reliable match'],
  ];
  const aspectNames = [...new Set(cars.flatMap(car => (car.itemSpecifics || []).map(a => a.name).filter(Boolean)))];
  return <section className="comparison-section page-section">
    <div className="section-heading"><div><p className="eyebrow">02 / COMPARE · {cars.length} OF 4 CONTENDERS</p><h1 tabIndex={-1}>Compare Your Vehicles</h1><p className="page-intro">The seller details, together. Find the differences that matter.</p></div>{!!cars.length && <button className="text-button" onClick={clearCars}>Clear comparison</button>}</div>
    <div className="comparison-import">{importForm}</div>
    {!cars.length ? <div className="empty-state"><h2>Your shortlist is ready for its first car.</h2><p>Import an eBay.ca listing above. Missing specifications will stay Unknown.</p></div> : <>
      <div className="car-grid" style={{ '--columns': cars.length }}>{cars.map((car, i) => <m.article className="car-card" key={car.legacyItemId} initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : 0.38 }}><VehicleImage car={car} /><div className="car-card-body"><div className="card-topline"><span>CONTENDER {String(i + 1).padStart(2, '0')}</span><button className="remove-button" aria-label={`Remove ${vehicleName(car)}`} onClick={() => removeCar(car.legacyItemId)}>×</button></div><h2 className="vehicle-name">{vehicleName(car)}</h2><p className="car-price">{priceDisplay(car)}</p><p className="car-meta">{mileageDisplay(car)}</p><p className="car-meta">{locationDisplay(car)}</p><ListingLink car={car} /></div></m.article>)}</div>
      <div className="source-status-grid">{cars.map(car => <div key={car.legacyItemId}><strong>{vehicleName(car)}</strong><SourceStatus car={car} /><VehicleEvidence car={car} /></div>)}</div>
      <div className="table-heading"><h2>The details, side by side</h2><p>Sources are labeled. Unknown means missing or conflicting; seller claims are not independently verified.</p></div>
      <div className="table-scroll" role="region" aria-label="Vehicle comparison table" tabIndex={0}><table><caption className="sr-only">Available seller specifications for shortlisted vehicles</caption><thead><tr><th scope="col">Specification</th>{cars.map(car => <th scope="col" key={car.legacyItemId}>{vehicleName(car)}</th>)}</tr></thead><tbody>{rows.map(([label, format]) => <tr key={label}><th scope="row">{label}</th>{cars.map(car => <td key={car.legacyItemId}>{format(car)}</td>)}</tr>)}</tbody></table></div>
      <details className="specifics"><summary>All available seller specifications</summary><div className="table-scroll" tabIndex={0}><table><thead><tr><th scope="col">Specification</th>{cars.map(car => <th scope="col" key={car.legacyItemId}>{vehicleName(car)}</th>)}</tr></thead><tbody>{aspectNames.length ? aspectNames.map(name => <tr key={name}><th scope="row">{name}</th>{cars.map(car => <td key={car.legacyItemId}>{unknown(specification(car, name.trim().toLowerCase()))}</td>)}</tr>) : <tr><td colSpan={cars.length + 1}>Unknown</td></tr>}</tbody></table></div></details>
      <h2 className="description-heading">From the sellers</h2><div className="description-grid">{cars.map(car => { const mileage = resolveMileage(car); return <details key={car.legacyItemId}><summary>{vehicleName(car)} · Seller description &amp; mileage evidence</summary><div className="seller-context"><ListingLink car={car} /><p><strong>Original headline:</strong> {unknown(car.title)}</p><p>{car.description || 'Unknown'}</p><p><strong>Mileage:</strong> {mileage.reason}</p>{mileage.evidence.map((e, i) => <p key={i}>{e.source} → {e.unit}</p>)}</div></details>; })}</div>
      <div className="decide-cta"><div><p className="eyebrow">THE DETAILS ARE HERE. WHAT MATTERS TO YOU?</p><h2>Turn your shortlist into a decision.</h2><p>Choose a decision mode and see an explainable recommendation.</p></div><button onClick={() => navigate('decide')}>Help Me Decide →</button></div>
    </>}
    <p className="data-note">eBay data is temporary and may change. Confirm identity, mileage and seller claims. Refreshing clears this shortlist.</p>
  </section>;
}
