# app.usemomora.com — smart app-download link

One URL for the Instagram bio (and anywhere else). Routes by device:

- iPhone/iPad → App Store
- Android → Google Play
- Desktop/unknown → usemomora.com
- Meta iOS in-app browsers (Instagram/Threads/Facebook) → interstitial that
  escapes to Safari (`instagram://extbrowser` / `x-safari-`), with a manual
  fallback. Works around Meta's iOS webviews rendering apps.apple.com as a
  blank page (July 2026).

## Attribution tags

Tag each channel's link with `src` (and optionally `c` for a campaign):

- `app.usemomora.com/?src=tiktok` (TikTok bio)
- `app.usemomora.com/?src=instagram` (Instagram bio)
- `app.usemomora.com/?src=tiktok&c=tiplist1` (a specific post or campaign)

`utm_source` / `utm_campaign` / `utm_medium` work as aliases. The worker
translates the tag per store, because neither store reads plain `utm_*`:

- App Store: `pt=127807408&ct=<src[-c]>&mt=8` (ct capped at 30 chars). Shows in
  App Store Connect > App Analytics > Sources > Campaigns (opted-in users only).
- Google Play: `referrer=utm_source%3D...%26utm_medium%3D...%26utm_campaign%3D...`.
  Shows in Play Console acquisition reports by UTM campaign.
- Desktop: `utm_source` is kept for website analytics.

Untagged links redirect exactly as before. Other query params are forwarded
without clobbering the destination's own params.

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
