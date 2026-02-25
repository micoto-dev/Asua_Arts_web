/**
 * Asua Arts - Main JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
  initLoading();
  initHeader();
  initMobileMenu();
  initHeroSlider();
  initNews();
  initScrollAnimations();
  initBackToTop();
  initSmoothScroll();
  initContactForm();
});

/**
 * Loading Screen
 */
function initLoading() {
  window.addEventListener('load', () => {
    setTimeout(() => {
      const loading = document.getElementById('loading');
      if (loading) {
        loading.classList.add('hidden');
      }
    }, 1500);
  });
}

/**
 * Header Scroll Effect
 */
function initHeader() {
  const header = document.getElementById('header');
  if (!header) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 100) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });
}

/**
 * Mobile Menu
 */
function initMobileMenu() {
  const menuToggle = document.getElementById('menuToggle');
  const nav = document.getElementById('nav');
  if (!menuToggle || !nav) return;

  function updateAriaExpanded(isOpen) {
    menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    menuToggle.setAttribute('aria-label', isOpen ? 'メニューを閉じる' : 'メニューを開く');
  }

  menuToggle.addEventListener('click', () => {
    const isOpen = menuToggle.classList.toggle('active');
    nav.classList.toggle('active');
    updateAriaExpanded(isOpen);
  });

  // Close menu on link click
  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      menuToggle.classList.remove('active');
      nav.classList.remove('active');
      updateAriaExpanded(false);
    });
  });
}

/**
 * Hero Slider
 */
function initHeroSlider() {
  const slides = document.querySelectorAll('.hero-slide');
  const dots = document.querySelectorAll('.slider-dot');
  if (slides.length === 0) return;

  let currentSlide = 0;
  let slideInterval;

  function showSlide(index) {
    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => {
      dot.classList.remove('active');
      dot.setAttribute('aria-selected', 'false');
    });
    slides[index].classList.add('active');
    if (dots[index]) {
      dots[index].classList.add('active');
      dots[index].setAttribute('aria-selected', 'true');
    }
  }

  function nextSlide() {
    currentSlide = (currentSlide + 1) % slides.length;
    showSlide(currentSlide);
  }

  function startSlider() {
    slideInterval = setInterval(nextSlide, 5000);
  }

  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      clearInterval(slideInterval);
      currentSlide = index;
      showSlide(currentSlide);
      startSlider();
    });
  });

  startSlider();
}

/**
 * News Section
 */
function initNews() {
  // Top page: show latest 3
  var newsList = document.getElementById('newsList');
  if (newsList) {
    loadNewsList(newsList, 3);
  }

  // News list page: show all
  var newsListAll = document.getElementById('newsListAll');
  if (newsListAll) {
    loadNewsList(newsListAll, 0);
  }

  // News detail page
  var newsDetail = document.getElementById('newsDetail');
  var newsListPage = document.getElementById('newsListPage');
  if (newsDetail && newsListPage) {
    var params = new URLSearchParams(window.location.search);
    var articleId = params.get('id');
    if (articleId) {
      loadNewsDetail(articleId);
    } else {
      newsListPage.style.display = 'block';
    }
  }
}

function loadNewsList(container, limit) {
  fetch('data/news.json')
    .then(function(response) { return response.json(); })
    .then(function(data) {
      var sorted = data.news.slice().sort(function(a, b) {
        return b.date.localeCompare(a.date);
      });
      var articles = limit > 0 ? sorted.slice(0, limit) : sorted;
      var html = '';
      articles.forEach(function(article) {
        var dateFormatted = formatNewsDate(article.date);
        html += '<a href="news.html?id=' + encodeURIComponent(article.id) + '" class="news-item fade-in">' +
          '<span class="news-date">' + dateFormatted + '</span>' +
          '<span class="news-category">' + article.category + '</span>' +
          '<span class="news-title">' + article.title + '</span>' +
          '</a>';
      });

      if (limit > 0 && data.news.length > limit) {
        html += '<div class="news-more fade-in"><a href="news.html" class="news-more-link">ニュース一覧を見る</a></div>';
      }

      container.innerHTML = html;
      observeFadeIn(container);
    })
    .catch(function() {});
}

function loadNewsDetail(articleId) {
  fetch('data/news.json')
    .then(function(response) { return response.json(); })
    .then(function(data) {
      var article = data.news.find(function(a) { return a.id === articleId; });
      if (!article) {
        document.getElementById('newsListPage').style.display = 'block';
        return;
      }

      document.title = article.title + ' | 有限会社アスアアーツ';
      document.getElementById('detailDate').textContent = formatNewsDate(article.date);
      document.getElementById('detailCategory').textContent = article.category;
      document.getElementById('detailTitle').textContent = article.title;

      var content = article.content || '';
      var bodyHtml;

      // Detect plain text (no HTML tags) for backward compatibility
      if (!/<[a-z][\s\S]*>/i.test(content)) {
        // Plain text: convert newlines to paragraphs
        bodyHtml = content
          .split('\n')
          .map(function(line) { return '<p>' + line + '</p>'; })
          .join('');
      } else {
        // Rich HTML content: sanitize with DOMPurify
        if (typeof DOMPurify !== 'undefined') {
          bodyHtml = DOMPurify.sanitize(content, {
            ADD_TAGS: ['iframe'],
            ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'src', 'width', 'height', 'style'],
            ALLOWED_URI_REGEXP: /^(?:(?:https?|data):)/i
          });
        } else {
          bodyHtml = content;
        }
      }

      document.getElementById('detailBody').innerHTML = bodyHtml;
      document.getElementById('newsDetail').style.display = 'block';
    })
    .catch(function() {
      document.getElementById('newsListPage').style.display = 'block';
    });
}

function observeFadeIn(container) {
  container.querySelectorAll('.fade-in').forEach(function(el) {
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });
    observer.observe(el);
  });
}

function formatNewsDate(dateStr) {
  var parts = dateStr.split('-');
  return parts[0] + '.' + parts[1] + '.' + parts[2];
}

/**
 * Scroll Animations (Intersection Observer)
 */
function initScrollAnimations() {
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, observerOptions);

  document.querySelectorAll('.fade-in, .fade-in-left, .fade-in-right').forEach(el => {
    observer.observe(el);
  });
}

/**
 * Back to Top Button
 */
function initBackToTop() {
  const backToTop = document.getElementById('backToTop');
  if (!backToTop) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 500) {
      backToTop.classList.add('visible');
    } else {
      backToTop.classList.remove('visible');
    }
  });

  backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/**
 * Smooth Scroll for Anchor Links
 */
function initSmoothScroll() {
  const header = document.getElementById('header');

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');
      const target = document.querySelector(targetId);
      if (target) {
        const headerHeight = header ? header.offsetHeight : 0;
        const targetPosition = target.offsetTop - headerHeight;
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
}

/**
 * Contact Form Handler (FormSubmit.co)
 */
function initContactForm() {
  const form = document.querySelector('.contact-form');
  if (!form) return;

  form.addEventListener('submit', function(e) {
    e.preventDefault();

    var submitButton = form.querySelector('.form-submit');
    submitButton.textContent = '送信中...';
    submitButton.disabled = true;

    var formData = new FormData(form);

    fetch(form.action, {
      method: 'POST',
      body: formData
    }).then(function() {
      window.location.href = '/thanks.html';
    }).catch(function() {
      window.location.href = '/thanks.html';
    });
  });
}
