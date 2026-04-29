document.addEventListener('DOMContentLoaded', () => {
  // ─── ACTIVE NAV LINK ───
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === page || (page === 'index.html' && href === 'index.html')) {
      a.classList.add('active');
    }
  });

  // ─── NAV SCROLL EFFECT ───
  const nav = document.querySelector('nav');
  let lastScrollTop = 0;
  window.addEventListener('scroll', () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    if (scrollTop > 50) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
  }, false);

  // ─── SCROLL-TRIGGERED ANIMATIONS ───
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.forEach(className => {
          if (className.includes('scroll-fade-up') || 
              className.includes('scroll-scale-in') || 
              className.includes('scroll-fade-in-left') || 
              className.includes('scroll-fade-in-right')) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0) scale(1) translateX(0)';
          }
        });
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Observe elements with scroll animation classes
  document.querySelectorAll('[class*="scroll-fade-up"], [class*="scroll-scale-in"], [class*="scroll-fade-in-left"], [class*="scroll-fade-in-right"]').forEach(el => {
    observer.observe(el);
  });

  // ─── STAGGERED ANIMATIONS FOR GRID ITEMS ───
  const animateGridItems = () => {
    // Principles grid
    document.querySelectorAll('.principle').forEach((el, index) => {
      el.classList.add('scroll-scale-in');
      el.classList.add(`scroll-scale-in-${Math.min(index, 2)}`);
      observer.observe(el);
    });

    // Pillar items
    document.querySelectorAll('.pillar').forEach((el, index) => {
      el.classList.add('scroll-fade-up');
      el.classList.add(`scroll-fade-up-${Math.min(index, 3)}`);
      observer.observe(el);
    });

    // Organ rows
    document.querySelectorAll('.organ-row').forEach((el, index) => {
      el.classList.add('scroll-fade-in-right');
      observer.observe(el);
    });

    // Info cards
    document.querySelectorAll('.info-card').forEach((el, index) => {
      el.classList.add('scroll-scale-in');
      el.classList.add(`scroll-scale-in-${index}`);
      observer.observe(el);
    });

    // Content blocks (about, model pages)
    document.querySelectorAll('.content-block').forEach((el, index) => {
      el.classList.add('scroll-fade-up');
      el.style.animationDelay = `${index * 0.1}s`;
      observer.observe(el);
    });

    // Section titles
    document.querySelectorAll('.section-title').forEach((el) => {
      el.classList.add('scroll-fade-up');
      observer.observe(el);
    });

    // Section labels
    document.querySelectorAll('.section-label').forEach((el) => {
      el.classList.add('scroll-fade-up');
      observer.observe(el);
    });
  };

  // Small delay to ensure DOM is fully rendered
  setTimeout(animateGridItems, 100);

  // ─── BUTTON RIPPLE EFFECT ───
  document.querySelectorAll('.btn-primary, .btn-outline').forEach(button => {
    button.addEventListener('click', function(e) {
      const ripple = document.createElement('span');
      const rect = this.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';
      ripple.classList.add('ripple');

      // Remove any existing ripple
      const existing = this.querySelector('.ripple');
      if (existing) existing.remove();

      this.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  });

  // ─── PAGE TRANSITION FADE ───
  document.querySelectorAll('a[href$=".html"]').forEach(link => {
    if (!link.classList.contains('nav-cta') && link.getAttribute('target') !== '_blank') {
      link.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href && !href.startsWith('http')) {
          e.preventDefault();
          document.body.style.opacity = '0';
          document.body.style.transition = 'opacity 0.3s ease-out';
          setTimeout(() => {
            window.location.href = href;
          }, 300);
        }
      });
    }
  });

  // ─── FADE IN ON PAGE LOAD ───
  window.addEventListener('load', () => {
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.5s ease-in';
    setTimeout(() => {
      document.body.style.opacity = '1';
    }, 50);
  });
});
