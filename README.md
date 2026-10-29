# Dilemma

A temporary, in-memory eBay.ca used-car comparison for a Grade 12 CS demo. React + JavaScript + CSS, Vite, and a minimal Node.js API. Import up to four cars, view real photos, compare available fields and specifications, and read seller descriptions as safe plain text.

## Decision engine

Vehicle evidence now includes optional NHTSA vPIC VIN decoding and strict matching against a bundled official NRCan fuel-consumption snapshot. Source badges distinguish seller claims, original VIN records, corroboration and unknown/conflicting values. See [REVIEW.md](REVIEW.md) for the current scoring rules, source limits, Java comparisons, worked example and four-minute demo outline. User comparisons remain temporary and in memory.

The app now follows Import ? Compare ? Decide, with a dedicated comparison page, mileage-unit evidence and six clickable decision modes. Recommendations use transparent scoring, missing-data exclusions and mechanical-warning safeguards. See [DECISION_ENGINE.md](DECISION_ENGINE.md) for the scoring example, three key files, Java comparisons, demonstration steps and review limitations.

## Run locally

Use Node.js 24 (also pinned for Vercel in package.json). From this project folder, install dependencies once:

```powershell
npm install
```

Keep the existing ignored .env with EBAY_CLIENT_ID and EBAY_CLIENT_SECRET set to Production credentials. If starting a fresh checkout, copy .env.example to .env and fill it in locally. Never prefix secrets with VITE_: those variables are exposed to the browser.

Terminal 1 — backend:

```powershell
npm run server
```

Terminal 2 — frontend:

```powershell
npm run dev
```

Open http://127.0.0.1:5173. Keep both terminals running; Ctrl+C stops each process. The backend runs on port 3001. Vite forwards /api requests to it, so no CORS configuration is needed. Save frontend files to see updates; restart the backend after editing server code. If port 3001 changes, update vite.config.js to match.

## Checks and production preview

```powershell
npm test
npm run build
npm run preview
```

For the production preview, keep the backend running and open http://127.0.0.1:4173. The dist folder contains the frontend only: it still needs the Node backend. Vercel hosts dist plus the functions in api/ using vercel.json. Do not upload only dist: it does not contain the backend. Never publish your .env or serve the project directory as static files.

Optional live check (uses Production API quota, stores no responses):

```powershell
npm run test:live
```

It finds an available Canadian used-vehicle candidate and tests both the local HTTP importer and the actual Vercel Web handler running locally. It prints only status, field counts and a demo link. This does not prove that a hosted Vercel deployment works. Inventory may change. The original feasibility CLI remains available below and intentionally prints its original diagnostic output; the website always calls the quiet importer.

## Deploy to Vercel

This is a Vite frontend plus Node.js Functions, not a Next.js project. The root api/import.js exports Vercel's Web Request handler; api/health.js returns a small health response. Both use backend/handler.mjs, without importing the local server or reading .env. Vercel supplies process.env credentials at runtime. React continues to POST to the relative /api/import path.

### Fix a hosted /api/health NOT_FOUND

A Vercel `404 NOT_FOUND` at `/api/health` means that request did not reach this app's health handler. Health does not authenticate with eBay. Production credentials cannot fix a missing route. The frontend's former JSON parsing error came from trying to parse the platform's HTML/text error as JSON; the frontend now reports a missing/unavailable API safely.

The checked-in `api/health.js` and `api/import.js` are beside `package.json` and `vercel.json` at the repository root. Their Web Request exports are supported by Vercel. `vercel.json` has no rewrites, redirects or legacy `builds` override. `outputDirectory: dist` selects the static frontend output; Vercel separately discovers root `api/` functions. Vite's local proxy is only for development/preview and is not deployed as a backend. Do not copy API source or credentials into `dist`.

Check the actual Vercel project (these dashboard settings are not stored in this checkout):

1. Settings → Git: connected repository must be `Sinammon/Dilemma`; production branch must be `main`. The deployment adapter has been merged into GitHub main at `370b578`. A redeploy of an older deployment may still rebuild its old commit; create a deployment from the latest main instead.
2. Settings → Build and Deployment: Root Directory must be the repository root (blank or `.`), **not `dist`, `src` or `api`**. That directory must contain `package.json`, `vercel.json`, `api/`, `backend/`, and `ebay-feasibility.mjs` together. Framework: Vite; install: `npm ci`; build: `npm run build`; output: `dist`; Node: 24.x. `npm run server` is only for local use.
3. Keep the existing server-side Production variables `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET`. No `VITE_` prefix. Do not print values or add them to Git. They are not needed for health checks.
4. Deploy the latest main from the full repository, then inspect that deployment's build output/resources. It must list **both** `/api/health` and `/api/import` as Node functions as well as static assets. A deployment containing only `index.html` and assets is incomplete. If using CLI, run it from the repository root, never from `dist`; do not use a static-only or incomplete prebuilt upload.
5. Test the new deployment's exact HTTPS URL first, then the public production domain. If only the latter fails, check which project/deployment the domain is assigned to. Preserve deployment protection; an authenticated test is needed for protected deployments.

Run the hosted routing check (it loads no credentials and prints no response bodies):

```powershell
npm run test:deployment -- https://YOUR-DEPLOYMENT
```

It requires GET `/api/health` → 200 JSON `{ "ok": true }`, GET `/api/import` → 405 JSON, and POST `/api/import` with an invalid listing URL → 400 JSON. This confirms both deployed routes and same-origin request validation, but deliberately does not claim eBay authentication. Then use the frontend to import a currently available complete used-car listing and confirm POST `/api/import` → 200 JSON with `vehicle`. A JSON 503 at this stage means the handler is deployed but authentication/permissions need attention.

Verification for the follow-up fix: 23 offline checks passed, production Vite build passed, and live Production eBay OAuth and listing import passed through local HTTP and the Vercel Web entry point **running locally**. No hosted deployment or configured dashboard root has been verified without a deployment URL and project access. Changes to frontend error handling do not themselves install missing hosted functions.

Hosted check on 2026-10-28 at `https://cardilemma015.vercel.app`: GET `/` returned 200 HTML; GET `/api/health`, GET `/api/import`, and POST `/api/import` with a listing URL all returned 404 `text/plain` with `x-vercel-error: NOT_FOUND`. The deployment smoke command correctly failed. Neither API handler was reachable at that domain, so hosted eBay authentication could not be tested. The dashboard project root, source deployment and function resources still require inspection with authenticated Vercel access.

### Repository and branch

The destination is https://github.com/Sinammon/Dilemma.git. The existing origin points to AI-Shopping-Assistant, so do not blindly run git push origin. The deployment adapter is already merged into Dilemma main. After committing further fixes, inspect remote branches first and never force-push. Push the intended main explicitly:

```powershell
git push https://github.com/Sinammon/Dilemma.git main:main
```

Vercel may automatically start a Production deployment if main is the tracked production branch. A successful push is not proof of a successful deployment.

### Project settings

1. In Vercel, import Sinammon/Dilemma (or open that existing Vercel project). Root Directory: repository root. Framework Preset: Vite. Build Command: npm run build. Output Directory: dist. Install Command: npm ci. Use Node.js 24.x; package.json pins it. Do not use npm run server as the Vercel build/start command.
2. For a preview, deploy the codex/vercel-deployment Git branch. If you want this branch to serve the production site, open Settings → Environments → Production → Branch Tracking and select codex/vercel-deployment. Alternatively merge this branch into main first and keep main as the production branch. Deploying the old main commit alone will not include this adapter.
3. Before deploying, open the project's Settings → Environment Variables. Add EBAY_CLIENT_ID with your Production App ID and EBAY_CLIENT_SECRET with your Production Cert ID. Copy the values privately from your local .env; do not paste them into chat, GitHub, vercel.json, or frontend code. Select Production and Preview (or restrict Preview to this trusted deployment branch). Use Sensitive where offered. No VITE_ prefixes.
4. Save the variables, then deploy/redeploy the intended branch. Environment-variable changes apply to new deployments, not existing ones. The local .env stays on your computer. .vercelignore additionally excludes environment files from CLI uploads; .gitignore remains unchanged.
5. Keep the generated HTTPS deployment URL for the checks below. If the preview requires Vercel sign-in, authenticate normally; do not disable deployment protection just for testing.

### Verify after deployment

- Open https://YOUR-DEPLOYMENT/api/health: expect {"ok":true}.
- Load the home page and import a currently available eBay.ca complete used-vehicle URL. Check real photos, price/currency, comparison fields and seller description. Missing units must remain explicitly unknown.
- Add up to four different cars, check duplicate protection, remove a car, and refresh to confirm the shortlist clears.
- In browser developer tools → Network, inspect /api/import: it must return JSON and Cache-Control: no-store. A GET to /api/import should return 405 JSON, not the homepage. A broken listing should produce a useful error.
- Check a phone-sized layout. Check the Vercel deployment's function logs for status/errors without adding payload or credential logging.

### Routing, timeout and data behavior

Vercel serves / from the Vite dist output and detects /api/import and /api/health from the root api directory. The app uses hash links, so no SPA catch-all rewrite is needed; a catch-all could accidentally hide API errors. Same-origin requests work on production, preview and custom domains. Other origins are rejected; no wildcard CORS is enabled.

vercel.json sets api/import.js to a 60-second maximum. Each eBay call times out after 25 seconds, giving OAuth plus Browse about 50 seconds and leaving room for a JSON error before the function limit. The browser already allows 70 seconds. No background tasks, database, persistent listing caches or accounts are added. Recommendations are calculated in memory by the frontend. All API responses set no-store for browser and CDN caching. Frontend assets can use Vercel's normal static caching. Direct eBay images remain subject to their image host's HTTP caching policy.

If /api/health is 404, verify Root Directory and that the deployed commit includes api/. If POST /api/import returns HTML, check for an old SPA rewrite or the wrong deployed branch. A 503 authentication message means the Production credentials or eBay permissions need checking; a 504 means an upstream connection/timeout failure. Do not diagnose by logging secrets or complete listing payloads.

### Verification recorded for this change

- npm test: 20 passing checks covering the original CLI importer, local HTTP adapter, actual Vercel Web entry point, missing credentials, origin validation, timeout/error mapping, body limits and no-store responses.
- npm run build: production frontend build passed.
- npm run test:live: real Production eBay import passed through local HTTP and the Vercel handler running locally; responses stayed in memory.
- Hosted verification: pending publication, Vercel environment settings and an actual deployment URL. No hosted deployment has been claimed or verified by these local tests.

Official references: [Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js), [Vite](https://vercel.com/docs/frameworks/frontend/vite), [function durations](https://vercel.com/docs/functions/configuring-functions/duration), [environment variables](https://vercel.com/docs/environment-variables).

## How data moves

React form → POST /api/import → Node validates the URL → eBay OAuth → Production Browse getItemByLegacyId → Node extracts fields and strips description markup → JSON → React state and comparison table.

React state is similar to an object held in a Java program's memory. Updating it tells React to redraw the affected screen. A refresh clears the entire shortlist. The backend holds each listing only while processing a request; it does not maintain a comparison or listing cache. Responses use Cache-Control: no-store. No database, localStorage, sessionStorage, listing files, persistent caches or full listing logs are used by the app. Photos are loaded directly from eBay's returned HTTPS image URLs; image requests remain subject to the image host's own HTTP caching headers.

The app preserves raw mileage and explicit units, currency, missing fields and seller values. It does not infer year/make/model from titles. Known categories outside Cars & Trucks, New listings, and titles explicitly containing accessories are rejected. Seller categorization can still be inaccurate; confirm complete-vehicle identity with the seller. eBay coverage and listing completeness vary. The decision dashboard uses only these imported fields and explicit seller text; no chatbot, accounts or saved comparisons are included.

## Importer architecture files (see DECISION_ENGINE.md for the three decision-engine files)

1. src/App.jsx: React components, temporary car state, URL form, loading/errors, remove actions and comparison table. Components are functions returning JSX (HTML-like markup). useState is the temporary data React watches.
2. backend/handler.mjs: the shared HTTP controller. Validates requests, calls eBay, returns safe errors and no-store JSON, and turns seller HTML into inert text. server.mjs adapts local Node requests to it; api/import.js exposes the same handler on Vercel.
3. ebay-feasibility.mjs: shared Production authentication, strict eBay.ca URL parsing and vehicle field extraction. Its standalone CLI still works; the backend passes quiet: true to suppress listing diagnostics.

Visual styling lives in src/styles.css; Vite's /api proxy lives in vite.config.js. All existing Git history is retained. The original app is on codex/dilemma-functional; Vercel preparation is on codex/vercel-deployment. The initial homepage was checkpointed before functional changes.

## Your tiny code change

In src/App.jsx, change the button text 'Import car' to 'Add to shortlist'. Save the file and watch the button update. It's a string literal, just like text inside double quotes in Java; JavaScript also allows single quotes.

---

## Original eBay API feasibility test

A standalone Node.js probe for eBay's **Production** Browse API. No web app, dependencies, database, or token files.

## Run

1. Use Node.js **22.9+** (Node 24 LTS recommended). The script uses built-in `fetch` and `.env` loading.
2. Open the local `.env` file and enter your eBay Developer Program **Production** App ID (Client ID) and Cert ID (Client Secret):

   ```dotenv
   EBAY_CLIENT_ID=your_production_app_id
   EBAY_CLIENT_SECRET=your_production_cert_id
   ```

   If `.env` is missing, run `Copy-Item .env.example .env` in PowerShell. `.env` is ignored by Git. Existing shell environment variables take precedence over `.env`; clear stale values if needed. Never put credentials into source files.

3. From this directory run:

   ```powershell
   node .\ebay-feasibility.mjs
   ```

No `npm install` is needed. A run makes one client-credentials token request, one search, and up to five item detail requests. Each request times out after 30 seconds. Tokens remain in memory and are never printed.

## Import a pasted eBay.ca URL

```powershell
node .\ebay-feasibility.mjs "https://www.ebay.ca/itm/PASTE_REAL_ITEM_ID_HERE"
```

Replace the example with a real listing URL. Both `/itm/ID` and `/itm/title/ID` formats work; tracking parameters are discarded. A numeric `var` parameter is passed through as the variation ID. Unsupported hosts and malformed URLs are rejected before authentication. This mode requests a token and retrieves that listing directly, without running a search or fetching the webpage.

The URL contains a **legacy item ID**. The script uses Browse's `getItemByLegacyId`, documented in the [official API specification](https://developer.ebay.com/api-docs/master/buy/browse/openapi/3/buy_browse_v1_oas3.json), to resolve it and retrieve details. It does not construct a REST ID by guessing.

To repeat the five-result search and automatically import the first returned eBay.ca URL:

```powershell
node .\ebay-feasibility.mjs --test-import
```

The JSON output contains title, CAD price, year, make, model, raw mileage and any explicit unit, VIN, condition, location, image URLs and full API description. Missing scalars are `null`; missing images are `[]`. All returned item specifics are preserved. Multiple conflicting aspect values are preserved as an array, not silently resolved. No vehicle values are inferred from the title or description. Description HTML is printed as a JSON string, never rendered; images are URLs, not downloaded files.

`priceCAD` uses an amount explicitly labelled CAD by eBay, including `convertedFromValue` when its currency is CAD. If no CAD amount is returned, it stays `null` and `returnedPrice` preserves the original currency. No exchange rate or kilometre unit is assumed.

- `URL IMPORT WORKS`: the API resolved the pasted ID and returned item details. Read the missing-field report to assess completeness. This does not validate the seller's claims or confirm a listing is a complete used car.
- `URL IMPORT NOT CONFIRMED`: configuration, API or input failure prevented confirmation. HTTP 404 can mean an unavailable or unexposed listing; one failure is not proof that every URL import is unsupported.
- `URL IMPORT NOT TESTED`: the automatic search supplied no usable URL.

**Live validation succeeded:** a fresh run of the original search returned five listings; the pasted URL from its third result resolved through `getItemByLegacyId`. Every requested top-level field was available, including CAD price, VIN, images and description. The mileage unit was absent and remained `null`. This establishes URL-import feasibility for that sample, not comprehensive Motors coverage. One of the five category matches was titled as accessories, illustrating why vehicle identity still needs review. No live response, listing fixture or token was saved to disk.

Listing data is held only in process memory and printed to the console. There are no file writes, caches, databases or image downloads. Avoid redirecting output to a file if you want to retain this behavior.

Run the offline regression checks (synthetic data only):

```powershell
node --test .\ebay-feasibility.test.mjs
```

## What it tests

- OAuth application token: `POST https://api.ebay.com/identity/v1/oauth2/token`, Basic client authentication, `grant_type=client_credentials`, scope `https://api.ebay.com/oauth/api_scope`.
- Browse: `GET /buy/browse/v1/item_summary/search`, header `X-EBAY-C-MARKETPLACE-ID: EBAY_CA`.
- Cars & Trucks category `6001`, `conditions:{USED}`, `itemLocationCountry:CA`, `limit=5`. Category-only search avoids requiring the literal words "used car" in a listing title. Location means physically located in Canada, rather than merely shippable to Canada.
- Each returned item is fetched through `getItem` for `localizedAspects`. All available specifics are printed, including year, make, model, trim, mileage, VIN, engine, transmission or fuel type **if supplied**. Missing values are not inferred from titles. Price includes its returned currency; Canadian location does not guarantee CAD.

## Motors support and limitations

**Finding: Canadian Browse search is documented; complete eBay Motors vehicle coverage remains unverified.** The documentation reviewed does not establish a blanket exclusion of all vehicle listings. Equally, marketplace support and vehicle compatibility examples do not establish a complete used-car inventory feed. A credentialed Production run is required to observe what this application can retrieve, and eBay should confirm category/format coverage before Dilemma depends on it.

- eBay documents Browse `item_summary` and `item` support for Canada in its [marketplace support table](https://developer.ebay.com/api-docs/buy/static/ref-marketplace-supported.html). The [Canadian category table](https://developer.ebay.com/api-docs/sell/static/marketing/pl-supported-categories.html) identifies `6001` as Cars & Trucks; that table concerns advertising eligibility, **not Browse eligibility**.
- The [Browse guide's compatibility feature](https://developer.ebay.com/api-docs/buy/static/api-browse.html) finds **parts that fit a vehicle**. Its year/make/model examples are not proof that complete vehicles can be discovered.
- The [official Browse specification](https://developer.ebay.com/api-docs/master/buy/browse/openapi/3/buy_browse_v1_oas3.json) says search returns listings with `FIXED_PRICE` by default. This minimal probe uses that default and therefore excludes auction-only inventory. It does not test every selling format.
- Browse supports `AUCTION` and `CLASSIFIED_AD` filters; claims that Browse never supports classified ads are outdated. See the [release notes](https://developer.ebay.com/api-docs/buy/browse/release-notes-archive.html) and [filter reference](https://www.developer.ebay.com/api-docs/buy/static/ref-buy-browse-filters.html). The filter reference specifies leaf-category constraints for buying-option filters; simply adding them to a broad category query is not a coverage guarantee. eBay Motors [Local Market listings](https://developer.ebay.com/api-docs/user-guides/static/trading-user-guide/ebay-motors-local-markets.html) are a separate US-only vehicle listing type, requiring US postal codes.
- Seller-provided specifics may omit or inconsistently express VIN, mileage/units, trim and other comparison fields. This script prints available data without promising a normalized vehicle schema, history or Canadian market coverage.
- Production keys/token success do not by themselves guarantee API permissions. Review eBay's [Production access requirements](https://developer.ebay.com/api-docs/buy/static/buy-requirements.html) if access is denied.

## Interpret the output

| Output | Meaning |
| --- | --- |
| `OAuth succeeded` | Credentials can mint an application token; inventory access is still to be tested. |
| `CANDIDATES RETURNED` | Up to five category matches were returned. Open their URLs and inspect specifics to confirm complete vehicles and usable comparison fields. This does not prove comprehensive coverage. |
| `INCONCLUSIVE` / zero results | The request succeeded but exposed no matching fixed-price Canadian used vehicles. It does not prove an API-wide vehicle exclusion, nor absence of cars on eBay's website. Check warnings and ask eBay about coverage. |
| `PARTIAL` | Search worked but some detail requests failed; available summary data is printed. |
| `TEST FAILED` / HTTP 401 | Check Production credentials, token and scope. Sandbox keys will not work here. |
| HTTP 403 | Check application permissions and Production approval with eBay; this is not proof of unsupported vehicles. |
| HTTP 400/409 or eBay warnings | Read the returned error ID/message for category or filter issues. Ignored filters weaken any feasibility conclusion. |
| HTTP 429 / network failure | Rate limiting or connectivity prevented a useful conclusion; rerun later. |

Exit code `0` means the requests completed, including an empty/inconclusive search. Exit code `1` means configuration, request or detail failure. Assess feasibility from the printed inventory and field availability, not the exit code alone.

Validation in this workspace includes a successful Production search and URL import, plus offline regression checks. Credentials remain in the ignored local `.env` file.
