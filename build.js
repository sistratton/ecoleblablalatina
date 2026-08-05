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
const COURSES_DIR = path.join(__dirname, 'cours');
var COURSE_KEYS = ['spanish', 'italian', 'french', 'soutien'];

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

var LANGS = ['fr', 'en', 'es', 'it'];

function isMultilingual(val) {
  return val != null && typeof val === 'object' && !Array.isArray(val) && 'fr' in val;
}

function expandMultilingual(val, tag) {
  if (!isMultilingual(val)) return String(val != null ? val : '');
  return LANGS.map(function(lang) {
    var text = val[lang];
    return text != null ? '<' + tag + ' data-lang="' + lang + '">' + text + '</' + tag + '>' : '';
  }).join('');
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
        return expandMultilingual(val, 'p');
      });

      // Handle {{strong:this.field}}
      expanded = expanded.replace(/\{\{strong:this\.([\w.]+)\}\}/g, function(_, field) {
        var val = resolve(item, field);
        return expandMultilingual(val, 'strong');
      });

      // Handle {{this.field}} (bilingual spans)
      expanded = expanded.replace(/\{\{this\.([\w.]+)\}\}/g, function(_, field) {
        var val = resolve(item, field);
        return expandMultilingual(val, 'span');
      });

      return expanded;
    }).join('');
  });

  // 2. Process {{p:key}} → bilingual <p> tags
  result = result.replace(/\{\{p:([\w.]+)\}\}/g, function(_, key) {
    var val = resolve(data, key);
    return expandMultilingual(val, 'p');
  });

  // 3. Process {{div:key}} → bilingual <div> tags
  result = result.replace(/\{\{div:([\w.]+)\}\}/g, function(_, key) {
    var val = resolve(data, key);
    return expandMultilingual(val, 'div');
  });

  // 4. Process {{strong:key}} → bilingual <strong> tags
  result = result.replace(/\{\{strong:([\w.]+)\}\}/g, function(_, key) {
    var val = resolve(data, key);
    return expandMultilingual(val, 'strong');
  });

  // 5-6. Process {{fr:key}}, {{en:key}}, {{es:key}}, {{it:key}} → just that language's value
  LANGS.forEach(function(lang) {
    result = result.replace(new RegExp('\\{\\{' + lang + ':([\\w.]+)\\}\\}', 'g'), function(_, key) {
      var val = resolve(data, key);
      if (isMultilingual(val)) return val[lang] || '';
      return val != null ? String(val) : '';
    });
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
    return expandMultilingual(val, 'span');
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
  var required = ['title', 'titleEn', 'titleEs', 'titleIt', 'date', 'slug', 'excerpt', 'excerptEn', 'excerptEs', 'excerptIt', 'image', 'imageAlt', 'metaDescription', 'breadcrumbFr', 'breadcrumbEn', 'breadcrumbEs', 'breadcrumbIt'];
  for (var i = 0; i < required.length; i++) {
    if (!data[required[i]]) {
      console.error('ERROR: Missing required field "' + required[i] + '" in ' + file);
      process.exit(1);
    }
  }

  // Split content on ---EN---, ---ES---, ---IT--- markers
  var partsFrEn = content.split('---EN---');
  var frContent = partsFrEn[0].trim();
  var rest = partsFrEn[1] || '';
  var partsEnEs = rest.split('---ES---');
  var enContent = partsEnEs[0].trim();
  var rest2 = partsEnEs[1] || '';
  var partsEsIt = rest2.split('---IT---');
  var esContent = partsEsIt[0].trim();
  var itContent = (partsEsIt[1] || '').trim();

  var result = {};
  for (var key in data) { result[key] = data[key]; }
  result.contentFr = marked.parse(frContent);
  result.contentEn = enContent ? marked.parse(enContent) : '';
  result.contentEs = esContent ? marked.parse(esContent) : '';
  result.contentIt = itContent ? marked.parse(itContent) : '';
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

// --- Generate course pages ---
if (!fs.existsSync(COURSES_DIR)) {
  fs.mkdirSync(COURSES_DIR, { recursive: true });
}
COURSE_KEYS.forEach(function(key) {
  if (text.coursePages && text.coursePages[key]) {
    var html = buildCoursePageHtml(key, text);
    var slug = text.coursePages[key].slug;
    fs.writeFileSync(path.join(COURSES_DIR, slug + '.html'), html, 'utf8');
  }
});

// --- Generate sitemap.xml ---
var sitemapXml = buildSitemapXml(posts);
fs.writeFileSync(SITEMAP_PATH, sitemapXml, 'utf8');

console.log('Built index.html from template + ' + posts.length + ' blog posts successfully.');

// ============================================================
// Template functions
// ============================================================

function mlSpan(obj, frKey, enKey, esKey, itKey) {
  return '<span data-lang="fr">' + (obj[frKey] || '') + '</span>' +
         '<span data-lang="en">' + (obj[enKey] || '') + '</span>' +
         '<span data-lang="es">' + (obj[esKey] || '') + '</span>' +
         '<span data-lang="it">' + (obj[itKey] || '') + '</span>';
}

function mlVal(obj, key) {
  if (!obj || !obj[key]) return '';
  var val = obj[key];
  if (isMultilingual(val)) {
    return LANGS.map(function(lang) {
      return val[lang] ? '<span data-lang="' + lang + '">' + val[lang] + '</span>' : '';
    }).join('');
  }
  return String(val);
}

function buildCoursePageHtml(courseKey, text) {
  var page = text.coursePages[courseKey];
  var shared = text.coursePages.shared;
  var course = text.courses[courseKey];
  var founder = text.founder;
  var nav = text.nav || {};
  var contact = text.contact || {};
  var t = text.blog || {};
  var slug = page.slug;

  // Helper: multilingual spans
  function ls(obj) {
    if (!obj) return '';
    return LANGS.map(function(l) {
      return obj[l] ? '<span data-lang="' + l + '">' + obj[l] + '</span>' : '';
    }).join('');
  }

  // Helper: French value only
  function fr(obj) {
    return obj && obj.fr ? obj.fr : '';
  }

  // Helper: nav spans
  function navSpans(navKey) {
    return LANGS.map(function(lang) {
      return '<span data-lang="' + lang + '">' + (nav[navKey] && nav[navKey][lang] ? nav[navKey][lang] : '') + '</span>';
    }).join('');
  }

  // Build FAQ schema
  var faqSchemaItems = (page.faq || []).map(function(item) {
    return '      {\n' +
'        "@type": "Question",\n' +
'        "name": "' + escapeJsonString(fr(item.q)) + '",\n' +
'        "acceptedAnswer": {\n' +
'          "@type": "Answer",\n' +
'          "text": "' + escapeJsonString(fr(item.a)) + '"\n' +
'        }\n' +
'      }';
  }).join(',\n');

  // Build levels HTML
  var levelsHtml = '';
  if (course.levels) {
    levelsHtml = course.levels.map(function(level) {
      return '            <div class="level-detail">\n' +
'              <h3><span class="level-code">' + escapeHtml(level.code) + '</span> ' + ls(level.name) + '</h3>\n' +
'              ' + LANGS.map(function(l) {
                return level.desc && level.desc[l] ? '<p data-lang="' + l + '">' + level.desc[l] + '</p>' : '';
              }).join('') + '\n' +
'            </div>';
    }).join('\n');
  } else if (course.content) {
    levelsHtml = '            <div class="level-detail">\n' +
'              ' + LANGS.map(function(l) {
                return course.content[l] ? '<p data-lang="' + l + '">' + course.content[l] + '</p>' : '';
              }).join('') + '\n' +
'            </div>';
  }

  // Build glossaire (benefits list)
  var glossaireHtml = '';
  if (course.glossaire && course.glossaire.length) {
    glossaireHtml = course.glossaire.map(function(item) {
      return '              <li>' + ls(item.list) + '</li>';
    }).join('\n');
  }

  // Build FAQ HTML
  var faqHtml = (page.faq || []).map(function(item, i) {
    var answerId = 'faq-answer-' + courseKey + '-' + i;
    return '          <div class="faq-item">\n' +
'            <button class="accordion-toggle" aria-expanded="false" aria-controls="' + answerId + '">\n' +
'              ' + ls(item.q) + '\n' +
'            </button>\n' +
'            <div class="accordion-content" id="' + answerId + '">\n' +
'              <div class="level">\n' +
'                ' + LANGS.map(function(l) {
                  return item.a && item.a[l] ? '<p data-lang="' + l + '">' + item.a[l] + '</p>' : '';
                }).join('') + '\n' +
'              </div>\n' +
'            </div>\n' +
'          </div>';
  }).join('\n');

  // Build formats HTML
  var formatsHtml = (text.courses.formats || []).map(function(fmt) {
    return '            <div class="format-item">\n' +
'              <span class="format-icon">' + fmt.icon + '</span>\n' +
'              ' + ls(fmt.label) + '\n' +
'            </div>';
  }).join('\n');

  // Build reviews HTML
  var reviewsHtml = '';
  if (page.reviews && page.reviews.length) {
    reviewsHtml = '\n  <section class="reviews">\n' +
'    <div class="container">\n' +
'      <h2>' + ls(text.reviews.title) + '</h2>\n' +
'      <div class="reviews-carousel">\n' +
page.reviews.map(function(r) {
  return '        <div class="review-slide">\n' +
'          <img src="../images/' + r.src + '" alt="' + escapeHtml(r.alt) + '" loading="lazy">\n' +
'        </div>';
}).join('\n') + '\n' +
'      </div>\n' +
'    </div>\n' +
'  </section>';
  }

  return '<!DOCTYPE html>\n' +
'<html lang="fr" class="lang-fr">\n' +
'<head>\n' +
'  <meta charset="UTF-8">\n' +
'  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
'  <title>' + escapeHtml(page.meta.title) + '</title>\n' +
'  <meta name="description" content="' + escapeHtml(page.meta.description) + '">\n' +
'  <meta name="keywords" content="' + escapeHtml(page.meta.keywords) + '">\n' +
'  <link rel="canonical" href="' + SITE_URL + '/cours/' + slug + '.html">\n' +
'  <meta property="og:title" content="' + escapeHtml(page.meta.title) + '">\n' +
'  <meta property="og:description" content="' + escapeHtml(page.meta.description) + '">\n' +
'  <meta property="og:type" content="website">\n' +
'  <meta property="og:image" content="' + SITE_URL + '/images/' + page.image + '">\n' +
'  <meta property="og:url" content="' + SITE_URL + '/cours/' + slug + '.html">\n' +
'  <link rel="icon" type="image/png" href="../images/logo.png">\n' +
'  <link rel="stylesheet" href="../css/style.css">\n' +
'  <script type="application/ld+json">\n' +
'  {\n' +
'    "@context": "https://schema.org",\n' +
'    "@type": "Course",\n' +
'    "name": "' + escapeJsonString(fr(page.hero.title)) + '",\n' +
'    "description": "' + escapeJsonString(page.meta.description) + '",\n' +
'    "provider": {\n' +
'      "@type": "EducationalOrganization",\n' +
'      "name": "École Blabla Latina",\n' +
'      "url": "https://ecoleblablalatina.com"\n' +
'    },\n' +
'    "url": "' + SITE_URL + '/cours/' + slug + '.html"\n' +
'  }\n' +
'  </script>\n' +
'  <script type="application/ld+json">\n' +
'  {\n' +
'    "@context": "https://schema.org",\n' +
'    "@type": "FAQPage",\n' +
'    "mainEntity": [\n' +
faqSchemaItems + '\n' +
'    ]\n' +
'  }\n' +
'  </script>\n' +
'</head>\n' +
'<body class="course-page">\n' +
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
'        <a href="../index.html#accueil">' + navSpans('home') + '</a>\n' +
'        <a href="../index.html#cours">' + navSpans('courses') + '</a>\n' +
'        <a href="../index.html#a-propos">' + navSpans('about') + '</a>\n' +
'        <a href="../index.html#avis">' + navSpans('reviews') + '</a>\n' +
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
'        <button onclick="toggleLanguage(\'es\')" class="lang-btn" aria-label="Español" title="Español">\n' +
'          <img src="../images/spanish-flag.png" alt="ES" width="28" height="28">\n' +
'        </button>\n' +
'        <button onclick="toggleLanguage(\'it\')" class="lang-btn" aria-label="Italiano" title="Italiano">\n' +
'          <img src="../images/italian-flag.png" alt="IT" width="28" height="28">\n' +
'        </button>\n' +
'      </div>\n' +
'    </div>\n' +
'  </header>\n' +
'\n' +
'  <main>\n' +
'    <div class="breadcrumb container">\n' +
'      <a href="../index.html">' + navSpans('home') + '</a> &gt;\n' +
'      <span>' + ls(shared.coursesBreadcrumb) + '</span> &gt;\n' +
'      <span>' + ls(page.hero.title) + '</span>\n' +
'    </div>\n' +
'\n' +
'    <section class="course-hero">\n' +
'      <div class="course-hero-inner">\n' +
'        <img src="../images/' + page.image + '" alt="' + escapeHtml(fr(page.imageAlt)) + '" class="course-hero-img" loading="eager">\n' +
'        <div class="course-hero-text">\n' +
'          <h1>' + ls(page.hero.title) + '</h1>\n' +
'          <p class="course-hero-subtitle">' + ls(page.hero.subtitle) + '</p>\n' +
'          <a href="#contact" class="btn btn-primary">' + ls(shared.contactBtn) + '</a>\n' +
'        </div>\n' +
'      </div>\n' +
'    </section>\n' +
'\n' +
'    <section class="course-section">\n' +
'      <div class="container">\n' +
'        <h2>' + ls(page.whyTitle) + '</h2>\n' +
'        <div class="course-desc">\n' +
'          ' + LANGS.map(function(l) {
            return course.desc && course.desc[l] ? '<p data-lang="' + l + '">' + course.desc[l] + '</p>' : '';
          }).join('') + '\n' +
'        </div>\n' +
'        <ul class="benefits-list course-benefits">\n' +
glossaireHtml + '\n' +
'        </ul>\n' +
'\n' +
'        <h2 class="levels-title">' + ls(shared.levelsTitle) + '</h2>\n' +
'        <div class="levels-detail">\n' +
levelsHtml + '\n' +
'        </div>\n' +
'\n' +
'        <div class="certif-block">\n' +
'          <h2>' + ls(page.certif.title) + '</h2>\n' +
'          <div class="certif-text">\n' +
'            ' + LANGS.map(function(l) {
              return page.certif.text && page.certif.text[l] ? '<p data-lang="' + l + '">' + page.certif.text[l] + '</p>' : '';
            }).join('') + '\n' +
'          </div>\n' +
'        </div>\n' +
'      </div>\n' +
'    </section>\n' +
'\n' +
'    <section class="course-formats-section">\n' +
'      <div class="container">\n' +
'        <h2>' + ls(shared.formatsTitle) + '</h2>\n' +
'        <div class="format-grid">\n' +
formatsHtml + '\n' +
'        </div>\n' +
'      </div>\n' +
'    </section>\n' +
'\n' +
'    <section class="faq-section">\n' +
'      <div class="container">\n' +
'        <h2>' + ls(shared.faqTitle) + '</h2>\n' +
'        <div class="faq-list">\n' +
faqHtml + '\n' +
'        </div>\n' +
'      </div>\n' +
'    </section>\n' +
'\n' +
'    <section class="about" id="a-propos">\n' +
'      <div class="container">\n' +
'        <div class="about-grid">\n' +
'          <div class="about-photo">\n' +
'            <img src="../images/camille-farion-new.jpg" alt="Camille Farion – Professeure de langues École Blabla Latina" loading="lazy">\n' +
'          </div>\n' +
'          <div class="about-text">\n' +
'            <h2>' + ls(shared.teacherTitle) + '</h2>\n' +
'            ' + LANGS.map(function(l) {
              return founder.bio1 && founder.bio1[l] ? '<p data-lang="' + l + '">' + founder.bio1[l] + '</p>' : '';
            }).join('') + '\n' +
'            ' + LANGS.map(function(l) {
              return founder.bio2 && founder.bio2[l] ? '<p data-lang="' + l + '">' + founder.bio2[l] + '</p>' : '';
            }).join('') + '\n' +
'            ' + LANGS.map(function(l) {
              return founder.bio3 && founder.bio3[l] ? '<p data-lang="' + l + '">' + founder.bio3[l] + '</p>' : '';
            }).join('') + '\n' +
'          </div>\n' +
'        </div>\n' +
'      </div>\n' +
'    </section>\n' +
reviewsHtml + '\n' +
'\n' +
'    <section class="contact" id="contact">\n' +
'      <div class="container">\n' +
'        <h2>' + ls(contact.title) + '</h2>\n' +
'        <p class="section-subtitle">' + ls(contact.subtitle) + '</p>\n' +
'        <div class="contact-grid">\n' +
'          <form action="https://api.web3forms.com/submit" method="POST" id="contact-form" class="contact-form">\n' +
'            <input type="hidden" name="access_key" value="2147f4e0-10a4-4dc8-9851-0902e217a424">\n' +
'            <input type="hidden" name="subject" value="Nouveau message depuis le site Blabla Latina">\n' +
'            <input type="checkbox" name="botcheck" style="display:none">\n' +
'            <div class="form-group">\n' +
'              <label for="name">' + ls(contact.nameLabel) + '</label>\n' +
'              <input type="text" name="name" id="name" required>\n' +
'            </div>\n' +
'            <div class="form-group">\n' +
'              <label for="email">Email</label>\n' +
'              <input type="email" name="email" id="email" required>\n' +
'            </div>\n' +
'            <div class="form-group">\n' +
'              <label for="phone">' + ls(contact.phoneLabel) + '</label>\n' +
'              <input type="tel" name="phone" id="phone">\n' +
'            </div>\n' +
'            <div class="form-group">\n' +
'              <label for="message">Message</label>\n' +
'              <textarea name="message" id="message" rows="5" required></textarea>\n' +
'            </div>\n' +
'            <button type="submit" class="btn btn-primary btn-submit">' + ls(contact.submitBtn) + '</button>\n' +
'            <div class="form-status" id="form-status"></div>\n' +
'          </form>\n' +
'          <div class="contact-info">\n' +
'            <div class="contact-item">\n' +
'              <h3>' + ls(contact.addressTitle) + '</h3>\n' +
'              <p>1 Rue des Fontaynelles<br>34120 Tourbes, France</p>\n' +
'            </div>\n' +
'            <div class="contact-item">\n' +
'              <h3>' + ls(contact.phoneTitle) + '</h3>\n' +
'              <p><a href="tel:+33613416320">06 13 41 63 20</a></p>\n' +
'            </div>\n' +
'            <div class="contact-item">\n' +
'              <h3>Email</h3>\n' +
'              <p><a href="mailto:ecole.blabla.latina@gmail.com">ecole.blabla.latina@gmail.com</a></p>\n' +
'            </div>\n' +
'          </div>\n' +
'        </div>\n' +
'      </div>\n' +
'    </section>\n' +
'  </main>\n' +
'\n' +
'  <footer class="footer">\n' +
'    <div class="container">\n' +
'      <div class="footer-bottom">\n' +
'        <p>&copy; 2025 École Blabla Latina. ' + ls(t.copyright) + '</p>\n' +
'        <a href="../index.html" style="color: rgba(255,255,255,0.7);">\n' +
'          ' + ls(t.backToHome) + '\n' +
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

function buildBlogPageHtml(post, relatedPosts) {
  var t = text.blog || {};
  var nav = text.nav || {};
  var ctaTitle = {
    fr: post.ctaTitle || t.defaultCtaTitle.fr,
    en: post.ctaTitleEn || t.defaultCtaTitle.en,
    es: post.ctaTitleEs || t.defaultCtaTitle.es,
    it: post.ctaTitleIt || t.defaultCtaTitle.it
  };
  var ctaText = {
    fr: post.ctaText || t.defaultCtaText.fr,
    en: post.ctaTextEn || t.defaultCtaText.en,
    es: post.ctaTextEs || t.defaultCtaText.es,
    it: post.ctaTextIt || t.defaultCtaText.it
  };
  var dateISO = new Date(post.date).toISOString().split('T')[0];
  var titleTag = post.metaTitle || post.title;

  var relatedHtml = relatedPosts.map(function(r) {
    return '\n        <a href="' + r.slug + '.html" class="related-post-link">' +
      '\n          ' + mlSpan(r, 'title', 'titleEn', 'titleEs', 'titleIt') +
      '\n        </a>';
  }).join('');

  var navSpans = function(navKey) {
    return LANGS.map(function(lang) {
      return '<span data-lang="' + lang + '">' + (nav[navKey][lang] || '') + '</span>';
    }).join('');
  };

  var langSpans = function(obj) {
    return LANGS.map(function(lang) {
      return obj[lang] ? '<span data-lang="' + lang + '">' + obj[lang] + '</span>' : '';
    }).join('');
  };

  return '<!DOCTYPE html>\n' +
'<html lang="fr" class="lang-fr">\n' +
'<head>\n' +
'  <meta charset="UTF-8">\n' +
'  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
'  <title>' + escapeHtml(titleTag) + ' | École Blabla Latina, Pézenas</title>\n' +
'  <meta name="description" content="' + escapeHtml(post.metaDescription) + '">\n' +
'  <link rel="canonical" href="' + SITE_URL + '/blog/' + post.slug + '.html">\n' +
'  <meta property="og:title" content="' + escapeHtml(titleTag) + ' – École Blabla Latina">\n' +
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
'        <a href="../index.html#accueil">' + navSpans('home') + '</a>\n' +
'        <a href="../index.html#cours">' + navSpans('courses') + '</a>\n' +
'        <a href="../index.html#a-propos">' + navSpans('about') + '</a>\n' +
'        <a href="../index.html#avis">' + navSpans('reviews') + '</a>\n' +
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
'        <button onclick="toggleLanguage(\'es\')" class="lang-btn" aria-label="Español" title="Español">\n' +
'          <img src="../images/spanish-flag.png" alt="ES" width="28" height="28">\n' +
'        </button>\n' +
'        <button onclick="toggleLanguage(\'it\')" class="lang-btn" aria-label="Italiano" title="Italiano">\n' +
'          <img src="../images/italian-flag.png" alt="IT" width="28" height="28">\n' +
'        </button>\n' +
'      </div>\n' +
'    </div>\n' +
'  </header>\n' +
'\n' +
'  <main class="blog-article">\n' +
'    <div class="breadcrumb">\n' +
'      <a href="../index.html">' + navSpans('home') + '</a> &gt;\n' +
'      <a href="../index.html#blog">Blog</a> &gt;\n' +
'      ' + mlSpan(post, 'breadcrumbFr', 'breadcrumbEn', 'breadcrumbEs', 'breadcrumbIt') + '\n' +
'    </div>\n' +
'\n' +
'    <h1>\n' +
'      ' + mlSpan(post, 'title', 'titleEn', 'titleEs', 'titleIt') + '\n' +
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
'    <div data-lang="es">\n' +
'      ' + post.contentEs + '\n' +
'    </div>\n' +
'\n' +
'    <div data-lang="it">\n' +
'      ' + post.contentIt + '\n' +
'    </div>\n' +
'\n' +
'    <div class="blog-cta">\n' +
'      <h3>\n' +
'        ' + langSpans(ctaTitle) + '\n' +
'      </h3>\n' +
'      <p>\n' +
'        ' + langSpans(ctaText) + '\n' +
'      </p>\n' +
'      <a href="../index.html#contact" class="btn btn-primary">\n' +
'        ' + langSpans(t.contactUs) + '\n' +
'      </a>\n' +
'    </div>\n' +
'\n' +
'    <div class="related-posts">\n' +
'      <h3>\n' +
'        ' + langSpans(t.otherArticles) + '\n' +
'      </h3>\n' +
'      <div class="related-posts-grid">' + relatedHtml + '\n' +
'      </div>\n' +
'    </div>\n' +
'  </main>\n' +
'\n' +
'  <footer class="footer">\n' +
'    <div class="container">\n' +
'      <div class="footer-bottom">\n' +
'        <p>&copy; 2025 École Blabla Latina. ' + langSpans(t.copyright) + '</p>\n' +
'        <a href="../index.html" style="color: rgba(255,255,255,0.7);">\n' +
'          ' + langSpans(t.backToHome) + '\n' +
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
'            ' + mlSpan(post, 'title', 'titleEn', 'titleEs', 'titleIt') + '\n' +
'          </h3>\n' +
'          <p>\n' +
'            ' + mlSpan(post, 'excerpt', 'excerptEn', 'excerptEs', 'excerptIt') + '\n' +
'          </p>\n' +
'          <a href="blog/' + post.slug + '.html" class="btn btn-outline">\n' +
'            ' + LANGS.map(function(lang) { return '<span data-lang="' + lang + '">' + (t.readMore[lang] || '') + '</span>'; }).join('') + '\n' +
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

  var courseEntries = COURSE_KEYS.map(function(key) {
    if (text.coursePages && text.coursePages[key]) {
      var slug = text.coursePages[key].slug;
      return '  <url>\n' +
'    <loc>' + SITE_URL + '/cours/' + slug + '.html</loc>\n' +
'    <priority>0.9</priority>\n' +
'    <changefreq>weekly</changefreq>\n' +
'  </url>';
    }
    return '';
  }).filter(Boolean).join('\n');

  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
'  <url>\n' +
'    <loc>' + SITE_URL + '/</loc>\n' +
'    <priority>1.0</priority>\n' +
'    <changefreq>weekly</changefreq>\n' +
'  </url>\n' +
courseEntries + '\n' +
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
