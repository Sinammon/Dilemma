# Dilemma: Import → Compare → Decide

Review branch: `codex/three-stage-experience`. This branch includes the earlier decision-engine commit and the three-stage redesign. `main` is unchanged; no deployment or merge is included.

## Three pages

- **Import (`#import`)**: paste an eBay.ca used-vehicle URL. A successful import automatically opens Compare. Errors stay on the current page.
- **Compare (`#compare`)**: up to four images and structured YEAR MAKE MODEL names, asking prices, mileage, transmission, fuel, engine, body type, power, drivetrain, condition, location, VIN and all other returned specifications. Missing fields say **Unknown**. Add another car, remove one and import a replacement, read descriptions and open original eBay links. **Help Me Decide** opens Decide.
- **Decide (`#decide`)**: six clickable modes update recommendations immediately. See selected vehicles with images, advantages, trade-offs, warnings, score contributions, why other cars rank lower and missing information. Return to Compare to edit the shortlist; the chosen mode is retained.

Hash navigation supports browser Back/Forward without a routing dependency or server changes. React state in App owns the shortlist and selected mode. Refresh clears everything. No database, accounts, saved comparisons, persistent browser storage or new API service was added. The eBay backend, credentials, security headers, importer and deployment configuration are unchanged.

## Mileage evidence

`src/vehicle-data.js` interprets the imported fields without changing the original listing object. It checks explicit structured units, embedded units, units in mileage field names, titles and mileage-related description statements. It recognizes km, kilometres, kilometers, mi and miles. Text evidence must match the original mileage number. Service intervals and warranty distances are excluded. Different explicit odometer statements, conflicting units and conflicting structured values cause **Unit unknown** and exclusion from scoring. A Canadian location never establishes kilometres.

The original mileage number and formatting remain visible. Explicit miles are converted to km only inside the calculation, using 1.609344. No mileage number is invented from a description when the structured number is missing. Evidence and reasons are available beside each seller description. Conservative exclusions may reject legitimate dual-unit or historical readings; confirm them with the seller.

## Deterministic scoring

| Mode | Configured weights | Caution policy |
| --- | --- | --- |
| Best Value | Price 45, age 25, mileage 30 | Mechanical concerns first |
| Lowest Upfront Cost | Price 100 | Pure asking-price order, prominent warnings; not a purchase endorsement |
| Everyday Practicality | Age 35, mileage 45, comparable amenities 20 | Mechanical concerns first |
| Performance | Explicit listed power 100 | Mechanical concerns first; abstain without comparable power |
| Comfort & Features | Comparable amenities 100 | Mechanical concerns first; abstain without common explicit evidence |
| Balanced Choice | Price, age and mileage equally | Mechanical concerns first |

Within the shortlist, the preferred numeric endpoint scores 100 and the opposite endpoint scores 0. Intermediate values use a straight line. Lower price/age/mileage is preferred; higher listed power or comparable amenity count is preferred. Equal values score 50. Multiply by active weight shares and add.

Example: fictional A costs $10,000 CAD and is ten years old; B costs $20,000 CAD and is five years old. Mileage is equal and explicit. Best Value gives A `100 × .45 + 0 × .25 + 50 × .30 = 60`; B gets `0 × .45 + 100 × .25 + 50 × .30 = 40`. Balanced Choice gives both 50, so they share a rank. If A discloses an engine problem, B ranks first in both modes regardless of A's low price. Lowest Upfront Cost still identifies A as cheapest and prominently warns about its disclosed condition and uncertain additional costs.

If any car lacks a compatible factor, exclude that factor for everyone and renormalize the remaining weights. No usable weighted data means no recommendation. Compare CAD prices only; never guess exchange rates. Age uses structured model year, with next-year models counted as zero. Scores are rounded to two decimals for ties and displayed at that precision. Single-car results are provisional. Scores depend on the shortlist, not the wider market.

Mechanical rules recognize supported English phrases for not running, engine problems, coolant leaks and repairs needed, with limited negation/repair handling. Except in cost mode, flagged cars rank below unflagged cars. If every car is flagged, no Best Match is endorsed. **Sold as is alone is not evidence of mechanical damage.** No warning match proves a car is sound.

Performance compares explicit hp/bhp or kW power claims (kW converted to hp); engine and drivetrain names are shown as context, not rated by guesswork. This is a limited power comparison, not an acceleration or handling prediction. Comfort/practicality use eight supported amenity categories only when each car explicitly confirms or denies the amenity. Missing mentions are unknown, never absent. Model or trim names never imply equipment.

## Three files to understand first

1. **`src/App.jsx`**: imports, temporary state and page navigation. `useState` holds a value and a setter that asks React to render again. Props pass values into components, like Java method arguments. Arrays plus `filter` create an updated shortlist rather than mutating the old one.
2. **`src/vehicle-data.js`**: structured names, specifications, mileage evidence, amenity claims and power parsing. `null` means unknown; JavaScript's `??` supplies a fallback only for null/undefined. Objects act like simple Java records, without a required class declaration.
3. **`src/decision-engine.js`**: six modes, normalization, weights, ties and warning groups. Exported pure functions resemble static Java utility methods: same input gives the same output when the year is fixed, and input objects are not modified.

`VehicleComparison.jsx` renders the comparison; `DecisionDashboard.jsx` renders mode choices and explanations. CSS lives in `src/styles.css`.

## Run and test

Use Node 24. Run `npm install` once. Keep the existing ignored `.env` with server-side eBay credentials; never add a `VITE_` prefix or commit it.

In separate terminals:

```powershell
npm run server
npm run dev
```

Open http://127.0.0.1:5173. If a server is already running, use it rather than starting another on the same port.

```powershell
npm test
npm run build
```

The offline suite uses fictional vehicles only and includes the existing importer/HTTP/security tests. New tests cover mileage spelling variants, structured units, unmatched service distances, conflicting measurements, Unknown fields, preserved raw values, feature negation, power units, all six modes, numeric examples, ties, mechanical caution versus cost mode, automatic navigation, duplicates, four imports, removal/replacement, mode retention and clearing. No live listing data is saved.

## Four-minute presentation

1. **0:00–0:45** — explain the buyer's dilemma; import a real listing and show automatic Compare navigation.
2. **0:45–1:45** — add another real listing, compare structured names/specifications, and point out Unknown fields and mileage evidence.
3. **1:45–3:15** — click Help Me Decide; switch Best Value, Lowest Upfront Cost and Balanced Choice. Explain one score and one trade-off. Show a real disclosure if available; otherwise discuss the fictional tested example honestly.
4. **3:15–4:00** — show Performance or Comfort handling incomplete evidence; return to Compare, remove a car, and explain that Dilemma never invents missing data.

## Review limits

Text interpretation is deliberately limited and can miss paraphrases, French, complicated negation, historical repairs or unusual mileage formatting. All displayed data remains seller claims, not independent verification. No reliability ratings, accident histories, maintenance costs, fuel economy or repair estimates are fabricated. Sparse listings may make Performance or Comfort inconclusive, and one incomplete car can remove a factor for the whole shortlist.

Automated DOM interaction checks and the production build passed. Browser automation access was unavailable and native Chrome input could not obtain usable geometry, so pixel-level desktop/mobile review remains a manual item. No fresh live eBay quota or Vercel troubleshooting was used in this change.
