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
    
    // Copy static pages
    const pagesDir = path.join(SRC_DIR, 'pages');
    if (fs.existsSync(pagesDir)) {
        const pageFiles = fs.readdirSync(pagesDir).filter(file => file.endsWith('.html'));
        pageFiles.forEach(file => {
            copyFile(
                path.join(pagesDir, file),
                path.join(OUTPUT_DIR, file)
            );
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
        
        // Replace placeholders in template
        let output = template
            .replace('{{TITLE}}', data.title || 'Momora')
            .replace('{{DESCRIPTION}}', data.description || 'Capture the moments you\'ll wish you could relive')
            .replace('{{CONTENT}}', htmlContent);
        
        // Generate output filename
        const filename = path.basename(filePath, '.md');
        const outputPath = path.join(OUTPUT_DIR, `${filename}.html`);
        
        // Write the HTML file
        fs.writeFileSync(outputPath, output);
        
        console.log(`✅ Generated: ${filename}.html`);
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
            const outputPath = path.join(OUTPUT_DIR, `${filename}.html`);
            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
                console.log(`\n🗑️  Removed: ${filename}.html`);
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

