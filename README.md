# Momora Marketing Website

Marketing website for Momora - the app that helps families capture and preserve precious memories.

## Markdown to HTML Workflow

This project includes a simple build system that converts Markdown files to HTML pages with your site's styling.

### Setup

1. Install dependencies:
```bash
npm install
```

### How to Use

1. **Write content in Markdown**: Create `.md` files in the `content/` folder

2. **Add frontmatter** at the top of each markdown file:
```markdown
---
title: Your Page Title
description: Your page description for SEO
slug: custom-url-path (optional)
---

# Your Content Here

Write your content in markdown...
```

**Custom URLs:** Add a `slug` field to use custom URL paths. For example:
- `slug: privacy-policy` creates `/privacy-policy/` instead of `/privacy.html`
- `slug: about-us` creates `/about-us/` instead of `/about.html`
- Without a `slug` field, pages default to `filename.html`

3. **Build HTML files**:
```bash
npm run build
```

This will generate HTML files in the `dist/` directory (e.g., `content/privacy.md` → `dist/privacy.html`)

4. **Watch for changes** (auto-rebuild on file changes):
```bash
npm run build:watch
```

### Examples

Check out the example files in the `content/` folder:
- `privacy.md` - Privacy policy example
- `terms.md` - Terms of service example
- `blog-example.md` - Blog post example

### File Structure

```
momora-marketing/
├── src/                  # Source files
│   ├── css/             # Stylesheets (styles.css, faq-styles.css)
│   ├── js/              # JavaScript files (script.js, faq-script.js)
│   ├── templates/       # HTML template (page-template.html)
│   └── pages/           # Static HTML pages (index.html, faq.html)
├── content/             # Your markdown files go here
│   ├── privacy.md
│   ├── terms.md
│   └── blog-post.md
├── assets/              # Images and other assets
├── dist/                # Build output (deployment-ready)
├── build.js             # Build script
└── package.json
```

### Customizing the Template

Edit `src/templates/page-template.html` to change:
- Header navigation
- Footer content
- Page layout
- Additional styles

### Markdown Syntax Support

The build system supports:
- Headings (`# H1`, `## H2`, etc.)
- **Bold** and *italic* text
- Links `[text](url)`
- Lists (ordered and unordered)
- Blockquotes
- Code blocks
- Tables
- Images
- And more!

### Deployment

#### GitHub Pages (Recommended)

This site is configured for easy deployment to GitHub Pages:

1. **Initial Setup** (one-time):
   - Go to https://github.com/eduardoyi/momora-marketing/settings/pages
   - Under "Build and deployment":
     - Set **Source** to "Deploy from a branch"
     - Set **Branch** to `gh-pages`
     - Set **Folder** to `/ (root)`
   - Click **Save**

2. **Deploy Updates**:
   ```bash
   npm run deploy
   ```
   
   This single command will:
   - Build your site from source files
   - Deploy to the `gh-pages` branch
   - Trigger GitHub Pages to update your live site
   
3. **Live Site**: https://eduardoyi.github.io/momora-marketing/

#### Other Hosting Providers

After building with `npm run build`, deploy the entire `dist/` directory to your hosting provider. It contains all the necessary HTML, CSS, JS, and assets.

## Repository

GitHub: https://github.com/eduardoyi/momora-marketing

## Contact

For questions or support: hello@usemomora.com

