// ===== LANGUAGE TOGGLE =====
function toggleLanguage(lang) {
  document.documentElement.className = 'lang-' + lang;
  document.documentElement.lang = lang;
  localStorage.setItem('preferredLang', lang);
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', function() {
  // Restore saved language preference
  var saved = localStorage.getItem('preferredLang') || 'fr';
  toggleLanguage(saved);

  // ===== MOBILE NAV =====
  var navToggle = document.getElementById('nav-toggle');
  var nav = document.getElementById('nav');

  if (navToggle && nav) {
    navToggle.addEventListener('click', function() {
      nav.classList.toggle('open');
      var isOpen = nav.classList.contains('open');
      navToggle.setAttribute('aria-expanded', isOpen);
    });

    // Close nav when clicking a link
    nav.querySelectorAll('a').forEach(function(link) {
      link.addEventListener('click', function() {
        nav.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });

    // Close nav when clicking outside
    document.addEventListener('click', function(e) {
      if (!nav.contains(e.target) && !navToggle.contains(e.target)) {
        nav.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ===== COURSE ACCORDIONS =====
  document.querySelectorAll('.accordion-toggle').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var content = btn.nextElementSibling;
      var isOpen = content.classList.contains('open');

      // Close all others
      document.querySelectorAll('.accordion-content.open').forEach(function(other) {
        other.classList.remove('open');
        other.previousElementSibling.setAttribute('aria-expanded', 'false');
      });

      if (!isOpen) {
        content.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // ===== CONTACT FORM =====
  var form = document.getElementById('contact-form');
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var submitBtn = form.querySelector('.btn-submit');
      var status = document.getElementById('form-status');
      var originalText = submitBtn.innerHTML;

      submitBtn.classList.add('loading');
      submitBtn.innerHTML = '<span data-lang="fr">Envoi en cours...</span><span data-lang="en">Sending...</span>';
      // Re-apply language visibility to new spans
      toggleLanguage(localStorage.getItem('preferredLang') || 'fr');

      var data = new FormData(form);

      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: data
      })
      .then(function(response) { return response.json(); })
      .then(function(result) {
        submitBtn.classList.remove('loading');
        submitBtn.innerHTML = originalText;
        toggleLanguage(localStorage.getItem('preferredLang') || 'fr');

        if (result.success) {
          status.className = 'form-status success';
          var lang = localStorage.getItem('preferredLang') || 'fr';
          status.textContent = lang === 'fr'
            ? 'Merci ! Votre message a été envoyé avec succès.'
            : 'Thank you! Your message has been sent successfully.';
          form.reset();
        } else {
          status.className = 'form-status error';
          var lang = localStorage.getItem('preferredLang') || 'fr';
          status.textContent = lang === 'fr'
            ? 'Une erreur est survenue. Veuillez réessayer.'
            : 'An error occurred. Please try again.';
        }
      })
      .catch(function() {
        submitBtn.classList.remove('loading');
        submitBtn.innerHTML = originalText;
        toggleLanguage(localStorage.getItem('preferredLang') || 'fr');
        status.className = 'form-status error';
        var lang = localStorage.getItem('preferredLang') || 'fr';
        status.textContent = lang === 'fr'
          ? 'Une erreur est survenue. Veuillez réessayer.'
          : 'An error occurred. Please try again.';
      });
    });
  }

  // ===== MENTIONS LÉGALES MODAL =====
  var mentionsToggle = document.getElementById('mentions-toggle');
  var modal = document.getElementById('mentions-modal');
  var modalClose = document.getElementById('modal-close');

  if (mentionsToggle && modal) {
    mentionsToggle.addEventListener('click', function() {
      modal.classList.add('open');
    });

    if (modalClose) {
      modalClose.addEventListener('click', function() {
        modal.classList.remove('open');
      });
    }

    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        modal.classList.remove('open');
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && modal.classList.contains('open')) {
        modal.classList.remove('open');
      }
    });
  }

  // ===== SCROLL ANIMATIONS =====
  var fadeElements = document.querySelectorAll('.course-card, .blog-card, .about-grid, .founder-grid, .contact-grid, .course-formats');

  fadeElements.forEach(function(el) {
    el.classList.add('fade-in');
  });

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    fadeElements.forEach(function(el) {
      observer.observe(el);
    });
  } else {
    // Fallback: show everything
    fadeElements.forEach(function(el) {
      el.classList.add('visible');
    });
  }
});
