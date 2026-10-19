// Records the width/height of every remote image the blog posts use in
// content/blog/image-sizes.json, so the (synchronous, offline) build can put
// width/height on each <img> and the browser can reserve the space before the
// image arrives. Run it after adding or changing images in a post:
//
//   npm run image-sizes
//
// Only images missing from the manifest are fetched, and only their first
// 64 KB (enough for any format's header).
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { getImageDimensions } = require('./image-dimensions');

const BLOG_DIR = path.join(__dirname, '..', 'content', 'blog');
const MANIFEST_PATH = path.join(BLOG_DIR, 'image-sizes.json');

function collectRemoteImageUrls() {
    const urls = new Set();
    fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md')).forEach(file => {
        const { data, content } = matter(fs.readFileSync(path.join(BLOG_DIR, file), 'utf-8'));
        if (typeof data.image === 'string' && /^https?:\/\//.test(data.image.trim())) {
            urls.add(data.image.trim());
        }
        for (const m of content.matchAll(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)/g)) {
            urls.add(m[1]);
        }
    });
    return [...urls];
}

async function readRemoteDimensions(url) {
    const res = await fetch(url, { headers: { Range: 'bytes=0-65535' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const dims = getImageDimensions(buf);
    if (!dims) throw new Error('unrecognised image format');
    return dims;
}

async function main() {
    const manifest = fs.existsSync(MANIFEST_PATH) ? JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8')) : {};
    const missing = collectRemoteImageUrls().filter(url => !manifest[url]);

    if (missing.length === 0) {
        console.log('✅ image-sizes.json already covers every blog image.');
        return;
    }

    let failures = 0;
    for (const url of missing) {
        try {
            manifest[url] = await readRemoteDimensions(url);
            console.log(`✅ ${manifest[url].width}×${manifest[url].height}  ${url}`);
        } catch (e) {
            failures++;
            console.warn(`⚠️  ${url}: ${e.message}`);
        }
    }

    const sorted = Object.fromEntries(Object.keys(manifest).sort().map(k => [k, manifest[k]]));
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(sorted, null, 2) + '\n');
    console.log(`\nWrote ${path.relative(process.cwd(), MANIFEST_PATH)}${failures ? ` (${failures} failed)` : ''}.`);
    if (failures) process.exitCode = 1;
}

main();
