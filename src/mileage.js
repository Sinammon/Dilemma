import { decodeHTML } from 'entities/decode';

const numberPattern = '(?:\\d{1,3}(?:[, ]\\d{3})+|\\d+)(?:\\.\\d+)?';
const unitPattern = '(?:kilometres?|kilometers?|miles?|kms?|mi)';
const readingPattern = new RegExp(`^(${numberPattern})(k(?=\\s|$|${unitPattern}))?\\s*(${unitPattern})?$`, 'i');
const measurementPattern = new RegExp(`(?<![\\w.,+\\-])(${numberPattern})(k(?=\\s|${unitPattern}))?\\s*(${unitPattern})\\b`, 'i');
const declarationPattern = new RegExp(`\\b(?:mileage|odometer(?:\\s+reading)?)\\s+(?:(?:is|are)\\s+)?(?:(?:reported|shown|displayed|measured|recorded)\\s+)?(?:in|units?\\s*(?:(?:is|are)\\s*|[:=]\\s*)?)\\s*(${unitPattern})\\b`, 'i');
const labelledPattern = new RegExp(`\\b(?:mileage|odometer(?:\\s+reading)?)\\s*(?:(?:is|reads?|shows?|at)\\s*|[:=]\\s*)?(${numberPattern})(k(?=\\s|[.!?;]|$))?(?![\\w,]|\\.\\d)`, 'i');
const mileageField = /^(mileage|odometer|odometer reading|kilom[eé]trage)(?:\s*\(([^)]+)\))?$/i;
export const unitType = unit => typeof unit !== 'string' ? null : /^(kms?|kilomet(?:er|re)s?)$/i.test(unit.trim()) ? 'km' : /^(mi|miles?)$/i.test(unit.trim()) ? 'mi' : null;

// Analyze visible text only; never render seller HTML.
export function sellerText(value) {
  if (typeof value !== 'string') return '';
  return decodeHTML(value
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\/?(?:p|div|li|h[1-6]|tr|td|th|ul|ol|table|section)\b[^>]*>|<br\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, ''))
    .replace(/\r\n?/g, '\n').replace(/[\u00a0\u2007\u202f]/g, ' ');
}

function reading(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const match = String(value).trim().match(readingPattern);
  if (!match) return null;
  const amount = Number(match[1].replace(/[, ]/g, '')) * (match[2] ? 1000 : 1);
  return Number.isFinite(amount) && amount >= 0 ? { amount, unit: unitType(match[3]) } : null;
}

export function resolveMileage(car) {
  const aspects = (car.itemSpecifics || []).filter(a => mileageField.test(a.name?.trim()));
  const structured = [
    ...[car.mileage?.raw].flat().map(raw => ({ raw, source: 'Original mileage' })),
    ...aspects.flatMap(a => [a.value].flat().map(raw => ({ raw, source: `Mileage specification: ${a.name}` }))),
  ].filter(item => item.raw != null && item.raw !== '');
  const originalRaw = car.mileage?.raw ?? structured[0]?.raw ?? null;
  const texts = [['Seller description', sellerText(car.description)], ['Listing title', sellerText(car.title)]];
  const complete = (parsed, raw, source, sellerReported, declared) => {
    const unit = parsed.unit || declared?.unit || 'km';
    const assumedUnit = !parsed.unit && !declared;
    const evidence = [{ ...parsed, unit, quote: String(raw), source, sellerReported }];
    if (declared) evidence.push(declared);
    return { raw, originalRaw, amount: parsed.amount, unit, status: 'known', source, sellerReported: sellerReported || !!declared?.sellerReported, assumedUnit, evidence,
      reason: assumedUnit ? 'No mileage unit stated; kilometres assumed.' : `Mileage selected from ${source.toLowerCase()}.` };
  };
  // Deliberately choose the first stated distance, without reconciling other claims.
  for (const [source, text] of texts) {
    const match = text.match(measurementPattern);
    if (match) return complete(reading(match[0]), match[0], source, true);
  }
  for (const item of structured) {
    const parsed = reading(item.raw);
    if (parsed?.unit) return complete(parsed, item.raw, item.source, false);
  }
  let declared;
  for (const [source, text] of texts) {
    const match = text.match(declarationPattern);
    if (match) { declared = { unit: unitType(match[1]), source, quote: match[0], sellerReported: true }; break; }
  }
  if (!declared) {
    const units = [car.mileage?.unit, ...aspects.map(a => a.name.trim().match(mileageField)?.[2]), ...(car.itemSpecifics || []).filter(a => /^(?:mileage|odometer) units?$/i.test(a.name?.trim())).map(a => a.value)].flat();
    const unit = units.map(unitType).find(Boolean);
    if (unit) declared = { unit, source: 'Structured mileage unit', quote: unit, sellerReported: false };
  }
  for (const [source, text] of texts) {
    const match = text.match(labelledPattern);
    if (match) return complete(reading(`${match[1]}${match[2] || ''}`), match[0], source, true, declared);
  }
  for (const item of structured) {
    const parsed = reading(item.raw);
    if (parsed) return complete(parsed, item.raw, item.source, false, declared);
  }
  return { raw: null, originalRaw, amount: null, unit: null, status: 'unknown', evidence: [], sellerReported: false, assumedUnit: false, reason: 'Mileage reading not found in the listing.' };
}

export function mileageDisplay(car) {
  const m = resolveMileage(car);
  if (m.amount == null) return 'Unknown';
  const original = String(m.raw);
  const display = reading(m.raw) ? `${original}${reading(m.raw).unit ? '' : ` ${m.unit}`}` : `${m.amount.toLocaleString('en-CA')} ${m.unit}`;
  return `${display}${m.assumedUnit ? ' · km assumed' : ''}`;
}
