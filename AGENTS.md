# Release workflow

- For every extension release, update the manifest version, run `npm run build` and `NO_UPDATE_NOTIFIER=1 npm run lint:extension`, and resolve failures before publishing.
- Commit the complete release source and relevant documentation, create an annotated Git tag `v<manifest version>`, and push both the release commit and tag to GitHub. The user has explicitly authorized this for all future releases; do not ask again routinely.
- Use the configured GitHub remote (`git`, currently `https://github.com/guenzd/firefox_bikeparts_finder.git`) and check the remote branch before pushing. Never force-push or overwrite an existing tag.
- Keep generated packages in the ignored `outputs/` directory. Do not commit browser profiles, credentials, local wishlist data, or signed packages. A Git tag does not mean Mozilla has signed the add-on.
- Report the version, commit/tag links, and any concrete push failure accurately.
