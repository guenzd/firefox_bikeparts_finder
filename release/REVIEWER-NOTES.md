# Teilefinder: reviewer notes

Distribution: unlisted / self-distributed. Desktop Firefox 140 or newer, Manifest V2. Stable extension ID: r2-teilefinder@local.invalid.

## Purpose and permissions

User-initiated bicycle-part comparison across bike24.de, bike-discount.de, bike-components.de and r2-bike.com. Host permissions and content scripts are limited to these shops. `storage` saves the wishlist and previous results locally. `clipboardWrite` is used only by an explicit copy-link click. No native messaging, developer server, analytics, remote executable code, or account credentials are used. Mozilla built-in data consent declares searchTerms and websiteActivity; the local privacy page explains the shop requests and normal browser session behavior.

## Test steps

1. Click the toolbar icon to open the extension page.
2. Enter `Continental Aero 111`, variant `29 mm`, then click `Suchen`. Four shop tabs open in the background. Search and product pages are read in these tabs. Subsequent searches reuse them. Challenges are left for the user; no CAPTCHA or anti-bot bypass is implemented.
3. Verify returned names, prices, variant labels and stock against the visible shop pages. Shop markup and live inventory may change.
4. Add an item to the wishlist; correct its name and use `Erneut suchen` to update only that item. This action does not fill carts.
5. Save the wishlist as JSON and reload it. Import merges configurations; cached offers are not imported. No file is uploaded.
6. `Wunschliste prüfen` searches all wishlist items and computes the sum of the cheapest confirmed deliverable exact variants within each price cap. Shop links allow the user to open products. There are no cart, checkout or purchase actions.

Product search needs no account. No credentials are provided or required by the extension itself.

## Reproducible packaging

All packaged code is plain source and shipped unchanged. From the repository root with Node.js 22+ and Python 3: `npm run build`. The Python script checks syntax, runs fixture tests and ZIPs `teilefinder/firefox-r2/` with fixed archive timestamps. It downloads nothing and does not preprocess code. For Mozilla lint: `npm ci` followed by `npm run lint:extension`. The website framework and its dependencies under `teilefinder/` are not part of the Firefox package.
