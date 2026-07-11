# `.well-known/` — universal / app links

These two files let iOS and Android verify that `usemomora.com` is allowed to
open the Momora app directly for links under `/invite*`, instead of the
browser. See `docs/plans/family-sharing.md` §9/§11 in the Momora2 repo for
the full flow, and `build.js` (`copyWellKnownFiles`) for how they reach
`dist/.well-known/` and `dist/_headers` for the content-type override they
need on Cloudflare Pages.

Bundle/package id is `com.memora.app` in both files — that's what the
**published** store listings use (verified via the iTunes lookup API for
App Store id 6745403572 and the live Play listing). `app.json` in Momora2
says `com.momora.app`, but that's post-publish drift; the published apps
are authoritative.

Only two **TODO placeholders** remain for a human to fill in:

- `apple-app-site-association` — `appID`/`appIDs` is `TEAMID.bundleId`.
  `TODO_REPLACE_WITH_APPLE_TEAM_ID` must become the actual Apple Developer
  **Team ID** (found in App Store Connect / Apple Developer portal, or in
  EAS credentials — see Phase 0 of the family-sharing plan).
- `assetlinks.json` —
  `TODO_REPLACE_WITH_SHA256_SIGNING_FINGERPRINT_FROM_EAS_CREDENTIALS` must
  become the SHA-256 signing certificate fingerprint from EAS build
  credentials (`eas credentials` → Android → app signing).

After filling these in, verify with:

- Apple: https://search.developer.apple.com/appsearch-validation-tool/ (or
  `curl -I https://usemomora.com/.well-known/apple-app-site-association`
  and confirm `Content-Type: application/json`)
- Android: `adb shell pm verify-app-links --re-verify com.memora.app` on a
  device with the EAS build installed, once `associatedDomains` /
  `intentFilters` ship in the app (family-sharing plan §9).

This file itself is not deployed anywhere meaningful (no host serves
`.well-known/README.md` as anything special) — it's just contributor notes
and is not copied into `dist/` by `build.js`.
