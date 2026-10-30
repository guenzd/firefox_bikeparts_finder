# Teilefinder: reviewer notes

Teilefinder compares bicycle parts across bike24.de, bike-discount.de, bike-components.de and r2-bike.com using user-initiated shop tabs. No companion server is required. Firefox and Chrome share the same UI, product rules and shop readers.

## Targets and source

- Firefox Desktop 140+: Manifest V2, stable ID `r2-teilefinder@local.invalid`; Mozilla self-distribution is described in [UNLISTED.md](UNLISTED.md).
- Chrome 114+: Manifest V3 with a small service worker; see [Chrome Web Store](CHROME-WEB-STORE.md).
- Shared source: `teilefinder/src/`; browser manifests: `teilefinder/manifests/`.
- The historical website and local Chromium prototype are not included in either extension package.

Search jobs execute in the open extension UI tab. The background handles toolbar events, owned-shop-tab registration and image-loading rules. Same-document shop jump fragments are accepted on the extension UI URL when validating the sender and owner tab; other paths, origins, query strings and foreign owners remain rejected. Session ownership survives a background/worker restart; the worker does not run the search loop. Wishlist batches use one serial lane per shop, including EAN refinement, so faster shops may advance to another item while a slow shop is still busy. Batch and item IDs keep results isolated; cancelling prevents queued work from starting. The native adapter exposes the browser family using its extension URL scheme. Firefox and Chromium can read a BIKE24 widget with missing or unsuccessfully read controls from fresh serialized product data plus a same-origin GET to `/api/product/<id>/availability`. Every option combination must map explicitly to an availability row; exact prices include only declared surcharges with the page’s tax rate. Unknown mappings, prices and GTIN assignments are rejected. BIKE24 links can describe a different axis from a dropdown (for example pack size versus flavour); candidate selection retains pages with missing axis evidence and passes the requested variant and original EAN into each linked detail read. Final variant confirmation remains mandatory. When an enabled EAN yields no confirmed offer inside the requested price range, both wishlist and ad hoc searches retry that shop by name with the same price/variant filters, reusing appropriately named saved product URLs first. Explicitly reported transport failures and security challenges do not trigger this retry; an unavailable exact EAN offer in range remains a match. Name fallback results carry `matchMode: name-fallback` through UI, storage and file snapshots: they neither change the requested EAN nor receive an inferred EAN, and are not discarded by the original EAN constraint. Successful EAN results in other shops remain intact. Listing prefilters do not compare unlabelled millimetres as if they always described the same axis: clamp diameter must not reject a requested length before dropdown inspection. Explicit tire-width encodings and matching labelled width axes remain eligible for early exclusion. On name searches, fresh linked-detail product names must still match the requested name, preventing a cheaper different pack from replacing the requested pack. Generic pack-count matching accepts equivalent count notation such as “24er”, “24 Stück” and “24x50g”; different counts and model identifiers remain distinct. Successfully read widgets retain the existing DOM/dropdown reader. No cart or checkout endpoint is called. Content scripts register at `document_start`; queued reads wait for `DOMContentLoaded`. Identical pending retries share a request, while different DOM reads are serialized.

## Permissions and data

Host permissions and content scripts are limited to the four shops. `storage` saves wishlist configuration, previous results, product URL/selection hints and settings locally. IndexedDB stores confirmed price history. `clipboardWrite` is used only after explicit copy actions, including HTML/text product lists and EANs. No clipboard reading is implemented.

`declarativeNetRequest` controls image loading only in registered shop tabs. An image-resource session rule and an additional image-only CSP response rule are installed before those tabs navigate to a shop. Rules preserve existing CSP, exclude the challenge image source, and do not restrict scripts, stylesheets, connections or subframes. No request-feedback or network logging is used. “Bilder laden” disables both rules and persists locally; an existing document policy remains until navigation/reload. Manual shop tabs are unaffected.

Firefox declares `searchTerms` and `websiteActivity` through Mozilla built-in data consent. Requests use the normal browser session; the extension does not read or store login credentials or authentication cookies. There is no native messaging, analytics, advertising, remote executable code, or automatic transmission to the developer. Privacy details are available in the packaged UI and [DATENSCHUTZ.md](../DATENSCHUTZ.md).

Search profiling keeps only the last 20 finished/cancelled jobs in UI memory, including product name, EAN, variant and per-shop timings. Reload clears them. Profiles are not automatically written or uploaded.

## Product identity and saved variants

Matching uses general product/model, EAN and variant rules, without a product-specific search dictionary. Shop-specific readers adapt to each DOM. Equivalent zero-padded GS1 GTIN representations are compared as the same identifier without rewriting user input. An empty identifier search may retry one equivalent UPC/EAN representation in the same tab and within the existing shop time budget; a different packaging indicator remains a different product. Explicit conflicting EANs are rejected. Ambiguous BIKE24 datasheet identifiers are not assigned to variants by list order; combined datasheet evidence is excluded from variant-specific history and cross-shop EAN propagation.

Known URLs and bounded option metadata (control kind, ID/name/label, option value/text) are stored locally and exported with the wishlist. Refresh restores choices through the existing dropdown/radio/option readers, then reads fresh identity, prices and stock. Missing options fall back to variant inspection. No arbitrary saved scripts or DOM selectors are executed. The BIKE24 purchase-event guard remains active during selection. No cart, checkout or purchase actions exist.

Wishlist refresh reads known product URLs directly. An unconfirmed known URL does not trigger another shop search; previous offers remain visibly unconfirmed and do not contribute to current totals or new history. Shops without a matching URL are searched normally. Ad-hoc search retains a search fallback.

## Suggested review steps

1. Click the toolbar icon. Enter a product name and optional variant/price range, then select “Suchen”. At most four background shop tabs open, one per shop. Later searches reuse them. Challenges are left for the user; no CAPTCHA bypass is implemented.
2. Compare returned product identity, exact price, selected variant and delivery text with the visible shop pages. Test a product with dependent dropdowns. Shop markup and stock can change independently of the extension.
3. Test a known EAN, a different EAN and an unavailable variant. Incorrect identifiers must not become matching offers. Disable EAN search to test name-based search. The ad-hoc form is independent of wishlist refreshes.
4. Add an item to the wishlist. Completed matching ad-hoc results are reused; otherwise a search starts. Use “Bearbeiten”, save/cancel, refresh one item, and open the shop-price dialog by clicking its name. Click the price to open history when available.
5. Refresh the wishlist. Known product pages and options should be used directly. Only confirmed deliverable exact offers within the price range contribute to totals; unavailable products remain inspectable.
6. Click the active progress control to stop. Completed results remain visible. Concurrent actions using the same shop tabs are disabled. Close managed tabs and verify that manually opened product links are preserved.
7. Toggle image loading, navigate/reload, and verify both states in managed tabs and unaffected manual tabs. Toggle light/dark appearance; reloading restores the browser preference.
8. Export JSON and import it again. This merges wishlist configuration and restores results/history locally without uploading the file. Copy deliverable links and EANs only through explicit controls.

## Reproducible packaging and validation

From the repository root, with Node.js 22+ and Python 3.9+:

```sh
npm ci
npm run build
NO_UPDATE_NOTIFIER=1 npm run lint:extension
npm run lint:chrome
```

The Python builder checks source syntax, runs fixture/API-mock regressions and packages unchanged HTML/CSS/JavaScript and local assets with fixed archive timestamps. Tests include browser-adapter contracts, worker restarts, tab ownership, selected variants, EAN filtering, local data roundtrips and reproducible packaging. Firefox lint is a separate step. No shop network access is required by the build.

Upload `outputs/teilefinder-firefox-<version>.zip` to Mozilla or `outputs/teilefinder-chrome-<version>.zip` to Chrome. A successful target build removes only older versioned ZIPs for that target. Profiles, credentials and user exports are excluded. Use the source corresponding to the release tag if additional sources are requested. Local tests do not imply an automated live-shop/browser review or store approval.
