// /invite page behavior: read ?code=, show/copy it, and point to the right
// app store based on user agent. No external network calls, no analytics,
// no backend — everything here runs against data already in the URL.
(function () {
    'use strict';

    // TODO(human): replace with the real store listings before shipping.
    // The rest of the site already links to production URLs (see
    // src/pages/index.html and src/templates/page-template.html):
    //   iOS:     https://apps.apple.com/us/app/usemomora/id6745403572
    //   Android: https://play.google.com/store/apps/details?id=com.memora.app
    // NOTE: that Android id is "com.memora.app", but app.json's Android
    // package is "com.momora.app" — confirm which one the live Play Store
    // listing actually uses before reusing it here.
    var APP_STORE_URL = 'https://apps.apple.com/app/momora/idPLACEHOLDER';
    var PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=PLACEHOLDER';

    var APPLE_ICON = '<svg viewBox="0 0 24 24" class="store-icon" aria-hidden="true"><path fill="currentColor" d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.09,16.67C20.06,16.74 19.67,18.11 18.71,19.5M13,3.5C13.73,2.67 14.94,2.04 15.94,2C16.07,3.17 15.6,4.35 14.9,5.19C14.21,6.04 13.07,6.7 11.95,6.61C11.8,5.46 12.36,4.26 13,3.5Z"/></svg>';
    var PLAY_ICON = '<svg viewBox="0 0 24 24" class="store-icon" aria-hidden="true"><path fill="currentColor" d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/></svg>';

    function storeButtonHTML(store, size) {
        var isApple = store === 'ios';
        var url = isApple ? APP_STORE_URL : PLAY_STORE_URL;
        var icon = isApple ? APPLE_ICON : PLAY_ICON;
        var label = isApple ? 'Download on the' : 'Get it on';
        var name = isApple ? 'App Store' : 'Google Play';
        var cls = 'store-button' + (size === 'large' ? ' store-button-large' : '');
        return (
            '<a href="' + url + '" target="_blank" rel="noopener noreferrer" class="' + cls + '">' +
            icon +
            '<div><div class="store-label">' + label + '</div><div class="store-name">' + name + '</div></div>' +
            '</a>'
        );
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
