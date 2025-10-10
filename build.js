const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const matter = require('gray-matter');
const chokidar = require('chokidar');

// Configuration
const CONTENT_DIR = path.join(__dirname, 'content');
const OUTPUT_DIR = path.join(__dirname, 'dist');
const TEMPLATE_PATH = path.join(__dirname, 'src/templates/page-template.html');
const SRC_DIR = path.join(__dirname, 'src');
const COMPONENTS_DIR = path.join(__dirname, 'src/components');

// Ensure content directory exists
if (!fs.existsSync(CONTENT_DIR)) {
    fs.mkdirSync(CONTENT_DIR, { recursive: true });
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
        title = 'Momora - Remember the chaos before it\'s gone',
        description = 'Made by tired parents, for tired parents. The simplest way to save everyday moments before they slip away.',
        activeFaq = '',
        extraCss = '',
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
        .replace(/\{\{EXTRA_CSS\}\}/g, extraCss)
        .replace(/\{\{EXTRA_SCRIPTS\}\}/g, extraScripts);
    
    return output;
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
                    title: 'Momora - Remember the chaos before it\'s gone',
                    description: 'Made by tired parents, for tired parents. The simplest way to save everyday moments before they slip away. No guilt, no glitter pens required.',
                    activeFaq: '',
                    extraCss: '',
                    extraScripts: ''
                };
            } else if (filename === 'faq') {
                options = {
                    title: 'FAQ - Momora Family Memory Journal',
                    description: 'Frequently asked questions about Momora plans, credits, and features.',
                    activeFaq: ' active',
                    extraCss: '<link rel="stylesheet" href="/css/faq-styles.css">',
                    extraScripts: '<script src="/js/faq-script.js"></script>'
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
        output = injectComponents(output, {
            title: data.title || 'Momora',
            description: data.description || 'Capture the moments you\'ll wish you could relive',
            activeFaq: '',
            extraCss: '',
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
    
    console.log('Press Ctrl+C to stop watching.\n');
}

// Main execution
const args = process.argv.slice(2);
if (args.includes('--watch') || args.includes('-w')) {
    watchMode();
} else {
    buildAll();
}

