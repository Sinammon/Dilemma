import { extractVehicleSpecs, FIELD_LABELS, researchVinMismatches } from './vehicle-specs.js';
import { CONFIG_FIELDS, MODEL_SPEC_FIELDS, MODEL_FEATURES, CORE_SPEC_FIELDS, modelSpecsInput, validatedResearch, RESEARCH_STATUSES, mergeResearch } from '../shared/model-specs.js';
import { specScheduler } from './spec-scheduler.js';
import { specCacheKey } from './spec-cache.js';
import { abortableDelay, transientFailure, retryDelayMilliseconds } from '../shared/retry.js';

function researchConfiguration(car) {
  if (car.demo) return { input: null, reason: 'Fictional demo uses bundled references; no AI request is made.' };
  // Listing contradictions still need resolution; decoded VIN differences
  // remain secondary and never veto otherwise consistent model notes.
  const mismatches = researchVinMismatches(car);
  if (mismatches.length) return { input: null, reason: `Resolve conflicting listing details before research: ${mismatches.map(item => item.field).join(', ')}.` };
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

let dailyCooldownUntil = 0;
export async function loadModelSpecs(car, { fetcher = fetch, signal, phase = 'research', requestedFields, cache, scheduler = specScheduler } = {}) {
  if (car.demo) return { status: 'skipped', fields: {}, reason: 'Fictional demo uses bundled references; no AI request is made.' };
  const { input, reason } = researchConfiguration(car);
  if (!input) return { status: 'insufficient', fields: {}, reason };
  if (phase === 'quick') input.fields = input.fields.filter(key => CORE_SPEC_FIELDS.includes(key));
  if (requestedFields) input.fields = input.fields.filter(key => requestedFields.includes(key));
  const generation = cache?.generation;
  const fallback = failure => mergeResearch(cache?.read(input, { allowStale: true }) || {}, failure);
  if (Date.now() < dailyCooldownUntil) return fallback({ status: 'quota', fields: {}, dailyQuota: true, reason: 'Daily AI quota is unavailable. Using saved model specifications where available.' });
  try {
    const key = `${phase}:${specCacheKey(input)}:${input.fields.toSorted().join(',')}`;
    const data = await scheduler.schedule(key, phase, async taskSignal => {
      const timeoutMs = phase === 'quick' ? 8000 : 40000, deadline = Date.now() + timeoutMs;
      const requestSignal = AbortSignal.any([taskSignal, AbortSignal.timeout(timeoutMs)]);
      for (let attempt = 0; ; attempt++) {
        try {
          requestSignal.throwIfAborted();
          const response = await fetcher('/api/model-specs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...input, phase }), signal: requestSignal, cache: 'no-store' });
          if (!response.ok) {
            const error = new Error('Specification endpoint unavailable');
            const retryAfter = response.headers.get('retry-after');
            Object.assign(error, { status: response.status, retryAfterSeconds: retryAfter != null && Number.isFinite(Number(retryAfter)) ? Number(retryAfter) : undefined });
            throw error;
          }
          if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Unavailable');
          const data = (await response.json())?.modelSpecs;
          if (!data || !RESEARCH_STATUSES.includes(data.status)) throw new Error('Invalid model research');
          requestSignal.throwIfAborted();
          return validatedResearch(data, input);
        } catch (error) {
          if (requestSignal.aborted) throw requestSignal.reason;
          const delay = retryDelayMilliseconds(error);
          if (attempt || !transientFailure(error) || Date.now() + delay >= deadline) throw error;
          await abortableDelay(delay, requestSignal);
        }
      }
    }, signal);
    if (data.status === 'quota' && data.dailyQuota) dailyCooldownUntil = Date.now() + Math.max(60, data.retryAfterSeconds || 3600) * 1000;
    if (!['matched', 'partial', 'complete'].includes(data.status)) return fallback(data);
    if (cache && cache.generation === generation) cache.save(input, data);
    return data;
  } catch (error) {
    if (signal?.aborted) throw error;
    if ([400, 422].includes(error.status)) return fallback({ status: 'invalid-request', fields: {}, reason: 'Specification request was rejected. Existing values remain available.' });
    if ([401, 403, 404].includes(error.status)) return fallback({ status: 'model-unavailable', fields: {}, reason: 'Specification endpoint access is unavailable. Existing values remain available.' });
    return fallback({ status: error.name === 'TimeoutError' ? 'timeout' : 'unavailable', fields: {}, reason: error.name === 'TimeoutError' ? 'AI research timed out. Saved specifications remain available.' : 'AI specification lookup is unavailable. Saved specifications remain available.' });
  }
}
