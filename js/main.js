document.addEventListener('DOMContentLoaded', () => {
  // Boot trace — check window.__modaBoot.sections in DevTools to see how far init got.
  window.__modaBoot = { sections: [] };
  const mark = (s) => { window.__modaBoot.sections.push(s); };
  // ─── ACTIVE NAV LINK ───
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .mobile-menu a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === page || (page === 'index.html' && href === 'index.html')) {
      a.classList.add('active');
    }
  });

  // ─── TAB TITLE TRICK (misses-you message matches the page) ───
  const originalTitle = document.title;
  const missYouByPage = {
    'index.html': 'The body misses you…',
    'about.html': 'The mission misses you…',
    'model.html': 'The heart misses you…',
    'team.html': 'The team misses you…',
    'contact.html': 'The lab misses you…'
  };
  const awayTitle = missYouByPage[page] || 'The body misses you…';
  document.addEventListener('visibilitychange', () => {
    document.title = document.hidden ? awayTitle : originalTitle;
  });

  // Model page only (the heart page) — EKG canvas exists just there.
  const isModelPage = !!document.getElementById('ekgCanvas');

  // ─── EKG SCROLL PROGRESS (model page) ───
  let ekgProg = null;
  if (isModelPage) {
    ekgProg = document.createElement('div');
    ekgProg.className = 'ekg-progress';
    ekgProg.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ekgProg);
  }
  const updateEkgProg = () => {
    if (!ekgProg) return;
    const h = document.documentElement;
    const max = h.scrollHeight - h.clientHeight;
    const p = max > 0 ? (h.scrollTop || window.pageYOffset) / max : 0;
    ekgProg.style.transform = 'scaleX(' + Math.min(1, Math.max(0, p)) + ')';
  };

  // ─── NAV SCROLL EFFECT (rAF-throttled, passive) ───
  const nav = document.querySelector('nav');
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      if (nav) nav.classList.toggle('scrolled', scrollTop > 50);
      updateEkgProg();
      ticking = false;
    });
  }, { passive: true });
  updateEkgProg();

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
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;
    const lineColor = '#DC5147';
    const gridColor = 'rgba(108, 27, 21, 0.06)';

    let xPosition = 0;
    let animationFrame = null;
    const drawnPoints = [];
    let viewportStart = 0;

    // Wave toggles — clicking a P / QRS / T label isolates it on the trace.
    const waveOn = { p: true, qrs: true, t: true };

    // Waveform calculation (extracted for reusability)
    const getWaveformY = (localX, baseline) => {
      let y = baseline;
      if (waveOn.p && localX >= 20 && localX <= 50) {
        const pProgress = (localX - 20) / 30;
        y = baseline - 12 * Math.sin(pProgress * Math.PI);
      } else if (waveOn.qrs && localX >= 80 && localX <= 120) {
        const qrsProgress = (localX - 80) / 40;
        if (qrsProgress < 0.2) y = baseline + 15 * (qrsProgress / 0.2);
        else if (qrsProgress < 0.4) y = baseline - 70 * ((qrsProgress - 0.2) / 0.2);
        else if (qrsProgress < 0.6) y = baseline - 70 + 95 * ((qrsProgress - 0.4) / 0.2);
        else y = baseline + 25 - 25 * ((qrsProgress - 0.6) / 0.4);
      } else if (waveOn.t && localX >= 150 && localX <= 190) {
        const tProgress = (localX - 150) / 40;
        y = baseline - 20 * Math.sin(tProgress * Math.PI);
      }
      return y;
    };

    // Click a wave label (no checkbox) to toggle that wave on the trace.
    // Labels are in DOM order: P Wave, QRS Complex, T Wave.
    const waveKeys = ['p', 'qrs', 't'];
    document.querySelectorAll('.ekg-wave-label').forEach((label, i) => {
      const key = waveKeys[i];
      if (!key) return;
      label.setAttribute('role', 'button');
      label.setAttribute('tabindex', '0');
      label.setAttribute('aria-pressed', 'true');
      label.classList.add('is-on');
      const toggleWave = () => {
        waveOn[key] = !waveOn[key];
        label.classList.toggle('is-on', waveOn[key]);
        label.classList.toggle('is-off', !waveOn[key]);
        label.setAttribute('aria-pressed', waveOn[key] ? 'true' : 'false');
      };
      label.addEventListener('click', toggleWave);
      label.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleWave(); }
      });
    });

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
        // Hold-to-charge logo fired — burst instead of navigating.
        if (link.dataset.charged) { delete link.dataset.charged; e.preventDefault(); return; }
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
  window.__modaCursorDebug = { finePointer, noMotion, booted: false };
  if (finePointer && !noMotion) {
    // Only swap cursors once the artwork is confirmed loaded —
    // otherwise a missing image would leave no cursor at all.
    const SRC = { arrow: 'assets/images/cursor.svg', hand: 'assets/images/cursor-hand.svg' };
    const OFF = { arrow: [4, 0], hand: [8, 1] };
    const SIZE = { arrow: [19, 24], hand: [20, 25] };
    const ORIG = { arrow: '4px 0px', hand: '8px 1px' };
    let curState = 'arrow', overText = false, handReady = false, glowRect = null;
    const handPre = new Image();
    handPre.onload = () => { handReady = true; };
    handPre.src = SRC.hand;
    const probe = new Image();
    let booted = false;
    const bootOnce = (artURL) => {
      if (booted) return;
      booted = true;
      window.__modaCursorDebug.booted = true;
      bootCursor(artURL);
    };
    const bootCursor = (artURL) => {
    document.body.classList.add('custom-cursor');
    const cur = document.createElement('div');
    cur.className = 'cursor';
    cur.setAttribute('aria-hidden', 'true');
    cur.innerHTML = '<img src="' + artURL + '" alt="" draggable="false"/>';
    document.body.appendChild(cur);
    const curImg = cur.querySelector('img');
    // If artwork is blocked (e.g. Brave Shields / file:// quirk), restore native cursor instead of leaving none.
    curImg.addEventListener('error', () => {
      cur.remove();
      const glowEl = document.querySelector('.cursor-glow');
      if (glowEl) glowEl.remove();
      document.body.classList.remove('custom-cursor');
    });
    let ox = 4, oy = 0;

    const setState = (s) => {
      if (s === 'hand' && !handReady) s = 'arrow';
      if (s === curState) return;
      curState = s;
      curImg.src = SRC[s];
      cur.style.width = SIZE[s][0] + 'px';
      cur.style.height = SIZE[s][1] + 'px';
      curImg.style.transformOrigin = ORIG[s];
      ox = OFF[s][0]; oy = OFF[s][1];
    };

    const glow = document.createElement('div');
    glow.className = 'cursor-glow';
    glow.setAttribute('aria-hidden', 'true');
    document.body.appendChild(glow);
    const SPOT = '.organ-tile, .organ-row, .pillar, .principle, .info-card, .roadmap-col, .tface';
    document.addEventListener('mousemove', (e) => {
      const x = e.clientX - ox, y = e.clientY - oy;
      cur.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
      let gx = e.clientX, gy = e.clientY;
      if (glowRect) {
        gx = glowRect.x + (e.clientX - glowRect.x) * 0.25;
        gy = glowRect.y + (e.clientY - glowRect.y) * 0.25;
      }
      glow.style.transform = 'translate3d(' + gx + 'px,' + gy + 'px,0)';
      if (!overText) {
        cur.classList.add('is-visible');
        glow.classList.add('is-visible');
      }
      const card = e.target.closest ? e.target.closest(SPOT) : null;
      if (card) {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      }
    });
    const hideCursor = () => { cur.classList.remove('is-visible'); glow.classList.remove('is-visible'); };
    document.documentElement.addEventListener('mouseleave', hideCursor);
    document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) hideCursor(); });
    window.addEventListener('blur', hideCursor);
    document.addEventListener('mousedown', () => cur.classList.add('is-down'));
    document.addEventListener('mouseup', () => cur.classList.remove('is-down'));
    document.addEventListener('mouseover', (e) => {
      const t = (e.target && e.target.closest) ? e.target : null;
      // Seed the dye drop position on entry so the first frame isn't stale.
      if (t) {
        const entered = t.closest(SPOT);
        if (entered) {
          const r = entered.getBoundingClientRect();
          entered.style.setProperty('--mx', (e.clientX - r.left) + 'px');
          entered.style.setProperty('--my', (e.clientY - r.top) + 'px');
        }
      }
      overText = !!t && !!t.closest('input, textarea');
      const hot = !overText && !!t && !!t.closest('a, button, .tcard, select, label');
      setState(hot ? 'hand' : 'arrow');
      cur.classList.toggle('is-hover', hot);
      cur.classList.toggle('is-visible', !overText);
      const snap = (!overText && t) ? t.closest('a, button') : null;
      if (snap) {
        const r = snap.getBoundingClientRect();
        const w = r.width + 56, h = r.height + 56;
        glow.style.width = w + 'px';
        glow.style.height = h + 'px';
        glow.style.margin = (-h / 2) + 'px 0 0 ' + (-w / 2) + 'px';
        glowRect = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      } else if (glowRect) {
        glowRect = null;
        glow.style.width = '';
        glow.style.height = '';
        glow.style.margin = '';
      }
    });
    };
    probe.onload = () => bootOnce(SRC.arrow);
    // Brave (Shields / stricter file:// handling) may fail the probe even when
    // the file is fine — still boot and let the <img> error handler decide.
    probe.onerror = () => bootOnce(SRC.arrow);
    probe.src = SRC.arrow;
  }

  // ─── HEARTBEAT MODE (model page only — the heart) ───
  // Press H, or click the footer logo. 72 BPM vignette pulse, no sound.
  if (isModelPage && !noMotion) {
    const hbPulse = document.createElement('div');
    hbPulse.className = 'hb-pulse';
    hbPulse.setAttribute('aria-hidden', 'true');
    document.body.appendChild(hbPulse);
    const hbBadge = document.createElement('div');
    hbBadge.className = 'hb-badge';
    hbBadge.setAttribute('aria-hidden', 'true');
    hbBadge.textContent = '♥ 72 BPM — press H to stop';
    document.body.appendChild(hbBadge);
    const setHeartbeat = (on) => {
      document.body.classList.toggle('heartbeat-mode', on);
      hbBadge.classList.toggle('show', on);
    };
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'h' && e.key !== 'H') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t && t.closest && t.closest('input, textarea, [contenteditable]')) return;
      setHeartbeat(!document.body.classList.contains('heartbeat-mode'));
    });
    const footLogo = document.querySelector('.footer-logo');
    if (footLogo) {
      footLogo.style.cursor = 'pointer';
      footLogo.setAttribute('title', 'Toggle heartbeat mode');
      footLogo.addEventListener('click', () => {
        setHeartbeat(!document.body.classList.contains('heartbeat-mode'));
      });
    }
  }

  // ─── KONAMI FLIP WAVE (team page) ───
  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
  let konamiIdx = 0;
  const heartBurst = (durationMs = 3000) => {
    // Spread hearts across the whole flip tour so they keep falling until it ends.
    const total = Math.max(24, Math.min(120, Math.ceil(durationMs / 200)));
    for (let i = 0; i < total; i++) {
      const h = document.createElement('div');
      h.className = 'heart-confetti';
      h.textContent = '♥';
      h.style.left = (Math.random() * 100) + 'vw';
      h.style.fontSize = (14 + Math.random() * 22) + 'px';
      const delay = (i / total) * (durationMs / 1000);
      h.style.animationDelay = delay + 's';
      document.body.appendChild(h);
      setTimeout(() => h.remove(), delay * 1000 + 3200);
    }
  };
  // ─── HEARTS PUMPED STREAK COUNTER ───
  let heartsPumped = 0;
  try { heartsPumped = parseInt(localStorage.getItem('moda-hearts') || '0', 10) || 0; } catch (err) {}
  const pumpEl = document.createElement('span');
  pumpEl.className = 'pump-count';
  const renderPumps = () => {
    pumpEl.textContent = ' · ♥ ' + heartsPumped.toLocaleString() + ' hearts pumped';
  };
  renderPumps();
  const footSub = document.querySelector('.footer-sub');
  if (footSub) footSub.appendChild(pumpEl);
  const pump = (n) => {
    heartsPumped += n;
    try { localStorage.setItem('moda-hearts', String(heartsPumped)); } catch (err) {}
    renderPumps();
  };
  // Rhythm taps count too (model page).
  const rhythmHeart = document.getElementById('rhythmHeart');
  if (rhythmHeart) rhythmHeart.addEventListener('click', () => pump(1));

  document.addEventListener('keydown', (e) => {
    konamiIdx = (e.code === KONAMI[konamiIdx]) ? konamiIdx + 1 : (e.code === KONAMI[0] ? 1 : 0);
    if (konamiIdx === KONAMI.length) {
      konamiIdx = 0;
      pump(12);
      const cards = document.querySelectorAll('.tcard');
      if (cards.length) {
        cards.forEach((c, i) => {
          setTimeout(() => c.classList.add('flipped'), i * 180);
          setTimeout(() => c.classList.remove('flipped'), 2300 + i * 180);
        });
        if (!reduceMotion) heartBurst(cards.length * 180 + 2500);
      } else {
        const SEL = '.btn-primary, .btn-outline, .btn-start, .organ-tile, .organ-row, .pillar, .principle, .info-card, .spec-item, .step, .roadmap-col, .ekg-canvas-wrapper, .ekg-wave-label, .rhythm-heart, .rhythm-stat, .prototype-badge, .bom-table';
        const els = Array.prototype.filter.call(document.querySelectorAll(SEL), (el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        }).slice(0, 40);
        document.querySelectorAll('.konami-flip').forEach((el) => el.classList.remove('konami-flip'));
        els.forEach((el, i) => {
          setTimeout(() => {
            el.classList.add('konami-flip');
            if (!reduceMotion) {
              try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (err) {}
            }
          }, i * 450);
          setTimeout(() => el.classList.remove('konami-flip'), i * 450 + 1400);
        });
        if (!reduceMotion) heartBurst(els.length * 450 + 1600);
      }
    }
  });

  // ─── LOGO CHARGE (hold nav logo 2s — squares light one at a time, then hearts) ───
  const navLogo = document.querySelector('.nav-logo');
  if (navLogo && !reduceMotion) {
    const chargeBox = document.createElement('div');
    chargeBox.className = 'logo-charge';
    chargeBox.setAttribute('aria-hidden', 'true');
    const cells = ['lc-tl', 'lc-tr', 'lc-bl', 'lc-br'].map((c) => {
      const d = document.createElement('div');
      d.className = 'lc-cell ' + c;
      chargeBox.appendChild(d);
      return d;
    });
    navLogo.appendChild(chargeBox);
    let chargeTimers = [];
    const cancelCharge = () => {
      chargeTimers.forEach(clearTimeout);
      chargeTimers = [];
      navLogo.classList.remove('charging');
      cells.forEach((cell) => cell.classList.remove('lit'));
    };
    navLogo.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      cancelCharge();
      navLogo.classList.add('charging');
      cells.forEach((cell, i) => {
        chargeTimers.push(setTimeout(() => cell.classList.add('lit'), 400 * (i + 1)));
      });
      chargeTimers.push(setTimeout(() => {
        chargeTimers = [];
        navLogo.classList.remove('charging');
        cells.forEach((cell) => cell.classList.remove('lit'));
        navLogo.dataset.charged = '1';
        heartBurst(2500);
        pump(5);
      }, 2000));
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => navLogo.addEventListener(ev, cancelCharge));
  }
});
