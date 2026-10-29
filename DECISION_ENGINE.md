# Decision engine review

Branch: `codex/decision-engine`. Intended base: `main`. No merge or deployment is part of this change.

## What changed

The original eBay importer, vehicle cards, specifications, descriptions and comparison table remain in place. A dashboard above the shortlist adds three priority sliders, immediate rankings for up to four cars, Best Match explanations, weighted score contributions, missing-data notices, ties and mechanical-warning evidence. Car data and priorities remain only in React memory; refresh clears them. The added jsdom dependency is for tests only.

## Explain it in the pitch

“Dilemma turns a shortlist into a decision based on what matters to you, while making missing information and seller-disclosed concerns visible.”

For each active measurement, the lowest value scores 100 and the highest scores 0:

`points = 100 × (highest − car value) / (highest − lowest)`

Equal values score 50. Multiply each result by its share of the active priorities and add. Scores describe preference fit within this shortlist, not market value, reliability or safety.

Example: fictional A costs $10,000 CAD and is 10 years old; B costs $20,000 CAD and is 5 years old. Both have the same explicit mileage. With priorities price 60, age 30, mileage 10:

| Car | Price | Age | Mileage | Total |
| --- | --- | --- | --- | --- |
| A | 100 × 60% | 0 × 30% | 50 × 10% | 65 |
| B | 0 × 60% | 100 × 30% | 50 × 10% | 35 |

Changing age to the only active priority makes B win. If A discloses an engine problem, it ranks below B regardless of price, while retaining its preference score and showing the reason. If all cars have detected warnings, no Best Match is endorsed. Scores rounded to two decimals share a rank when tied within the same warning group. Joint winners each receive explanations.

Missing data excludes that measurement for every car, then the remaining weights are renormalized. This conservative rule avoids giving unknown values an advantage. If all active data is unusable or all priorities are zero, there is no numerical recommendation. Only explicitly CAD prices are compared. Explicit miles convert by 1.609344; no unit is guessed. Model years outside 1886 through next year, conflicting arrays, numeric ranges and ambiguous numbers are excluded. Next-year models have age zero. A single-car score is provisional.

## Three files to understand

1. `src/decision-engine.js`: the calculation and warning rules. Like a Java utility class with static methods, these exported functions take inputs and return results without changing the inputs. Arrays of objects play the role of lists of vehicle records.
2. `src/DecisionDashboard.jsx`: sliders, ranking and explanations. `useState` holds temporary priorities; its setter tells React to render again. `Number(event.target.value)` converts the slider's string value, similar to parsing a string in Java. `{ ...previous, [key]: value }` copies the old object and replaces one field rather than mutating it.
3. `src/App.jsx`: the existing importer and shortlist owner. It passes `cars` into the dashboard as a prop, similar to passing an argument into a Java method. The dashboard computes its results from the current cars and priorities each time it renders.

`src/styles.css` controls appearance. `decision-engine.test.mjs` checks the pure rules; `decision-dashboard.test.mjs` checks actual React events with mocked imports using fictional cars only.

## Four-minute demonstration

1. Import two complete used-car listings and show the preserved comparison table.
2. Explain the default Best Match and its strengths and trade-offs.
3. Move the price and age sliders to demonstrate immediate recalculation. Reset priorities.
4. Show missing mileage units and the “How the scores work” disclosure. Explain that unknown data is excluded.
5. If a real listing contains a supported mechanical disclosure, show its evidence and ranking group. Otherwise explain the tested fictional example above; do not present synthetic cars as real listings.

## Validation and review

Run `npm test` and `npm run build`. The offline suite covers scoring arithmetic, changed priorities, intermediate values, four-car limits, missing/invalid data, currency and mileage compatibility, ties, empty inputs, mechanical rules, and UI import/remove/clear/reset behavior. Existing importer and HTTP regression tests remain included. No live eBay responses are saved, no new API requests are introduced, and Vercel configuration is unchanged.

Review the engine policy and dashboard before merging into `main`. In particular, decide whether excluding incomplete criteria is appropriate for the presentation. The browser automation host was unavailable during this session, so a visual check in a real browser at desktop and phone widths remains a manual review item; DOM interaction tests do not verify pixels. No hosted deployment or fresh live eBay check is claimed.

## Limits to explain honestly

- Mechanical detection uses supported English phrases in titles, descriptions and specifications. It has limited negation/repair handling and can miss paraphrases, French disclosures or subtle context. It shows evidence for human review; absence of a match never establishes that a car is sound.
- A warning changes the ranking group, not the score. Cars within each group sort by preference score; this does not estimate the relative severity or cost of different mechanical problems.
- A car with incomplete data can remove a useful criterion for the entire shortlist. Warnings can still be shown when there is insufficient data to score.
- Scores change with the shortlist, and seller asking prices may not represent total purchase cost. The engine adds no accident history, reliability rating, repair estimate or independent verification.
