import { MODEL_PROFILES } from './model-profiles.js';
import { extractVehicleSpecs, normalized } from './vehicle-specs.js';
import { CONFIG_FIELDS, MODEL_FIELDS, modelSpecsInput, validatedResearch } from '../shared/model-specs.js';
import { modelResearchBlockReason } from './model-specs.js';
import { reviewedDimensionsForCar } from './reviewed-dimensions.js';

export const RESEARCH_CATEGORIES = { strengths: 'Strengths', issues: 'Documented issues to investigate', comfort: 'Comfort', practicality: 'Practicality', performance: 'Performance' };
export const RESEARCH_METHOD = 'Model research combines retrieved manufacturer information and attributed professional reviews. The reviewed model library is available as a fallback. Individual condition and installed equipment still need confirmation.';
export const RESEARCH_LIMIT = 'Model-level information only. Reviews describe typical or tested configurations, not this car. Equipment, condition, accident history, maintenance and campaign completion need individual verification. Bulletins and recalls do not measure how common a failure is.';

// Citation metadata is required, but human source review remains necessary to verify support.
export function supportedClaims(profile) {
  const sources = new Map((Array.isArray(profile?.sources) ? profile.sources : []).filter(s => {
    try { return s.id && s.title && s.publisher && s.locator && /^\d{4}-\d{2}-\d{2}$/.test(s.reviewed) && new URL(s.url).protocol === 'https:'; } catch { return false; }
  }).map(s => [s.id, s]));
  return (Array.isArray(profile?.claims) ? profile.claims : []).filter(c => c?.id && c.text && Object.hasOwn(RESEARCH_CATEGORIES, c.category) && ['positive', 'mixed', 'caution'].includes(c.tone) && Array.isArray(c.sourceIds) && c.sourceIds.length && c.sourceIds.every(id => sources.has(id)))
    .map(c => ({ ...c, sources: c.sourceIds.map(id => sources.get(id)) }));
}

export function researchForCar(car, profiles = MODEL_PROFILES) {
  const none = reason => ({ status: 'unavailable', reason, claims: [] });
  const { specs } = extractVehicleSpecs(car);
  if (['year', 'make', 'model'].some(key => specs[key].value == null)) return none('A supported year, make and model are needed to select research.');
  const candidates = profiles.filter(p => p.year === specs.year.value && normalized(p.make) === normalized(specs.make.value) && p.models.some(m => normalized(m) === normalized(specs.model.value)));
  if (candidates.length !== 1) return none('No bundled review profile for this exact model year. Live research appears separately when available.');
  const profile = candidates[0];
  const variant = [car.title, specs.model.value, ...(car.itemSpecifics || []).filter(a => /^(trim|model)$/i.test(a.name?.trim())).flatMap(a => [a.value].flat())].filter(v => typeof v === 'string').join(' ');
  if (profile.excludedVariants?.some(v => new RegExp(`\\b${v.replaceAll(' ', '\\s*')}\\b`, 'i').test(variant))) return none('This performance variant is outside the reviewed profile.');
  const body = specs.bodyType.value;
  const modelBody = /\bsedan$/i.test(specs.model.value) ? 'Sedan' : /\bhatchback$/i.test(specs.model.value) ? 'Hatchback' : null;
  if (specs.bodyType.status === 'conflict' || (body && modelBody && body !== modelBody) || (body && !profile.bodies.includes(body))) return none('Body style is conflicting or outside the reviewed profile.');
  if (profile.requireBody && !profile.bodies.includes(body || modelBody)) return none('Confirm the body style first: this profile covers the sedan, not the hatchback.');
  const claims = supportedClaims(profile);
  if (!claims.length) return none('No research claims with identifiable supporting sources are available.');
  return { status: 'matched', profileId: profile.id, title: profile.title, scope: profile.scope, claims };
}

const modeCategories = { value: ['strengths', 'issues'], cost: ['issues'], comfort: ['comfort'], practical: ['practicality'], performance: ['performance'], balanced: ['strengths', 'comfort', 'practicality', 'performance'] };
export function liveResearchForCar(car) {
  const none = { fields: {}, insights: [], assessments: {} };
  if (!['matched', 'partial'].includes(car.enrichment?.modelSpecs?.status) || modelResearchBlockReason(car)) return none;
  const { specs } = extractVehicleSpecs({ ...car, enrichment: { ...car.enrichment, modelSpecs: undefined } });
  if (CONFIG_FIELDS.some(key => specs[key]?.status === 'conflict')) return none;
  const input = modelSpecsInput({ ...Object.fromEntries(CONFIG_FIELDS.filter(key => specs[key]?.value != null).map(key => [key, specs[key].value])), fields: MODEL_FIELDS });
  return input ? validatedResearch(car.enrichment.modelSpecs, input) : none;
}
export function dimensionRatingsForCar(car) {
  return { ...reviewedDimensionsForCar(car), ...liveResearchForCar(car).dimensionRatings };
}
export function liveResearchClaim(insight, checked) {
  const date = checked ? new Date(checked) : null;
  const reviewed = date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(date) : 'Current lookup';
  return { ...insight, tone: { advantage: 'positive', drawback: 'caution', neutral: 'mixed' }[insight.tone],
    sources: insight.evidence.map((e, index) => ({ id: `${insight.id}-${index}`, url: e.url, publisher: e.source, title: e.title || e.source, locator: e.label || e.quote, reviewed, kind: 'AI-read model source' })) };
}
export function researchGuidance(car, mode) {
  const research = researchForCar(car);
  const live = liveResearchForCar(car);
  const claims = [...live.insights.filter(c => c.categories.includes(mode)).map(c => liveResearchClaim(c, live.checked)), ...research.claims.filter(c => (modeCategories[mode] || modeCategories.value).includes(c.category))];
  return { ...research, status: claims.length ? 'matched' : research.status, claims, assessment: live.assessments[mode], checks: [...live.insights.filter(c => c.categories.includes('issues')).map(c => liveResearchClaim(c, live.checked)), ...research.claims.filter(c => c.category === 'issues')] };
}
