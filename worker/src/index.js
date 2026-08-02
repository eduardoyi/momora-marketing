// Smart app-download link for app.usemomora.com
//
// One URL for the Instagram bio (and anywhere else):
//   - iPhone/iPad        -> App Store
//   - Android            -> Google Play
//   - Desktop/unknown    -> usemomora.com
//
// Meta's iOS in-app browsers (Instagram, Threads, Facebook) currently render
// apps.apple.com as a blank page, so those get an interstitial that breaks out
// to Safari via undocumented app schemes, with a manual fallback. Android
// webviews open Play Store links fine and keep the instant 302 so the Play
// install referrer stays intact.

const APP_NAME = "Momora";
const IOS_URL = "https://apps.apple.com/us/app/usemomora/id6745403572";
const ANDROID_URL = "https://play.google.com/store/apps/details?id=com.memora.app";
const DESKTOP_URL = "https://usemomora.com";

const COMMON_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
  "Vary": "User-Agent",
};

function getDevice(userAgent) {
  const ua = userAgent.toLowerCase();
  if (/android/.test(ua)) return "android";
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  // iPadOS webviews can report as Macintosh + Mobile
  if (/macintosh/.test(ua) && /mobile/.test(ua)) return "ios";
  return "desktop";
}

// Threads UAs can contain both "Barcelona" and "Instagram", so check Threads first.
function getMetaApp(userAgent) {
  const ua = userAgent.toLowerCase();
  if (/barcelona/.test(ua)) return "threads";
  if (/instagram/.test(ua)) return "instagram";
  if (/fban|fbav|fb_iab/.test(ua)) return "facebook";
  return null;
}

function getDestination(device) {
  if (device === "ios") return IOS_URL;
  if (device === "android") return ANDROID_URL;
  return DESKTOP_URL;
}

// Forward query params from the incoming request (e.g. ?utm_source=instagram)
// onto the destination without clobbering params the destination already has.
function withForwardedParams(destination, requestUrl) {
  const dest = new URL(destination);
  for (const [key, value] of requestUrl.searchParams) {
    if (!dest.searchParams.has(key)) {
      dest.searchParams.append(key, value);
    }
  }
  return dest.toString();
}

function escapeHTML(value) {
  const entities = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return value.replace(/[&<>"']/g, (c) => entities[c]);
}

// Interstitial served only to Meta iOS in-app browsers. Three layers:
//   1. Auto-attempt the escape scheme ~300ms after load.
//   2. A real <a> to the store, whose click handler re-fires the escape
//      synchronously (iOS drops custom-scheme navigations fired async after
//      a user gesture).
//   3. If no visibilitychange/pagehide/blur lands within 1.5s of an attempt,
//      the escape was swallowed: show manual instructions + copy-link button.
//      The "left" flag resets on every attempt so one stray blur can't
//      permanently suppress the fallback.
function createEscapePage(metaApp, destination) {
  // Instagram and Threads honor instagram://extbrowser; Facebook's webview
  // blocks it but lets x-safari-https:// through via window.open.
  const escapeURL =
    metaApp === "facebook"
      ? "x-safari-" + destination
      : "instagram://extbrowser/?url=" + encodeURIComponent(destination);

  const safeAppName = escapeHTML(APP_NAME);
  const safeDestination = escapeHTML(destination);
  const menuHint =
    metaApp === "facebook"
      ? "Tap the menu button, then choose “Open in Safari” or “Open in browser”."
      : "Tap ⋯ at the top right, then choose “Open in external browser”.";

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="robots" content="noindex, nofollow">
  <title>Opening ${safeAppName}…</title>
  <style>
    html, body { width: 100%; height: 100%; margin: 0; }
    body {
      display: grid;
      place-items: center;
      box-sizing: border-box;
      padding: 24px;
      background: #ffffff;
      color: #111111;
      font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
      text-align: center;
    }
    main { max-width: 420px; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    p { margin: 8px 0; color: #444444; font-size: 15px; line-height: 1.5; }
    .btn {
      display: inline-block;
      margin-top: 16px;
      padding: 14px 22px;
      border-radius: 12px;
      background: #111111;
      color: #ffffff;
      font-weight: 600;
      font-size: 16px;
      text-decoration: none;
      border: none;
      cursor: pointer;
    }
    .btn-secondary { background: #f0f0f0; color: #111111; }
    #fallback { display: none; margin-top: 24px; padding-top: 16px; border-top: 1px solid #eeeeee; }
    #copied { display: none; color: #2e7d32; font-weight: 600; }
  </style>
</head>
<body>
  <main>
    <h1>Opening the App Store…</h1>
    <p>Taking you to ${safeAppName}.</p>
    <a id="store-link" class="btn" href="${safeDestination}">Download ${safeAppName}</a>
    <div id="fallback">
      <p><strong>Didn’t open?</strong> ${escapeHTML(menuHint)}</p>
      <p>Or copy the link and paste it in Safari:</p>
      <button id="copy-link" class="btn btn-secondary" type="button">Copy link</button>
      <p id="copied">Link copied</p>
    </div>
  </main>
  <script>
    (function () {
      var META = ${JSON.stringify(metaApp)};
      var ESCAPE_URL = ${JSON.stringify(escapeURL)};
      var DESTINATION = ${JSON.stringify(destination)};

      var left = false;
      var fallbackTimer = null;

      function markLeft() { left = true; }
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden") markLeft();
      });
      window.addEventListener("pagehide", markLeft);
      window.addEventListener("blur", markLeft);

      function showFallback() {
        document.getElementById("fallback").style.display = "block";
      }

      function attemptEscape() {
        // Reset per attempt: a single stray blur must not permanently
        // convince us the escape worked.
        left = false;
        try {
          if (META === "facebook") {
            window.open(ESCAPE_URL, "_blank");
          } else {
            window.location.href = ESCAPE_URL;
          }
        } catch (e) {
          showFallback();
          return;
        }
        clearTimeout(fallbackTimer);
        fallbackTimer = setTimeout(function () {
          if (!left) showFallback();
        }, 1500);
      }

      document.getElementById("store-link").addEventListener("click", function (e) {
        e.preventDefault();
        // Must fire synchronously inside the tap handler.
        attemptEscape();
      });

      document.getElementById("copy-link").addEventListener("click", function () {
        function done() {
          document.getElementById("copied").style.display = "block";
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(DESTINATION).then(done, function () {
            legacyCopy();
          });
        } else {
          legacyCopy();
        }
        function legacyCopy() {
          var ta = document.createElement("textarea");
          ta.value = DESTINATION;
          ta.setAttribute("readonly", "");
          ta.style.position = "absolute";
          ta.style.left = "-9999px";
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand("copy"); done(); } catch (e) {}
          document.body.removeChild(ta);
        }
      });

      // Layer 1: auto-attempt shortly after load.
      setTimeout(attemptEscape, 300);
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      ...COMMON_HEADERS,
      "Content-Type": "text/html; charset=UTF-8",
      "Content-Security-Policy":
        "default-src 'none'; " +
        "script-src 'unsafe-inline'; " +
        "style-src 'unsafe-inline'; " +
        "base-uri 'none'; " +
        "form-action 'none'; " +
        "frame-ancestors 'none'",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    },
  });
}

export default {
  async fetch(request) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { ...COMMON_HEADERS, Allow: "GET, HEAD" },
      });
    }

    const userAgent = request.headers.get("User-Agent") || "";
    const requestUrl = new URL(request.url);

    const device = getDevice(userAgent);
    const destination = withForwardedParams(getDestination(device), requestUrl);
    const metaApp = getMetaApp(userAgent);

    // Only Meta's iOS in-app browsers need the escape hatch. Android webviews
    // open Play Store links normally — keep the instant 302 there.
    if (device === "ios" && metaApp !== null) {
      const page = createEscapePage(metaApp, destination);
      if (request.method === "HEAD") {
        return new Response(null, { status: page.status, headers: page.headers });
      }
      return page;
    }

    return new Response(null, {
      status: 302,
      headers: { ...COMMON_HEADERS, Location: destination },
    });
  },
};
