const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const matter = require('gray-matter');
const chokidar = require('chokidar');
const { execSync } = require('child_process');
const crypto = require('crypto');
const { getImageDimensions } = require('./scripts/image-dimensions');

// Configuration
const CONTENT_DIR = path.join(__dirname, 'content');
const OUTPUT_DIR = path.join(__dirname, 'dist');
const TEMPLATE_PATH = path.join(__dirname, 'src/templates/page-template.html');
const SRC_DIR = path.join(__dirname, 'src');
const COMPONENTS_DIR = path.join(__dirname, 'src/components');

// Blog configuration
const SITE_URL = 'https://usemomora.com';
const BLOG_CONTENT_DIR = path.join(CONTENT_DIR, 'blog');
const BLOG_POST_TEMPLATE_PATH = path.join(__dirname, 'src/templates/blog-post-template.html');
const BLOG_ARCHIVE_TEMPLATE_PATH = path.join(__dirname, 'src/templates/blog-archive-template.html');
const BLOG_POSTS_PER_PAGE = 6;
const DEFAULT_OG_IMAGE = `${SITE_URL}/assets/images/brand/og-home.jpg`;

// Ensure content directory exists
if (!fs.existsSync(CONTENT_DIR)) {
    fs.mkdirSync(CONTENT_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// Image dimensions + asset cache-busting
// ---------------------------------------------------------------------------

// Remote (R2) blog image sizes, recorded by `npm run image-sizes` so the build
// stays offline. Local /assets/ images are measured straight from disk.
const REMOTE_IMAGE_SIZES_PATH = path.join(__dirname, 'content/blog/image-sizes.json');
const remoteImageSizes = fs.existsSync(REMOTE_IMAGE_SIZES_PATH)
    ? JSON.parse(fs.readFileSync(REMOTE_IMAGE_SIZES_PATH, 'utf-8'))
    : {};
const localImageSizes = new Map();

function lookupImageSize(src) {
    if (/^https?:\/\//.test(src)) {
        return remoteImageSizes[src] || null;
    }
    if (!src.startsWith('/assets/')) return null;
    if (!localImageSizes.has(src)) {
        const filePath = path.join(__dirname, src);
        localImageSizes.set(src, fs.existsSync(filePath) ? getImageDimensions(fs.readFileSync(filePath)) : null);
    }
    return localImageSizes.get(src);
}

// Gives every <img> that lacks them its intrinsic width/height, so the browser
// reserves the right aspect ratio before the image loads (no layout shift).
// CSS still decides the rendered size.
function addImageDimensions(html) {
    return html.replace(/<img\b[^>]*>/g, tag => {
        if (/\swidth=/.test(tag)) return tag;
        const src = (tag.match(/\ssrc="([^"]+)"/) || [])[1];
        const size = src && lookupImageSize(src);
        if (!size) {
            if (src && /^https?:\/\//.test(src)) {
                console.warn(`⚠️  No size recorded for ${src} — run \`npm run image-sizes\`.`);
            }
            return tag;
        }
        return tag.replace(/^<img\b/, `<img width="${size.width}" height="${size.height}"`);
    });
}

// Appends ?v=<content hash> to /css/ and /js/ references so those files can
// be cached for a year (see _headers) and still update the moment they change.
const assetHashes = new Map();
function assetVersion(urlPath) {
    if (!assetHashes.has(urlPath)) {
        const filePath = path.join(SRC_DIR, urlPath);
        assetHashes.set(urlPath, fs.existsSync(filePath)
            ? crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').slice(0, 10)
            : null);
    }
    return assetHashes.get(urlPath);
}

function versionAssetUrls(html) {
    return html.replace(/(href|src)="(\/(?:css|js)\/[^"?#]+\.(?:css|js))"/g, (match, attr, urlPath) => {
        const version = assetVersion(urlPath);
        return version ? `${attr}="${urlPath}?v=${version}"` : match;
    });
}

// Read the template file
function getTemplate() {
    if (!fs.existsSync(TEMPLATE_PATH)) {
        console.error('Error: page-template.html not found. Please create a template file.');
        process.exit(1);
    }
    return fs.readFileSync(TEMPLATE_PATH, 'utf-8');
}

// Read component files
function getComponent(componentName) {
    const componentPath = path.join(COMPONENTS_DIR, `${componentName}.html`);
    if (!fs.existsSync(componentPath)) {
        console.warn(`Warning: ${componentName}.html not found in components directory.`);
        return '';
    }
    return fs.readFileSync(componentPath, 'utf-8');
}

// Inject components into HTML
function injectComponents(html, options = {}) {
    const {
        title = 'Momora - Your private family memory journal',
        description = 'Save family memories with text, voice, photos, videos, and optional AI illustrations in one private shared journal.',
        activeFaq = '',
        activeBlog = '',
        extraCss = '',
        extraHead = '',
        extraScripts = ''
    } = options;

    const headComponent = getComponent('head');
    const headerComponent = getComponent('header');
    const footerComponent = getComponent('footer');
    const gtmBodyComponent = getComponent('gtm-body');

    // Replace component placeholders
    let output = html
        .replace('{{HEAD}}', headComponent)
        .replace('{{HEADER}}', headerComponent)
        .replace('{{FOOTER}}', footerComponent)
        .replace('{{GTM_BODY}}', gtmBodyComponent);

    // Replace page-specific placeholders
    output = output
        .replace(/\{\{TITLE\}\}/g, title)
        .replace(/\{\{DESCRIPTION\}\}/g, description)
        .replace(/\{\{ACTIVE_FAQ\}\}/g, activeFaq)
        .replace(/\{\{ACTIVE_BLOG\}\}/g, activeBlog)
        .replace(/\{\{EXTRA_CSS\}\}/g, extraCss)
        .replace(/\{\{EXTRA_HEAD\}\}/g, extraHead)
        .replace(/\{\{EXTRA_SCRIPTS\}\}/g, extraScripts);

    return versionAssetUrls(addImageDimensions(output));
}

// Copy a file from source to destination
function copyFile(src, dest) {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
}

// Recursively copy a directory
function copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
            copyDirectory(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// Copy static assets to dist
function copyStaticFiles() {
    // Ensure dist directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    // Copy CSS files
    const cssDir = path.join(SRC_DIR, 'css');
    const cssDestDir = path.join(OUTPUT_DIR, 'css');
    if (fs.existsSync(cssDir)) {
        copyDirectory(cssDir, cssDestDir);
    }
    
    // Copy JS files
    const jsDir = path.join(SRC_DIR, 'js');
    const jsDestDir = path.join(OUTPUT_DIR, 'js');
    if (fs.existsSync(jsDir)) {
        copyDirectory(jsDir, jsDestDir);
    }
    
    // Copy static pages with component injection
    const pagesDir = path.join(SRC_DIR, 'pages');
    if (fs.existsSync(pagesDir)) {
        const pageFiles = fs.readdirSync(pagesDir).filter(file => file.endsWith('.html'));
        pageFiles.forEach(file => {
            const filename = path.basename(file, '.html');
            const sourcePath = path.join(pagesDir, file);
            let htmlContent = fs.readFileSync(sourcePath, 'utf-8');
            
            // Determine page-specific options
            let options = {};
            if (filename === 'index') {
                options = {
                    title: 'Momora — the baby book that starts from your phone',
                    description: 'Their photos, videos, stories, little voice and drawings, kept in one private place your family shares. Then made into books, films and cards you can hold.',
                    activeFaq: '',
                    extraCss: '<link rel="stylesheet" href="/css/home.css">',
                    extraScripts: ''
                };
            } else if (filename === 'get') {
                options = {
                    title: 'Get Momora',
                    description: 'Download Momora on the App Store or Google Play.',
                    activeFaq: '',
                    extraCss: '',
                    extraScripts: ''
                };
            } else if (filename === 'faq') {
                const title = 'FAQ — Momora';
                const description = 'Answers about Momora memories, AI illustrations, family sharing, privacy, pricing, and account deletion.';
                options = {
                    title,
                    description,
                    activeFaq: ' active',
                    extraCss: '',
                    extraHead: buildSocialHead({ urlPath: '/faq/', title, description }) +
                        '\n' + buildFaqSchema(htmlContent),
                    extraScripts: '<script src="/js/faq-script.js"></script>'
                };
            } else if (filename === 'delete-account') {
                const title = 'Delete Your Account — Momora';
                const description = 'Schedule deletion of your Momora account and learn what happens during the 15-day grace period.';
                options = {
                    title,
                    description,
                    activeFaq: '',
                    extraCss: '',
                    extraHead: buildSocialHead({ urlPath: '/delete-account/', title, description }),
                    extraScripts: ''
                };
            } else if (filename === '404') {
                // Served by Cloudflare Pages (with a real 404 status) for any
                // path that doesn't exist. Without a 404.html, Pages falls back
                // to SPA mode and answers every unknown URL with the homepage
                // and a 200, which search engines index as duplicate pages.
                options = {
                    title: 'Page not found — Momora',
                    description: 'This page doesn\'t exist. Head back to the Momora homepage, blog, or FAQ.',
                    activeFaq: '',
                    extraCss: '',
                    extraScripts: ''
                };
            } else if (filename === 'invite') {
                options = {
                    title: 'Join your family on Momora',
                    description: 'Enter your invite code to join your family\'s memory journal on Momora.',
                    activeFaq: '',
                    extraCss: '',
                    extraScripts: '<script src="/js/invite-script.js"></script>\n    <script src="/js/store-link-escape.js"></script>'
                };
            }
            
            // Inject components
            htmlContent = injectComponents(htmlContent, options);
            
            // Determine output path
            let outputPath;
            if (filename === 'faq') {
                const faqDir = path.join(OUTPUT_DIR, 'faq');
                if (!fs.existsSync(faqDir)) {
                    fs.mkdirSync(faqDir, { recursive: true });
                }
                outputPath = path.join(faqDir, 'index.html');
            } else if (filename === 'delete-account') {
                const deleteAccountDir = path.join(OUTPUT_DIR, 'delete-account');
                if (!fs.existsSync(deleteAccountDir)) {
                    fs.mkdirSync(deleteAccountDir, { recursive: true });
                }
                outputPath = path.join(deleteAccountDir, 'index.html');
            } else if (filename === 'invite') {
                // Directory + index.html (not invite.html) so the page is
                // reachable at the extension-less `/invite` path used by the
                // share-sheet invite link (`https://usemomora.com/invite?code=...`),
                // matching the /faq/, /delete-account/ etc. convention above.
                const inviteDir = path.join(OUTPUT_DIR, 'invite');
                if (!fs.existsSync(inviteDir)) {
                    fs.mkdirSync(inviteDir, { recursive: true });
                }
                outputPath = path.join(inviteDir, 'index.html');
            } else if (filename === 'get') {
                // /get/ is what the homepage QR code encodes; it forwards
                // each phone to its own store.
                const getDir = path.join(OUTPUT_DIR, 'get');
                if (!fs.existsSync(getDir)) {
                    fs.mkdirSync(getDir, { recursive: true });
                }
                outputPath = path.join(getDir, 'index.html');
            } else {
                outputPath = path.join(OUTPUT_DIR, file);
            }
            
            // Write processed HTML
            fs.writeFileSync(outputPath, htmlContent);
        });
    }
    
    // Copy assets directory
    const assetsDir = path.join(__dirname, 'assets');
    const assetsDestDir = path.join(OUTPUT_DIR, 'assets');
    if (fs.existsSync(assetsDir)) {
        copyDirectory(assetsDir, assetsDestDir);
    }
    
    // Copy CNAME file for custom domain
    const cnamePath = path.join(__dirname, 'CNAME');
    const cnameDestPath = path.join(OUTPUT_DIR, 'CNAME');
    if (fs.existsSync(cnamePath)) {
        fs.copyFileSync(cnamePath, cnameDestPath);
    }

    // Copy universal/app-link verification files (Apple + Android).
    // These are extensionless / plain-JSON files that don't end in .html,
    // so they can't ride the src/pages/*.html loop above — copy them
    // explicitly. Without this they never reach dist/ and every universal
    // link silently falls back to opening the marketing site in a browser
    // instead of the app.
    copyWellKnownFiles();

    // Copy Cloudflare Pages' _headers file (controls response headers,
    // e.g. the content-type override the extensionless AASA file needs).
    // Irrelevant to GitHub Pages but harmless there.
    copyHeadersFile();

    // Cloudflare Pages' _redirects file (short aliases like /privacy).
    const redirectsSrcPath = path.join(__dirname, '_redirects');
    if (fs.existsSync(redirectsSrcPath)) {
        fs.copyFileSync(redirectsSrcPath, path.join(OUTPUT_DIR, '_redirects'));
    }
}

// Copy Apple App Site Association + Android Asset Links files into
// dist/.well-known/. Source files live in the repo root's .well-known/
// directory (see .well-known/README.md for what still needs filling in).
function copyWellKnownFiles() {
    const wellKnownSrcDir = path.join(__dirname, '.well-known');
    const wellKnownDestDir = path.join(OUTPUT_DIR, '.well-known');
    const wellKnownFiles = ['apple-app-site-association', 'assetlinks.json'];

    wellKnownFiles.forEach(filename => {
        const srcPath = path.join(wellKnownSrcDir, filename);
        if (fs.existsSync(srcPath)) {
            copyFile(srcPath, path.join(wellKnownDestDir, filename));
        } else {
            console.warn(`Warning: .well-known/${filename} not found; universal/app links will not verify.`);
        }
    });
}

// Copy the Cloudflare Pages _headers file from the repo root into dist/.
function copyHeadersFile() {
    const headersSrcPath = path.join(__dirname, '_headers');
    const headersDestPath = path.join(OUTPUT_DIR, '_headers');
    if (fs.existsSync(headersSrcPath)) {
        fs.copyFileSync(headersSrcPath, headersDestPath);
    }
}

// ---------------------------------------------------------------------------
// Blog
// ---------------------------------------------------------------------------

// Custom marked renderer: an image with a title (`![alt](src "title")`)
// becomes a <figure>/<figcaption> pair per the blog style guide; without a
// title it's still wrapped in a bare <figure> so spacing/sizing stays
// consistent. Marked treats a lone image as inline content and wraps it in
// a <p>, so the figure gets unwrapped from that <p> afterwards.
const blogRenderer = new marked.Renderer();
blogRenderer.image = (href, title, text) => {
    const caption = title ? `<figcaption>${title}</figcaption>` : '';
    return `<figure><img src="${href}" alt="${text || ''}" loading="lazy">${caption}</figure>`;
};

// The first image sits right under the intro, usually in the first screen, so
// it loads eagerly at high priority (it's typically the page's LCP element);
// the rest stay lazy.
function renderPostBody(markdownContent) {
    const html = marked(markdownContent, { renderer: blogRenderer })
        .replace(/<p><figure>([\s\S]*?)<\/figure><\/p>/g, '<figure>$1</figure>');
    return html.replace(/(<figure><img [^>]*?)loading="lazy"/, '$1fetchpriority="high"');
}

// Strip tags/entities down to plain words for a word-count-based read time.
function estimateReadTime(html) {
    const text = html.replace(/<[^>]+>/g, ' ').replace(/&[a-z0-9#]+;/gi, ' ');
    const words = text.split(/\s+/).filter(Boolean);
    const minutes = Math.max(1, Math.round(words.length / 200));
    return `${minutes} min read`;
}

// gray-matter's YAML parser auto-coerces an unquoted `date: 2026-08-04`
// frontmatter value into a JS Date (UTC midnight), rather than leaving it as
// the string "2026-08-04". Reconstruct the plain ISO string from its UTC
// parts (not local getters, which would shift the day for anyone west of
// UTC) so every other date helper can treat frontmatter dates as strings.
function toISODateString(value) {
    if (value instanceof Date) {
        const y = value.getUTCFullYear();
        const m = String(value.getUTCMonth() + 1).padStart(2, '0');
        const d = String(value.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    return String(value);
}

// Formats a "YYYY-MM-DD" date string as "Aug 4, 2026" without going through
// Date/timezone conversion, which would push midnight-UTC dates back a day
// for anyone west of UTC.
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatDateDisplay(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Non-regex placeholder fill — safe even if a post body happens to contain
// characters that are special in a regex or in String.replace patterns.
function fillPlaceholders(html, map) {
    return Object.entries(map).reduce(
        (acc, [key, value]) => acc.split(`{{${key}}}`).join(value == null ? '' : value),
        html
    );
}

function jsonLdScript(data) {
    const json = JSON.stringify(data).replace(/</g, '\\u003c');
    return `<script type="application/ld+json">${json}</script>`;
}

// Canonical + Open Graph + Twitter card tags for a plain (non-article) page.
function buildSocialHead({ urlPath, title, description, image = DEFAULT_OG_IMAGE }) {
    const url = `${SITE_URL}${urlPath}`;
    return `
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Momora">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${image}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${image}">`;
}

// FAQPage structured data, pulled straight from the FAQ page's markup so the
// schema can never drift from what's on the page.
function buildFaqSchema(faqHtml) {
    const toText = html => html
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .replace(/\s+([.,;:!?)])/g, '$1')
        .trim();
    const itemPattern = /<button class="faq-question"><span class="faq-number">[^<]*<\/span><span>([\s\S]*?)<\/span>[\s\S]*?<\/button>\s*<div class="faq-answer">([\s\S]*?)<\/div>\s*<\/div>\s*(?=<div class="faq-item"|<\/div>)/g;
    const mainEntity = [];
    let match;
    while ((match = itemPattern.exec(faqHtml)) !== null) {
        mainEntity.push({
            '@type': 'Question',
            name: toText(match[1]),
            acceptedAnswer: { '@type': 'Answer', text: toText(match[2]) }
        });
    }
    if (mainEntity.length === 0) {
        console.warn('Warning: no FAQ items found for FAQPage schema.');
        return '';
    }
    return jsonLdScript({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity });
}

// ---------------------------------------------------------------------------
// Sitemap + robots.txt
// ---------------------------------------------------------------------------

// Last commit date (YYYY-MM-DD) touching any of the given files, or null
// outside a git checkout / for never-committed files.
function gitLastModified(...files) {
    try {
        const out = execSync(`git log -1 --format=%cs -- ${files.map(f => JSON.stringify(f)).join(' ')}`, {
            cwd: __dirname,
            stdio: ['ignore', 'pipe', 'ignore']
        }).toString().trim();
        return out || null;
    } catch (e) {
        return null;
    }
}

// Every indexable page. /get/ and /invite/ are noindex utility pages and
// stay out on purpose.
function buildSitemap(posts) {
    const pages = [
        { loc: '/', lastmod: gitLastModified('src/pages/index.html') },
        { loc: '/faq/', lastmod: gitLastModified('src/pages/faq.html') },
        { loc: '/delete-account/', lastmod: gitLastModified('src/pages/delete-account.html') }
    ];

    if (posts.length > 0) {
        pages.push({ loc: '/blog/', lastmod: posts[0].date });
        const totalPages = Math.max(1, Math.ceil((posts.length - 1) / BLOG_POSTS_PER_PAGE));
        for (let n = 2; n <= totalPages; n++) {
            pages.push({ loc: `/blog/page/${n}/`, lastmod: null });
        }
        posts.forEach(post => {
            pages.push({ loc: post.url, lastmod: gitLastModified(path.join('content/blog', post.file)) || post.date });
        });
    }

    fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md')).forEach(file => {
        const { data } = matter(fs.readFileSync(path.join(CONTENT_DIR, file), 'utf-8'));
        const loc = data.slug ? `/${data.slug}/` : `/${path.basename(file, '.md')}.html`;
        pages.push({ loc, lastmod: gitLastModified(path.join('content', file)) });
    });

    const urls = pages.map(({ loc, lastmod }) =>
        `  <url>\n    <loc>${SITE_URL}${loc}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n  </url>`
    ).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
    fs.writeFileSync(path.join(OUTPUT_DIR, 'sitemap.xml'), xml);
    console.log(`✅ Generated: sitemap.xml (${pages.length} URLs)`);
}

function buildRobots() {
    fs.writeFileSync(path.join(OUTPUT_DIR, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
    console.log('✅ Generated: robots.txt');
}

function readTemplateFile(templatePath) {
    if (!fs.existsSync(templatePath)) {
        console.error(`Error: template not found at ${templatePath}`);
        process.exit(1);
    }
    return fs.readFileSync(templatePath, 'utf-8');
}

// Read every content/blog/*.md file into a fully-resolved post object,
// sorted newest first.
function readBlogPosts() {
    if (!fs.existsSync(BLOG_CONTENT_DIR)) {
        return [];
    }

    const files = fs.readdirSync(BLOG_CONTENT_DIR).filter(file => file.endsWith('.md'));

    const posts = files.map(file => {
        const filePath = path.join(BLOG_CONTENT_DIR, file);
        const raw = fs.readFileSync(filePath, 'utf-8');
        const { data, content } = matter(raw);

        if (!data.title || !data.date || !data.author) {
            console.warn(`⚠️  content/blog/${file} is missing required frontmatter (title, date, author) — skipping.`);
            return null;
        }

        const slug = data.slug || path.basename(file, '.md');
        const bodyHtml = renderPostBody(content);
        const description = data.description || data.excerpt || '';
        const date = toISODateString(data.date);

        return {
            file,
            slug,
            title: data.title,
            description,
            excerpt: data.excerpt || description,
            dek: data.dek || '',
            date,
            dateDisplay: formatDateDisplay(date),
            author: data.author,
            // Short form shows in the archive (latest card); the post header
            // byline gets the fuller version if one's provided (e.g. adding
            // "· mother of two" the way the design's post page does, without
            // repeating it on the more compact archive card).
            authorRole: data.authorRole || '',
            authorRoleFull: data.authorRoleFull || data.authorRole || '',
            authorBio: data.authorBio || '',
            authorInitial: data.author.trim().charAt(0).toUpperCase(),
            authorAvatar: data.authorAvatar || '',
            image: data.image || '',
            bodyHtml,
            readTime: estimateReadTime(bodyHtml),
            url: `/blog/${slug}/`
        };
    }).filter(Boolean);

    // Newest first.
    posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    return posts;
}

// Renders the author avatar at a given size — a photo (cropped to a circle
// via object-fit: cover) when the post sets `authorAvatar`, otherwise the
// initial-letter circle.
function renderAuthorAvatar(post, size) {
    if (post.authorAvatar) {
        return `<img src="${post.authorAvatar}" alt="${escapeHtml(post.author)}" class="author-avatar author-avatar--${size}" loading="lazy">`;
    }
    return `<span class="author-avatar author-avatar--${size}">${escapeHtml(post.authorInitial)}</span>`;
}

function renderLatestPostSection(post) {
    return `
<section class="blog-latest-section">
  <a href="${post.url}" class="blog-latest-card">
    <div class="blog-latest-meta">
      <span class="blog-latest-label">Latest</span>
      <span class="blog-meta-dot"></span>
      <span class="blog-mono">${escapeHtml(post.dateDisplay)} · ${escapeHtml(post.readTime)}</span>
    </div>
    <h2>${escapeHtml(post.title)}</h2>
    <p>${escapeHtml(post.excerpt)}</p>
    <div class="blog-latest-byline">
      ${renderAuthorAvatar(post, 'md')}
      <span class="blog-latest-byline-text">
        <span class="blog-latest-byline-name">${escapeHtml(post.author)}</span>
        <span class="blog-latest-byline-role">${escapeHtml(post.authorRole)}</span>
      </span>
      <span class="blog-latest-cta">Read it →</span>
    </div>
  </a>
</section>`;
}

function renderArchiveItem(post) {
    return `
    <a href="${post.url}" class="blog-archive-item">
      <div class="blog-archive-item-main">
        <h3>${escapeHtml(post.title)}</h3>
        <p>${escapeHtml(post.excerpt)}</p>
      </div>
      <div class="blog-archive-item-meta">
        <span class="blog-mono">${escapeHtml(post.dateDisplay)}</span>
        <span class="blog-mono">${escapeHtml(post.readTime)}</span>
        <span class="blog-archive-item-byline">
          ${renderAuthorAvatar(post, 'sm')}
          <span>${escapeHtml(post.author)}</span>
        </span>
      </div>
    </a>`;
}

function renderArchiveListSection(pagePosts, totalOtherPosts, pageNum, totalPages) {
    if (totalOtherPosts === 0) {
        return '';
    }

    const items = pagePosts.map(renderArchiveItem).join('\n');

    const pagination = [];
    if (pageNum > 1) {
        const prevHref = pageNum === 2 ? '/blog/' : `/blog/page/${pageNum - 1}/`;
        pagination.push(`<a href="${prevHref}" class="blog-pagination-btn">← Newer posts</a>`);
    }
    if (pageNum < totalPages) {
        pagination.push(`<a href="/blog/page/${pageNum + 1}/" class="blog-pagination-btn">Older posts</a>`);
    }

    return `
<section class="blog-archive-section">
  <div class="blog-archive-heading">
    <h2>Everything else</h2>
    <span class="blog-mono">${totalOtherPosts} post${totalOtherPosts === 1 ? '' : 's'}</span>
  </div>
  ${items}
  ${pagination.length ? `<div class="blog-pagination">${pagination.join('\n  ')}</div>` : ''}
</section>`;
}

function buildPostHead(post) {
    const url = `${SITE_URL}${post.url}`;
    const image = post.image || DEFAULT_OG_IMAGE;

    const articleSchema = {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        headline: post.title,
        description: post.description,
        image: [image],
        datePublished: post.date,
        dateModified: post.date,
        author: { '@type': 'Person', name: post.author },
        publisher: {
            '@type': 'Organization',
            name: 'Momora',
            logo: { '@type': 'ImageObject', url: `${SITE_URL}/assets/images/brand/momora-favicon.png` }
        }
    };

    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
            { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog/` },
            { '@type': 'ListItem', position: 3, name: post.title, item: url }
        ]
    };

    return `
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Momora">
<meta property="og:title" content="${escapeHtml(post.title)}">
<meta property="og:description" content="${escapeHtml(post.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${image}">
<meta property="article:published_time" content="${post.date}">
<meta property="article:author" content="${escapeHtml(post.author)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(post.title)}">
<meta name="twitter:description" content="${escapeHtml(post.description)}">
<meta name="twitter:image" content="${image}">
${jsonLdScript(articleSchema)}
${jsonLdScript(breadcrumbSchema)}`;
}

function buildArchiveHead(pageNum, entries) {
    const url = pageNum === 1 ? `${SITE_URL}/blog/` : `${SITE_URL}/blog/page/${pageNum}/`;
    const title = pageNum === 1 ? 'Blog — Momora' : `Blog — Page ${pageNum} — Momora`;
    const description = 'Notes on remembering your kids: what to write down, what you forget first, and how to keep a family memory journal without the guilt.';

    const blogSchema = {
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: 'The Momora blog',
        url,
        description,
        blogPost: entries.map(post => ({
            '@type': 'BlogPosting',
            headline: post.title,
            url: `${SITE_URL}${post.url}`,
            datePublished: post.date
        }))
    };

    return {
        title,
        description,
        extraHead: `
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Momora">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${DEFAULT_OG_IMAGE}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${DEFAULT_OG_IMAGE}">
${jsonLdScript(blogSchema)}`
    };
}

function buildBlogPost(post) {
    const template = readTemplateFile(BLOG_POST_TEMPLATE_PATH);

    let output = fillPlaceholders(template, {
        POST_TITLE: escapeHtml(post.title),
        POST_DATE_DISPLAY: escapeHtml(post.dateDisplay),
        POST_READ_TIME: escapeHtml(post.readTime),
        POST_DEK_BLOCK: post.dek ? `<p class="post-dek">${escapeHtml(post.dek)}</p>` : '',
        AUTHOR_NAME: escapeHtml(post.author),
        AUTHOR_ROLE: escapeHtml(post.authorRoleFull),
        AUTHOR_BIO: escapeHtml(post.authorBio),
        AUTHOR_AVATAR_LG: renderAuthorAvatar(post, 'lg'),
        AUTHOR_AVATAR_XL: renderAuthorAvatar(post, 'xl'),
        POST_BODY: post.bodyHtml
    });

    output = injectComponents(output, {
        title: `${post.title} — Momora`,
        description: post.description,
        activeBlog: ' active',
        extraCss: '<link rel="stylesheet" href="/css/blog.css">',
        extraHead: buildPostHead(post)
    });

    const outDir = path.join(OUTPUT_DIR, 'blog', post.slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), output);
    console.log(`✅ Generated: blog/${post.slug}/index.html (accessible as /blog/${post.slug}/)`);
}

function buildBlogArchivePage(pageNum, totalPages, featuredPost, pagePosts, totalOtherPosts) {
    const template = readTemplateFile(BLOG_ARCHIVE_TEMPLATE_PATH);

    const latestSection = pageNum === 1 ? renderLatestPostSection(featuredPost) : '';
    const listSection = renderArchiveListSection(pagePosts, totalOtherPosts, pageNum, totalPages);

    let output = fillPlaceholders(template, {
        LATEST_POST_SECTION: latestSection,
        ARCHIVE_LIST_SECTION: listSection
    });

    const entries = pageNum === 1 ? [featuredPost, ...pagePosts] : pagePosts;
    const head = buildArchiveHead(pageNum, entries);

    output = injectComponents(output, {
        title: head.title,
        description: head.description,
        activeBlog: ' active',
        extraCss: '<link rel="stylesheet" href="/css/blog.css">',
        extraHead: head.extraHead
    });

    const outDir = pageNum === 1
        ? path.join(OUTPUT_DIR, 'blog')
        : path.join(OUTPUT_DIR, 'blog', 'page', String(pageNum));
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), output);
    console.log(`✅ Generated: blog${pageNum === 1 ? '' : `/page/${pageNum}`}/index.html`);
}

// Builds every post page plus the paginated archive. The archive's "Latest"
// hero card is always the single newest post; everything else is paginated
// BLOG_POSTS_PER_PAGE at a time across /blog/, /blog/page/2/, etc.
function buildBlogContent() {
    const posts = readBlogPosts();

    if (posts.length === 0) {
        console.log('⚠️  No posts found in content/blog/ — skipping blog build.');
        return posts;
    }

    console.log(`📝 Building ${posts.length} blog post(s)...`);
    posts.forEach(buildBlogPost);

    const featuredPost = posts[0];
    const otherPosts = posts.slice(1);
    const totalPages = otherPosts.length === 0 ? 1 : Math.ceil(otherPosts.length / BLOG_POSTS_PER_PAGE);

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const pagePosts = otherPosts.slice((pageNum - 1) * BLOG_POSTS_PER_PAGE, pageNum * BLOG_POSTS_PER_PAGE);
        buildBlogArchivePage(pageNum, totalPages, featuredPost, pagePosts, otherPosts.length);
    }

    console.log(`✨ Blog built: ${posts.length} post(s) across ${totalPages} archive page(s).\n`);
    return posts;
}

// Convert markdown file to HTML
function convertMarkdownToHTML(filePath) {
    try {
        const markdownContent = fs.readFileSync(filePath, 'utf-8');
        
        // Parse frontmatter (metadata like title, description)
        const { data, content } = matter(markdownContent);
        
        // Convert markdown to HTML
        const htmlContent = marked(content);
        
        // Get template
        const template = getTemplate();
        
        // Replace content placeholder first
        let output = template.replace('{{CONTENT}}', htmlContent);
        
        // Inject components with page-specific metadata
        const title = data.title ? `${data.title} — Momora` : 'Momora';
        const description = data.description || 'Capture the moments you\'ll wish you could relive';
        const urlPath = data.slug ? `/${data.slug}/` : `/${path.basename(filePath, '.md')}.html`;
        output = injectComponents(output, {
            title,
            description,
            activeFaq: '',
            extraCss: '',
            extraHead: buildSocialHead({ urlPath, title, description }),
            extraScripts: ''
        });
        
        // Generate output filename/path
        const filename = path.basename(filePath, '.md');
        let outputPath;
        
        // Check if custom slug is provided in frontmatter
        if (data.slug) {
            // Create directory with index.html (e.g., /privacy-policy/index.html)
            const slugDir = path.join(OUTPUT_DIR, data.slug);
            if (!fs.existsSync(slugDir)) {
                fs.mkdirSync(slugDir, { recursive: true });
            }
            outputPath = path.join(slugDir, 'index.html');
            console.log(`✅ Generated: ${data.slug}/index.html (accessible as /${data.slug}/)`);
        } else {
            // Default behavior: create filename.html
            outputPath = path.join(OUTPUT_DIR, `${filename}.html`);
            console.log(`✅ Generated: ${filename}.html`);
        }
        
        // Write the HTML file
        fs.writeFileSync(outputPath, output);
        
        return outputPath;
        
    } catch (error) {
        console.error(`❌ Error processing ${filePath}:`, error.message);
    }
}

// Process all markdown files in the content directory
function buildAll() {
    console.log('🔨 Building site...\n');
    
    // Copy static files first
    console.log('📋 Copying static files...');
    copyStaticFiles();
    console.log('✅ Static files copied\n');

    // Blog (content/blog/*.md -> /blog/ archive + /blog/<slug>/ posts)
    const posts = buildBlogContent();

    buildSitemap(posts);
    buildRobots();

    if (!fs.existsSync(CONTENT_DIR)) {
        console.log('⚠️  No content directory found. Creating one...');
        fs.mkdirSync(CONTENT_DIR, { recursive: true });
        console.log('\n✨ Build complete!\n');
        return;
    }
    
    const files = fs.readdirSync(CONTENT_DIR);
    const markdownFiles = files.filter(file => file.endsWith('.md'));
    
    if (markdownFiles.length === 0) {
        console.log('⚠️  No markdown files found in content/ directory.');
        console.log('Create a .md file in the content/ folder to get started!');
        console.log('\n✨ Build complete!\n');
        return;
    }
    
    console.log('📝 Processing markdown files...');
    markdownFiles.forEach(file => {
        const filePath = path.join(CONTENT_DIR, file);
        convertMarkdownToHTML(filePath);
    });
    
    console.log(`\n✨ Build complete! Processed ${markdownFiles.length} markdown file(s).\n`);
}

// Watch mode
function watchMode() {
    console.log('👀 Watching for changes in content/ directory...\n');
    buildAll();
    
    const watcher = chokidar.watch(path.join(CONTENT_DIR, '*.md'), {
        persistent: true,
        ignoreInitial: true
    });
    
    watcher
        .on('add', filePath => {
            console.log(`\n📝 New file detected: ${path.basename(filePath)}`);
            convertMarkdownToHTML(filePath);
        })
        .on('change', filePath => {
            console.log(`\n📝 File changed: ${path.basename(filePath)}`);
            convertMarkdownToHTML(filePath);
        })
        .on('unlink', filePath => {
            const filename = path.basename(filePath, '.md');
            
            // Try to read the file's frontmatter to check for custom slug
            // (This won't work if file is already deleted, but try anyway)
            let customSlug = null;
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const { data } = matter(content);
                customSlug = data.slug;
            } catch (e) {
                // File already deleted, check both possible paths
            }
            
            if (customSlug) {
                const slugDir = path.join(OUTPUT_DIR, customSlug);
                if (fs.existsSync(slugDir)) {
                    fs.rmSync(slugDir, { recursive: true });
                    console.log(`\n🗑️  Removed: ${customSlug}/`);
                }
            } else {
                const outputPath = path.join(OUTPUT_DIR, `${filename}.html`);
                if (fs.existsSync(outputPath)) {
                    fs.unlinkSync(outputPath);
                    console.log(`\n🗑️  Removed: ${filename}.html`);
                }
            }
        });

    const blogWatcher = chokidar.watch(path.join(BLOG_CONTENT_DIR, '*.md'), {
        persistent: true,
        ignoreInitial: true
    });

    // Any post's read time, and the archive's "Latest" card and pagination,
    // can shift when any post is added, edited, or removed — a full blog
    // rebuild is simplest and correct on every change.
    blogWatcher
        .on('add', filePath => {
            console.log(`\n📝 New blog post detected: ${path.basename(filePath)}`);
            buildBlogContent();
        })
        .on('change', filePath => {
            console.log(`\n📝 Blog post changed: ${path.basename(filePath)}`);
            buildBlogContent();
        })
        .on('unlink', filePath => {
            console.log(`\n🗑️  Blog post removed: ${path.basename(filePath)}`);
            buildBlogContent();
        });

    console.log('Press Ctrl+C to stop watching.\n');
}

// Main execution
const args = process.argv.slice(2);
if (args.includes('--watch') || args.includes('-w')) {
    watchMode();
} else {
    buildAll();
}
