# Teilefinder: reviewer notes

Distribution: unlisted / self-distributed. Desktop Firefox 140 or newer, Manifest V2. Stable extension ID: r2-teilefinder@local.invalid.

## Purpose and permissions

User-initiated bicycle-part comparison across bike24.de, bike-discount.de, bike-components.de and r2-bike.com. Host permissions and content scripts are limited to these shops. `storage` saves the wishlist and previous results locally. `clipboardWrite` is used only by an explicit copy-link click. No native messaging, developer server, analytics, remote executable code, or account credentials are used. Mozilla built-in data consent declares searchTerms and websiteActivity; the local privacy page explains the shop requests and normal browser session behavior.

## Test steps

1. Click the toolbar icon to open the extension page.
2. Enter `Continental Aero 111`, variant `29 mm`, then click `Suchen`. Four shop tabs open in the background. Search and product pages are read in these tabs. Subsequent searches reuse them. Challenges are left for the user; no CAPTCHA or anti-bot bypass is implemented.
3. Verify returned names, prices, variant labels and stock against the visible shop pages. Shop markup and live inventory may change.
4. Add an item to the wishlist; correct its name and use its refresh button to update only that item. This action does not fill carts.
5. Save the wishlist as JSON and reload it. Import merges configurations and restores saved results and local price history. No file is uploaded.
6. `Wunschliste prüfen` searches all wishlist items and computes the sum of the cheapest confirmed deliverable exact variants within each price cap. Shop links allow the user to open products. There are no cart, checkout or purchase actions.

Product search needs no account. No credentials are provided or required by the extension itself.

## Reproducible packaging

All packaged code is plain source and shipped unchanged. From the repository root with Node.js 22+ and Python 3.9+: `npm run build`. The Python script checks syntax, runs fixture tests and packages the shared files from `teilefinder/src/` plus `teilefinder/manifests/firefox.json` with fixed archive timestamps. Both browser targets are produced, and the Mozilla upload uses only `outputs/teilefinder-firefox-0.8.8.zip`. Search jobs run in the extension tab; the background only handles toolbar events and persisted ownership of shop tabs. It downloads nothing and does not preprocess code. For Mozilla lint: `npm ci` followed by `npm run lint:extension`. The website framework and its dependencies under `teilefinder/` are not part of the Firefox package.


Image blocking: `declarativeNetRequest` is used only for a session rule scoped to registered shop tab IDs, the four shop initiator domains and `image` resources. A second session rule appends only an `img-src` Content-Security-Policy to the four shops’ main-frame responses in those owned tabs. Existing policies are preserved; scripts, stylesheets, connections and subframes are not restricted by the added policy. No request feedback or network logging is used. The Cloudflare challenge domain is excluded. Search tabs open as blank children, are registered and receive the rule before navigating to a shop. Manually opened tabs are excluded. Closing owned tabs removes their rule membership. Rules are restored from session ownership on worker restart. The “Bilder laden” checkbox disables both session rules, persists locally and takes effect on the next navigation/reload; an already installed document policy remains until its document is replaced. Verify both enabled/disabled states, tab reuse and independent manually opened shop tabs. A new content-blocking permission prompt may be shown by the browser.

Content scripts register their message receiver at `document_start`. Read requests are queued until `DOMContentLoaded` before extracting data or interacting with variant controls; this avoids waiting for idle injection and preserves DOM readiness checks.
