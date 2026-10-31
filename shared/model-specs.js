// The browser and backend share the research contract; no credentials or network here.
export const MODEL_SPEC_FIELDS = ['displacement', 'engineType', 'induction', 'cylinders', 'horsepower', 'torque', 'curbWeightKg', 'zeroTo100KphSeconds', 'zeroTo60MphSeconds', 'transmission', 'transmissionSpeeds', 'drivetrain', 'fuelType', 'bodyType', 'seats'];
export const CORE_SPEC_FIELDS = ['horsepower', 'torque', 'curbWeightKg', 'displacement', 'cylinders', 'engineType', 'transmission', 'transmissionSpeeds'];
export const RATING_DIMENSIONS = ['rideQuality', 'cabinQuietness', 'frontSeatComfort', 'rearSeatComfort', 'frontPassengerSpace', 'rearPassengerSpace', 'cargoSpace'];
export const RATING_ANCHORS = ['Severe deficiency', 'Poor', 'Basic', 'Good mainstream', 'Premium', 'Exceptional'];
export const ACCELERATION_FIELDS = ['zeroTo100KphSeconds', 'zeroTo60MphSeconds'];
export const MODEL_FEATURES = ['Heated seats', 'Leather seats', 'Navigation', 'Backup camera', 'Sunroof', 'Bluetooth', 'Air conditioning', 'Cruise control', 'Climate control', 'Heated steering wheel', 'Ventilated seats', 'Power seats', 'Apple CarPlay', 'Android Auto', 'Parking sensors', 'Remote start'];
export const MODEL_FIELDS = [...MODEL_SPEC_FIELDS, ...MODEL_FEATURES.map(name => `feature:${name}`)];
export const CONFIG_FIELDS = ['year', 'make', 'model', 'trim', 'market', 'displacement', 'cylinders', 'bodyType', 'transmission', 'transmissionSpeeds', 'drivetrain', 'fuelType'];
export const DISCRIMINATORS = CONFIG_FIELDS.filter(key => !['year', 'make', 'model'].includes(key));
export const RESEARCH_MODES = ['value', 'cost', 'comfort', 'balanced', 'practical', 'performance'];
export const RESEARCH_CATEGORIES = [...RESEARCH_MODES, 'safety', 'issues', 'strengths'];
export const RESEARCH_STATUSES = ['matched', 'partial', 'complete', 'unavailable', 'not-configured', 'model-unavailable', 'invalid-request', 'quota', 'timeout', 'no-sources', 'insufficient'];
const relevantFields = {
  horsepower: ['trim', 'market', 'displacement', 'cylinders', 'bodyType', 'fuelType', 'transmission'],
  torque: ['trim', 'market', 'displacement', 'cylinders', 'bodyType', 'fuelType', 'transmission'],
  curbWeightKg: ['trim', 'market', 'displacement', 'cylinders', 'bodyType', 'fuelType', 'transmission', 'drivetrain'],
  zeroTo100KphSeconds: ['trim', 'market', 'displacement', 'cylinders', 'bodyType', 'fuelType', 'transmission', 'drivetrain'],
  zeroTo60MphSeconds: ['trim', 'market', 'displacement', 'cylinders', 'bodyType', 'fuelType', 'transmission', 'drivetrain'],
  displacement: ['trim', 'market', 'bodyType', 'fuelType'], cylinders: ['trim', 'market', 'displacement', 'fuelType'],
  engineType: ['market', 'displacement', 'cylinders', 'fuelType'], induction: ['trim', 'market', 'displacement', 'fuelType'],
  transmission: ['trim', 'market', 'displacement', 'fuelType'], transmissionSpeeds: ['trim', 'market', 'displacement', 'transmission'],
  drivetrain: ['trim', 'market', 'bodyType'], fuelType: ['trim', 'market', 'displacement'], bodyType: ['trim', 'market'], seats: ['trim', 'market', 'bodyType'],
};
export const relevantDiscriminators = field => relevantFields[field] || ['trim', 'market', 'bodyType'];
export const modelKey = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
export const sameConfigurationValue = (a, b) => typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 0.06 : modelKey(a) === modelKey(b);
export const cosmeticTrim = value => /^(?:m\s*(?:sport|package|pkg)|sport package)$/i.test(String(value || '').trim());

export function approximateScopeMatches(scope, input, { adjacentYear = false } = {}) {
  if (!scope || !['make', 'model'].every(key => sameConfigurationValue(scope[key], input[key]))) return false;
  if (!sameConfigurationValue(scope.year, input.year) && !(adjacentYear && Math.abs(Number(scope.year) - input.year) <= 1 && input.displacement != null && sameConfigurationValue(scope.displacement, input.displacement) && input.bodyType && sameConfigurationValue(scope.bodyType, input.bodyType))) return false;
  return DISCRIMINATORS.every(key => key === 'trim' && modelKey(input.make) === 'bmw' && cosmeticTrim(input.trim) || input[key] == null || scope[key] == null || sameConfigurationValue(scope[key], input[key]));
}

const enums = {
  engineType: ['V', 'Inline', 'Boxer / flat', 'rotary', 'electric motor'],
  induction: ['Turbocharged', 'Supercharged', 'Naturally aspirated'],
  transmission: ['Automatic', 'Manual', 'CVT', 'Dual-clutch / automated manual'],
  drivetrain: ['AWD', '4WD', 'FWD', 'RWD'], fuelType: ['Gasoline', 'Diesel', 'Electric', 'Ethanol / flex fuel'],
  bodyType: ['SUV', 'Hatchback', 'Sedan', 'Coupe', 'Convertible', 'Wagon', 'Pickup', 'Van'],
};
const bounds = { displacement: [0.1, 20], cylinders: [1, 24], horsepower: [1, 3000], torque: [1, 10000], curbWeightKg: [100, 20000], zeroTo100KphSeconds: [0.5, 120], zeroTo60MphSeconds: [0.5, 120], transmissionSpeeds: [1, 20], seats: [1, 100] };
export function modelFieldValue(key, raw) {
  if (key.startsWith('feature:')) return raw === true || raw === 'true' ? true : raw === false || raw === 'false' ? false : null;
  if (bounds[key]) {
    if (typeof raw !== 'number' && (typeof raw !== 'string' || !/^\d+(?:\.\d+)?$/.test(raw))) return null;
    const value = Number(raw), [min, max] = bounds[key];
    return Number.isFinite(value) && value >= min && value <= max && (!['cylinders', 'seats', 'transmissionSpeeds'].includes(key) || Number.isInteger(value)) ? value : null;
  }
  const aliases = { fuelType: { gas: 'Gasoline', petrol: 'Gasoline', regularunleaded: 'Gasoline', premiumunleaded: 'Gasoline' }, engineType: { inline4: 'Inline', inline6: 'Inline', i4: 'Inline', i6: 'Inline', v6: 'V', v8: 'V' } };
  return enums[key]?.find(value => modelKey(value) === modelKey(raw)) ?? aliases[key]?.[modelKey(raw)] ?? null;
}

// Only these small configuration fields can leave the app in an AI request.
export function modelSpecsInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const result = {};
  for (const key of CONFIG_FIELDS) {
    const value = input[key];
    if (value == null || value === '') continue;
    if (key === 'year') {
      const year = Number(value);
      if (!Number.isInteger(year) || year < 1886 || year > new Date().getFullYear() + 1) return null;
      result.year = year;
    } else if (MODEL_SPEC_FIELDS.includes(key)) {
      const canonical = modelFieldValue(key, value);
      if (canonical == null) return null;
      result[key] = canonical;
    } else {
      if (typeof value !== 'string' || value.length > 100 || !/^[\p{L}\p{N} .,+()/&'’−-]+$/u.test(value)) return null;
      result[key] = value.trim();
    }
  }
  if (!result.year || !result.make || !result.model || !Array.isArray(input.fields) || input.fields.length > MODEL_FIELDS.length || input.fields.some(field => !MODEL_FIELDS.includes(field))) return null;
  result.fields = [...new Set(input.fields)];
  return result;
}

export function scopeMatches(scope, input) {
  return scope && ['year', 'make', 'model'].every(key => sameConfigurationValue(scope[key], input[key]))
    && DISCRIMINATORS.every(key => input[key] == null ? scope[key] == null : sameConfigurationValue(scope[key], input[key]));
}

// Unknown listing details can qualify a reference without contradicting the car.
// These scoped references are display-only, never measured comparison values.
export function compatibleModelScope(scope, input) {
  return scope && ['year', 'make', 'model'].every(key => sameConfigurationValue(scope[key], input[key]))
    && DISCRIMINATORS.every(key => input[key] == null || sameConfigurationValue(scope[key], input[key]));
}
export function modelScopeLabel(scope) {
  return DISCRIMINATORS.filter(key => scope?.[key] != null).map(key => `${({ market: 'market', displacement: 'engine (L)', cylinders: 'cylinders', bodyType: 'body', transmissionSpeeds: 'gears', fuelType: 'fuel' })[key] || key}: ${scope[key]}`).join(' · ');
}

export function usableModelFinding(field, finding, input) {
  if (finding?.quality === 'estimated') return !(field === 'transmissionSpeeds' && input.transmission === 'CVT') && CORE_SPEC_FIELDS.includes(field) && finding.kind === 'value'
    && finding.origin === 'model-estimate' && Array.isArray(finding.assumptions) && finding.assumptions.length > 0
    && modelFieldValue(field, finding.value) != null && approximateScopeMatches(finding.scope, input)
    && Array.isArray(finding.evidence) && finding.evidence.length === 0;
  if (finding?.quality === 'typical' && finding.kind === 'value') return modelFieldValue(field, finding.value) != null
    && approximateScopeMatches(finding.scope, input, { adjacentYear: true }) && Array.isArray(finding.assumptions) && finding.assumptions.length > 0
    && Array.isArray(finding.evidence) && finding.evidence.length > 0
    && finding.evidence.every(e => e?.quote && e.source && /^https:\/\//.test(e.url))
    && (!ACCELERATION_FIELDS.includes(field) || ['manufacturer', 'instrumented-test'].includes(finding.measurementMethod));
  if (!finding || !(finding.kind === 'value' ? scopeMatches(finding.scope, input) : compatibleModelScope(finding.scope, input)) || !Array.isArray(finding.evidence) || !finding.evidence.length) return false;
  if (!finding.evidence.every(e => typeof e.quote === 'string' && e.quote && typeof e.source === 'string' && /^https:\/\//.test(e.url))) return false;
  if (finding.kind === 'value') {
    if (modelFieldValue(field, finding.value) == null) return false;
    if (ACCELERATION_FIELDS.includes(field) && !['manufacturer', 'instrumented-test'].includes(finding.measurementMethod)) return false;
    if (field.startsWith('feature:') && finding.availability !== (finding.value ? 'standard' : 'not-available')) return false;
    // An unknown trim/market/engine must not become a silently selected variant.
    if (relevantDiscriminators(field).some(key => input[key] == null && !finding.sharedAcross?.includes(key))) return false;
  } else if (finding.kind === 'configuration') {
    if (modelFieldValue(field, finding.value) == null || field.startsWith('feature:') || !finding.contextReason) return false;
  } else if (finding.kind === 'range') {
    if (typeof finding.minimum !== 'number' || typeof finding.maximum !== 'number' || modelFieldValue(field, finding.minimum) == null || modelFieldValue(field, finding.maximum) == null || finding.minimum >= finding.maximum) return false;
  } else if (finding.kind === 'alternatives') {
    if (!Array.isArray(finding.alternatives) || finding.alternatives.length < 2 || finding.alternatives.some(v => modelFieldValue(field, v) == null)) return false;
  } else if (finding.kind !== 'optional' || !field.startsWith('feature:')) return false;
  return true;
}

export function validResearchInsight(insight, input) {
  const applicable = insight?.scope && ['year', 'make', 'model'].every(key => sameConfigurationValue(insight.scope[key], input[key]))
    && DISCRIMINATORS.every(key => insight.scope[key] == null || input[key] != null && sameConfigurationValue(insight.scope[key], input[key]) || input[key] == null && insight.contextOnly === true && !!insight.contextReason);
  return insight && typeof insight.id === 'string' && /^[a-z0-9_-]{1,60}$/i.test(insight.id)
    && typeof insight.text === 'string' && insight.text.length >= 15 && insight.text.length <= 260
    && ['advantage', 'drawback', 'neutral'].includes(insight.tone) && applicable
    && Array.isArray(insight.categories) && insight.categories.length > 0 && insight.categories.every(c => RESEARCH_CATEGORIES.includes(c))
    && Array.isArray(insight.evidence) && insight.evidence.length > 0 && insight.evidence.every(e => e?.quote && e.source && /^https:\/\//.test(e.url))
    && !/[$€£]\s*\d|\d\s*%|\b\d[\d,.]*\s*(?:CAD|USD|dollars|percent)\b|\b(?:this (?:car|vehicle) (?:has never|has no|is accident|is reliable)|guaranteed|failure rate|frequency|frequently|insurance|owners?|unscheduled repair)\b/i.test(insight.text)
    && (!/\breliab|\bdependab/i.test(insight.text) || /\breview|\brating|\bsurvey|\breported|\breputation/i.test(insight.text));
}

export function researchAssessment(insights) {
  if (!insights.length) return null;
  const positive = insights.some(c => c.tone === 'advantage'), negative = insights.some(c => c.tone === 'drawback');
  return insights.some(c => c.tone === 'neutral') ? 'mixed' : positive && !negative ? 'favourable' : negative && !positive ? 'unfavourable' : 'mixed';
}
export const ASSESSMENT_VALUES = { favourable: 2, mixed: 1, unfavourable: 0 };

export function validDimensionRating(rating, input) {
  return rating && Number.isInteger(rating.rating) && rating.rating >= 0 && rating.rating <= 5
    && typeof rating.rationale === 'string' && rating.rationale.length >= 15 && rating.rationale.length <= 600
    && rating.contextOnly !== true && rating.scope
    && ['year', 'make', 'model'].every(key => sameConfigurationValue(rating.scope[key], input[key]))
    && DISCRIMINATORS.every(key => rating.scope[key] == null || input[key] != null && sameConfigurationValue(rating.scope[key], input[key]))
    && Array.isArray(rating.evidence) && rating.evidence.length > 0
    && rating.evidence.every(e => e?.quote && e.source && e.editorial === true && /^https:\/\//.test(e.url));
}

export function validatedResearch(data, input) {
  const fields = Object.fromEntries(Object.entries(data?.fields || {}).filter(([field, finding]) => input.fields.includes(field) && usableModelFinding(field, finding, input)));
  const resolvedInput = { ...input, ...Object.fromEntries(Object.entries(fields).filter(([field, f]) => CONFIG_FIELDS.includes(field) && input[field] == null && f.kind === 'value').map(([field, f]) => [field, f.value])) };
  const insights = [...new Map((Array.isArray(data?.insights) ? data.insights : []).filter(c => validResearchInsight(c, resolvedInput)).map(c => [c.id, c])).values()].slice(0, 18);
  const assessments = {};
  for (const category of RESEARCH_MODES) {
    const proposed = data?.assessments?.[category];
    if (!proposed || !Array.isArray(proposed.insightIds) || !proposed.insightIds.length) continue;
    const claims = proposed.insightIds.map(id => insights.find(c => c.id === id && c.categories.includes(category)));
    if (claims.some(c => !c || c.contextOnly) || researchAssessment(claims) !== proposed.assessment) continue;
    assessments[category] = { assessment: proposed.assessment, value: ASSESSMENT_VALUES[proposed.assessment], insightIds: [...new Set(proposed.insightIds)] };
  }
  const dimensionRatings = Object.fromEntries(RATING_DIMENSIONS.filter(key => validDimensionRating(data?.dimensionRatings?.[key], resolvedInput)).map(key => [key, data.dimensionRatings[key]]));
  return { ...data, fields, insights, assessments, dimensionRatings };
}

export const findingStrength = finding => (({ exact: 4, typical: 2, estimated: 1 })[finding?.quality] ?? (finding?.kind === 'value' ? 3 : 0)) + (finding?.origin === 'reviewed-reference' ? 0.5 : 0);
export function mergeResearch(previous = {}, incoming = {}) {
  const fields = { ...previous.fields };
  for (const [key, finding] of Object.entries(incoming.fields || {})) {
    if (!fields[key] || findingStrength(finding) >= findingStrength(fields[key]) && !(finding.stale && !fields[key].stale)) fields[key] = finding;
  }
  const useful = Object.keys(fields).length || incoming.insights?.length || previous.insights?.length || Object.keys(incoming.dimensionRatings || {}).length || Object.keys(previous.dimensionRatings || {}).length;
  const failed = !!incoming.status && !['matched', 'partial', 'complete', 'loading'].includes(incoming.status);
  return { ...previous, ...incoming, fields, dimensionRatings: { ...previous.dimensionRatings, ...incoming.dimensionRatings },
    insights: incoming.insights?.length ? incoming.insights : previous.insights || [],
    assessments: incoming.insights?.length ? incoming.assessments || {} : previous.assessments || {},
    status: useful ? 'partial' : incoming.status || previous.status || 'unavailable',
    lastAttempt: failed && useful ? { status: incoming.status, reason: incoming.reason, dailyQuota: incoming.dailyQuota, retryAfterSeconds: incoming.retryAfterSeconds } : incoming.lastAttempt,
  };
}
