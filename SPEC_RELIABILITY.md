# Listing-first specifications

Implemented 31 October 2026. The existing free-tier Gemini provider, billing settings and temporary shortlist remain. Only sanitized model-spec references persist on the device.

## Resolution and evidence

Listing identity, engine, transmission, seating and numeric claims take priority. VIN disagreements remain visible; VIN supplements require a decoded matching identity and compatible relevant configuration. An incompatible engine cannot donate horsepower. Contradictions within the listing still remain unresolved. Matching, research, fuel lookup and scoring use this same resolved configuration.

Known listing/factory/bundled/cache data is emitted immediately. The reviewed 1999 BMW Z3 2.8 automatic coupe reference supplies horsepower, torque, curb weight, displacement, cylinders, engine configuration, transmission and four-speed gear count without AI. M Sport is cosmetic, never an M Coupe engine selector. Its sources are the [1999 Car and Driver test](https://www.caranddriver.com/reviews/a68119699/1999-bmw-z3-coupe-archive-test/) and [archived BMW owner manual](https://manualzz.com/doc/o/1705tt/bmw-z3-roadster-owner-s-manual-data). Unknown original market and the adjacent-year automatic weight reference remain approximate. BMW's stated weight includes one person and a full tank; this definition is shown with the value.

Findings carry quality (`exact`, `typical`, `estimated`), origin, assumptions, source configuration and retrieval time. One credible successfully read source can support a typical value. Estimates have no invented citations. Numeric bounds, units, gross/curb distinctions, variant conflicts and separate acceleration metrics remain enforced. CVT simulated steps cannot become an AI estimate of fixed gears. Applicable professional reviews still determine Comfort.

## Requests, merging and cancellation

`POST /api/model-specs` accepts `phase: "quick" | "research"`; omission preserves research behavior. Quick requests ask only for missing core specs in a compact tool-free response, bounded to eight seconds. Background URL-context research has forty seconds. Numeric values already shown remain usable during review/amenity retrieval and failures.

The browser schedules at most two quick requests and one research request, sharing identical in-flight requests. Each phase allows one transient provider retry within the deadline, follows short retry delays, and stops for daily quota, authentication or invalid requests. Browser transport failures can retry once; a returned provider failure is not retried again. See [Google troubleshooting guidance](https://ai.google.dev/gemini-api/docs/troubleshooting).

VIN, quick lookup and background research have separate work state. Research can restart while VIN is pending. Removing/replacing a car aborts all its work; per-car ownership and cancellation prevent late responses from changing another car or replacing newer results. Stronger per-field evidence replaces weaker evidence (including precedence for manually reviewed references within the same quality), and partial or failed attempts preserve useful values and review dimensions.

## Device storage

`src/spec-cache.js` stores an explicit allowlist of normalized configurations and model findings under a schema-versioned key. It excludes listing URLs/IDs, prices, mileage, VINs, descriptions, seller details and attribution HTML. At most 200 configurations are retained. Source-backed data is fresh for 30 days and estimates for seven. Outage fallback permits visibly stale source-backed data up to 90 days old and estimates up to 30 days. Reuse validates configuration compatibility. Reading does not extend a field's expiry. Storage failures use memory.

**Clear saved model specs** sits beside the comparison controls. It clears this cache, preserves the current shortlist and prevents already-running lookups and their subsequent phases from saving again. A new lookup may save new results. Refresh still clears all imported cars.

## Results and verification

Labels distinguish seller reports, VIN supplements, factory references, typical source-backed specs and unverified model estimates. Core-field coverage is separate from evidence quality. Compatible approximate power/weight can contribute to rankings, with provisional labeling and source/assumption details. Comfort does not gain points from estimated equipment or brand, and performance never mixes 0-60 with 0-100 elapsed times.

The repeatable check is `node model-specs-evaluation.mjs --live --quick`. A 31 October run on a 1999 BMW Z3 2.8 automatic coupe, 2018 Civic 2.0, 2019 Corolla CVT and 2017 Mazda3 2.0 populated **17/18 requested missing core fields** in about five seconds total. The omitted field was a fixed gear count for the CVT. All **10/10 independently referenced numeric fields** agreed within the stated tolerance: power/torque/weight within 5%, gear count exact. Manufacturer power references and the BMW sources above supply the comparison values. Other returned core fields were counted for coverage, not silently counted as verified accuracy.

An earlier run returned the BMW automatic gear count as five instead of four (9/10 numeric agreement). The app's reviewed reference supplies four and outranks that estimate. This variation is why estimates stay unverified and why these small samples do not establish general accuracy or a measured "70% accurate" claim.

Regression coverage includes listing/VIN precedence and internal contradictions; offline BMW coverage; single-source and unknown-market applicability; cosmetic/engine normalization; numeric bounds and conversion; compatible provisional ranking; transient retry, quota and auth handling; independent VIN timing; request deduplication/concurrency; cancellation and replacement; partial preservation; cache expiry, stale recovery, blocked/corrupt storage, capacity and clearing during lookup. Rendered React checks cover fourth-car retry, all decision modes, controls and disclosure focus. Browser visual/responsive inspection was attempted but the computer-use browser host was unavailable; rendered interaction and the existing responsive CSS checks remain available.

Final verification: 139 regression tests passed, the production build passed, and the Impeccable detector reported no findings in the changed UI files. A live request through the local Vite/API route returned HTTP 200 with four accepted, single-source typical BMW findings in 20.9 seconds; the reviewed reference preserved the more carefully scoped automatic weight. This improves on the earlier diagnostic that rejected all five findings. Build output retains the existing Motion dependency directive warnings. No hosted deployment or new visual sign-off is claimed.
