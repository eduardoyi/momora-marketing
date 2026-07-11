# `.well-known/` — universal / app links

These two files let iOS and Android verify that `usemomora.com` is allowed to
open the Momora app directly for links under `/invite*`, instead of the
browser. See `docs/plans/family-sharing.md` §9/§11 in the Momora2 repo for
the full flow, and `build.js` (`copyWellKnownFiles`) for how they reach
`dist/.well-known/` and `dist/_headers` for the content-type override they
need on Cloudflare Pages.

Bundle/package id is `com.memora.app` in both files — that's what the
**published** store listings use (verified via the iTunes lookup API for
App Store id 6745403572 and the live Play listing). Momora2's `app.json`
briefly drifted to `com.momora.app` post-publish; it has since been
reverted to `com.memora.app`, so both repos and both stores now agree.

**All values are filled in** (2026-07-11):

- `apple-app-site-association` — `appID`/`appIDs` = `67B39P5MPN.com.memora.app`
  (Apple Team ID from the Apple Developer portal).
- `assetlinks.json` — SHA-256 fingerprint of the **Play app signing key**
  certificate (from Play Console → App integrity). Note it must be the app
  signing key, not the upload key: Android verifies against the certificate
  on the app as *delivered*, which Play re-signs.

Verify the live deployment with:

- Apple: https://search.developer.apple.com/appsearch-validation-tool/ (or
  `curl -I https://usemomora.com/.well-known/apple-app-site-association`
  and confirm `Content-Type: application/json`)
- Android: `adb shell pm verify-app-links --re-verify com.memora.app` on a
  device with the EAS build installed, once `associatedDomains` /
  `intentFilters` ship in the app (family-sharing plan §9).

This file itself is not deployed anywhere meaningful (no host serves
`.well-known/README.md` as anything special) — it's just contributor notes
and is not copied into `dist/` by `build.js`.
