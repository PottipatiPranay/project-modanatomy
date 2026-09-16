document.addEventListener('DOMContentLoaded', () => {
  // ─── ACTIVE NAV LINK ───
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .mobile-menu a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === page || (page === 'index.html' && href === 'index.html')) {
      a.classList.add('active');
    }
  });

  // ─── NAV SCROLL EFFECT (rAF-throttled, passive) ───
  const nav = document.querySelector('nav');
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      nav.classList.toggle('scrolled', scrollTop > 50);
      ticking = false;
    });
  }, { passive: true });

  // ─── MOBILE MENU ───
  const navToggle = document.querySelector('.nav-toggle');
  const mobileMenu = document.querySelector('.mobile-menu');
  if (navToggle && mobileMenu) {
    const setMenu = (open) => {
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      mobileMenu.classList.toggle('open', open);
    };
    navToggle.addEventListener('click', () => {
      setMenu(!mobileMenu.classList.contains('open'));
    });
    mobileMenu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => setMenu(false));
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setMenu(false);
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 820) setMenu(false);
    });
  }

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

  // ─── EKG VISUALIZATION ───
  const initEKG = () => {
    const canvas = document.getElementById('ekgCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;
    const lineColor = '#DC5147';
    const gridColor = 'rgba(108, 27, 21, 0.06)';

    let xPosition = 0;
    let animationFrame = null;
    const drawnPoints = [];
    let viewportStart = 0;

    // Waveform calculation (extracted for reusability)
    const getWaveformY = (localX, baseline) => {
      let y = baseline;
      if (localX >= 20 && localX <= 50) {
        const pProgress = (localX - 20) / 30;
        y = baseline - 12 * Math.sin(pProgress * Math.PI);
      } else if (localX >= 80 && localX <= 120) {
        const qrsProgress = (localX - 80) / 40;
        if (qrsProgress < 0.2) y = baseline + 15 * (qrsProgress / 0.2);
        else if (qrsProgress < 0.4) y = baseline - 70 * ((qrsProgress - 0.2) / 0.2);
        else if (qrsProgress < 0.6) y = baseline - 70 + 95 * ((qrsProgress - 0.4) / 0.2);
        else y = baseline + 25 - 25 * ((qrsProgress - 0.6) / 0.4);
      } else if (localX >= 150 && localX <= 190) {
        const tProgress = (localX - 150) / 40;
        y = baseline - 20 * Math.sin(tProgress * Math.PI);
      }
      return y;
    };

    // Set canvas context defaults
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;

    const drawGrid = () => {
      // Vertical lines (with viewport shift)
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 0.5;
      const lineSpacing = 50;
      const startX = viewportStart % lineSpacing;
      for (let x = -startX; x < width; x += lineSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Horizontal lines
      for (let y = 0; y < height; y += 25) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Center baseline
      ctx.strokeStyle = 'rgba(108, 27, 21, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();
    };

    const animate = () => {
      const baseline = centerY;
      const cycleWidth = 300;
      const batchSize = 3;

      // Generate points
      for (let i = 0; i < batchSize; i++) {
        const localX = xPosition % cycleWidth;
        const y = getWaveformY(localX, baseline);
        drawnPoints.push({ xAbs: xPosition, y });
        xPosition++;
      }

      // Update viewport
      viewportStart = xPosition - width;
      if (viewportStart < 0) viewportStart = 0;

      // Trim old points
      while (drawnPoints.length > 0 && drawnPoints[0].xAbs < viewportStart - width) {
        drawnPoints.shift();
      }

      // Render
      ctx.clearRect(0, 0, width, height);
      drawGrid();

      if (drawnPoints.length > 1) {
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();

        let isFirstPoint = true;
        for (let i = 0; i < drawnPoints.length; i++) {
          const screenX = (drawnPoints[i].xAbs - viewportStart) % width;
          if (isFirstPoint) {
            ctx.moveTo(screenX, drawnPoints[i].y);
            isFirstPoint = false;
          } else {
            ctx.lineTo(screenX, drawnPoints[i].y);
          }
        }
        ctx.stroke();
      }

      animationFrame = requestAnimationFrame(animate);
    };

    drawGrid();
    animate();

    // Pause when not visible
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting && animationFrame) {
          cancelAnimationFrame(animationFrame);
          animationFrame = null;
        } else if (entry.isIntersecting && !animationFrame) {
          animate();
        }
      });
    });
    observer.observe(canvas);
  };

  initEKG();

  // ─── STAGGERED ANIMATIONS FOR GRID ITEMS ───
  const animateGridItems = () => {
    // Principles grid
    document.querySelectorAll('.principle, .team-card').forEach((el, index) => {
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

  // ─── PAGE WIPE TRANSITION ───
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!reduceMotion) {
    // Overlay ships in the HTML so it covers first paint; fall back to creating it.
    let wipe = document.querySelector('.wipe');
    if (!wipe) {
      wipe = document.createElement('div');
      wipe.className = 'wipe is-covering';
      wipe.setAttribute('aria-hidden', 'true');
      wipe.innerHTML = '<div class="wipe-panel wipe-brick"></div><div class="wipe-panel wipe-deep"><img class="wipe-logo-img" src="assets/images/logo-loader.svg" alt="Project ModAnatomy" width="600" height="150"/></div>';
      document.body.appendChild(wipe);
    }

    // First visit: hold the logo, then lift slowly. Later visits: quick lift.
    let firstVisit = true;
    try { firstVisit = !localStorage.getItem('moda-seen'); } catch (err) {}
    const reveal = () => {
      requestAnimationFrame(() => {
        wipe.classList.remove('is-covering');
        document.body.classList.remove('wipe-covering');
        setTimeout(() => wipe.classList.remove('wipe-slow'), 1500);
      });
    };
    document.body.classList.add('wipe-covering');
    if (firstVisit) {
      try { localStorage.setItem('moda-seen', '1'); } catch (err) {}
      wipe.classList.add('wipe-slow');
      setTimeout(reveal, 100);
    } else {
      reveal();
    }

    // Re-reveal when returning via back/forward cache
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) {
        wipe.classList.remove('is-covering');
        document.body.classList.remove('wipe-covering');
      }
    });

    // Short curtain on navigation (last click wins)
    let navTimer = null;
    document.querySelectorAll('a[href$=".html"]').forEach(link => {
      link.addEventListener('click', (e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const href = link.getAttribute('href');
        if (!href || href.startsWith('http') || href.startsWith('#') || link.getAttribute('target') === '_blank') return;
        const current = window.location.pathname.split('/').pop() || 'index.html';
        if (href === current) {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        e.preventDefault();
        wipe.classList.add('is-covering');
        document.body.classList.add('wipe-covering');
        if (navTimer) clearTimeout(navTimer);
        navTimer = setTimeout(() => { window.location.href = href; }, 500);
      });
    });
  } else {
    // Reduced motion: never trap content behind the curtain
    const wipe = document.querySelector('.wipe');
    if (wipe) wipe.classList.remove('is-covering');
  }

  // ─── CUSTOM CURSOR (desktop pointers only) ───
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const noMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (finePointer && !noMotion) {
    // Only swap cursors once the artwork is confirmed loaded —
    // otherwise a missing image would leave no cursor at all.
    const probe = new Image();
    probe.onload = () => {
    document.body.classList.add('custom-cursor');
    const cur = document.createElement('div');
    cur.className = 'cursor';
    cur.setAttribute('aria-hidden', 'true');
    cur.innerHTML = '<img src="assets/images/cursor.svg" alt=""/>';
    document.body.appendChild(cur);

    let cx = -100, cy = -100, tx = -100, ty = -100, raf = null;
    const render = () => {
      cx += (tx - cx) * 0.4;
      cy += (ty - cy) * 0.4;
      cur.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
      if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) {
        raf = requestAnimationFrame(render);
      } else {
        raf = null;
      }
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(render); };
    document.addEventListener('mousemove', (e) => {
      tx = e.clientX - 4;
      ty = e.clientY;
      cur.classList.add('is-visible');
      kick();
    });
    const hideCursor = () => cur.classList.remove('is-visible');
    document.documentElement.addEventListener('mouseleave', hideCursor);
    document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) hideCursor(); });
    window.addEventListener('blur', hideCursor);
    document.addEventListener('mousedown', () => cur.classList.add('is-down'));
    document.addEventListener('mouseup', () => cur.classList.remove('is-down'));
    document.addEventListener('mouseover', (e) => {
      cur.classList.toggle('is-hover', !!e.target.closest('a, button, .tcard, select, label'));
    });
    };
    probe.src = 'assets/images/cursor.svg';
  }

  // ─── KONAMI FLIP WAVE (team page) ───
  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
  let konamiIdx = 0;
  const heartBurst = () => {
    for (let i = 0; i < 36; i++) {
      const h = document.createElement('div');
      h.className = 'heart-confetti';
      h.textContent = '♥';
      h.style.left = (Math.random() * 100) + 'vw';
      h.style.fontSize = (14 + Math.random() * 22) + 'px';
      h.style.animationDelay = (Math.random() * 0.6) + 's';
      document.body.appendChild(h);
      setTimeout(() => h.remove(), 3400);
    }
  };
  document.addEventListener('keydown', (e) => {
    konamiIdx = (e.code === KONAMI[konamiIdx]) ? konamiIdx + 1 : (e.code === KONAMI[0] ? 1 : 0);
    if (konamiIdx === KONAMI.length) {
      konamiIdx = 0;
      const cards = document.querySelectorAll('.tcard');
      if (!cards.length) return;
      cards.forEach((c, i) => {
        setTimeout(() => c.classList.add('flipped'), i * 180);
        setTimeout(() => c.classList.remove('flipped'), 2300 + i * 180);
      });
      if (!reduceMotion) heartBurst();
    }
  });
});
