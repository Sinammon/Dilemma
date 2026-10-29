import { decodeHTML } from 'entities/decode';

const numberPattern = '(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?';
const unitPattern = '(?:kilometres?|kilometers?|miles?|kms?|mi)';
// A suffix k means thousands only when separate from the distance unit.
const readingPattern = new RegExp(`^(${numberPattern})(k(?=\\s|$))?\\s*(${unitPattern})?$`, 'i');
const measurementPattern = new RegExp(`(?<![\\w.,+\\-])(${numberPattern})(k(?=\\s))?\\s*(${unitPattern})\\b`, 'gi');
const unitDeclarationPattern = new RegExp(`\\b(?:mileage|odometer(?:\\s+reading)?)\\s+(?:(?:is|are)\\s+)?(?:(?:reported|shown|displayed|measured|recorded)\\s+)?(?:in|units?\\s*(?:(?:is|are)\\s*|[:=]\\s*)?)\\s*(${unitPattern})\\b`, 'gi');
const mileageField = /^(mileage|odometer|odometer reading|kilom[eé]trage)(?:\s*\(([^)]+)\))?$/i;
export const unitType = unit => typeof unit !== 'string' ? null : /^(kms?|kilomet(?:er|re)s?)$/i.test(unit.trim()) ? 'km' : /^(mi|miles?)$/i.test(unit.trim()) ? 'mi' : null;

// Decode seller text for analysis only. Never insert seller HTML into the page.
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
  const amount = Number(match[1].replaceAll(',', '')) * (match[2] ? 1000 : 1);
  return Number.isFinite(amount) ? { amount, unit: unitType(match[3]) } : null;
}

function measurementContext(text, match) {
  const before = text.slice(0, match.index).split(/[!?;\n]|\.(?!\d)/).at(-1).slice(-120);
  const after = text.slice(match.index + match[0].length, match.index + match[0].length + 65);
  const odometer = [...before.matchAll(/\b(?:mileage|odometer|driven|travelled|traveled|clock)\b/gi)].at(-1)?.index ?? -1;
  const unrelated = [...before.matchAll(/\b(?:service|serviced|oil|every|warranty|range|tires?|tyres?|brakes?|replaced?|replacement|rebuilt|trip|interval)\b/gi)].at(-1)?.index ?? -1;
  const explicit = odometer >= 0 || /^\s*on (?:the )?(?:clock|odometer)\b/i.test(after);
  const excluded = unrelated > odometer
    || /^\s*(?:warranty|range|interval|ago|since|per (?:year|month))\b/i.test(after)
    || /\b(?:not|isn['’]t|wasn['’]t|unknown|unsure)\s*(?:at\s*)?$/i.test(before);
  return { explicit, excluded, after };
}

export function resolveMileage(car) {
  const aspects = (car.itemSpecifics || []).filter(a => mileageField.test(a.name?.trim()));
  const values = [...new Set(aspects.flatMap(a => Array.isArray(a.value) ? a.value : [a.value]).filter(v => v != null && v !== ''))];
  const raw = car.mileage?.raw ?? (values.length > 1 ? values : values[0]) ?? null;
  const result = { raw, unit: null, status: 'unknown', evidence: [], sellerReported: false };
  if (raw == null) return { ...result, reason: 'Mileage was not supplied.' };
  if (Array.isArray(raw)) return { ...result, status: 'conflict', reason: 'Conflicting structured mileage values.' };
  const parsed = reading(raw);
  if (!parsed) return { ...result, reason: 'Mileage number is ambiguous or unsupported.' };
  const { amount } = parsed;
  const evidence = [];
  let conflict = false;
  const add = (unit, source, sellerReported = false) => evidence.push({ unit, source, sellerReported });
  if (parsed.unit) add(parsed.unit, `Original mileage: ${raw}`);
  for (const value of values) {
    const structured = reading(value);
    if (!structured || structured.amount !== amount) conflict = true;
    if (structured?.unit) add(structured.unit, `Mileage specification: ${value}`);
  }
  for (const aspect of aspects) {
    const namedUnit = aspect.name.trim().match(mileageField)?.[2];
    if (namedUnit) {
      if (unitType(namedUnit)) add(unitType(namedUnit), `Structured field: ${aspect.name}`);
      else conflict = true;
    }
  }
  const declared = (car.itemSpecifics || []).filter(a => /^(?:mileage|odometer) units?$/i.test(a.name?.trim())).flatMap(a => a.value);
  for (const unit of [car.mileage?.unit, ...declared].flat().filter(v => v != null && v !== '')) {
    if (unitType(unit)) add(unitType(unit), 'Structured mileage unit');
    else conflict = true;
  }
  for (const [source, value] of [['Listing title', car.title], ['Seller description', car.description]]) {
    const text = sellerText(value);
    for (const match of text.matchAll(measurementPattern)) {
      const { explicit, excluded, after } = measurementContext(text, match);
      if (excluded) continue;
      const value = Number(match[1].replaceAll(',', '')) * (match[2] ? 1000 : 1);
      if (value === amount) {
        add(unitType(match[3]), `${source}: ${match[0]}`, true);
        const alternative = after.match(new RegExp(`^\\s*(?:/|or)\\s*(${unitPattern})\\b`, 'i'));
        if (alternative) add(unitType(alternative[1]), `${source}: alternative unit ${alternative[1]}`, true);
      } else if (explicit) conflict = true;
    }
    for (const match of text.matchAll(unitDeclarationPattern)) {
      add(unitType(match[1]), `${source}: ${match[0]}`, true);
      const after = text.slice(match.index + match[0].length);
      const alternative = after.match(new RegExp(`^\\s*(?:/|or)\\s*(${unitPattern})\\b`, 'i'));
      if (alternative) add(unitType(alternative[1]), `${source}: alternative unit ${alternative[1]}`, true);
    }
  }
  const units = new Set(evidence.map(e => e.unit));
  if (conflict || units.size > 1) return { ...result, amount, status: 'conflict', evidence, reason: 'Mileage statements or units conflict; confirm with the seller.' };
  const unit = [...units][0] ?? null;
  const sellerReported = !!unit && evidence.every(e => e.sellerReported);
  return { raw, unit, amount, status: unit ? 'known' : 'unknown', evidence, sellerReported,
    reason: !unit ? 'No confident unit matched to this mileage number.' : sellerReported ? 'Unit matched in seller text (seller-reported, not independently verified).' : 'Explicit unit attached to this mileage.' };
}

export function mileageDisplay(car) {
  const m = resolveMileage(car);
  if (m.raw == null) return 'Unknown · Unit unknown';
  const original = Array.isArray(m.raw) ? m.raw.join(' / ') : String(m.raw);
  if (!m.unit) return `${original} · Unit unknown${m.status === 'conflict' ? ' (conflicting evidence)' : ''}`;
  return `${original}${reading(m.raw)?.unit ? '' : ` ${m.unit}`}${m.sellerReported ? ' · Seller-reported unit' : ''}`;
}
