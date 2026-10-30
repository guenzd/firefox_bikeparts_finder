# Release workflow

- For every extension release, update the manifest version, run `npm run build` and `NO_UPDATE_NOTIFIER=1 npm run lint:extension`, and resolve failures before publishing.
- Commit the complete release source and relevant documentation, create an annotated Git tag `v<manifest version>`, and push both the release commit and tag to GitHub. The user has explicitly authorized this for all future releases; do not ask again routinely.
- Use the configured GitHub remote (`git`, currently `https://github.com/guenzd/firefox_bikeparts_finder.git`) and check the remote branch before pushing. Never force-push or overwrite an existing tag.
- Keep generated packages in the ignored `outputs/` directory. Do not commit browser profiles, credentials, local wishlist data, or signed packages. A Git tag does not mean Mozilla has signed the add-on.
- Report the version, commit/tag links, and any concrete push failure accurately.

## Documentation and matching

- Keep the root README, manual, architecture and publishing instructions consistent with the current shared Firefox/Chrome sources. Preserve historical release facts as historical and leave third-party license text unchanged.
- Run extension builds from the repository root. The nested website package is a historical prototype, not the extension build.
- Keep product matching generic; do not add special cases for individual product names or search terms. Shop-specific DOM adapters are allowed.
