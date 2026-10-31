import { extractVehicleSpecs } from './vehicle-specs.js';
import { CONFIG_FIELDS, MODEL_SPEC_FIELDS, MODEL_FEATURES, modelSpecsInput, validatedResearch, RESEARCH_STATUSES } from '../shared/model-specs.js';

export function modelResearchRequest(car) {
  if (car.demo || car.enrichment?.vin?.mismatches?.length) return null;
  const { specs, features } = extractVehicleSpecs({ ...car, enrichment: { ...car.enrichment, modelSpecs: undefined } });
  // An unresolved configuration conflict cannot be repaired by choosing a typical variant.
  if (CONFIG_FIELDS.some(key => specs[key]?.status === 'conflict')) return null;
  const fields = [...MODEL_SPEC_FIELDS.filter(key => specs[key].status === 'unknown'), ...MODEL_FEATURES.filter(key => features[key].status === 'unknown').map(key => `feature:${key}`)];
  return modelSpecsInput({ ...Object.fromEntries(CONFIG_FIELDS.filter(key => specs[key]?.value != null).map(key => [key, specs[key].value])), fields });
}

export async function loadModelSpecs(car, { fetcher = fetch, signal } = {}) {
  if (car.demo) return { status: 'skipped', fields: {}, reason: 'Fictional demo uses bundled references; no AI request is made.' };
  const input = modelResearchRequest(car);
  if (!input) return { status: 'insufficient', fields: {}, reason: 'AI lookup needs a consistent year, make and model.' };
  try {
    const response = await fetcher('/api/model-specs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(48000)]) : AbortSignal.timeout(48000), cache: 'no-store' });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Unavailable');
    const data = (await response.json())?.modelSpecs;
    if (!data || !RESEARCH_STATUSES.includes(data.status)) throw new Error('Invalid model research');
    return validatedResearch(data, input);
  } catch (error) {
    if (signal?.aborted) throw error;
    return { status: 'unavailable', fields: {}, reason: 'AI specification lookup is unavailable. Existing details remain available.' };
  }
}
