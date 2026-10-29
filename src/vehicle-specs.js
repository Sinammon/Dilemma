import { sellerText } from './mileage.js';

export const normalized = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const number = value => /^\d+(?:\.\d+)?$/.test(String(value).trim()) ? Number(value) : null;
const positive = value => number(value) > 0 ? number(value) : null;
export const FIELD_LABELS = { year: 'Year', make: 'Make', model: 'Model', displacement: 'Engine displacement (L)', engineType: 'Engine configuration', induction: 'Induction', cylinders: 'Cylinders', horsepower: 'Power (hp)', torque: 'Torque (Nm)', transmission: 'Transmission', transmissionSpeeds: 'Transmission speeds', transmissionCode: 'Transmission code', drivetrain: 'Drivetrain', fuelType: 'Fuel type', bodyType: 'Body type', seats: 'Seating capacity' };
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
  addMatches(/\b(\d{1,4}(?:\.\d+)?)\s*(hp|bhp|kW)\b/gi, 'horsepower', m => Number(m[1]) * (/kw/i.test(m[2]) ? 1.34102209 : 1));
  addMatches(/\b(\d{1,4}(?:\.\d+)?)\s*(Nm|N[- ]m|lb[- ]ft|ft[- ]lb)\b/gi, 'torque', m => Number(m[1]) * (/lb/i.test(m[2]) ? 1.355817948 : 1));
  addMatches(/\b(?:V|I|inline[- ]?|flat[- ]?|boxer[- ]?)([3468]|10|12)\b/gi, 'cylinders');
  addMatches(/\b(\d{1,2})[- ]?(?:cylinders?|cyl)\b/gi, 'cylinders');
  addMatches(/\b(V[3468]|V10|V12|I[3468]|inline[- ]?[3468]|boxer|rotary|electric motor)\b/gi, 'engineType');
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

function resolve(evidence) {
  const values = [...new Map(evidence.map(e => [typeof e.value === 'number' ? e.value.toFixed(2) : normalized(e.value), e.value])).values()];
  return { value: values.length === 1 ? values[0] : null, status: !values.length ? 'unknown' : values.length > 1 ? 'conflict' : evidence.some(e => e.type === 'vpic') ? evidence.some(e => e.type !== 'vpic') ? 'corroborated' : 'vin-record' : 'seller-reported', evidence };
}

export function extractVehicleSpecs(car) {
  const evidence = Object.fromEntries(Object.keys(FIELD_LABELS).map(key => [key, []]));
  const add = (key, value, source, type, quote) => { if (value != null) evidence[key].push({ value, source, type, quote }); };
  for (const key of ['year', 'make', 'model']) {
    for (const value of [car[key]].flat()) add(key, normalize(key, value), 'eBay item specifics', 'seller-specifics', String(value ?? ''));
  }
  for (const aspect of car.itemSpecifics || []) {
    const key = Object.keys(aliases).find(key => aliases[key].includes(aspect.name?.trim().toLowerCase()));
    if (!key) continue;
    for (const value of [aspect.value].flat()) {
      const field = aspect.name.trim().toLowerCase();
      const explicitUnit = key === 'horsepower' && /^(?:horse ?power|power \(hp\)|horsepower \(hp\))$/.test(field) || key === 'displacement' && /\(l\)$/.test(field) || key === 'torque' && /\(nm\)$/.test(field);
      if (explicitUnit && positive(value)) add(key, normalize(key, value), `eBay: ${aspect.name}`, 'seller-specifics', String(value));
      for (const item of patterns(String(value ?? ''), key)) add(item.key, item.value, `eBay: ${aspect.name}`, 'seller-specifics', item.quote);
    }
  }
  for (const item of patterns(sellerText(car.description))) add(item.key, item.value, 'Seller description', 'seller-description', item.quote);
  const vin = car.enrichment?.vin;
  if (vin?.status === 'decoded' && !vin.mismatches?.length) {
    for (const [key, value] of Object.entries(vin.fields || {})) {
      if (!evidence[key]) continue;
      add(key, normalize(key, value), 'NHTSA vPIC', 'vpic', String(value ?? ''));
    }
  }
  const specs = Object.fromEntries(Object.entries(evidence).map(([key, items]) => [key, resolve(items)]));
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
