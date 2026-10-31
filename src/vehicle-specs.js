import { sellerText } from './mileage.js';
import { CONFIG_FIELDS, MODEL_FIELDS, modelSpecsInput, usableModelFinding } from '../shared/model-specs.js';

export const normalized = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const number = value => /^\d+(?:\.\d+)?$/.test(String(value).trim()) ? Number(value) : null;
const positive = value => number(value) > 0 ? number(value) : null;
export const FIELD_LABELS = { year: 'Year', make: 'Make', model: 'Model', trim: 'Trim', market: 'Original market', displacement: 'Engine displacement (L)', engineType: 'Engine configuration', induction: 'Induction', cylinders: 'Cylinders', horsepower: 'Power (hp)', torque: 'Torque (Nm)', transmission: 'Transmission', transmissionSpeeds: 'Transmission speeds', transmissionCode: 'Transmission code', drivetrain: 'Drivetrain', fuelType: 'Fuel type', bodyType: 'Body type', seats: 'Seating capacity' };
// A seating difference still requires review, but does not change model identity
// or engine/body configuration. Never let research replace that seller value.
export const researchVinMismatches = car => (car.enrichment?.vin?.mismatches || []).filter(item => item.field !== FIELD_LABELS.seats);
export const FEATURE_RULES = [
  ['Heated seats', /\bheated (?:front |rear )?seats?\b/i], ['Leather seats', /\b(?:full[- ]grain )?leather (?:seats?|interior|upholstery)\b/i],
  ['Navigation', /\b(?:navigation|gps)\b/i], ['Backup camera', /\b(?:backup|back[- ]up|rear[- ]?view|reversing) camera\b/i],
  ['Sunroof', /\b(?:sunroof|moonroof)\b/i], ['Bluetooth', /\bbluetooth\b/i],
  ['Air conditioning', /\b(?:air conditioning|a\/c)\b/i], ['Cruise control', /\b(?:adaptive )?cruise control\b/i],
  ['Climate control', /\b(?:(?:dual|three|tri)[- ]zone (?:automatic )?)?climate control\b/i],
  ['Heated steering wheel', /\bheated steering wheel\b/i], ['Ventilated seats', /\b(?:ventilated|cooled) (?:front )?seats?\b/i],
  ['Power seats', /\b(?:power|electric)(?:[- ]adjustable)? (?:front )?seats?\b/i],
  ['Apple CarPlay', /\b(?:apple )?carplay\b/i], ['Android Auto', /\bandroid auto\b/i],
  ['Parking sensors', /\b(?:front |rear )?parking sensors?\b/i], ['Remote start', /\bremote (?:engine )?start\b/i],
];

function normalize(key, value) {
  if (value == null || value === '' || /^(?:unknown|n\/?a|not specified)$/i.test(String(value).trim())) return null;
  const text = String(value).trim();
  if (key === 'market') return /^(?:ca|canada|canadian)$/i.test(text) ? 'CA' : /^(?:us|usa|united states|american)$/i.test(text) ? 'US' : text;
  if (['year', 'cylinders', 'seats', 'transmissionSpeeds'].includes(key)) {
    const n = positive(text);
    return Number.isInteger(n) && (key !== 'year' || n >= 1886 && n <= new Date().getFullYear() + 1) && (key !== 'seats' || n <= 100) ? n : null;
  }
  if (['displacement', 'horsepower', 'torque'].includes(key)) {
    const n = positive(value);
    return n == null ? null : key === 'displacement' ? Math.round(n * 10) / 10 : n;
  }
  if (key === 'drivetrain') {
    if (/\b(?:awd|all[- ]wheel|4wd\/4[- ]wheel\/4x4|4wd\/4[- ]wheel drive)\b/i.test(text)) return /awd|all[- ]wheel/i.test(text) ? 'AWD' : '4WD';
    if (/\b(?:4wd|4x4|four[- ]wheel|4[- ]wheel)\b/i.test(text)) return '4WD';
    if (/\b(?:fwd|front[- ]wheel)\b/i.test(text)) return 'FWD';
    if (/\b(?:rwd|rear[- ]wheel)\b/i.test(text)) return 'RWD';
    return null;
  }
  if (key === 'transmission') {
    if (/\b(?:cvt|continuously variable)|^AV\d*$/i.test(text)) return 'CVT';
    if (/dual[- ]clutch|automated manual|^AM\d+$/i.test(text)) return 'Dual-clutch / automated manual';
    if (/automatic|^A(?:S)?\d+$/i.test(text)) return 'Automatic';
    if (/manual|^M\d+$/i.test(text)) return 'Manual';
    return null;
  }
  if (key === 'fuelType') {
    if (/gasoline|petrol|^gas$/i.test(text)) return 'Gasoline';
    if (/diesel/i.test(text)) return 'Diesel';
    if (/electric/i.test(text)) return 'Electric';
    if (/ethanol|e85|flex[- ]fuel/i.test(text)) return 'Ethanol / flex fuel';
    return null;
  }
  if (key === 'bodyType') {
    if (/suv|sport utility|crossover/i.test(text)) return 'SUV';
    if (/hatchback|liftback/i.test(text)) return 'Hatchback';
    if (/sedan|saloon/i.test(text)) return 'Sedan';
    if (/coupe|coupé/i.test(text)) return 'Coupe';
    if (/convertible|cabriolet/i.test(text)) return 'Convertible';
    if (/wagon|estate/i.test(text)) return 'Wagon';
    if (/pickup/i.test(text)) return 'Pickup';
    if (/minivan|van/i.test(text)) return 'Van';
    return null;
  }
  if (key === 'engineType') {
    if (/^v(?:[- ]?shaped|\d{1,2})?$/i.test(text)) return 'V';
    if (/^(?:i\d|in[- ]?line(?:[- ]?\d)?)/i.test(text)) return 'Inline';
    if (/^(?:boxer|flat)/i.test(text)) return 'Boxer / flat';
    if (/^(?:rotary|electric motor)$/i.test(text)) return text.toLowerCase();
    return null;
  }
  return text;
}

const aliases = {
  trim: ['trim', 'trim level', 'variant'], market: ['market', 'original market', 'market specification', 'market specifications'],
  displacement: ['engine displacement', 'engine displacement (l)', 'displacement (l)', 'engine size', 'engine size (l)', 'engine'],
  engineType: ['engine configuration', 'engine type', 'engine'], cylinders: ['cylinders', 'number of cylinders', 'engine cylinders'],
  horsepower: ['horsepower', 'horse power', 'power', 'engine power', 'power (hp)', 'horsepower (hp)'], torque: ['torque', 'engine torque', 'torque (nm)'],
  transmission: ['transmission', 'transmission type'], transmissionSpeeds: ['transmission speeds', 'number of gears'],
  drivetrain: ['drivetrain', 'drive type', 'drive system'], fuelType: ['fuel type', 'fuel'],
  bodyType: ['body type', 'body style'], seats: ['seating capacity', 'seats', 'number of seats'],
};

function patterns(text, structuredKey) {
  const values = [];
  const push = (key, value, quote) => { const canonical = normalize(key, value); if (canonical !== null) values.push({ key, value: canonical, quote }); };
  const addMatches = (pattern, key, convert = m => m[1]) => {
    for (const match of text.matchAll(pattern)) {
      const before = text.slice(Math.max(0, match.index - 65), match.index).split(/[;\n!?]|\.(?!\d)/).at(-1);
      const after = text.slice(match.index + match[0].length, match.index + match[0].length + 45);
      if (/\b(?:not|no|optional|available|may have)\s*(?:an?\s*)?$/i.test(before) || /\b(?:replacement|swapped|modified|tuned)\b/i.test(before) || /^\s*(?:optional|available|unknown)\b/i.test(after)) continue;
      if (key === 'transmission' && /^manual$/i.test(match[0]) && /^\s+(?:mode|shift|selection|control)\b/i.test(after)) continue;
      push(key, convert(match), match[0]);
    }
  };
  addMatches(/(?<![\w.])(\d(?:\.\d{1,3})?)\s*[- ]?(?:litres?|liters?|L)\b/gi, 'displacement');
  addMatches(/(?<![\w.])(\d{3,5})\s*cc\b/gi, 'displacement', m => Number(m[1]) / 1000);
  addMatches(/(?<![\w.,+\-])(\d{1,4}(?:\.\d+)?)\s*[-–]?\s*(hp|bhp|horse\s?power|kW|PS)\b/gi, 'horsepower', m => Number(m[1]) * (/kw/i.test(m[2]) ? 1.34102209 : /^ps$/i.test(m[2]) ? 0.98632007 : 1));
  addMatches(/\b(?:horse\s?power|hp|bhp)\s*(?::|=|is)\s*(\d{1,4}(?:\.\d+)?)(?![\w.])/gi, 'horsepower');
  addMatches(/(?<![\w.,+\-])(\d{1,4}(?:\.\d+)?)\s*(N\s*[.·•\-–]?\s*m|newton[- ]met(?:er|re)s?|lbs?\.?\s*[.·•\-–]?\s*ft\.?|ft\.?\s*[.·•\-–]?\s*lbs?\.?|pound[- ]feet|foot[- ]pounds?)\b/gi, 'torque', m => Number(m[1]) * (/lb|pound|feet/i.test(m[2]) ? 1.355817948 : 1));
  addMatches(/\b(?:Canadian|Canada|US|USA|United States)[- ](?:market|spec(?:ification)?s?)\b/gi, 'market', m => /^(?:canada|canadian)/i.test(m[0]) ? 'CA' : 'US');
  addMatches(/\b(?:V|I|inline[- ]?|flat[- ]?|boxer[- ]?)([34568]|10|12)\b/gi, 'cylinders');
  addMatches(/\b(\d{1,2})[- ]?(?:cylinders?|cyl)\b/gi, 'cylinders');
  addMatches(/\b(V[3468]|V10|V12|I[34568]|inline[- ]?[34568]|boxer|rotary|electric motor)\b/gi, 'engineType');
  addMatches(/\b(turbocharged|supercharged|naturally aspirated)\b/gi, 'induction');
  addMatches(/\b(automatic|manual|CVT|continuously variable|dual[- ]clutch|automated manual)\b/gi, 'transmission');
  addMatches(/\b(\d{1,2})[- ]speed\b/gi, 'transmissionSpeeds');
  addMatches(/\b(AWD|FWD|RWD|4WD|4x4|all[- ]wheel drive|front[- ]wheel drive|rear[- ]wheel drive|four[- ]wheel drive)\b/gi, 'drivetrain');
  addMatches(/\b(gasoline|petrol|diesel|electric|E85|flex[- ]fuel)\b/gi, 'fuelType');
  addMatches(/\b(sedan|saloon|coupe|hatchback|convertible|cabriolet|SUV|crossover|station wagon|pickup|minivan)\b/gi, 'bodyType');
  addMatches(/\b(?:seats?\s+(\d{1,2})|(\d{1,2})[- ](?:seats?|seater|passenger))\b/gi, 'seats', m => m[1] || m[2]);
  addMatches(/\b(?:seating capacity|number of seats)\s*(?::|is|=)?\s*(\d{1,2})\b/gi, 'seats');
  if (structuredKey) {
    if (structuredKey === 'horsepower' && /^(?:\d+(?:\.\d+)?)$/.test(text)) return values; // A bare number lacks a trustworthy power unit.
    if (!['horsepower', 'torque', 'displacement'].includes(structuredKey)) push(structuredKey, text, text);
    if (structuredKey === 'transmission' && /^(?:A[SMV]?|M)\d+$/i.test(text)) {
      push('transmissionCode', text.toUpperCase(), text);
      push('transmissionSpeeds', text.match(/\d+/)[0], text);
    }
  }
  return values;
}

function resolve(evidence, tolerance = 0) {
  const values = [...new Map(evidence.map(e => [typeof e.value === 'number' ? e.value.toFixed(2) : normalized(e.value), e.value])).values()];
  // Published whole-unit ratings can differ slightly after unit conversion.
  if (values.length > 1 && tolerance && values.every(v => typeof v === 'number') && Math.max(...values) - Math.min(...values) <= tolerance) values.splice(1);
  return { value: values.length === 1 ? values[0] : null, status: !values.length ? 'unknown' : values.length > 1 ? 'conflict' : evidence.some(e => e.type === 'factory-reference') ? evidence.some(e => e.type !== 'factory-reference') ? 'corroborated' : 'factory-reference' : evidence.some(e => e.type === 'vpic') ? evidence.some(e => e.type !== 'vpic') ? 'corroborated' : 'vin-record' : 'seller-reported', evidence };
}

export function specEvidenceLabel(spec) {
  if (spec.status === 'model-reference') return 'Typical model spec · AI-researched with cited sources';
  const factory = spec.evidence.some(item => item.type === 'factory-reference');
  if (factory) return spec.status === 'corroborated' ? 'Listing/VIN agrees with factory reference; not measured output' : 'Manufacturer factory reference; not measured output';
  return spec.status === 'vin-record' ? 'NHTSA original VIN record' : spec.status === 'corroborated' ? 'Seller claim + NHTSA VIN record' : 'Seller-reported';
}

export function extractVehicleSpecs(car) {
  const evidence = Object.fromEntries(Object.keys(FIELD_LABELS).map(key => [key, []]));
  const add = (key, value, source, type, quote) => { if (value != null) evidence[key].push({ value, source, type, quote }); };
  for (const key of ['year', 'make', 'model', 'trim', 'market']) {
    for (const value of [car[key]].flat()) add(key, normalize(key, value), 'eBay item specifics', 'seller-specifics', String(value ?? ''));
  }
  for (const aspect of car.itemSpecifics || []) {
    const fieldName = aspect.name?.trim().toLowerCase();
    const powerField = /^(?:engine )?(?:power|horse ?power)\s*\((hp|bhp|kw|ps)\)$/.exec(fieldName);
    const torqueField = /^(?:engine )?torque\s*\(([^)]+)\)$/.exec(fieldName);
    const key = powerField ? 'horsepower' : torqueField ? 'torque' : Object.keys(aliases).find(key => aliases[key].includes(fieldName));
    if (!key) continue;
    for (const value of [aspect.value].flat()) {
      const field = aspect.name.trim().toLowerCase();
      const unit = powerField?.[1] || torqueField?.[1] || (/^horse ?power$/.test(field) ? 'hp' : null);
      const labelledNumber = String(value ?? '').match(/^(\d+(?:\.\d+)?)(?:\s*@\s*\d[\d,]*\s*(?:rpm)?)?$/i);
      if (unit && labelledNumber) for (const item of patterns(`${labelledNumber[1]} ${unit}`)) if (item.key === key) add(item.key, item.value, `eBay: ${aspect.name}`, 'seller-specifics', `${aspect.name}: ${value}`);
      const explicitUnit = key === 'horsepower' && /^(?:horse ?power|power \(hp\)|horsepower \(hp\))$/.test(field) || key === 'displacement' && /\(l\)$/.test(field) || key === 'torque' && /\(nm\)$/.test(field);
      if (explicitUnit && positive(value)) add(key, normalize(key, value), `eBay: ${aspect.name}`, 'seller-specifics', String(value));
      for (const item of patterns(String(value ?? ''), key)) add(item.key, item.value, `eBay: ${aspect.name}`, 'seller-specifics', item.quote);
    }
  }
  for (const [text, source, type] of [[car.description, 'Seller description', 'seller-description'], [car.title, 'Listing title', 'seller-title']]) {
    for (const item of patterns(sellerText(text))) add(item.key, item.value, source, type, item.quote);
    // Unit-bearing labels also support table-like prose: Torque (lb-ft): 138.
    for (const match of sellerText(text).matchAll(/\b(power|horsepower|torque)\s*\(([^)]+)\)\s*[:=]?\s*(\d{1,4}(?:\.\d+)?)/gi)) {
      const before = sellerText(text).slice(Math.max(0, match.index - 65), match.index).split(/[;\n!?]|\.(?!\d)/).at(-1);
      const after = sellerText(text).slice(match.index + match[0].length);
      if (/\b(?:not|no|optional|available|may have|tuned|modified)\s*$/i.test(before) || /^\s*(?:optional|available|unknown)\b/i.test(after)) continue;
      const key = match[1].toLowerCase() === 'torque' ? 'torque' : 'horsepower';
      for (const item of patterns(`${match[3]} ${match[2]}`)) if (item.key === key) add(key, item.value, source, type, match[0]);
    }
  }
  const vin = car.enrichment?.vin;
  if (vin?.status === 'decoded' && !vin.mismatches?.length) {
    for (const [key, value] of Object.entries(vin.fields || {})) {
      if (!evidence[key]) continue;
      add(key, normalize(key, value), 'NHTSA vPIC', 'vpic', String(value ?? ''));
    }
  }
  const factory = car.enrichment?.factorySpecs;
  if (factory?.status === 'matched' && !vin?.mismatches?.length) {
    for (const key of ['horsepower', 'torque']) {
      const value = normalize(key, factory.values?.[key]);
      if (value != null) evidence[key].push({ value, source: factory.source.publisher, type: 'factory-reference', url: factory.source.url, quote: factory.quotes[key], configuration: factory.configuration });
    }
  }
  const specs = Object.fromEntries(Object.entries(evidence).map(([key, items]) => [key, resolve(items, ['horsepower', 'torque'].includes(key) ? 0.75 : 0)]));
  for (const key of ['horsepower', 'torque']) if (specs[key].status === 'unknown') specs[key].reason = factory?.reason || 'Factory specifications need an exact original market and engine/trim match; check the listing or ask the seller.';
  const features = Object.fromEntries(FEATURE_RULES.map(([label, pattern]) => {
    const claims = [];
    const texts = [['Seller description', sellerText(car.description)], ...(car.itemSpecifics || []).flatMap(a => [a.value].flat().filter(v => v != null && v !== '').map(v => [`eBay: ${a.name}`, `${a.name}: ${v}`]))];
    for (const [source, text] of texts) for (const match of text.matchAll(new RegExp(pattern.source, 'gi'))) {
      const before = text.slice(Math.max(0, match.index - 100), match.index).split(/[.;\n]|\bbut\b/i).at(-1);
      const after = text.slice(match.index + match[0].length, match.index + match[0].length + 60);
      if (/\b(?:optional|available|may have|might have|wish (?:it|this car) had|would like)\s*$/i.test(before) || /^\s*(?::\s*)?(?:optional|available|unknown|n\/?a|not specified)\b/i.test(after)) continue;
      const absent = /\b(?:not|no|without|not equipped with|does not have|doesn['’]t have)\s*(?:[^.;\n]*?(?:and|or|,)\s*)?$/i.test(before) || /^\s*(?::\s*)?(?:no|false|not (?:working|included|installed)|broken|inoperative|does not work)\b/i.test(after);
      claims.push({ value: !absent, source, type: source === 'Seller description' ? 'seller-description' : 'seller-specifics', quote: text.slice(Math.max(0, match.index - 30), match.index + match[0].length + 25) });
    }
    const result = resolve(claims);
    return [label, result];
  }));
  const research = car.enrichment?.modelSpecs;
  if (['matched', 'partial'].includes(research?.status) && !researchVinMismatches(car).length && !CONFIG_FIELDS.some(key => specs[key]?.status === 'conflict')) {
    const input = modelSpecsInput({ ...Object.fromEntries(CONFIG_FIELDS.filter(key => specs[key]?.value != null).map(key => [key, specs[key].value])), fields: MODEL_FIELDS });
    if (input) for (const [field, finding] of Object.entries(research.fields || {})) {
      const target = field.startsWith('feature:') ? features[field.slice(8)] : specs[field];
      if (!target || target.status !== 'unknown' || !usableModelFinding(field, finding, input)) continue;
      Object.assign(target, finding, { referenceValue: finding.kind === 'configuration' ? finding.value : undefined, value: finding.kind === 'value' ? finding.value : null, status: finding.kind === 'value' ? 'model-reference' : 'model-context' });
    }
  }
  return { specs, features };
}

export function vinMismatches(car, decoded) {
  if (decoded?.status !== 'decoded') return [];
  const seller = extractVehicleSpecs({ ...car, enrichment: undefined }).specs;
  return ['year', 'make', 'model', 'displacement', 'cylinders', 'transmission', 'drivetrain', 'fuelType', 'bodyType', 'seats'].flatMap(key => {
    const a = seller[key].value, b = normalize(key, decoded.fields?.[key]);
    if (seller[key].status === 'conflict' && b != null) return [{ field: FIELD_LABELS[key], listing: 'Conflicting seller values', vin: b }];
    if (a == null || b == null) return [];
    const equal = key === 'displacement' ? Math.abs(a - b) < 0.06 : normalized(a) === normalized(b);
    return equal ? [] : [{ field: FIELD_LABELS[key], listing: a, vin: b }];
  });
}
