# Dilemma: vehicle evidence and recommendations

Review branch: `codex/evidence-based-recommendations`. Do not merge into main until reviewed. This branch includes the earlier landing-page, image and mileage changes from this conversation. No deployment work is included.

## What changed

- Full vehicle photographs use `object-fit: contain`, fixed frames and neutral letterboxing. Gallery navigation is preserved.
- Mileage accepts full numbers, `k` shorthand, `kms`, explicit unit declarations and HTML/entity-encoded descriptions. Original readings remain unchanged. Conflicts stay unknown; recovered units are labeled seller-reported.
- Specifications and 16 comfort amenities carry evidence, source and status. Unknown, conflicting, reported-present and reported-absent values are separate.
- Imported listings appear immediately. Optional VIN/fuel enrichment runs in the background, in memory; stale results cannot restore a removed/replaced car. Refresh/unmount cancels outstanding frontend requests.
- Six existing modes remain. Affordability adds supported fuel scenarios. Performance uses explicit comparable horsepower/torque, with engine/drivetrain context. Comfort compares documented positive amenities. Practicality includes seating and body preferences. Balanced adds comparable supported factors with visible weights.
- Serious mechanical phrases trigger the existing caution-first rule outside Affordability. Affordability deliberately retains a price/fuel ordering with visible mechanical cautions. VIN identity/specification mismatches cannot receive an endorsement in any mode.
- Every recommendation exposes scored factors, strengths, trade-offs, lower-ranking alternatives, unknown data and sources. One-car results remain provisional. Ties are shared.

## Official sources and limits

**NHTSA vPIC:** `shared/vin.js` validates complete 17-character VINs and their North American check digit; `POST /api/vehicle-data` forwards only the VIN to the official public API, with a seven-second upstream timeout. No API key is required. Non-clean decodes are withheld. Listing/VIN mismatches are displayed, and decoded data never overwrites seller fields. The VIN check omits the listing's model-year hint so that the listing cannot bias the independent year comparison. Old, unsupported and invalid VINs degrade to seller data. vPIC describes manufacturer-submitted original specifications, not current installed options, condition, accidents, ownership or reliability. Horsepower, seats, transmission and drive type can be blank even on a valid decode. All resulting empty fields stay unknown.

**Natural Resources Canada:** `public/data/fuel/` contains 29,227 conventional/non-plug-in-hybrid reference rows for 1995–2026, downloaded from the official Canadian Open Government catalogue on 29 October 2026. Only one year loads per imported car. `manifest.json` records exact official URLs, CSV SHA-256 hashes, columns, coverage and retrieval time. `python scripts/update-nrcan.py` refreshes these public reference files; it never stores user listings. This is static reference data, not persistent comparison storage.

Matching requires exact supported year/make/model, displacement, cylinders, transmission family/speed (or CVT), fuel, and compatible explicit body/drive configuration. Explicit body/trim/drive tokens may be appended to a model name; no fuzzy/model-neighbour matching or assumed default trims. Multiple remaining configurations produce no rating, even if their ratings happen to agree. The dataset does not separately identify every drivetrain or trim; ambiguous or contradicted configurations stay unmatched. 1995–2014 ratings are adjusted 5-cycle estimates. Electric and plug-in hybrid energy costs are intentionally not integrated. Real consumption depends on condition and use.

Source: [NRCan fuel-consumption dataset](https://open.canada.ca/data/en/dataset/98f1a129-f628-4ce4-b24d-6f16bf24dd64). Contains information licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada). Adapted reference data; no government endorsement. [vPIC documentation](https://vpic.nhtsa.dot.gov/api/) and [coverage/free-use FAQ](https://vpic.nhtsa.dot.gov/api/home/index/faq).

Fuel cost is an explicit scenario: `combined L/100 km / 100 * annual km * CAD per litre`. Defaults (15,000 km, CAD 1.70/L) are editable demo assumptions, not live pump prices. Fuel scoring requires every car to have a unique match and the same fuel grade. No repair, insurance, reliability or history estimates are created.

Comfort ranks **documentation**, not verified installed equipment or ride quality. A car with no feature documentation is unscored, not assigned zero features. A lower documented count can mean an incomplete seller description. Performance never substitutes engine size, cylinder count or AWD for missing horsepower/torque. With insufficient comparable measurements, it withholds a reliable recommendation.

## Two-car worked example

These are fictional numerical teaching inputs, not claims about real vehicles. No missing horsepower, fuel or amenities are invented.

| Input | A | B |
|---|---:|---:|
| CAD asking price | 16,000 | 19,000 |
| Model year | 2018 | 2020 |
| Explicit mileage in km | 100,000 | 70,000 |

Best Value weights price 45%, age 25%, mileage 30%. Each factor gives the preferable end of this shortlist 100 and the opposite end 0; equal values receive 50.

- A: `100 × .45 + 0 × .25 + 0 × .30 = 45`.
- B: `0 × .45 + 100 × .25 + 100 × .30 = 55`.

B wins on supported age/mileage; its weakness is the higher asking price. A ranks lower because its price advantage does not outweigh its older age and greater mileage. A disclosed engine problem on B triggers the caution rule and makes A the endorsed value match, despite B's numerical score. The automated worked-example test checks this exact outcome. Scores are relative to the shortlist, not general vehicle ratings.

## Three files to understand

1. `src/vehicle-specs.js`: `extractVehicleSpecs(car)` turns listing fields and plain seller text into evidence records. Think of a Java static method returning a `Map<String, Specification>`. JavaScript objects are flexible records; each record has `value`, `status` and `evidence`. Regular expressions recognize explicit phrases. They do not guess equipment from a model name. `vinMismatches` compares canonical values without mutating the listing.
2. `src/fuel-data.js`: `filter` keeps only exact supported configurations—like a Java Stream with several `.filter(...)` predicates. A result is usable only when one configuration remains. `annualFuelCost` is ordinary arithmetic with input checks. Asynchronous `fetch` returns a Promise, similar to a Java `CompletableFuture`; failure leaves fuel data unavailable.
3. `src/decision-engine.js`: deterministic functions turn comparable measurements into normalized points, multiply by active weights, and sort. This resembles Java methods operating on lists and comparators. If anyone lacks a factor, it is excluded for everyone and remaining weights are renormalized. Safety/identity caution rules run separately from the arithmetic. No network call or AI chooses a winner.

## Four-minute presentation

1. **0:00–0:35** Explain the problem and the eBay.ca link input. Import two pre-checked, currently available listings; preparation matters because live eBay inventory can disappear.
2. **0:35–1:25** Compare full photos, original mileage, specifications and source badges. Open one evidence panel. Show an unknown value honestly.
3. **1:25–2:25** Switch Value, Comfort and Performance. Explain documented-feature counts and explicit power. If a seller/VIN lacks power, show why the app refuses to guess. Official enrichment has a bounded wait and never blocks the comparison.
4. **2:25–3:20** Show one strengths/trade-offs breakdown and weights. If a fuel match is available, open the editable fuel scenario and explain that it is an assumption. Do not promise an NRCan match for an incomplete listing.
5. **3:20–4:00** Use the numerical example above to explain determinism, missing-data exclusions and mechanical cautions. Emphasize no paid APIs, accounts, persistent car storage or invented history. The landing preview is explicitly illustrative and does not contaminate real imports.

## Review and verification

Run `npm test` and `npm run build`. New evidence tests cover VIN validation/decoding/mismatches, missing data, HTML/entity parsing, comfort contradictions, strict fuel matching, NRCan coverage, optional-enrichment failures, endpoint security, CSS image containment/consistent frames, relative ranking and mechanical concerns. Existing mileage, importer, decision journey, gallery, API and deployment regression tests remain. CSS/DOM image assertions verify the browser's sizing contract; they are not a visual screenshot test. Live vPIC verification uses only the public NHTSA example VIN, not a user VIN. No Vercel debugging or deployment is part of this change.

Review the source parsing rules and feature wording, exact-match refusals, Affordability's caution-only ordering, and reference-data provenance before merging. No `.env`, credentials or saved seller payloads belong in the review commit.
