import { extractVehicleSpecs, normalized, FIELD_LABELS } from './vehicle-specs.js';
import { sellerText } from './mileage.js';

const lbFtToNm = 1.355817948;
const source = (publisher, title, url, locator) => ({ publisher, title, url, locator, reviewed: '2026-10-30' });
const honda = source('Honda Canada', '2018 Civic Sedan Specifications', 'https://hondanews.ca/en-CA/releases/release-4fade6c61d0220ec4eba0c8716005e14-2018-civic-sedan-press-kit', 'ENGINE and TRANSMISSION tables');
const toyota = source('Toyota Canada', '2019 Corolla — CVT Transmission Specifications', 'https://media.toyota.ca/content/dam/media-toyota/general/unassigned/20145/2019_Toyota_Corolla__CVT_Transmission.pdf', 'Pages 7–8: engine, transmission, power and torque; CE, LE, LE ECO, SE columns');
const mazda = source('Mazda Canada', '2017 Mazda3 Canadian brochure (archived manufacturer document)', 'https://cdn.dealereprocess.org/cdn/brochures/mazda/ca/2017-mazda3.pdf', 'Page 4: GX/GS and GT specifications; sedan and Sport engineering');
const dodge = source('DaimlerChrysler / Dodge', '2005 Dodge Sprinter Van Specifications', 'https://s3.amazonaws.com/chryslermedia.iconicweb.com/mediasite/attachments/sprinterspecifications.pdf', 'Page 1: 2.7-liter I-5 turbodiesel and five-speed automatic');
const ford = source('Ford Motor Company', 'Thunderbird Soars High Once Again (manufacturer release archived by The Auto Channel)', 'https://www.theautochannel.com/news/2002/05/27/141007.html', 'Powertrain: 3.9-liter DOHC V8, output and five-speed automatic');

// Reviewed factory ratings only, never listing records. Each row groups configurations
// with identical output. Trim is required where it distinguishes otherwise identical engines.
const row = (id, year, make, models, market, requirements, trims, hp, lbFt, reference) => ({
  id, year, make, models, market, requirements, trims, source: reference,
  values: { horsepower: hp, torque: lbFt * lbFtToNm },
  quotes: { horsepower: `${hp} hp (factory rating)`, torque: `${lbFt} lb-ft (factory rating; converted to Nm)` },
});
export const FACTORY_SPECS = [
  row('civic-ca-2018-20', 2018, 'Honda', ['Civic', 'Civic Sedan'], 'CA', { bodyType: ['Sedan'], displacement: [2], cylinders: [4], fuelType: ['Gasoline'], drivetrain: ['FWD'], transmission: ['Manual'], transmissionSpeeds: [6] }, ['DX', 'LX'], 158, 138, honda),
  row('civic-ca-2018-20-cvt', 2018, 'Honda', ['Civic', 'Civic Sedan'], 'CA', { bodyType: ['Sedan'], displacement: [2], cylinders: [4], fuelType: ['Gasoline'], drivetrain: ['FWD'], transmission: ['CVT'] }, ['LX', 'EX'], 158, 138, honda),
  row('civic-ca-2018-15', 2018, 'Honda', ['Civic', 'Civic Sedan'], 'CA', { bodyType: ['Sedan'], displacement: [1.5], cylinders: [4], fuelType: ['Gasoline'], drivetrain: ['FWD'], transmission: ['CVT'] }, ['EX-T', 'Touring'], 174, 162, honda),
  row('corolla-ca-2019-cvt', 2019, 'Toyota', ['Corolla', 'Corolla Sedan'], 'CA', { bodyType: ['Sedan'], displacement: [1.8], cylinders: [4], fuelType: ['Gasoline'], drivetrain: ['FWD'], transmission: ['CVT'], trim: ['CE', 'LE', 'SE'] }, ['CE', 'LE', 'SE'], 132, 128, toyota),
  row('corolla-ca-2019-eco', 2019, 'Toyota', ['Corolla', 'Corolla Sedan'], 'CA', { bodyType: ['Sedan'], displacement: [1.8], cylinders: [4], fuelType: ['Gasoline'], drivetrain: ['FWD'], transmission: ['CVT'], trim: ['LE ECO'] }, ['LE ECO'], 140, 126, toyota),
  row('mazda3-ca-2017-20', 2017, 'Mazda', ['Mazda3', 'Mazda 3', '3', 'Mazda3 Sport'], 'CA', { bodyType: ['Sedan', 'Hatchback'], displacement: [2], cylinders: [4], fuelType: ['Gasoline'], drivetrain: ['FWD'], transmission: ['Manual', 'Automatic'], transmissionSpeeds: [6] }, ['GX', 'GS'], 155, 150, mazda),
  row('mazda3-ca-2017-25', 2017, 'Mazda', ['Mazda3', 'Mazda 3', '3', 'Mazda3 Sport'], 'CA', { bodyType: ['Sedan', 'Hatchback'], displacement: [2.5], cylinders: [4], fuelType: ['Gasoline'], drivetrain: ['FWD'], transmission: ['Manual', 'Automatic'], transmissionSpeeds: [6] }, ['GT'], 184, 185, mazda),
  row('sprinter-us-2005', 2005, 'Dodge', ['Sprinter', 'Sprinter 2500', 'Sprinter 3500'], 'US', { bodyType: ['Van'], displacement: [2.7], cylinders: [5], fuelType: ['Diesel'], transmission: ['Automatic'], transmissionSpeeds: [5] }, null, 154, 243, dodge),
  row('thunderbird-us-2002', 2002, 'Ford', ['Thunderbird'], 'US', { bodyType: ['Convertible'], displacement: [3.9], cylinders: [8], fuelType: ['Gasoline'], drivetrain: ['RWD'], transmission: ['Automatic'], transmissionSpeeds: [5] }, ['Deluxe', 'Premium', 'Neiman Marcus'], 252, 267, ford),
];

const same = (a, b) => typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 0.06 : normalized(a) === normalized(b);
export function matchFactorySpecs(car, rows = FACTORY_SPECS) {
  // Do not let a previous factory match supply its own matching inputs.
  const { specs } = extractVehicleSpecs({ ...car, enrichment: { ...car.enrichment, factorySpecs: undefined, modelSpecs: undefined } });
  const fail = (status, reason, missing = []) => ({ status, reason, missing });
  const conflicts = Object.entries(specs).filter(([key, spec]) => !['horsepower', 'torque', 'seats'].includes(key) && spec.status === 'conflict').map(([key]) => FIELD_LABELS[key]);
  if (conflicts.length) return fail('conflict', `Resolve conflicting ${conflicts.join(', ')} before matching factory specifications.`);
  const identity = ['year', 'make', 'model'];
  const absent = identity.filter(key => specs[key].value == null);
  if (absent.length) return fail('insufficient', `Factory lookup needs ${absent.map(k => FIELD_LABELS[k]).join(', ')}.`, absent);
  let candidates = rows.filter(r => r.year === specs.year.value && same(r.make, specs.make.value) && r.models.some(model => same(model, specs.model.value)));
  if (!candidates.length) return fail('unavailable', 'This year/model is outside the reviewed factory-reference coverage; ask the seller for power specifications.');
  if (specs.market.value == null) return fail('insufficient', 'Original market needed for factory specifications; Canadian listing location does not establish Canadian-market specification.', ['market']);
  candidates = candidates.filter(r => same(r.market, specs.market.value));
  // Modified/swapped engines cannot be represented by original factory output.
  const text = sellerText([car.title, car.description, ...(car.itemSpecifics || []).map(a => `${a.name}: ${a.value}`)].filter(Boolean).join('\n'));
  if (same(specs.make.value, 'Honda') && /\b(?:Si|Type[- ]?R)\b/i.test(text)) return fail('unmatched', 'Civic Si and Type R require separate factory references; confirm the exact variant.');
  if (/\b(?:tuned|remapped|engine swap|swapped engine|replacement engine|modified engine|supercharger kit|turbo kit)\b/i.test(text)) return fail('unavailable', 'Engine modifications are mentioned; confirm the current powertrain before using factory ratings.');
  candidates = candidates.filter(r => (!specs.trim.value || !r.trims || r.trims.some(trim => same(trim, specs.trim.value))) && Object.entries(r.requirements).every(([key, allowed]) => specs[key].value == null || allowed.some(value => same(value, specs[key].value))));
  if (!candidates.length) return fail('unmatched', 'No reviewed factory configuration matches this market, engine, trim and transmission. Confirm those details with the seller.');
  const missing = [...new Set(candidates.flatMap(r => Object.keys(r.requirements).filter(key => specs[key].value == null)))];
  if (missing.length) return fail('insufficient', `${missing.map(k => FIELD_LABELS[k]).join(', ')} needed for factory specifications.`, missing);
  if (candidates.length !== 1) return fail('ambiguous', 'Multiple factory configurations match; confirm the engine/trim before assigning power.');
  const matched = candidates[0];
  return { status: 'matched', referenceId: matched.id, source: matched.source, values: { ...matched.values }, quotes: { ...matched.quotes },
    configuration: { year: matched.year, make: matched.make, model: specs.model.value, market: matched.market, ...Object.fromEntries(Object.keys(matched.requirements).map(key => [key, specs[key].value])), ...(specs.trim.value ? { trim: specs.trim.value } : {}) },
    reason: 'Exact configuration matched to reviewed manufacturer specifications. Factory ratings are reference values, not measured output or verification of this used vehicle.' };
}
