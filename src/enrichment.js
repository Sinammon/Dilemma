import { validateVin } from '../shared/vin.js';
import { extractVehicleSpecs, vinMismatches } from './vehicle-specs.js';
import { loadFuelYear, matchFuelEconomy, NRCAN_SOURCE } from './fuel-data.js';
import { matchFactorySpecs } from './factory-specs.js';
import { loadModelSpecs, modelResearchRequest } from './model-specs.js';
import { bundledModelSpecs } from './bundled-model-specs.js';
import { modelSpecCache } from './spec-cache.js';
import { CORE_SPEC_FIELDS, mergeResearch } from '../shared/model-specs.js';

export async function enrichVehicle(car, { fetcher = fetch, signal, researchSignal, factoryMatcher = matchFactorySpecs, onUpdate, cache = modelSpecCache, force = false, scheduler, skipVin = false } = {}) {
  const cacheGeneration = cache.generation;
  const phaseCache = { get generation() { return cache.generation; }, read: (...args) => cache.read(...args), save: (...args) => { if (cache.generation === cacheGeneration) cache.save(...args); } };
  const specsSignal = researchSignal && signal ? AbortSignal.any([signal, researchSignal]) : researchSignal || signal;
  const state = { status: 'loading-model', vin: car.enrichment?.vin || validateVin(car.vin), specsStatus: 'loading-quick' };
  const candidate = () => ({ ...car, enrichment: { ...state } });
  const factory = () => { try { return factoryMatcher(candidate()); } catch { return { status: 'unavailable', reason: 'Factory references are unavailable.' }; } };
  state.factorySpecs = factory();
  let input = modelResearchRequest(candidate());
  let saved = input && !car.demo ? cache.read(input) : null;
  state.modelSpecs = mergeResearch(mergeResearch(car.enrichment?.modelSpecs || {}, bundledModelSpecs(candidate())), saved || {});
  if (input && !car.demo) cache.save(input, state.modelSpecs);
  const emit = domain => { if (!signal?.aborted && (domain !== 'specs' || !specsSignal?.aborted)) onUpdate?.({ ...state }, { domain }); };
  emit('initial');

  // VIN/static references run independently; they never hold up listing-based specs.
  const vinTask = (async () => {
    if (skipVin) { state.fuel = car.enrichment?.fuel; return; }
    let vin = state.vin;
    const fuelRows = loadFuelYear(extractVehicleSpecs(candidate()).specs.year.value, { fetcher, signal }).catch(() => null);
    if (vin.status === 'valid') {
      try {
        const response = await fetcher('/api/vehicle-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vin: vin.vin }), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(9000)]) : AbortSignal.timeout(9000), cache: 'no-store' });
        if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Unavailable');
        const data = await response.json();
        vin = data?.vin && ['decoded', 'unsupported', 'unavailable', 'invalid', 'missing'].includes(data.vin.status) ? data.vin : { status: 'unavailable', reason: 'Invalid VIN response.' };
        if (vin.status === 'decoded') vin = { ...vin, mismatches: vinMismatches(car, vin) };
      } catch { vin = { status: 'unavailable', reason: 'VIN lookup unavailable. Listing details remain preferred.' }; }
    }
    const rows = await fuelRows;
    signal?.throwIfAborted();
    state.vin = vin; state.factorySpecs = factory();
    state.fuel = rows ? matchFuelEconomy(candidate(), rows) : { status: 'unavailable', reason: 'Canadian fuel reference data is unavailable.', source: NRCAN_SOURCE };
    emit('vin');
  })();

  const specsTask = (async () => {
    if (car.demo) { state.modelSpecs = { status: 'skipped', fields: {}, reason: 'Fictional demo uses bundled references; no AI request is made.' }; state.specsStatus = 'ready'; emit('specs'); return; }
    if (!input) {
      await vinTask;
      input = modelResearchRequest(candidate());
      saved = input ? cache.read(input) : null;
      state.modelSpecs = mergeResearch(state.modelSpecs, saved || {});
    }
    const missing = CORE_SPEC_FIELDS.filter(key => extractVehicleSpecs(candidate()).specs[key].value == null);
    if (!force && saved && !missing.length) { state.specsStatus = 'ready'; emit('specs'); return; }
    specsSignal?.throwIfAborted();
    if (missing.length) {
      const quick = await loadModelSpecs(candidate(), { fetcher, signal: specsSignal, phase: 'quick', requestedFields: missing, cache: phaseCache, scheduler });
      state.modelSpecs = mergeResearch(state.modelSpecs, quick);
      state.specsStatus = 'verifying'; emit('specs');
      const stopped = quick.lastAttempt || quick;
      if (['not-configured', 'model-unavailable', 'invalid-request'].includes(stopped.status) || stopped.status === 'quota' && stopped.dailyQuota) { state.specsStatus = 'failed'; emit('specs'); return; }
    }
    specsSignal?.throwIfAborted();
    state.specsStatus = 'verifying'; emit('specs');
    const researched = await loadModelSpecs(candidate(), { fetcher, signal: specsSignal, phase: 'research', cache: phaseCache, scheduler });
    state.modelSpecs = mergeResearch(state.modelSpecs, researched);
    state.specsStatus = ['matched', 'partial', 'complete'].includes(researched.status) ? 'ready' : 'failed';
    emit('specs');
  })().catch(error => {
    if (specsSignal?.aborted || signal?.aborted) return;
    state.modelSpecs = mergeResearch(state.modelSpecs, { status: 'unavailable', fields: {}, reason: 'Specification lookup could not finish. Existing values remain available.' });
    state.specsStatus = 'failed'; emit('specs');
  });
  await Promise.all([vinTask, specsTask]);
  signal?.throwIfAborted();
  state.status = 'complete';
  return { ...state };
}
