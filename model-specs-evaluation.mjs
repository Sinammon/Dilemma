import { readFile } from 'node:fs/promises';
import { loadEnvFile } from 'node:process';
import { pathToFileURL } from 'node:url';
import { researchModelSpecs } from './backend/model-specs.mjs';
import { sameConfigurationValue, CORE_SPEC_FIELDS } from './shared/model-specs.js';
import { FACTORY_SPECS } from './src/factory-specs.js';
import { MODEL_PROFILES } from './src/model-profiles.js';

export const powerReferenceCases = () => FACTORY_SPECS.map(row => ({
  id: row.id,
  input: { year: row.year, make: row.make, model: row.models[0], market: row.market, ...Object.fromEntries(Object.entries(row.requirements).map(([key, values]) => [key, values[0]])), ...(row.trims?.length ? { trim: row.trims[0] } : {}), fields: ['horsepower', 'torque'] },
  expected: row.values, source: row.source, auditProfile: MODEL_PROFILES.find(p => p.year === row.year && p.make === row.make && p.models.some(m => row.models.includes(m))),
}));

export function gradeResearch(cases, results, { approximate = false } = {}) {
  let expected = 0, populated = 0, correct = 0;
  const mismatches = [];
  for (const [index, reference] of cases.entries()) for (const [field, value] of Object.entries(reference.expected)) {
    expected++;
    const finding = results[index]?.fields?.[field];
    if (finding?.kind !== 'value' || finding.value == null) continue;
    populated++;
    const matches = approximate && ['horsepower', 'torque', 'curbWeightKg'].includes(field) ? Math.abs(value - finding.value) <= Math.max(0.75, value * 0.05)
      : ['horsepower', 'torque'].includes(field) ? Math.abs(value - finding.value) <= 0.75 : sameConfigurationValue(value, finding.value);
    if (matches) correct++;
    else mismatches.push({ configuration: reference.id, field, expected: value, actual: finding.value });
  }
  const insightCategories = results.reduce((sum, r) => sum + Object.keys(r.assessments || {}).length, 0);
  return { configurations: cases.length, attempted: results.length, expectedFields: expected, populatedFields: populated, correctFields: correct, sourcedCategoryAssessments: insightCategories, categoryCoverage: results.length ? insightCategories / (results.length * 6) : 0,
    accuracyAmongPopulated: populated ? correct / populated : null, coverage: expected ? populated / expected : 0, mismatches };
}

async function main() {
  const benchmark = JSON.parse(await readFile(new URL('./test-data/model-specs-benchmark.json', import.meta.url), 'utf8'));
  const power = powerReferenceCases();
  const quick = process.argv.includes('--quick');
  const bmw = { id: '1999-bmw-z3-2.8-auto-coupe', input: { year: 1999, make: 'BMW', model: 'Z3', trim: 'm sport', displacement: 2.8, cylinders: 6, bodyType: 'Coupe', transmission: 'Automatic' },
    expected: { horsepower: 193, torque: 280, curbWeightKg: 1375, transmissionSpeeds: 4 },
    source: { url: 'https://www.caranddriver.com/reviews/a68119699/1999-bmw-z3-coupe-archive-test/', weight: 'https://manualzz.com/doc/o/1705tt/bmw-z3-roadster-owner-s-manual-data', note: 'Adjacent-year BMW automatic weight definition includes one person and a full tank.' } };
  const representative = power.filter((c, index) => power.findIndex(other => other.input.make === c.input.make && other.input.model === c.input.model) === index).slice(0, 3);
  const cases = quick ? [bmw, ...representative].map(c => ({ ...c, input: { ...c.input, fields: CORE_SPEC_FIELDS.filter(key => c.input[key] == null) } })) : process.argv.includes('--power-only') ? power : [...power, ...benchmark.cases];
  if (!process.argv.includes('--live')) {
    console.log(`Reference benchmark: ${benchmark.cases.length} NRCan configurations plus ${power.length} manufacturer power configurations and reviewed model-observation references. Run npm run test:model-specs:live to measure accuracy and coverage.`);
    return;
  }
  try { loadEnvFile(new URL('.env', import.meta.url)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!process.env.GEMINI_API_KEY) {
    console.error('Live accuracy evaluation not run: GEMINI_API_KEY is missing. Configure a free-tier project with billing unlinked.');
    process.exitCode = 2;
    return;
  }
  const results = [];
  const audited = new Set();
  for (const reference of cases) {
    const result = await researchModelSpecs(reference.input, { phase: quick ? 'quick' : 'research' });
    results.push(result);
    console.log(`${reference.id}: ${result.status}; ${Object.keys(result.fields).length}/${reference.input.fields.length} fields populated`);
    if (!quick && reference.auditProfile && !audited.has(reference.auditProfile.id)) {
      audited.add(reference.auditProfile.id);
      console.log(JSON.stringify({ audit: reference.id, independentReviewedClaims: reference.auditProfile.claims.map(c => c.text), observedClaims: result.insights.map(c => ({ text: c.text, categories: c.categories, sources: c.evidence.map(e => e.url) })) }));
    }
    if (['quota', 'not-configured', 'model-unavailable'].includes(result.status)) break;
  }
  const report = gradeResearch(cases, results, { approximate: quick });
  if (quick) {
    const requested = cases.reduce((sum, c) => sum + c.input.fields.length, 0), populated = results.reduce((sum, r) => sum + Object.keys(r.fields).length, 0);
    report.requestedMissingCore = requested; report.populatedMissingCore = populated; report.missingCoreCoverage = populated / requested;
    report.agreementTolerance = 'Power/torque/weight within 5% of independent references; gears exact. An estimate is not verified accuracy.';
  }
  console.log(JSON.stringify(report, null, 2));
  console.log(quick ? 'Quick tool-free estimates only; bundled/cached specs are not used in this diagnostic. Reference agreement and missing-field coverage are separate measures on four configurations, not general accuracy. No listing data or model responses are stored.' : 'Numeric accuracy covers manufacturer power/torque plus NRCan cylinder count, fuel family and non-CVT speeds. Category coverage is not semantic accuracy: compare observed insights against the independent reviewed claims and cited sources. No listing data or model responses are stored.');
  if (report.attempted !== report.configurations || report.accuracyAmongPopulated == null || report.accuracyAmongPopulated < 0.9) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => { console.error('Evaluation could not complete. No credentials or upstream response bodies are printed.'); process.exitCode = 1; });
