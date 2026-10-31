import { CONFIG_FIELDS, MODEL_FIELDS, cosmeticTrim, modelKey, modelSpecsInput, usableModelFinding, mergeResearch } from '../shared/model-specs.js';

const STORAGE_KEY = 'dilemma:model-specs:v1';
const DAY = 86400000;
const scopeOnly = value => Object.fromEntries(CONFIG_FIELDS.filter(key => value?.[key] != null).map(key => [key, value[key]]));
export const specCacheKey = input => JSON.stringify(CONFIG_FIELDS.map(key => key === 'trim' && modelKey(input.make) === 'bmw' && cosmeticTrim(input.trim) ? '' : modelKey(input[key])));
const short = (value, length) => typeof value === 'string' ? value.slice(0, length) : undefined;

// Explicit allowlist: never serialize a car, listing identifier, VIN, price,
// mileage, description, seller, import URL, or response attribution HTML.
export function cacheableFinding(finding) {
  if (!finding || typeof finding !== 'object' || Array.isArray(finding)) return { evidence: [] };
  return { kind: finding.kind, value: finding.value, minimum: finding.minimum, maximum: finding.maximum, alternatives: finding.alternatives,
    scope: scopeOnly(finding.scope), sharedAcross: Array.isArray(finding.sharedAcross) ? finding.sharedAcross.filter(key => CONFIG_FIELDS.includes(key)) : undefined, availability: finding.availability,
    quality: finding.quality, origin: short(finding.origin, 80), assumptions: Array.isArray(finding.assumptions) ? finding.assumptions.filter(a => typeof a === 'string').map(a => a.slice(0, 500)).slice(0, 6) : undefined,
    contextReason: short(finding.contextReason, 600), measurementMethod: finding.measurementMethod, retrievedAt: short(finding.retrievedAt, 40),
    evidence: (Array.isArray(finding.evidence) ? finding.evidence : []).filter(e => e && typeof e === 'object').slice(0, 6).map(e => ({ type: e.type, source: short(e.source, 150), url: short(e.url, 2048), quote: short(e.quote, 1200), label: short(e.label, 180), manufacturer: e.manufacturer, configuration: scopeOnly(e.configuration) })),
  };
}

export function createSpecCache({ storage, now = Date.now, maxEntries = 200 } = {}) {
  const entries = new Map();
  let loaded = false;
  let generation = 0;
  const getStorage = () => { try { return storage === undefined ? globalThis.window?.localStorage : storage; } catch { return null; } };
  const load = () => {
    if (loaded) return; loaded = true;
    try {
      const saved = JSON.parse(getStorage()?.getItem(STORAGE_KEY) || '[]');
      for (const entry of Array.isArray(saved) ? saved.slice(-maxEntries) : []) {
        const input = modelSpecsInput({ ...scopeOnly(entry?.input), fields: MODEL_FIELDS });
        if (input && typeof entry.savedAt === 'number' && entry.savedAt <= now()) entries.set(specCacheKey(input), { input: scopeOnly(input), fields: entry.fields || {}, savedAt: entry.savedAt });
      }
    } catch {}
  };
  const persist = () => { try { getStorage()?.setItem(STORAGE_KEY, JSON.stringify([...entries.values()])); } catch {} };
  return {
    get generation() { return generation; },
    read(input, { allowStale = false } = {}) {
      load(); const entry = entries.get(specCacheKey(input));
      if (!entry) return null;
      const fields = {};
      for (const [key, raw] of Object.entries(entry.fields || {})) {
        if (!MODEL_FIELDS.includes(key) || !raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        const finding = cacheableFinding(raw), estimated = finding.quality === 'estimated';
        const savedAt = typeof raw.cachedAt === 'number' ? raw.cachedAt : entry.savedAt;
        const age = now() - savedAt, freshDays = estimated ? 7 : 30, maximumDays = allowStale ? estimated ? 30 : 90 : freshDays;
        if (age < 0 || age > maximumDays * DAY || !usableModelFinding(key, finding, { ...input, fields: MODEL_FIELDS })) continue;
        fields[key] = { ...finding, stale: age > freshDays * DAY, fromCache: true, cachedAt: savedAt };
      }
      return Object.keys(fields).length ? { status: 'partial', fields, reason: Object.values(fields).some(f => f.stale) ? 'Using older saved model specifications while the provider is unavailable.' : 'Saved model specifications are available.' } : null;
    },
    save(input, research) {
      load(); const key = specCacheKey(input), previous = entries.get(key);
      const merged = mergeResearch({ fields: previous?.fields || {} }, research).fields;
      const fields = {};
      for (const [field, raw] of Object.entries(merged)) {
        if (!MODEL_FIELDS.includes(field) || !usableModelFinding(field, raw, { ...input, fields: MODEL_FIELDS })) continue;
        const previousField = previous?.fields?.[field];
        const reused = raw === previousField || raw.fromCache && raw.cachedAt === previousField?.cachedAt;
        fields[field] = { ...cacheableFinding(raw), cachedAt: reused ? previousField.cachedAt ?? previous.savedAt : now() };
      }
      if (!Object.keys(fields).length) return;
      entries.delete(key); entries.set(key, { input: scopeOnly(input), fields, savedAt: now() });
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
      persist();
    },
    clear() { entries.clear(); loaded = true; generation++; try { getStorage()?.removeItem(STORAGE_KEY); } catch {} },
  };
}
export const modelSpecCache = createSpecCache();
