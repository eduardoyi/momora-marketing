// /invite page behavior: read ?code=, show/copy it, and point to the right
// app store based on user agent. No external network calls, no analytics,
// no backend — everything here runs against data already in the URL.
(function () {
    'use strict';

    // These match the published store listings (bundle/package id
    // "com.memora.app") and the URLs the rest of the site already uses.
    var APP_STORE_URL = 'https://apps.apple.com/us/app/usemomora/id6745403572';
    var PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.memora.app';

    // Official store badges (same files as the rest of the site).
    function storeButtonHTML(store, size) {
        var isApple = store === 'ios';
        var url = isApple ? APP_STORE_URL : PLAY_STORE_URL;
        var img = isApple
            ? '<img src="/assets/images/brand/badge-app-store.svg" alt="Download on the App Store" width="150" height="50">'
            : '<img src="/assets/images/brand/badge-google-play.png" alt="Get it on Google Play" width="168" height="50">';
        var cls = 'store-badge' + (size === 'large' ? ' store-badge-large' : '');
        return '<a href="' + url + '" target="_blank" rel="noopener noreferrer" class="' + cls + '">' + img + '</a>';
    }

    function detectPlatform() {
        var ua = (navigator.userAgent || navigator.vendor || '') + '';
        if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
        if (/Android/i.test(ua)) return 'android';
        return 'unknown';
    }

    // Shows one prominent badge for the detected platform, plus a small
    // text link to the other store — desktop/unknown UAs get both badges.
    function renderStoreLinks(container) {
        if (!container) return;
        var platform = detectPlatform();

        if (platform === 'ios' || platform === 'android') {
            var other = platform === 'ios' ? 'android' : 'ios';
            var otherUrl = other === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
            var otherLabel = other === 'ios' ? 'App Store (iPhone/iPad)' : 'Google Play (Android)';
            var thisDeviceLabel = platform === 'ios' ? 'an iPhone or iPad' : 'an Android phone';

            container.innerHTML =
                storeButtonHTML(platform, 'large') +
                '<p class="invite-store-secondary">Not on ' + thisDeviceLabel + '? Get it on ' +
                '<a href="' + otherUrl + '" target="_blank" rel="noopener noreferrer">' + otherLabel + '</a>.</p>';
        } else {
            container.innerHTML =
                '<div class="invite-store-both">' +
                storeButtonHTML('ios', 'large') +
                storeButtonHTML('android', 'large') +
                '</div>';
        }
    }

    // "sunny-tiger-lake" — three lowercase, dash-separated words.
    var CODE_PATTERN = /^[a-z]+-[a-z]+-[a-z]+$/;

    function getInviteCode() {
        var params;
        try {
            params = new URLSearchParams(window.location.search);
        } catch (e) {
            return null;
        }
        var raw = params.get('code');
        if (!raw) return null;
        var normalized = raw.trim().toLowerCase();
        return CODE_PATTERN.test(normalized) ? normalized : null;
    }

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

    document.addEventListener('DOMContentLoaded', function () {
        var validState = document.getElementById('invite-valid');
        var invalidState = document.getElementById('invite-invalid');
        var code = getInviteCode();

        if (code && validState) {
            validState.hidden = false;

            var codeDisplay = document.getElementById('invite-code-display');
            if (codeDisplay) codeDisplay.textContent = code;

            var copyBtn = document.getElementById('copy-code-btn');
            if (copyBtn) {
                copyBtn.addEventListener('click', function () {
                    copyToClipboard(code, function (success) {
                        copyBtn.textContent = success ? 'Copied!' : 'Couldn’t copy — select it manually';
                        copyBtn.classList.toggle('copied', success);
                        setTimeout(function () {
                            copyBtn.textContent = 'Copy';
                            copyBtn.classList.remove('copied');
                        }, 2000);
                    });
                });
            }

            renderStoreLinks(document.getElementById('store-badge-primary'));
        } else if (invalidState) {
            invalidState.hidden = false;
            renderStoreLinks(document.getElementById('store-badge-fallback'));
        }
    });
})();
