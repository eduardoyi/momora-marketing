// Homepage behaviour: the hand-made artwork frames, the hero "book fills up"
// moment, the looping storyboards in each phone mockup, the gallery wall's
// swing and the drawn-moment cycler. Everything degrades to a readable static page
// without JS, and motion is skipped under prefers-reduced-motion.
(function () {
    'use strict';

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ── Artwork frames ────────────────────────────────────────────────────
    // A port of the app's frame geometry (src/components/artwork/
    // frame-geometry.ts in the app repo): six frame kinds drawn around the
    // scanned piece, with a mat, a lip, and an optional nail + string.
    function fmt(n) { return String(Math.round(n * 10) / 10); }
    function rectPath(x0, y0, x1, y1) {
        return 'M' + fmt(x0) + ' ' + fmt(y0) + ' H' + fmt(x1) + ' V' + fmt(y1) + ' H' + fmt(x0) + ' Z';
    }
    function roundRect(x0, y0, x1, y1, r) {
        return 'M' + fmt(x0 + r) + ' ' + fmt(y0) + ' H' + fmt(x1 - r) + ' A' + r + ' ' + r + ' 0 0 1 ' + fmt(x1) + ' ' + fmt(y0 + r) +
            ' V' + fmt(y1 - r) + ' A' + r + ' ' + r + ' 0 0 1 ' + fmt(x1 - r) + ' ' + fmt(y1) +
            ' H' + fmt(x0 + r) + ' A' + r + ' ' + r + ' 0 0 1 ' + fmt(x0) + ' ' + fmt(y1 - r) +
            ' V' + fmt(y0 + r) + ' A' + r + ' ' + r + ' 0 0 1 ' + fmt(x0 + r) + ' ' + fmt(y0) + ' Z';
    }
    function edgePath(x0, y0, x1, y1, a, shape, period) {
        var f = shape === 'wavy'
            ? function (u) { return 0.5 + 0.5 * Math.cos(2 * Math.PI * u); }
            : shape === 'ricrac'
                ? function (u) { return Math.abs(2 * u - 1); }
                : function (u) { return Math.sqrt(Math.max(0, 1 - Math.pow(2 * u - 1, 2))); };
        var sides = [
            { sx: x0, sy: y0, dx: 1, dy: 0, nx: 0, ny: -1, L: x1 - x0 },
            { sx: x1, sy: y0, dx: 0, dy: 1, nx: 1, ny: 0, L: y1 - y0 },
            { sx: x1, sy: y1, dx: -1, dy: 0, nx: 0, ny: 1, L: x1 - x0 },
            { sx: x0, sy: y1, dx: 0, dy: -1, nx: -1, ny: 0, L: y1 - y0 }
        ];
        var pts = [];
        sides.forEach(function (s) {
            var n = Math.max(1, Math.round(s.L / period));
            var per = s.L / n;
            var steps = Math.max(12, Math.ceil(s.L / 1.5));
            for (var i = 0; i < steps; i++) {
                var d = (s.L * i) / steps;
                var off = a * f((d % per) / per);
                pts.push(fmt(s.sx + s.dx * d + s.nx * off) + ' ' + fmt(s.sy + s.dy * d + s.ny * off));
            }
        });
        return 'M' + pts.join(' L') + ' Z';
    }

    var CREAM = '#FFF6DF';
    var MAT = '#FFFDF7';
    var frameId = 0;

    function frameMarkup(opts) {
        var kind = opts.kind || 'scallop';
        var color = opts.color || '#F2A7B8';
        var artW = opts.artW || 220;
        var ratio = opts.ratio || 0.75;
        var artH = Math.round(artW / ratio);
        var base = Math.min(artW, artH);
        var band = Math.max(16, Math.round(base * 0.12));
        var mat = Math.max(10, Math.round(base * 0.085));
        var w = artW + 2 * (band + mat);
        var h = artH + 2 * (band + mat);
        var amp = Math.round(band * 0.42);
        var k = Math.max(1, base / 220);

        var outer = rectPath(0, 0, w, h);
        var corners = '';
        var beads = '';
        var bodyFill = color;
        var matPath = rectPath(band, band, w - band, h - band);
        var lipColor = 'rgba(255,255,255,0.55)';
        var outline = '';
        var defs = '';
        var id = 'fr' + (++frameId);

        if (kind === 'scallop' || kind === 'wavy' || kind === 'ricrac') {
            var period = kind === 'scallop' ? amp * 2 : kind === 'wavy' ? amp * 4.4 : amp * 2.2;
            outer = edgePath(amp, amp, w - amp, h - amp, amp, kind, period);
            if (kind !== 'ricrac') {
                [[amp, amp], [w - amp, amp], [w - amp, h - amp], [amp, h - amp]].forEach(function (c) {
                    corners += '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="' + amp + '" fill="' + color + '"/>';
                });
            }
        } else if (kind === 'bobble') {
            outer = roundRect(0, 0, w, h, 5);
            bodyFill = CREAM;
            lipColor = 'rgba(120,90,50,0.18)';
            outline = '<path d="' + roundRect(0.5, 0.5, w - 0.5, h - 0.5, 5) + '" fill="none" stroke="rgba(120,90,50,0.18)" stroke-width="' + k + '"/>';
            var c = band / 2;
            var r = band * 0.31;
            var spacing = r * 2.3;
            [[c, c, w - c, c], [w - c, c, w - c, h - c], [w - c, h - c, c, h - c], [c, h - c, c, c]].forEach(function (s) {
                var L = Math.hypot(s[2] - s[0], s[3] - s[1]);
                var n = Math.max(1, Math.round(L / spacing));
                for (var i = 0; i < n; i++) {
                    var t = i / n;
                    var x = s[0] + (s[2] - s[0]) * t;
                    var y = s[1] + (s[3] - s[1]) * t;
                    beads += '<circle cx="' + fmt(x) + '" cy="' + fmt(y) + '" r="' + fmt(r) + '" fill="' + color + '"/>' +
                        '<circle cx="' + fmt(x - r * 0.32) + '" cy="' + fmt(y - r * 0.36) + '" r="' + fmt(r * 0.3) + '" fill="#fff" fill-opacity="0.6"/>';
                }
            });
        } else if (kind === 'gingham') {
            var cs = Math.max(8, Math.round(band / 2.2));
            defs = '<defs><pattern id="' + id + '" width="' + cs + '" height="' + cs + '" patternUnits="userSpaceOnUse">' +
                '<rect width="' + cs + '" height="' + cs + '" fill="#fff"/>' +
                '<rect width="' + cs / 2 + '" height="' + cs + '" fill="' + color + '" fill-opacity="0.5"/>' +
                '<rect width="' + cs + '" height="' + cs / 2 + '" fill="' + color + '" fill-opacity="0.5"/></pattern></defs>';
            outer = roundRect(0, 0, w, h, 3);
            bodyFill = 'url(#' + id + ')';
            lipColor = 'rgba(255,255,255,0.9)';
            outline = '<path d="' + roundRect(0.5, 0.5, w - 0.5, h - 0.5, 3) + '" fill="none" stroke="' + color + '" stroke-width="' + k + '"/>';
        } else if (kind === 'chunky') {
            outer = roundRect(0, 0, w, h, Math.round(band * 0.5));
            var a2 = 4;
            matPath = edgePath(band + a2, band + a2, w - band - a2, h - band - a2, a2, 'wavy', 14);
            lipColor = 'rgba(0,0,0,0)';
        }

        var nail = '';
        if (opts.nail) {
            var nailY = -Math.round(30 * k);
            nail = '<path d="M' + fmt(w * 0.26) + ' ' + fmt(band * 0.6) + ' L' + fmt(w / 2) + ' ' + nailY + ' L' + fmt(w * 0.74) + ' ' + fmt(band * 0.6) +
                '" fill="none" stroke="#6B5E4F" stroke-width="' + fmt(1.2 * k) + '" stroke-linecap="round"/>' +
                '<circle cx="' + w / 2 + '" cy="' + nailY + '" r="' + fmt(3.4 * k) + '" fill="#5F4A36"/>' +
                '<circle cx="' + fmt(w / 2 - k) + '" cy="' + fmt(nailY - 1.2 * k) + '" r="' + fmt(1.1 * k) + '" fill="#C9B79F"/>';
        }

        var lip = rectPath(band - 1.5 * k, band - 1.5 * k, w - band + 1.5 * k, h - band + 1.5 * k);
        var svg = '<svg class="frame-svg" viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="100%" aria-hidden="true" focusable="false">' +
            defs + nail +
            '<path d="' + outer + '" fill="' + bodyFill + '"/>' + corners + beads + outline +
            '<path d="' + lip + '" fill="none" stroke="' + lipColor + '" stroke-width="' + fmt(2 * k) + '"/>' +
            '<path d="' + matPath + '" fill="' + MAT + '"/></svg>';
        var inset = band + mat;
        var art = '<span class="frame-art" style="left:' + (inset / w * 100) + '%;top:' + (inset / h * 100) + '%;width:' + (artW / w * 100) + '%;height:' + (artH / h * 100) + '%">' +
            '<img src="' + opts.src + '" alt="' + (opts.alt || '') + '" loading="lazy" decoding="async"></span>';
        return { html: svg + art, w: w, h: h };
    }

    document.querySelectorAll('[data-frame]').forEach(function (el) {
        var built = frameMarkup({
            kind: el.dataset.frame,
            color: el.dataset.color,
            artW: 220,
            ratio: parseFloat(el.dataset.ratio || '0.75'),
            src: el.dataset.src,
            alt: el.dataset.alt,
            nail: el.hasAttribute('data-nail')
        });
        el.style.aspectRatio = built.w + ' / ' + built.h;
        el.insertAdjacentHTML('afterbegin', built.html);
    });

    // ── Hero: the book fills up ───────────────────────────────────────────
    var hero = document.querySelector('.h-hero');
    if (hero) {
        requestAnimationFrame(function () {
            requestAnimationFrame(function () { hero.classList.add('is-ready'); });
        });
    }

    // ── Storyboards ───────────────────────────────────────────────────────
    // Each animated mockup is a looping storyboard: a list of [ms, step]
    // where a step is a class added to the mockup (classes accumulate, so
    // CSS describes each state cumulatively) or a function. At the end of a
    // loop the mockup fades, every step class is removed with transitions
    // off, and it starts again. Off-screen mockups stop; reduced motion
    // shows the last frame.
    function storyboard(el, total, steps) {
        var timers = [];
        var classes = steps.filter(function (s) { return typeof s[1] === 'string'; }).map(function (s) { return s[1]; });
        var running = false;
        function clear() { timers.forEach(clearTimeout); timers = []; }
        function reset() {
            el.classList.add('sb-reset');
            classes.forEach(function (c) { el.classList.remove(c); });
            steps.forEach(function (s) { if (typeof s[1] === 'function') { s[1](true); } });
            void el.offsetWidth;
            el.classList.remove('sb-reset');
            el.classList.remove('sb-fade'); // with transitions back on, so the first frame fades in
        }
        function run() {
            reset();
            steps.forEach(function (s) {
                timers.push(setTimeout(function () {
                    if (typeof s[1] === 'string') { el.classList.add(s[1]); } else { s[1](false); }
                }, s[0]));
            });
            timers.push(setTimeout(function () { el.classList.add('sb-fade'); }, total - 450));
            timers.push(setTimeout(run, total));
        }
        if (reduceMotion || !('IntersectionObserver' in window)) {
            classes.forEach(function (c) { el.classList.add(c); });
            steps.forEach(function (s) { if (typeof s[1] === 'function') { s[1](false, true); } });
            el.classList.add('sb-still');
            return;
        }
        new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting && !running) { running = true; run(); }
                if (!entry.isIntersecting && running) { running = false; clear(); }
            });
        }, { threshold: 0.3 }).observe(el);
    }

    var q = function (sel) { return document.querySelector(sel); };

    if (q('.anim-photos')) {
        storyboard(q('.anim-photos'), 10500, [
            [500, 's1'],    // photo picker slides up
            [1200, 's2'],   // three photos get ticked
            [2900, 's3'],   // "Add 3" pressed
            [3300, 's4'],   // picker closes, the memory lands on the timeline
            [5400, 's5'],   // swipe to photo 2
            [7100, 's6']    // swipe to photo 3
        ]);
    }

    if (q('.anim-roll')) {
        storyboard(q('.anim-roll'), 9500, [
            [300, 's1'],    // scan sweeps the camera roll
            [2500, 's2'],   // screenshots, receipts and near-duplicates fall away
            [3200, 's3'],   // the keepers light up
            [4500, 's4']    // the day card arrives
        ]);
    }

    if (q('.anim-say')) {
        storyboard(q('.anim-say'), 11500, [
            [400, 's1'],    // listening
            [900, 's2'],    // words appear as you speak
            [5300, 's3'],   // stop listening
            [5800, 's4'],   // Save
            [6300, 's5'],   // over to the timeline
            [6800, 's6']    // the new memory settles in
        ]);
    }

    var voice = q('.anim-voice');
    if (voice) {
        var timerEl = voice.querySelector('.rec-timer');
        var ticks = [];
        var setTime = function (n) { timerEl.textContent = '0:' + String(n).padStart(2, '0'); };
        setTime(0);
        storyboard(voice, 12500, [
            [300, function (isReset, still) {
                ticks.forEach(clearTimeout); ticks = [];
                if (isReset) { setTime(0); return; }
                if (still) { setTime(14); return; }
                for (var i = 1; i <= 14; i++) {
                    (function (n) { ticks.push(setTimeout(function () { setTime(n); }, n * 320)); })(i);
                }
            }],
            [300, 's1'],    // recording: the waveform grows
            [4900, 's2'],   // stopped
            [5600, 's3'],   // trim handles pull in
            [7700, 's4']    // kept: the sound ticket lands
        ]);
    }

    if (q('.anim-scan')) {
        storyboard(q('.anim-scan'), 10500, [
            [1700, 's1'],   // edges found
            [2500, 's2'],   // straightened
            [3500, 's3'],   // flash
            [3700, 's4'],   // framed
            [4200, 's5'],   // swings onto its nail
            [5300, 's6']    // placard
        ]);
    }

    var family = q('.anim-family');
    if (family) {
        var countEl = family.querySelector('.react-count');
        var setCount = function (n) { countEl.textContent = String(n); };
        setCount(4);
        storyboard(family, 9000, [
            [900, function (isReset, still) { setCount(isReset ? 4 : still ? 6 : 5); }],
            [900, 's1'],
            [2100, 's2'],
            [3700, 's3'],
            [4900, function (isReset, still) { if (!isReset) { setCount(6); } }],
            [4900, 's4']
        ]);
    }

    if (q('.anim-curate')) {
        storyboard(q('.anim-curate'), 9500, [
            [600, 's1'],    // the best moments get picked
            [2400, 's2'],   // the rest step back
            [3200, 's3']    // and land on a spread
        ]);
    }

    // ── Holiday card: flips to show the letter on the back ────────────────
    document.querySelectorAll('.xcard-col').forEach(function (col) {
        var card = col.querySelector('.xcard');
        var button = col.querySelector('.xcard-flip');
        var auto = null;
        var setFlipped = function (on) {
            card.classList.toggle('is-flipped', on);
            if (button) { button.textContent = on ? 'See the front' : 'See the back'; }
        };
        if (button) {
            button.addEventListener('click', function () {
                clearInterval(auto);
                auto = null;
                setFlipped(!card.classList.contains('is-flipped'));
            });
        }
        if (!reduceMotion && 'IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting && auto === null && !col.dataset.touched) {
                        auto = setInterval(function () { setFlipped(!card.classList.contains('is-flipped')); }, 4200);
                    }
                    if (!entry.isIntersecting && auto) { clearInterval(auto); auto = null; }
                });
            }, { threshold: 0.5 }).observe(col);
            if (button) { button.addEventListener('click', function () { col.dataset.touched = '1'; }); }
        }
    });

    // ── Gallery wall: settle once in view, swing when touched ─────────────
    var swing = function (el) {
        if (reduceMotion) { return; }
        el.classList.remove('is-swinging');
        void el.offsetWidth; // restart the animation
        el.classList.add('is-swinging');
    };
    var wall = document.querySelector('.wall');
    if (wall) {
        var pieces = wall.querySelectorAll('.piece');
        pieces.forEach(function (piece) {
            piece.addEventListener('mouseenter', function () { swing(piece); });
            piece.addEventListener('click', function () { swing(piece); });
            piece.addEventListener('animationend', function () { piece.classList.remove('is-swinging'); });
        });
        if ('IntersectionObserver' in window && !reduceMotion) {
            var io = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        pieces.forEach(function (piece, i) {
                            setTimeout(function () { swing(piece); }, i * 140);
                        });
                        io.disconnect();
                    }
                });
            }, { threshold: 0.35 });
            io.observe(wall);
        }
    }

    // ── Drawn moments: each one paints itself in, then the next ───────────
    var drawn = document.querySelector('.drawn');
    if (drawn) {
        var slides = Array.prototype.slice.call(drawn.querySelectorAll('.drawn-slide'));
        var counter = drawn.querySelector('.drawn-count');
        var current = 0;
        var paintTimer = null;
        var advanceTimer = null;
        var inView = false;
        var show = function (n) {
            current = (n + slides.length) % slides.length;
            clearTimeout(paintTimer);
            clearTimeout(advanceTimer);
            slides.forEach(function (s, i) {
                s.hidden = i !== current;
                s.classList.remove('is-painted');
            });
            if (counter) { counter.textContent = (current + 1) + ' of ' + slides.length; }
            if (reduceMotion) { slides[current].classList.add('is-painted'); return; }
            paintTimer = setTimeout(function () { slides[current].classList.add('is-painted'); }, 1100);
            if (inView) { advanceTimer = setTimeout(function () { show(current + 1); }, 7000); }
        };
        drawn.querySelector('.drawn-next').addEventListener('click', function () { show(current + 1); });
        drawn.querySelector('.drawn-prev').addEventListener('click', function () { show(current - 1); });
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    var was = inView;
                    inView = entry.isIntersecting;
                    if (inView && !was) { show(current); }
                    if (!inView) { clearTimeout(advanceTimer); }
                });
            }, { threshold: 0.4 }).observe(drawn);
        } else {
            show(0);
        }
    }
})();
