import { extractVehicleSpecs, FIELD_LABELS, researchVinMismatches } from './vehicle-specs.js';
import { CONFIG_FIELDS, MODEL_SPEC_FIELDS, MODEL_FEATURES, modelSpecsInput, validatedResearch, RESEARCH_STATUSES } from '../shared/model-specs.js';

function researchConfiguration(car) {
  if (car.demo) return { input: null, reason: 'Fictional demo uses bundled references; no AI request is made.' };
  // Seating is not a research configuration discriminator. Keep that warning and
  // all VIN/scoring safeguards, but do not block otherwise consistent model notes.
  const mismatches = researchVinMismatches(car);
  if (mismatches.length) return { input: null, reason: `Resolve VIN/listing differences before research: ${mismatches.map(item => item.field).join(', ')}.` };
  const { specs, features } = extractVehicleSpecs({ ...car, enrichment: { ...car.enrichment, modelSpecs: undefined } });
  // An unresolved configuration conflict cannot be repaired by choosing a typical variant.
  const conflicts = CONFIG_FIELDS.filter(key => specs[key]?.status === 'conflict');
  if (conflicts.length) return { input: null, reason: `Resolve conflicting vehicle details before research: ${conflicts.map(key => FIELD_LABELS[key]).join(', ')}.` };
  const missing = ['year', 'make', 'model'].filter(key => specs[key]?.value == null);
  if (missing.length) return { input: null, reason: `AI lookup needs these vehicle details: ${missing.map(key => FIELD_LABELS[key]).join(', ')}.` };
  const fields = [...MODEL_SPEC_FIELDS.filter(key => specs[key].status === 'unknown'), ...MODEL_FEATURES.filter(key => features[key].status === 'unknown').map(key => `feature:${key}`)];
  const input = modelSpecsInput({ ...Object.fromEntries(CONFIG_FIELDS.filter(key => specs[key]?.value != null).map(key => [key, specs[key].value])), fields });
  return { input, reason: input ? '' : 'Vehicle configuration is not supported for AI lookup. Check the year, make, model and trim.' };
}

export const modelResearchRequest = car => researchConfiguration(car).input;
export const modelResearchBlockReason = car => researchConfiguration(car).reason;

export async function loadModelSpecs(car, { fetcher = fetch, signal } = {}) {
  if (car.demo) return { status: 'skipped', fields: {}, reason: 'Fictional demo uses bundled references; no AI request is made.' };
  const { input, reason } = researchConfiguration(car);
  if (!input) return { status: 'insufficient', fields: {}, reason };
  try {
    const response = await fetcher('/api/model-specs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(48000)]) : AbortSignal.timeout(48000), cache: 'no-store' });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Unavailable');
    const data = (await response.json())?.modelSpecs;
    if (!data || !RESEARCH_STATUSES.includes(data.status)) throw new Error('Invalid model research');
    return validatedResearch(data, input);
  } catch (error) {
    if (signal?.aborted) throw error;
    return { status: error.name === 'TimeoutError' ? 'timeout' : 'unavailable', fields: {}, reason: error.name === 'TimeoutError' ? 'AI research timed out. Retry research to search again.' : 'AI specification lookup is unavailable. Retry research to search again; existing details remain available.' };
  }
}
