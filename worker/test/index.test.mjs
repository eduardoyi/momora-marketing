import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const IOS_URL = "https://apps.apple.com/us/app/usemomora/id6745403572";
const ANDROID_URL = "https://play.google.com/store/apps/details?id=com.memora.app";
// new URL() normalizes the bare origin to include the trailing slash
const DESKTOP_URL = "https://usemomora.com/";

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36",
  desktopChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
  instagramIOS:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 385.0.0.47.85",
  instagramAndroid:
    "Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro) AppleWebKit/537.36 Chrome/132.0 Mobile Safari/537.36 Instagram 367.0.0.45.88 Android",
  threadsIOS:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Barcelona 385.0.0.47.85 Instagram",
  facebookIOS:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 [FBAN/FBIOS;FBAV/500.0.0.0;FBBV/1;FBDV/iPhone16,1;FBMD/iPhone;FBSN/iOS;FBSV/18.5;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5]",
};

function makeRequest(ua, { method = "GET", path = "/" } = {}) {
  return new Request(`https://app.usemomora.com${path}`, {
    method,
    headers: ua ? { "User-Agent": ua } : {},
  });
}

test("normal iPhone Safari gets a 302 to the App Store", async () => {
  const res = await worker.fetch(makeRequest(UA.iphoneSafari));
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("Location"), IOS_URL);
});

test("Android Chrome gets a 302 to Google Play", async () => {
  const res = await worker.fetch(makeRequest(UA.androidChrome));
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("Location"), ANDROID_URL);
});

test("desktop gets a 302 to the website", async () => {
  const res = await worker.fetch(makeRequest(UA.desktopChrome));
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("Location"), DESKTOP_URL);
});

test("missing User-Agent gets a 302 to the website", async () => {
  const res = await worker.fetch(makeRequest(null));
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("Location"), DESKTOP_URL);
});

test("Instagram on iOS gets the escape interstitial", async () => {
  const res = await worker.fetch(makeRequest(UA.instagramIOS));
  assert.equal(res.status, 200);
  assert.match(res.headers.get("Content-Type"), /text\/html/);
  const html = await res.text();
  assert.ok(html.includes("instagram://extbrowser/?url="));
  assert.ok(html.includes(encodeURIComponent(IOS_URL)));
  // Real anchor fallback points at the App Store
  assert.ok(html.includes(`href="${IOS_URL}"`));
});

test("Threads on iOS gets the extbrowser escape", async () => {
  const res = await worker.fetch(makeRequest(UA.threadsIOS));
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes("instagram://extbrowser/?url="));
});

test("Facebook on iOS gets the x-safari escape", async () => {
  const res = await worker.fetch(makeRequest(UA.facebookIOS));
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes(`"x-safari-${IOS_URL}"`));
  assert.ok(!html.includes("instagram://extbrowser"));
});

test("Instagram on Android keeps the instant 302 to Google Play", async () => {
  const res = await worker.fetch(makeRequest(UA.instagramAndroid));
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("Location"), ANDROID_URL);
});

test("incoming query params are forwarded to the destination", async () => {
  const res = await worker.fetch(
    makeRequest(UA.androidChrome, { path: "/?utm_source=instagram&utm_campaign=bio" })
  );
  assert.equal(res.status, 302);
  const location = new URL(res.headers.get("Location"));
  assert.equal(location.searchParams.get("utm_source"), "instagram");
  assert.equal(location.searchParams.get("utm_campaign"), "bio");
  // Existing destination params survive
  assert.equal(location.searchParams.get("id"), "com.memora.app");
});

test("forwarded params never clobber destination params", async () => {
  const res = await worker.fetch(
    makeRequest(UA.androidChrome, { path: "/?id=evil.package" })
  );
  const location = new URL(res.headers.get("Location"));
  assert.equal(location.searchParams.get("id"), "com.memora.app");
});

test("forwarded params appear in the interstitial's encoded destination", async () => {
  const res = await worker.fetch(
    makeRequest(UA.instagramIOS, { path: "/?utm_source=instagram" })
  );
  const html = await res.text();
  assert.ok(html.includes(encodeURIComponent(`${IOS_URL}?utm_source=instagram`)));
});

test("HEAD on the interstitial returns headers without a body", async () => {
  const res = await worker.fetch(makeRequest(UA.instagramIOS, { method: "HEAD" }));
  assert.equal(res.status, 200);
  assert.match(res.headers.get("Content-Type"), /text\/html/);
  assert.equal(await res.text(), "");
});

test("POST returns 405", async () => {
  const res = await worker.fetch(makeRequest(UA.iphoneSafari, { method: "POST" }));
  assert.equal(res.status, 405);
  assert.equal(res.headers.get("Allow"), "GET, HEAD");
});

test("responses are uncacheable and unindexable", async () => {
  const res = await worker.fetch(makeRequest(UA.iphoneSafari));
  assert.match(res.headers.get("Cache-Control"), /no-store/);
  assert.equal(res.headers.get("X-Robots-Tag"), "noindex, nofollow");
  assert.equal(res.headers.get("Vary"), "User-Agent");
});
