# Vehicle evidence and the school demo

The app uses live seller data, optional original VIN records, bundled Canadian fuel reference data, and a small reviewed model-research library. Missing specifications are never manufactured to fill a table or complete a score.

## What works

| Layer | Implementation | Limits |
|---|---|---|
| eBay | Existing stateless importer; original fields and plain seller text stay in React memory | Seller assertions need confirmation. Production credentials and available inventory are still required for live import. |
| NHTSA | Existing `/api/vehicle-data` endpoint validates the VIN, calls free vPIC, and records original specifications separately | Coverage is incomplete, especially for older vehicles and options. No condition, accident or ownership history. Conflicts with the listing prevent endorsement and fuel matching. |
| NRCan | Official 1995–2026 reference snapshot in `public/data/fuel`, with licence, resource URLs and hashes in the manifest | Exact, unique supported configuration only. Multiple possible rows are withheld even if ratings agree. EV/PHEV energy costs are outside this matcher. |
| Model research | Reviewed, attributed claims in `src/model-profiles.js`; exact scoped selection in `src/model-research.js` | Five profiles, not general web coverage. No general AI browsing, generation API or paid service. An optional live NHTSA model recall lookup is available in decision source details. |
| Comparison | Short table omits factors unknown for every car; summary cards separate original specs, seller claims, model research and individual checks | A gap remains a gap. Expand evidence for raw claims and source links. |
| Help Me Decide | Existing numeric scoring uses only compatible, supported measurements; factor provenance and exclusions are visible. Relevant model opinions/issues appear alongside the result | Research is qualitative and contributes no numeric points. Without measurements for the selected priority, show an explicitly labeled Best Value starting point using available price/year/mileage. Without those factors, contenders remain unscored. Missing research coverage is never scored as a disadvantage. |

`enrichVehicle` runs after import and never blocks showing a listing. VIN checks and local fuel-file loads have bounded timeouts. Outages leave seller data usable. Removed/replaced cars cannot be restored by late responses. Neither the new research library nor the demo writes listing payloads to disk, browser storage or a database.

The fuel matcher now understands the explicit NRCan Mazda3 `4-Door`/`5-Door` naming when supported sedan/hatchback evidence is present. It does not strip configuration suffixes, infer trim, assume equipment or choose a nearby model. An ambiguous Corolla CVT remains unmatched.

## Research coverage and source review

| Profile | Scope | Supporting material |
|---|---|---|
| 2018 Honda Civic | Regular North American range; excludes Si/Type R. Body-specific observations are conditional. | [Car and Driver road-test review](https://www.caranddriver.com/honda/civic-2018); [American Honda bulletin 19-091, version 4, p. 1](https://static.nhtsa.gov/odi/tsbs/2020/MC-10180616-0001.pdf). |
| 2019 Toyota Corolla | Sedan only; body must be supported. The different 2019 hatchback is excluded. | [Car and Driver sedan review](https://www.caranddriver.com/toyota/corolla-2019); [Toyota Canada recall notice, 21 January 2020](https://media.toyota.ca/en/releases/2020/toyota-is-conducting-a-safety-recall-involving-certain-corolla-matrix-and-avalon-vehicles.html). |
| 2017 Mazda3 | Canadian sedan/hatchback review; cargo observations concern the hatchback. Recall document is US-market. | [CAA-Quebec road test, 24 February 2017](https://www.caaquebec.com/en/advices/buying-or-selling-a-vehicle/road-tests/mazda-3-2017); [Mazda US recall statement, 15 April 2019](https://news.mazdausa.com/2019-04-15-2019-statement-on-recall-of-certain-2016-2018-my-mazda3-vehicles). |

Each claim has a category, source IDs and wording reviewed on 29 October 2026. Each source has a publisher, specific title, HTTPS URL, section/page locator, source type and review date. A claim with missing or unresolved citations is withheld. Citation validation checks identification; human review is still needed to establish that the source actually supports the wording.

Profiles cover strengths, documented issues, comfort, practicality and performance. Reviews are attributed opinions about typical/tested configurations. Bulletins and recalls support issues to investigate, not failure-frequency statistics, a reliability score, Canadian warranty eligibility, an individual diagnosis or an open-recall lookup. Research cannot establish installed equipment and never populates `extractVehicleSpecs` or its amenity records.

To expand coverage, read supporting sources first, add a narrowly scoped profile with claim-level citations, and add scope/regression tests. Do not broaden a year range just because the name looks similar. For arbitrary vehicles, a future working research integration would need retrieval, claim/source verification, configuration scope, failure handling and source freshness. The current UI explicitly says general AI web research is not connected. The separate free NHTSA campaign lookup is working, but it does not answer comfort, individual condition or installed-equipment questions.

## Repeatable demonstration

1. Start the frontend with `npm run dev`. The backend (`npm run server`) is needed only for live eBay/VIN requests.
2. Click **Try fictional demo** on Import or an empty Compare page. It loads three invented vehicle records in memory. It makes no eBay, VIN or research request; fuel data comes from bundled public files served by Vite.
3. Compare the key table and the four evidence categories. Civic and Mazda3 have unique fuel matches; Corolla's incompletely specified CVT has multiple possible matches, so it gets no rating. This also excludes fuel from all-car cost scoring.
4. Open **Typical model research** to show all five topics and identifiable sources. Source links need internet if clicked; the summaries themselves work offline.
5. Choose **Help Me Decide → Performance**, then **Comfort & Features**. No horsepower or comfort equipment was supplied in these fictional records. The app shows a labeled starting point based on price/year/mileage, alongside sourced model context; it does not claim a score or winner for the unsupported priority. A relevant positive review can suggest a test drive; it does not establish superiority over uncovered cars.
6. Switch to **Best Value** to show the numeric price/age/mileage result, advantages, trade-offs, source labels and excluded factors. Refresh to clear the demo.

The demo is always explicitly labelled fictional. It does not impersonate real eBay listings, use real eBay listing photographs, or claim a VIN decode took place. Bundled Commons model-example photos have linked credits and may differ from the fictional year, body or trim.

## Verification and remaining work

Run `npm test` and `npm run build`. Tests cover profile scope, all five research topics, citation rejection, identity/body conflicts, variant exclusions, numeric/research isolation, absence of inferred equipment, mechanical cautions, unavailable research, unique/ambiguous official fuel matches, outage handling and the full Import/Compare/Decide/demo journey. Existing importer, VIN endpoint, no-cache, security and deployment tests are retained.

Live eBay availability and a hosted Vercel deployment still need their existing smoke checks in the target environment. This change does not deploy or add a new provider. The public vPIC API can fail or omit fields. More models require reviewed sources; the app does not promise research for arbitrary imports. Current condition, installed options, history and campaign completion still need individual evidence. No paid APIs or persistent eBay storage were added.

Validation for this update: 81 automated tests passed, production build passed, and a live vPIC decode of the existing public example VIN returned original identity/engine/transmission data while leaving seating blank. The demo's compact comparison and evidence categories were also inspected in Chrome. No live eBay import or hosted deployment was performed for this update. Vite reports existing Motion dependency `use client` bundling warnings; the build succeeds.

The latest decision-screen design, two added exact-year profiles, conservative starting-point behavior and official recall lookup are documented in [DECIDE_REDESIGN.md](DECIDE_REDESIGN.md).
