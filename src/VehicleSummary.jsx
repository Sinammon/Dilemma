import React from 'react';
import { extractVehicleSpecs, FIELD_LABELS } from './vehicle-specs.js';
import VehicleEvidence, { SpecValue, SourceStatus } from './VehicleEvidence.jsx';
import ModelResearch, { ResearchClaim } from './ModelResearch.jsx';
import { researchForCar } from './model-research.js';

const summaryKeys = ['displacement', 'horsepower', 'torque', 'transmission', 'drivetrain', 'bodyType', 'seats'];
export const INDIVIDUAL_CHECKS = 'Current mechanical condition, accident history, maintenance, modifications and recall completion are not verified by these sources. Confirm installed equipment and arrange an independent inspection.';

export default function VehicleSummary({ car }) {
  const { specs, features } = extractVehicleSpecs(car);
  const documented = summaryKeys.filter(key => ['vin-record', 'corroborated'].includes(specs[key].status));
  const seller = summaryKeys.filter(key => specs[key].status === 'seller-reported');
  const gaps = summaryKeys.filter(key => specs[key].value == null);
  const amenities = Object.entries(features).filter(([, item]) => item.value === true).map(([name]) => name);
  const research = researchForCar(car);
  return <div className="vehicle-summary">
    <SourceStatus car={car} />
    <h3>Documented original specifications</h3>
    {documented.length ? <dl className="summary-specs">{documented.map(key => <div key={key}><dt>{FIELD_LABELS[key]}</dt><dd><SpecValue spec={specs[key]} /></dd></div>)}</dl> : <p>No supported original VIN specifications for these key details yet.</p>}
    <h3>Seller-reported claims</h3>
    {seller.length ? <dl className="summary-specs">{seller.map(key => <div key={key}><dt>{FIELD_LABELS[key]}</dt><dd><SpecValue spec={specs[key]} /></dd></div>)}</dl> : <p>No uncorroborated key specification claims available.</p>}
    <p>Amenities reported present: {amenities.join(', ') || 'none documented'}. Missing mentions do not mean equipment is absent.</p>
    <h3>Typical model information</h3>{research.status === 'matched' ? <>{research.claims.filter(claim => claim.category === 'strengths').map(claim => <ResearchClaim key={claim.id} claim={claim} />)}<p>General model context only; this car's equipment and condition remain unverified.</p></> : <p>{research.reason}</p>}<ModelResearch car={car} />
    <h3>Still to verify on this car</h3><p>{gaps.length ? `Missing or conflicting specifications: ${gaps.map(key => FIELD_LABELS[key]).join(', ')}. ` : ''}{INDIVIDUAL_CHECKS}</p>
    <VehicleEvidence car={car} />
  </div>;
}
