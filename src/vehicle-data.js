// Conservative interpretation of seller claims. Original listing fields are untouched.
export const unknown = value => value == null || value === '' || Array.isArray(value) && !value.length ? 'Unknown' : Array.isArray(value) ? value.join(' / ') : String(value);
export const vehicleName = car => [car.year, car.make, car.model].map(unknown).join(' ');
export const safeUrl = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; } };
export function specification(car, ...names) {
  const values = [...new Set((car.itemSpecifics || []).filter(a => names.includes(a.name?.trim().toLowerCase())).flatMap(a => Array.isArray(a.value) ? a.value : [a.value]).filter(v => v != null && v !== ''))];
  return values.length > 1 ? values : values[0] ?? null;
}
export function numeric(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== 'string' || !/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(value.trim())) return null;
  const amount = Number(value.replaceAll(',', ''));
  return Number.isFinite(amount) ? amount : null;
}
export const unitType = unit => typeof unit !== 'string' ? null : /^(km|kilomet(?:er|re)s?)$/i.test(unit.trim()) ? 'km' : /^(mi|miles?)$/i.test(unit.trim()) ? 'mi' : null;
const measurementPattern = /(?<![\d.,])((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*(kilometres?|kilometers?|miles?|km|mi)\b/gi;

export function resolveMileage(car) {
  const mileageAspects = (car.itemSpecifics || []).filter(a => /^(mileage|odometer|odometer reading|kilom[eé]trage)(?:\s*\((?:km|mi|miles|kilometres|kilometers)\))?$/i.test(a.name?.trim()));
  const aspectValues = [...new Set(mileageAspects.flatMap(a => Array.isArray(a.value) ? a.value : [a.value]).filter(v => v != null && v !== ''))];
  const raw = car.mileage?.raw ?? (aspectValues.length > 1 ? aspectValues : aspectValues[0]) ?? null;
  const result = { raw, unit: null, status: 'unknown', evidence: [] };
  if (raw == null) return { ...result, reason: 'Mileage was not supplied.' };
  if (Array.isArray(raw)) return { ...result, status: 'conflict', reason: 'Conflicting structured mileage values.' };
  const embedded = [...String(raw).matchAll(measurementPattern)];
  const amount = embedded.length === 1 && embedded[0][0].trim() === String(raw).trim() ? numeric(embedded[0][1]) : numeric(raw);
  if (amount === null) return { ...result, reason: 'Mileage number is ambiguous or unsupported.' };
  const evidence = [];
  let conflict = false;
  for (const value of aspectValues) {
    const measurements = [...String(value).matchAll(measurementPattern)];
    const structuredAmount = measurements.length === 1 && measurements[0][0].trim() === String(value).trim() ? numeric(measurements[0][1]) : numeric(value);
    if (structuredAmount === null || structuredAmount !== amount) conflict = true;
  }
  for (const aspect of mileageAspects) {
    const namedUnit = aspect.name.match(/\(([^)]+)\)/)?.[1];
    if (namedUnit && unitType(namedUnit)) evidence.push({ unit: unitType(namedUnit), source: `Structured field: ${aspect.name}` });
  }
  const declaredUnits = [car.mileage?.unit, specification(car, 'mileage unit', 'mileage units', 'odometer unit', 'odometer units')].flat().filter(v => v != null);
  for (const unit of declaredUnits) {
    if (unitType(unit)) evidence.push({ unit: unitType(unit), source: 'Structured mileage unit' });
    else conflict = true;
  }
  for (const match of embedded) evidence.push({ unit: unitType(match[2]), source: `Original mileage: ${match[0]}` });
  const sources = [
    ['Listing title', car.title, true],
    ['Seller description', car.description, false],
    ...mileageAspects.map(a => ['Mileage specification', Array.isArray(a.value) ? a.value.join('; ') : a.value, true]),
  ];
  for (const [source, text, direct] of sources) {
    if (typeof text !== 'string') continue;
    for (const match of text.matchAll(measurementPattern)) {
      const before = text.slice(Math.max(0, match.index - 65), match.index).split(/[.!?;\n]/).at(-1);
      const after = text.slice(match.index + match[0].length, match.index + match[0].length + 30);
      // Service intervals, warranties and component replacements aren't odometer readings.
      if (/\b(service|oil|every|warranty|range|tires?|tyres?|engine replacement|rebuilt|brakes?)\b/i.test(before) || /^\s*(?:warranty|range|interval)\b/i.test(after)) continue;
      const explicitOdometer = /\b(mileage|odometer|driven|travelled|traveled|clock)\b/i.test(before) || /^\s*(?:on (?:the )?(?:clock|odometer))\b/i.test(after);
      if (!direct && !explicitOdometer && !/\b(?:has|vehicle|car)\s*(?:only\s*)?$/i.test(before)) continue;
      if (/^\s*(?:\/|or)\s*(?:km|mi|miles|kilometres|kilometers)\b/i.test(after)) conflict = true;
      if (numeric(match[1]) === amount) evidence.push({ unit: unitType(match[2]), source: `${source}: ${match[0]}` });
      else if (explicitOdometer) conflict = true;
    }
  }
  const units = new Set(evidence.map(e => e.unit));
  if (conflict || units.size > 1) return { ...result, status: 'conflict', evidence, reason: 'Mileage statements or units conflict; confirm with the seller.' };
  const unit = [...units][0] ?? null;
  return { raw, unit, amount, status: unit ? 'known' : 'unknown', evidence, reason: unit ? 'Explicit unit attached to this mileage.' : 'No confident unit matched to this mileage number.' };
}
export function mileageDisplay(car) {
  const m = resolveMileage(car);
  if (m.raw == null) return 'Unknown · Unit unknown';
  if (!m.unit) return `${unknown(m.raw)} · Unit unknown${m.status === 'conflict' ? ' (conflicting evidence)' : ''}`;
  return `${unknown(m.raw)}${unitType(String(m.raw).match(/(km|kilomet(?:er|re)s?|mi|miles?)$/i)?.[0]) ? '' : ` ${m.unit}`}`;
}
export function priceDisplay(car) {
  const price = car.priceCAD ?? car.returnedPrice;
  return price?.value != null && price.currency ? `${unknown(price.value)} ${price.currency}` : 'Unknown';
}
export const FEATURE_RULES = [
  ['Heated seats', /heated (?:front |rear )?seats?/i], ['Leather seats', /leather (?:seats?|interior|upholstery)/i],
  ['Navigation', /\b(?:navigation|gps)\b/i], ['Backup camera', /\b(?:backup|rear[- ]?view|reversing) camera\b/i],
  ['Sunroof', /\b(?:sunroof|moonroof)\b/i], ['Bluetooth', /\bbluetooth\b/i],
  ['Air conditioning', /\b(?:air conditioning|a\/c)\b/i], ['Cruise control', /\bcruise control\b/i],
];
export function listedFeatures(car) {
  const text = [car.description, ...(car.itemSpecifics || []).map(a => `${a.name}: ${unknown(a.value)}`)].filter(Boolean).join('\n');
  return Object.fromEntries(FEATURE_RULES.map(([label, pattern]) => {
    const claims = [...text.matchAll(new RegExp(pattern.source, 'gi'))].map(match => {
      const before = text.slice(Math.max(0, match.index - 80), match.index).split(/[.;\n]|\bbut\b/i).at(-1);
      const after = text.slice(match.index + match[0].length, match.index + match[0].length + 35);
      if (/\b(?:optional|available|may have)\s*$/i.test(before) || /^\s*(?::\s*)?(?:optional|available|unknown)\b/i.test(after)) return null;
      return /\b(?:no|without|not equipped with|does not have|doesn['’]t have)\s*(?:[^.;\n]*?(?:and|or|,)\s*)?$/i.test(before) || /^\s*(?::\s*)?(?:no|false|not (?:working|included)|broken|inoperative|does not work)\b/i.test(after) ? false : true;
    }).filter(v => v !== null);
    return [label, claims.length && claims.every(v => v === claims[0]) ? claims[0] : null];
  }));
}
export function powerHp(car) {
  const power = specification(car, 'horsepower', 'horse power', 'power', 'engine power');
  if (typeof power !== 'string') return null;
  const match = power.trim().match(/^(\d+(?:\.\d+)?)\s*(hp|bhp|kw)$/i);
  if (!match) return null; // Bare numbers lack a trustworthy power unit.
  return Number(match[1]) * (match[2].toLowerCase() === 'kw' ? 1.34102209 : 1);
}

export function missingDetails(car) {
  const details = [
    ['Year', car.year], ['Make', car.make], ['Model', car.model],
    ['Mileage / unit', resolveMileage(car).status === 'known' ? true : null],
    ['Transmission', specification(car, 'transmission', 'transmission type')],
    ['Fuel type', specification(car, 'fuel type', 'fuel')],
    ['Engine', specification(car, 'engine', 'engine size', 'engine displacement')],
    ['Body type', specification(car, 'body type', 'body style')],
    ['Condition', car.condition], ['Seller description', car.description],
  ];
  return details.filter(([, value]) => value == null || value === '' || Array.isArray(value)).map(([label]) => label);
}
