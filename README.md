# Dilemma: eBay API feasibility test

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
