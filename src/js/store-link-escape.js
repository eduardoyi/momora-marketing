// Escape hatch for App Store links opened inside Meta's iOS in-app browsers
// (Instagram, Threads, Facebook). Those webviews render apps.apple.com as a
// blank white page, so on iOS + Meta only, we intercept taps on App Store
// links and break out to Safari using undocumented app schemes, with a
// layered fallback UI if the escape gets swallowed.
//
// Every other browser (including Android and Play Store links, which are
// never touched here) keeps normal link behavior — this script does nothing
// outside iOS + Meta webviews, and it never auto-redirects on page load.
(function () {
    var ua = (navigator.userAgent || '').toLowerCase();

    var isIOS = ua.indexOf('iphone') !== -1 || ua.indexOf('ipad') !== -1 || ua.indexOf('ipod') !== -1;

    // Order matters: Threads UAs can also contain "instagram", so check for
    // Threads' "barcelona" marker first.
    var metaApp = null;
    if (ua.indexOf('barcelona') !== -1) {
        metaApp = 'threads';
    } else if (ua.indexOf('instagram') !== -1) {
        metaApp = 'instagram';
    } else if (ua.indexOf('fban') !== -1 || ua.indexOf('fbav') !== -1 || ua.indexOf('fb_iab') !== -1) {
        metaApp = 'facebook';
    }

    if (!isIOS || !metaApp) {
        return;
    }

    var FALLBACK_DELAY_MS = 1500;

    // Whether the user appears to have left the webview since the last
    // escape attempt. IMPORTANT: this gets reset to false at the START of
    // every attempt (see attemptEscape) — a single stray blur/visibility
    // event (e.g. the host app briefly loses focus) must not permanently
    // convince this page the escape "worked" and suppress the fallback UI
    // forever.
    var left = false;

    function markLeft() {
        left = true;
    }

    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            markLeft();
        }
    });
    window.addEventListener('pagehide', markLeft);
    window.addEventListener('blur', markLeft);

    function legacyCopy(text) {
        var textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.top = '-1000px';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);
        var success = false;
        try {
            success = document.execCommand('copy');
        } catch (e) {
            success = false;
        }
        document.body.removeChild(textarea);
        return success;
    }

    function copyToClipboard(text, onDone) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(
                function () { onDone(true); },
                function () { onDone(legacyCopy(text)); }
            );
            return;
        }
        onDone(legacyCopy(text));
    }

    function injectStyles() {
        if (document.getElementById('store-link-escape-style')) {
            return;
        }
        var style = document.createElement('style');
        style.id = 'store-link-escape-style';
        style.textContent =
            '.store-escape-note{margin-top:12px;padding:12px 16px;background:var(--bg-light,#fef3f2);' +
            'border-radius:var(--radius-sm,8px);font-family:var(--font-sans,sans-serif);font-size:0.875rem;' +
            'line-height:1.5;color:var(--text-gray,#6b7280);max-width:320px;}' +
            '.store-escape-note p{margin:0 0 10px;}' +
            '.store-escape-copy-btn{display:inline-block;border:2px solid var(--primary,#7c3aed);' +
            'color:var(--primary,#7c3aed);background:transparent;border-radius:var(--radius-sm,8px);' +
            'padding:8px 14px;font-family:inherit;font-size:0.8125rem;font-weight:600;cursor:pointer;}' +
            '.store-escape-copy-btn.is-copied{border-color:#16a34a;color:#16a34a;}';
        document.head.appendChild(style);
    }

    function showFallback(anchor, url) {
        // Only insert the fallback UI once per link — repeated taps must
        // not stack duplicate notes.
        if (anchor.dataset.escapeFallbackShown === '1') {
            return;
        }
        anchor.dataset.escapeFallbackShown = '1';

        injectStyles();

        var note = document.createElement('div');
        note.className = 'store-escape-note';

        var text = document.createElement('p');
        text.textContent = "Didn't open? Tap ⋯ at the top right, then 'Open in external browser'.";
        note.appendChild(text);

        var copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'store-escape-copy-btn';
        copyBtn.textContent = 'Copy link';
        copyBtn.addEventListener('click', function (e) {
            e.preventDefault();
            copyToClipboard(url, function (success) {
                copyBtn.textContent = success ? 'Link copied' : "Couldn't copy";
                if (success) {
                    copyBtn.classList.add('is-copied');
                }
                setTimeout(function () {
                    copyBtn.textContent = 'Copy link';
                    copyBtn.classList.remove('is-copied');
                }, 2000);
            });
        });
        note.appendChild(copyBtn);

        anchor.insertAdjacentElement('afterend', note);
    }

    function attemptEscape(anchor, url) {
        left = false;

        if (metaApp === 'facebook') {
            // Facebook's webview blocks the extbrowser scheme but lets
            // x-safari- through.
            window.open('x-safari-' + url, '_blank');
        } else {
            // instagram or threads
            window.location.href = 'instagram://extbrowser/?url=' + encodeURIComponent(url);
        }

        setTimeout(function () {
            if (!left) {
                showFallback(anchor, url);
            }
        }, FALLBACK_DELAY_MS);
    }

    // Delegate from document rather than binding each <a> individually so
    // App Store links inserted after this script runs (e.g. /invite's
    // store badges, rendered client-side by invite-script.js) are covered
    // too, regardless of script load order.
    document.addEventListener('click', function (e) {
        var anchor = e.target && e.target.closest ? e.target.closest('a[href*="apps.apple.com"]') : null;
        if (!anchor) {
            return;
        }

        e.preventDefault();
        attemptEscape(anchor, anchor.href);
    });
})();
