# app.usemomora.com — smart app-download link

One URL for the Instagram bio (and anywhere else). Routes by device:

- iPhone/iPad → App Store
- Android → Google Play
- Desktop/unknown → usemomora.com
- Meta iOS in-app browsers (Instagram/Threads/Facebook) → interstitial that
  escapes to Safari (`instagram://extbrowser` / `x-safari-`), with a manual
  fallback. Works around Meta's iOS webviews rendering apps.apple.com as a
  blank page (July 2026).

Any query params on the link (e.g. `?utm_source=instagram`) are forwarded to
the destination.

## Test

```
node --test test/index.test.mjs
```

## Deploy

```
npx wrangler login       # once
npx wrangler deploy      # from this directory
```

The custom domain `app.usemomora.com` is configured in `wrangler.jsonc`
(`custom_domain: true`) — Cloudflare creates the DNS record and certificate on
first deploy since the zone is already on Cloudflare.

## After Instagram updates

The escape schemes are undocumented and Meta patches them periodically.
Re-test from a real device after major Instagram updates: open the link from
an IG DM on iPhone — you should briefly see the interstitial, then land in
Safari on the App Store. If the auto-escape stops working, the manual
fallback ("Tap ⋯ → Open in external browser" + copy link) still keeps the
funnel alive.
