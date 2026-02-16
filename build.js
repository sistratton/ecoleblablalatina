const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

const CONTENT_DIR = path.join(__dirname, 'content', 'blog');
const BLOG_DIR = path.join(__dirname, 'blog');
const TEMPLATE_PATH = path.join(__dirname, 'index.template.html');
const INDEX_PATH = path.join(__dirname, 'index.html');
const TEXT_PATH = path.join(__dirname, 'content', 'text.json');
const SITEMAP_PATH = path.join(__dirname, 'sitemap.xml');
const SITE_URL = 'https://ecoleblablalatina.com';

const START_MARKER = '<!-- BLOG-CARDS-START -->';
const END_MARKER = '<!-- BLOG-CARDS-END -->';

// --- Load text content ---
const text = JSON.parse(fs.readFileSync(TEXT_PATH, 'utf8'));

// ============================================================
// Template engine
// ============================================================

function resolve(obj, keyPath) {
  return keyPath.split('.').reduce(function(o, k) {
    return o != null ? o[k] : undefined;
  }, obj);
}

function isBilingual(val) {
  return val != null && typeof val === 'object' && !Array.isArray(val) && 'fr' in val && 'en' in val;
}

function expandBilingual(val, tag) {
  if (!isBilingual(val)) return String(val != null ? val : '');
  return '<' + tag + ' data-lang="fr">' + val.fr + '</' + tag + '>' +
         '<' + tag + ' data-lang="en">' + val.en + '</' + tag + '>';
}

function expandTemplate(template, data) {
  var result = template;

  // 1. Process {{#each key}}...{{/each}} blocks
  result = result.replace(/\{\{#each\s+([\w.]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, function(_, key, body) {
    var arr = resolve(data, key);
    if (!Array.isArray(arr)) return '';
    return arr.map(function(item) {
      // Create a context where "this" fields resolve to item properties
      var expanded = body;

      // Handle {{raw:this.field}}
      expanded = expanded.replace(/\{\{raw:this\.([\w.]+)\}\}/g, function(_, field) {
        var val = resolve(item, field);
        return val != null ? String(val) : '';
      });

      // Handle {{p:this.field}}
      expanded = expanded.replace(/\{\{p:this\.([\w.]+)\}\}/g, function(_, field) {
        var val = resolve(item, field);
        return expandBilingual(val, 'p');
      });

      // Handle {{strong:this.field}}
      expanded = expanded.replace(/\{\{strong:this\.([\w.]+)\}\}/g, function(_, field) {
        var val = resolve(item, field);
        return expandBilingual(val, 'strong');
      });

      // Handle {{this.field}} (bilingual spans)
      expanded = expanded.replace(/\{\{this\.([\w.]+)\}\}/g, function(_, field) {
        var val = resolve(item, field);
        return expandBilingual(val, 'span');
      });

      return expanded;
    }).join('');
  });

  // 2. Process {{p:key}} → bilingual <p> tags
  result = result.replace(/\{\{p:([\w.]+)\}\}/g, function(_, key) {
    var val = resolve(data, key);
    return expandBilingual(val, 'p');
  });

  // 3. Process {{div:key}} → bilingual <div> tags
  result = result.replace(/\{\{div:([\w.]+)\}\}/g, function(_, key) {
    var val = resolve(data, key);
    return expandBilingual(val, 'div');
  });

  // 4. Process {{strong:key}} → bilingual <strong> tags
  result = result.replace(/\{\{strong:([\w.]+)\}\}/g, function(_, key) {
    var val = resolve(data, key);
    return expandBilingual(val, 'strong');
  });

  // 5. Process {{fr:key}} → just the FR value
  result = result.replace(/\{\{fr:([\w.]+)\}\}/g, function(_, key) {
    var val = resolve(data, key);
    if (isBilingual(val)) return val.fr;
    return val != null ? String(val) : '';
  });

  // 6. Process {{en:key}} → just the EN value
  result = result.replace(/\{\{en:([\w.]+)\}\}/g, function(_, key) {
    var val = resolve(data, key);
    if (isBilingual(val)) return val.en;
    return val != null ? String(val) : '';
  });

  // 7. Process {{raw:key}} → raw value
  result = result.replace(/\{\{raw:([\w.]+)\}\}/g, function(_, key) {
    var val = resolve(data, key);
    return val != null ? String(val) : '';
  });

  // 8. Process {{jsText}} → inject JS text object
  result = result.replace(/\{\{jsText\}\}/g, function() {
    return JSON.stringify(data.js || {});
  });

  // 9. Process {{key}} → bilingual <span> tags (default)
  result = result.replace(/\{\{([\w.]+)\}\}/g, function(_, key) {
    var val = resolve(data, key);
    return expandBilingual(val, 'span');
  });

  return result;
}

// --- Build index.html from template ---
var templateHtml = fs.readFileSync(TEMPLATE_PATH, 'utf8');
var indexHtml = expandTemplate(templateHtml, text);

// --- Read and parse all markdown files ---
var files = fs.readdirSync(CONTENT_DIR).filter(function(f) { return f.endsWith('.md'); });

if (files.length === 0) {
  console.log('No blog posts found in content/blog/');
  fs.writeFileSync(INDEX_PATH, indexHtml, 'utf8');
  console.log('Built index.html from template.');
  process.exit(0);
}

var posts = files.map(function(file) {
  var raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
  var parsed = matter(raw);
  var data = parsed.data;
  var content = parsed.content;

  // Validate required fields
  var required = ['title', 'titleEn', 'date', 'slug', 'excerpt', 'excerptEn', 'image', 'imageAlt', 'metaDescription', 'breadcrumbFr', 'breadcrumbEn'];
  for (var i = 0; i < required.length; i++) {
    if (!data[required[i]]) {
      console.error('ERROR: Missing required field "' + required[i] + '" in ' + file);
      process.exit(1);
    }
  }

  // Split FR / EN content on ---EN--- marker
  var parts = content.split('---EN---');
  var contentFr = marked.parse(parts[0].trim());
  var contentEn = parts[1] ? marked.parse(parts[1].trim()) : '';

  var result = {};
  for (var key in data) { result[key] = data[key]; }
  result.contentFr = contentFr;
  result.contentEn = contentEn;
  result.file = file;
  return result;
});

// Check for duplicate slugs
var slugs = posts.map(function(p) { return p.slug; });
var dupes = slugs.filter(function(s, i) { return slugs.indexOf(s) !== i; });
if (dupes.length > 0) {
  console.error('ERROR: Duplicate slugs found: ' + dupes.join(', '));
  process.exit(1);
}

// Sort by date, newest first
posts.sort(function(a, b) { return new Date(b.date) - new Date(a.date); });

// Ensure blog/ directory exists
if (!fs.existsSync(BLOG_DIR)) {
  fs.mkdirSync(BLOG_DIR, { recursive: true });
}

// --- Generate each blog post HTML ---
posts.forEach(function(post, index) {
  var related = posts.filter(function(_, i) { return i !== index; }).slice(0, 2);
  var html = buildBlogPageHtml(post, related);
  fs.writeFileSync(path.join(BLOG_DIR, post.slug + '.html'), html, 'utf8');
});

// --- Inject blog cards into index.html ---
if (!indexHtml.includes(START_MARKER) || !indexHtml.includes(END_MARKER)) {
  console.error('ERROR: Blog card markers not found in index.html');
  console.error('Expected: ' + START_MARKER + ' and ' + END_MARKER);
  process.exit(1);
}

var cardsHtml = posts.map(function(post) { return buildBlogCardHtml(post); }).join('\n        ');
var markerRegex = new RegExp(
  escapeRegex(START_MARKER) + '[\\s\\S]*?' + escapeRegex(END_MARKER)
);
indexHtml = indexHtml.replace(
  markerRegex,
  START_MARKER + '\n        ' + cardsHtml + '\n        ' + END_MARKER
);
fs.writeFileSync(INDEX_PATH, indexHtml, 'utf8');

// --- Generate sitemap.xml ---
var sitemapXml = buildSitemapXml(posts);
fs.writeFileSync(SITEMAP_PATH, sitemapXml, 'utf8');

console.log('Built index.html from template + ' + posts.length + ' blog posts successfully.');

// ============================================================
// Template functions
// ============================================================

function buildBlogPageHtml(post, relatedPosts) {
  var t = text.blog || {};
  var nav = text.nav || {};
  var ctaTitleFr = post.ctaTitle || t.defaultCtaTitle.fr;
  var ctaTitleEn = post.ctaTitleEn || t.defaultCtaTitle.en;
  var ctaTextFr = post.ctaText || t.defaultCtaText.fr;
  var ctaTextEn = post.ctaTextEn || t.defaultCtaText.en;
  var dateISO = new Date(post.date).toISOString().split('T')[0];
  var copyrightFr = t.copyright ? t.copyright.fr : 'Tous droits réservés.';
  var copyrightEn = t.copyright ? t.copyright.en : 'All rights reserved.';

  var relatedHtml = relatedPosts.map(function(r) {
    return '\n        <a href="' + r.slug + '.html" class="related-post-link">' +
      '\n          <span data-lang="fr">' + r.title + '</span>' +
      '\n          <span data-lang="en">' + r.titleEn + '</span>' +
      '\n        </a>';
  }).join('');

  return '<!DOCTYPE html>\n' +
'<html lang="fr" class="lang-fr">\n' +
'<head>\n' +
'  <meta charset="UTF-8">\n' +
'  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
'  <title>' + escapeHtml(post.title) + ' | École Blabla Latina, Pézenas</title>\n' +
'  <meta name="description" content="' + escapeHtml(post.metaDescription) + '">\n' +
'  <link rel="canonical" href="' + SITE_URL + '/blog/' + post.slug + '.html">\n' +
'  <meta property="og:title" content="' + escapeHtml(post.title) + ' – École Blabla Latina">\n' +
'  <meta property="og:description" content="' + escapeHtml(post.metaDescription) + '">\n' +
'  <meta property="og:type" content="article">\n' +
'  <meta property="og:image" content="' + SITE_URL + '/images/' + post.image + '">\n' +
'  <meta property="og:url" content="' + SITE_URL + '/blog/' + post.slug + '.html">\n' +
'  <link rel="icon" type="image/png" href="../images/logo.png">\n' +
'  <link rel="stylesheet" href="../css/style.css">\n' +
'  <script type="application/ld+json">\n' +
'  {\n' +
'    "@context": "https://schema.org",\n' +
'    "@type": "BlogPosting",\n' +
'    "headline": "' + escapeJsonString(post.title) + '",\n' +
'    "datePublished": "' + dateISO + '",\n' +
'    "author": {"@type": "Person", "name": "Camille Farion"},\n' +
'    "publisher": {"@type": "Organization", "name": "École Blabla Latina"},\n' +
'    "description": "' + escapeJsonString(post.metaDescription) + '",\n' +
'    "image": "' + SITE_URL + '/images/' + post.image + '"\n' +
'  }\n' +
'  </script>\n' +
'</head>\n' +
'<body class="blog-page">\n' +
'\n' +
'  <header class="header" id="header">\n' +
'    <div class="header-inner">\n' +
'      <a href="../index.html" class="logo">\n' +
'        <img src="../images/logo.png" alt="Logo École Blabla Latina" width="48" height="48">\n' +
'        <span class="logo-text">Blabla Latina</span>\n' +
'      </a>\n' +
'      <button class="nav-toggle" id="nav-toggle" aria-label="Menu">\n' +
'        <span></span><span></span><span></span>\n' +
'      </button>\n' +
'      <nav class="nav" id="nav">\n' +
'        <a href="../index.html#accueil"><span data-lang="fr">' + nav.home.fr + '</span><span data-lang="en">' + nav.home.en + '</span></a>\n' +
'        <a href="../index.html#cours"><span data-lang="fr">' + nav.courses.fr + '</span><span data-lang="en">' + nav.courses.en + '</span></a>\n' +
'        <a href="../index.html#a-propos"><span data-lang="fr">' + nav.about.fr + '</span><span data-lang="en">' + nav.about.en + '</span></a>\n' +
'        <a href="../index.html#avis"><span data-lang="fr">' + nav.reviews.fr + '</span><span data-lang="en">' + nav.reviews.en + '</span></a>\n' +
'        <a href="../index.html#blog">Blog</a>\n' +
'        <a href="../index.html#contact">Contact</a>\n' +
'      </nav>\n' +
'      <div class="lang-switch">\n' +
'        <button onclick="toggleLanguage(\'fr\')" class="lang-btn" aria-label="Français" title="Français">\n' +
'          <img src="../images/flag-france.png" alt="FR" width="28" height="28">\n' +
'        </button>\n' +
'        <button onclick="toggleLanguage(\'en\')" class="lang-btn" aria-label="English" title="English">\n' +
'          <img src="../images/flag-uk.png" alt="EN" width="28" height="28">\n' +
'        </button>\n' +
'      </div>\n' +
'    </div>\n' +
'  </header>\n' +
'\n' +
'  <main class="blog-article">\n' +
'    <div class="breadcrumb">\n' +
'      <a href="../index.html"><span data-lang="fr">' + nav.home.fr + '</span><span data-lang="en">' + nav.home.en + '</span></a> &gt;\n' +
'      <a href="../index.html#blog">Blog</a> &gt;\n' +
'      <span data-lang="fr">' + post.breadcrumbFr + '</span>\n' +
'      <span data-lang="en">' + post.breadcrumbEn + '</span>\n' +
'    </div>\n' +
'\n' +
'    <h1>\n' +
'      <span data-lang="fr">' + post.title + '</span>\n' +
'      <span data-lang="en">' + post.titleEn + '</span>\n' +
'    </h1>\n' +
'\n' +
'    <img src="../images/' + post.image + '" alt="' + escapeHtml(post.imageAlt) + '" class="blog-hero-image" loading="lazy">\n' +
'\n' +
'    <div data-lang="fr">\n' +
'      ' + post.contentFr + '\n' +
'    </div>\n' +
'\n' +
'    <div data-lang="en">\n' +
'      ' + post.contentEn + '\n' +
'    </div>\n' +
'\n' +
'    <div class="blog-cta">\n' +
'      <h3>\n' +
'        <span data-lang="fr">' + ctaTitleFr + '</span>\n' +
'        <span data-lang="en">' + ctaTitleEn + '</span>\n' +
'      </h3>\n' +
'      <p>\n' +
'        <span data-lang="fr">' + ctaTextFr + '</span>\n' +
'        <span data-lang="en">' + ctaTextEn + '</span>\n' +
'      </p>\n' +
'      <a href="../index.html#contact" class="btn btn-primary">\n' +
'        <span data-lang="fr">' + t.contactUs.fr + '</span>\n' +
'        <span data-lang="en">' + t.contactUs.en + '</span>\n' +
'      </a>\n' +
'    </div>\n' +
'\n' +
'    <div class="related-posts">\n' +
'      <h3>\n' +
'        <span data-lang="fr">' + t.otherArticles.fr + '</span>\n' +
'        <span data-lang="en">' + t.otherArticles.en + '</span>\n' +
'      </h3>\n' +
'      <div class="related-posts-grid">' + relatedHtml + '\n' +
'      </div>\n' +
'    </div>\n' +
'  </main>\n' +
'\n' +
'  <footer class="footer">\n' +
'    <div class="container">\n' +
'      <div class="footer-bottom">\n' +
'        <p>&copy; 2025 École Blabla Latina. <span data-lang="fr">' + copyrightFr + '</span><span data-lang="en">' + copyrightEn + '</span></p>\n' +
'        <a href="../index.html" style="color: rgba(255,255,255,0.7);">\n' +
'          <span data-lang="fr">' + t.backToHome.fr + '</span>\n' +
'          <span data-lang="en">' + t.backToHome.en + '</span>\n' +
'        </a>\n' +
'      </div>\n' +
'    </div>\n' +
'  </footer>\n' +
'\n' +
'  <script>window.__TEXT__ = ' + JSON.stringify(text.js || {}) + ';</script>\n' +
'  <script src="../js/main.js"></script>\n' +
'</body>\n' +
'</html>';
}

function buildBlogCardHtml(post) {
  var t = text.blog || {};
  return '<article class="blog-card">\n' +
'          <img src="images/' + post.image + '" alt="' + escapeHtml(post.imageAlt) + '" loading="lazy">\n' +
'          <h3>\n' +
'            <span data-lang="fr">' + post.title + '</span>\n' +
'            <span data-lang="en">' + post.titleEn + '</span>\n' +
'          </h3>\n' +
'          <p>\n' +
'            <span data-lang="fr">' + post.excerpt + '</span>\n' +
'            <span data-lang="en">' + post.excerptEn + '</span>\n' +
'          </p>\n' +
'          <a href="blog/' + post.slug + '.html" class="btn btn-outline">\n' +
'            <span data-lang="fr">' + t.readMore.fr + '</span>\n' +
'            <span data-lang="en">' + t.readMore.en + '</span>\n' +
'          </a>\n' +
'        </article>';
}

function buildSitemapXml(posts) {
  var blogEntries = posts.map(function(post) {
    return '  <url>\n' +
'    <loc>' + SITE_URL + '/blog/' + post.slug + '.html</loc>\n' +
'    <lastmod>' + new Date(post.date).toISOString().split('T')[0] + '</lastmod>\n' +
'    <priority>0.8</priority>\n' +
'    <changefreq>monthly</changefreq>\n' +
'  </url>';
  }).join('\n');

  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
'  <url>\n' +
'    <loc>' + SITE_URL + '/</loc>\n' +
'    <priority>1.0</priority>\n' +
'    <changefreq>weekly</changefreq>\n' +
'  </url>\n' +
blogEntries + '\n' +
'</urlset>\n';
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeJsonString(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}
