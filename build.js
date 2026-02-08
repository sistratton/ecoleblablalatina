const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

const CONTENT_DIR = path.join(__dirname, 'content', 'blog');
const BLOG_DIR = path.join(__dirname, 'blog');
const INDEX_PATH = path.join(__dirname, 'index.html');
const SITEMAP_PATH = path.join(__dirname, 'sitemap.xml');
const SITE_URL = 'https://ecoleblablalatina.pages.dev';

const START_MARKER = '<!-- BLOG-CARDS-START -->';
const END_MARKER = '<!-- BLOG-CARDS-END -->';

// --- Read and parse all markdown files ---
const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));

if (files.length === 0) {
  console.log('No blog posts found in content/blog/');
  process.exit(0);
}

const posts = files.map(file => {
  const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
  const { data, content } = matter(raw);

  // Validate required fields
  const required = ['title', 'titleEn', 'date', 'slug', 'excerpt', 'excerptEn', 'image', 'imageAlt', 'metaDescription', 'breadcrumbFr', 'breadcrumbEn'];
  for (const field of required) {
    if (!data[field]) {
      console.error(`ERROR: Missing required field "${field}" in ${file}`);
      process.exit(1);
    }
  }

  // Split FR / EN content on ---EN--- marker
  const parts = content.split('---EN---');
  const contentFr = marked.parse(parts[0].trim());
  const contentEn = parts[1] ? marked.parse(parts[1].trim()) : '';

  return { ...data, contentFr, contentEn, file };
});

// Check for duplicate slugs
const slugs = posts.map(p => p.slug);
const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i);
if (dupes.length > 0) {
  console.error(`ERROR: Duplicate slugs found: ${dupes.join(', ')}`);
  process.exit(1);
}

// Sort by date, newest first
posts.sort((a, b) => new Date(b.date) - new Date(a.date));

// Ensure blog/ directory exists
if (!fs.existsSync(BLOG_DIR)) {
  fs.mkdirSync(BLOG_DIR, { recursive: true });
}

// --- Generate each blog post HTML ---
posts.forEach((post, index) => {
  const related = posts.filter((_, i) => i !== index).slice(0, 2);
  const html = buildBlogPageHtml(post, related);
  fs.writeFileSync(path.join(BLOG_DIR, `${post.slug}.html`), html, 'utf8');
});

// --- Inject blog cards into index.html ---
const indexHtml = fs.readFileSync(INDEX_PATH, 'utf8');

if (!indexHtml.includes(START_MARKER) || !indexHtml.includes(END_MARKER)) {
  console.error('ERROR: Blog card markers not found in index.html');
  console.error(`Expected: ${START_MARKER} and ${END_MARKER}`);
  process.exit(1);
}

const cardsHtml = posts.map(post => buildBlogCardHtml(post)).join('\n        ');
const markerRegex = new RegExp(
  escapeRegex(START_MARKER) + '[\\s\\S]*?' + escapeRegex(END_MARKER)
);
const updatedIndex = indexHtml.replace(
  markerRegex,
  `${START_MARKER}\n        ${cardsHtml}\n        ${END_MARKER}`
);
fs.writeFileSync(INDEX_PATH, updatedIndex, 'utf8');

// --- Generate sitemap.xml ---
const sitemapXml = buildSitemapXml(posts);
fs.writeFileSync(SITEMAP_PATH, sitemapXml, 'utf8');

console.log(`Built ${posts.length} blog posts successfully.`);

// ============================================================
// Template functions
// ============================================================

function buildBlogPageHtml(post, relatedPosts) {
  const ctaTitleFr = post.ctaTitle || 'Intéressé(e) par nos cours ?';
  const ctaTitleEn = post.ctaTitleEn || 'Interested in our courses?';
  const ctaTextFr = post.ctaText || "Contactez-nous pour plus d'informations.";
  const ctaTextEn = post.ctaTextEn || 'Contact us for more information.';
  const dateISO = new Date(post.date).toISOString().split('T')[0];

  const relatedHtml = relatedPosts.map(r => `
        <a href="${r.slug}.html" class="related-post-link">
          <span data-lang="fr">${r.title}</span>
          <span data-lang="en">${r.titleEn}</span>
        </a>`).join('');

  return `<!DOCTYPE html>
<html lang="fr" class="lang-fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(post.title)} | École Blabla Latina, Pézenas</title>
  <meta name="description" content="${escapeHtml(post.metaDescription)}">
  <link rel="canonical" href="${SITE_URL}/blog/${post.slug}.html">
  <meta property="og:title" content="${escapeHtml(post.title)} – École Blabla Latina">
  <meta property="og:description" content="${escapeHtml(post.metaDescription)}">
  <meta property="og:type" content="article">
  <meta property="og:image" content="${SITE_URL}/images/${post.image}">
  <meta property="og:url" content="${SITE_URL}/blog/${post.slug}.html">
  <link rel="icon" type="image/png" href="../images/logo.png">
  <link rel="stylesheet" href="../css/style.css">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "${escapeJsonString(post.title)}",
    "datePublished": "${dateISO}",
    "author": {"@type": "Person", "name": "Camille Farion"},
    "publisher": {"@type": "Organization", "name": "École Blabla Latina"},
    "description": "${escapeJsonString(post.metaDescription)}",
    "image": "${SITE_URL}/images/${post.image}"
  }
  </script>
</head>
<body class="blog-page">

  <header class="header" id="header">
    <div class="header-inner">
      <a href="../index.html" class="logo">
        <img src="../images/logo.png" alt="Logo École Blabla Latina" width="48" height="48">
        <span class="logo-text">Blabla Latina</span>
      </a>
      <button class="nav-toggle" id="nav-toggle" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>
      <nav class="nav" id="nav">
        <a href="../index.html#accueil"><span data-lang="fr">Accueil</span><span data-lang="en">Home</span></a>
        <a href="../index.html#cours"><span data-lang="fr">Cours</span><span data-lang="en">Courses</span></a>
        <a href="../index.html#a-propos"><span data-lang="fr">À propos</span><span data-lang="en">About</span></a>
        <a href="../index.html#avis"><span data-lang="fr">Avis</span><span data-lang="en">Reviews</span></a>
        <a href="../index.html#blog">Blog</a>
        <a href="../index.html#contact">Contact</a>
      </nav>
      <div class="lang-switch">
        <button onclick="toggleLanguage('fr')" class="lang-btn" aria-label="Français" title="Français">
          <img src="../images/flag-france.png" alt="FR" width="28" height="28">
        </button>
        <button onclick="toggleLanguage('en')" class="lang-btn" aria-label="English" title="English">
          <img src="../images/flag-uk.png" alt="EN" width="28" height="28">
        </button>
      </div>
    </div>
  </header>

  <main class="blog-article">
    <div class="breadcrumb">
      <a href="../index.html"><span data-lang="fr">Accueil</span><span data-lang="en">Home</span></a> &gt;
      <a href="../index.html#blog">Blog</a> &gt;
      <span data-lang="fr">${post.breadcrumbFr}</span>
      <span data-lang="en">${post.breadcrumbEn}</span>
    </div>

    <h1>
      <span data-lang="fr">${post.title}</span>
      <span data-lang="en">${post.titleEn}</span>
    </h1>

    <img src="../images/${post.image}" alt="${escapeHtml(post.imageAlt)}" class="blog-hero-image" loading="lazy">

    <div data-lang="fr">
      ${post.contentFr}
    </div>

    <div data-lang="en">
      ${post.contentEn}
    </div>

    <div class="blog-cta">
      <h3>
        <span data-lang="fr">${ctaTitleFr}</span>
        <span data-lang="en">${ctaTitleEn}</span>
      </h3>
      <p>
        <span data-lang="fr">${ctaTextFr}</span>
        <span data-lang="en">${ctaTextEn}</span>
      </p>
      <a href="../index.html#contact" class="btn btn-primary">
        <span data-lang="fr">Contactez-nous</span>
        <span data-lang="en">Contact Us</span>
      </a>
    </div>

    <div class="related-posts">
      <h3>
        <span data-lang="fr">Autres articles</span>
        <span data-lang="en">Other articles</span>
      </h3>
      <div class="related-posts-grid">${relatedHtml}
      </div>
    </div>
  </main>

  <footer class="footer">
    <div class="container">
      <div class="footer-bottom">
        <p>&copy; 2025 École Blabla Latina. <span data-lang="fr">Tous droits réservés.</span><span data-lang="en">All rights reserved.</span></p>
        <a href="../index.html" style="color: rgba(255,255,255,0.7);">
          <span data-lang="fr">Retour à l'accueil</span>
          <span data-lang="en">Back to home</span>
        </a>
      </div>
    </div>
  </footer>

  <script src="../js/main.js"></script>
</body>
</html>`;
}

function buildBlogCardHtml(post) {
  return `<article class="blog-card">
          <img src="images/${post.image}" alt="${escapeHtml(post.imageAlt)}" loading="lazy">
          <h3>
            <span data-lang="fr">${post.title}</span>
            <span data-lang="en">${post.titleEn}</span>
          </h3>
          <p>
            <span data-lang="fr">${post.excerpt}</span>
            <span data-lang="en">${post.excerptEn}</span>
          </p>
          <a href="blog/${post.slug}.html" class="btn btn-outline">
            <span data-lang="fr">Lire la suite</span>
            <span data-lang="en">Read more</span>
          </a>
        </article>`;
}

function buildSitemapXml(posts) {
  const blogEntries = posts.map(post => `  <url>
    <loc>${SITE_URL}/blog/${post.slug}.html</loc>
    <lastmod>${new Date(post.date).toISOString().split('T')[0]}</lastmod>
    <priority>0.8</priority>
    <changefreq>monthly</changefreq>
  </url>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <priority>1.0</priority>
    <changefreq>weekly</changefreq>
  </url>
${blogEntries}
</urlset>
`;
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
