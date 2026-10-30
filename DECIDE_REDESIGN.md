# Help Me Decide

The main view follows the supplied reference: four priorities, one photo-led result, up to two supported reasons, one cited model note, a trade-off and a short specification strip. Sources, excluded factors, original descriptions and score arithmetic are collapsed. Contender arrows and a larger-photo dialog work with the real in-memory shortlist. Practicality and Performance remain under More priorities.

## Missing information

`rankDecisionMode` still abstains when its requested measurements cannot be compared. `decisionSummary` can then offer a **Starting point** using the existing Best Value factors (available price, model year and compatible mileage). The card explicitly states this basis; it does not claim a Comfort or Performance winner. With no comparable factors, contenders remain unscored. Condition warnings and VIN/listing conflicts retain their safeguards, and ties remain equal. Lowest Cost can show a cheap car with concerns, with an explicit caution badge and its warnings visible.

Comfort counts only feature categories explicitly documented for every contender. It no longer compares unrelated lists of advertised amenities. Unmentioned equipment stays unknown. Model research supplies no equipment, specification values or score points.

## Research that works

- Existing seller data, optional NHTSA VIN decoding and exact Canadian NRCan fuel matching continue working.
- Five exact-year, source-reviewed profiles cover the 2018 Civic, 2019 Corolla sedan, 2017 Mazda3, **2002 Thunderbird** and **2005 Dodge Sprinter**. The last two address the examples in the supplied screenshot. Sprinter passenger impressions are conditional; cargo vans and camper conversions differ. Road tests and single test-car problems do not establish failure rates.
- The free **Check official recalls** action calls `POST /api/recalls`, which retrieves NHTSA model-year/make/model campaigns. It sends no eBay URL, description or VIN. Records include identifiable campaign links, the manufacturer remedy and scope notes, including aftermarket-only cases. It is a US model lookup, not an individual open-recall or Canadian applicability check. Results are temporary, uncached and excluded from scoring.
- General AI web research is **not connected**. The app does not claim to browse, fill every missing fact or rate reliability. Broad AI research would need a working retrieval provider, claim/source validation, configuration matching and freshness checks. No paid API was added.

## Verification and preview

Run `npm run server` and `npm run dev`, then open `http://127.0.0.1:5173`. Choose **Try fictional demo → Help me decide → Comfort** to see the sparse-data starting point. The demo's locally bundled Commons photographs are model examples, with credits; they do not document its invented years, trims or equipment.

Automated coverage includes the full Import/Compare/Decide journey, source rejection, exact profile scope, strict feature comparison, missing-data fallback, condition/identity safeguards, ties, official recall validation and failures, and existing importer/VIN/fuel/deployment checks. Browser checks use isolated Chrome with fictional inputs, at 1440, 768 and 390 pixels. The homepage's three preview stages, decision priorities, contender arrows, larger-photo dialog, keyboard navigation, reduced motion and horizontal overflow were checked. No live eBay import or hosted deployment was performed.

The earlier homepage redesign is also retained: real URL import beside a separate three-stage illustrative preview. The preview uses Motion's keyed AnimatePresence slides with direction-dependent 500 ms slide/fade transitions, a rapid-click guard and no autoplay.
