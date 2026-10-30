# Dilemma decision engine

The latest missing-data and research changes are documented in [ENRICHMENT.md](ENRICHMENT.md). `rankDecisionMode` now returns `basis` and mode-specific `research` guidance as well as numeric results. Model research never enters numeric factors or populates vehicle specifications. When measurements for a selected priority are missing, the UI labels a separate Best Value starting point based on available price/year/mileage. It does not invent a score for the requested priority. See [DECIDE_REDESIGN.md](DECIDE_REDESIGN.md). The fictional demo exercises this path without any external API.

The current architecture, source limitations, deterministic worked example, beginner-friendly Java comparisons, four-minute demonstration outline and review checklist are documented in [REVIEW.md](REVIEW.md).

`src/decision-engine.js` exposes pure `rankCars` and `rankDecisionMode` functions. Every comparable factor is normalized relative to the current shortlist, weighted, and added. Missing/conflicting factors are excluded for everyone; remaining weights are renormalized. Ties share the recommendation. Scores describe relative preference fit, not reliability or purchase safety.

The six mode IDs (`value`, `cost`, `practical`, `performance`, `comfort`, `balanced`) and Import ? Compare ? Decide flow are retained. `cost` is labeled Affordability and combines supported price/fuel factors. It preserves the existing caution-only mechanical ordering. Other modes put disclosed mechanical concerns below unflagged cars; VIN/listing mismatches are never endorsed. Engine size and drivetrain are source-labeled context, not automatic performance points. Comfort compares only feature categories documented for every car, not assumed installed equipment.

See `vehicle-evidence.test.mjs`, `decision-engine.test.mjs` and `decision-dashboard.test.mjs` for executable examples. Run `npm test` and `npm run build` before review. No API key, source dataset or scoring logic makes an accident, ownership, repair-cost or insurance claim.
