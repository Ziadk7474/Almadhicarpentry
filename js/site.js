/* Al Madhi Carpentry — shared site script. No scroll listeners: everything
   runs from IntersectionObserver or pointer events, so scrolling stays smooth. */
(function () {
  'use strict';
  var doc = document.documentElement;
  doc.classList.add('js');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var IO = 'IntersectionObserver' in window;
  var WA = '971505974922';
  var EMAIL = 'almadhicarpentry@yahoo.com';

  $$('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

  /* ---------- Liquid glass nav (desktop Chromium only; phones keep plain frosted glass) ---------- */
  function liquidGlass(el, o) {
    if (!el || !fine) return;
    try {
      var ua = navigator.userAgent;
      if (/Firefox/.test(ua) || (/Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua))) return;
      if (!(window.CSS && CSS.supports('backdrop-filter', 'url(#a)'))) return;
      if (typeof document.createElement('canvas').getContext('2d').roundRect !== 'function') return;
    } catch (_) { return; }
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none';
    var id = 'lg' + Math.random().toString(36).slice(2, 7);
    var f = document.createElementNS(NS, 'filter');
    f.setAttribute('id', id); f.setAttribute('x', '0'); f.setAttribute('y', '0'); f.setAttribute('width', '100%'); f.setAttribute('height', '100%');
    f.setAttribute('color-interpolation-filters', 'sRGB');
    var img = document.createElementNS(NS, 'feImage');
    img.setAttribute('result', 'map'); img.setAttribute('preserveAspectRatio', 'none');
    f.appendChild(img);
    var keep = ['1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0'];
    for (var i = 0; i < 3; i++) {
      var d = document.createElementNS(NS, 'feDisplacementMap');
      d.setAttribute('in', 'SourceGraphic'); d.setAttribute('in2', 'map'); d.setAttribute('scale', o.scale + 4 * i);
      d.setAttribute('xChannelSelector', 'R'); d.setAttribute('yChannelSelector', 'B'); d.setAttribute('result', 'd' + i);
      f.appendChild(d);
      var m = document.createElementNS(NS, 'feColorMatrix');
      m.setAttribute('in', 'd' + i); m.setAttribute('type', 'matrix'); m.setAttribute('values', keep[i]); m.setAttribute('result', 'c' + i);
      f.appendChild(m);
    }
    var b1 = document.createElementNS(NS, 'feBlend'); b1.setAttribute('in', 'c0'); b1.setAttribute('in2', 'c1'); b1.setAttribute('mode', 'screen'); b1.setAttribute('result', 'c01'); f.appendChild(b1);
    var b2 = document.createElementNS(NS, 'feBlend'); b2.setAttribute('in', 'c01'); b2.setAttribute('in2', 'c2'); b2.setAttribute('mode', 'screen'); f.appendChild(b2);
    svg.appendChild(f); document.body.appendChild(svg);
    var lw = 0, lh = 0;
    function refresh() {
      var w = el.offsetWidth, h = el.offsetHeight;
      if (!w || !h || (w === lw && h === lh)) return;
      lw = w; lh = h;
      var r = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, Math.min(w, h) / 2);
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var x = c.getContext('2d');
      var gx = x.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, '#000'); gx.addColorStop(1, '#f00'); x.fillStyle = gx; x.fillRect(0, 0, w, h);
      var gy = x.createLinearGradient(0, 0, 0, h); gy.addColorStop(0, '#000'); gy.addColorStop(1, '#00f');
      x.globalCompositeOperation = 'difference'; x.fillStyle = gy; x.fillRect(0, 0, w, h);
      x.globalCompositeOperation = 'source-over';
      var inset = 0.14 * Math.min(w, h);
      x.filter = 'blur(8px)'; x.fillStyle = 'rgba(128,128,128,0.93)';
      x.beginPath(); x.roundRect(inset, inset, w - inset * 2, h - inset * 2, Math.max(r - inset, 2)); x.fill();
      img.setAttribute('href', c.toDataURL()); img.setAttribute('width', w); img.setAttribute('height', h);
    }
    refresh();
    var fx = 'url(#' + id + ') blur(10px) saturate(1.8)';
    el.style.backdropFilter = fx; el.style.webkitBackdropFilter = fx;
    el.classList.add('lg-on');
    var t; new ResizeObserver(function () { clearTimeout(t); t = setTimeout(refresh, 150); }).observe(el);
  }
  liquidGlass($('#navBar'), { scale: -46 });

  /* ---------- Nav ---------- */
  var nav = $('#nav');
  var menuBtn = $('#menuBtn');
  var menu = $('#menu');
  function setMenu(open) {
    if (!nav) return;
    nav.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.setAttribute('aria-hidden', String(!open));
  }
  if (menuBtn) menuBtn.addEventListener('click', function () { setMenu(!nav.classList.contains('menu-open')); });
  $$('#menu a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  $$('.menu-group > button').forEach(function (b) {
    b.addEventListener('click', function () {
      var g = b.parentElement, open = !g.classList.contains('is-open');
      g.classList.toggle('is-open', open); b.setAttribute('aria-expanded', String(open));
    });
  });

  // Products mega menu
  var megaBtn = $('#megaBtn'), mega = $('#mega'), megaTimer;
  function setMega(open) {
    if (!mega) return;
    clearTimeout(megaTimer);
    mega.classList.toggle('is-open', open);
    megaBtn.setAttribute('aria-expanded', String(open));
  }
  if (megaBtn) {
    megaBtn.addEventListener('click', function () { setMega(!mega.classList.contains('is-open')); });
    if (fine) {
      megaBtn.addEventListener('pointerenter', function () { setMega(true); });
      [megaBtn, mega].forEach(function (el) {
        el.addEventListener('pointerleave', function () { megaTimer = setTimeout(function () { setMega(false); }, 180); });
        el.addEventListener('pointerenter', function () { clearTimeout(megaTimer); });
      });
    }
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { setMenu(false); setMega(false); } });
  document.addEventListener('click', function (e) {
    if (nav && nav.classList.contains('menu-open') && !nav.contains(e.target)) setMenu(false);
    if (mega && mega.classList.contains('is-open') && !mega.contains(e.target) && e.target !== megaBtn && !megaBtn.contains(e.target)) setMega(false);
  });

  // Sliding pill under nav links
  var links = $('.nav-links'), pill = $('#navPill');
  var current = links ? $('.nav-links > .is-active') : null;
  function movePill(a) {
    if (!links || !pill) return;
    if (!a) { links.classList.remove('has-pill'); return; }
    var lr = links.getBoundingClientRect(), r = a.getBoundingClientRect();
    pill.style.width = r.width + 'px';
    pill.style.setProperty('--x', (r.left - lr.left) + 'px');
    links.classList.add('has-pill');
  }
  if (links) {
    $$('.nav-links > a, .nav-links > button').forEach(function (a) { a.addEventListener('pointerenter', function () { movePill(a); }); });
    links.addEventListener('pointerleave', function () { movePill(current); });
    requestAnimationFrame(function () { movePill(current); });
    window.addEventListener('resize', function () { movePill(current); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { movePill(current); });
  }

  // Scrolled state + dock, from sentinels (no scroll listener)
  var dock = $('#dock');
  if (IO && nav) {
    var top = document.createElement('div');
    top.style.cssText = 'position:absolute;top:0;left:0;height:30px;width:1px;pointer-events:none';
    document.body.prepend(top);
    new IntersectionObserver(function (en) { nav.classList.toggle('is-scrolled', !en[0].isIntersecting); }).observe(top);
  }
  if (IO && dock) {
    var first = $('main > section'), quote = $('[data-hide-dock]');
    var pastFirst = false, nearQuote = false;
    var upd = function () { dock.classList.toggle('is-on', pastFirst && !nearQuote); };
    new IntersectionObserver(function (en) { pastFirst = !en[0].isIntersecting && en[0].boundingClientRect.top < 0; upd(); }, { threshold: 0.35 }).observe(first);
    if (quote) new IntersectionObserver(function (en) { nearQuote = en[0].isIntersecting; upd(); }, { rootMargin: '0px 0px -30% 0px' }).observe(quote);
  }

  /* ---------- Reveals ---------- */
  var revs = $$('[data-r]');
  revs.forEach(function (el) {
    var sibs = $$(':scope > [data-r]', el.parentElement), i = sibs.indexOf(el);
    if (i > 0) el.style.setProperty('--d', Math.min(i * 0.08, 0.48) + 's');
  });
  if (reduced || !IO) revs.forEach(function (el) { el.classList.add('is-in'); });
  else {
    var rio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        el.classList.add('is-in');
        rio.unobserve(el);
        if (el.classList.contains('ptile')) setTimeout(function () { el.classList.add('is-settled'); }, 1400);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.06 });
    revs.forEach(function (el) { rio.observe(el); });
  }

  // About page: fan out photos once in view
  $$('.fan').forEach(function (fan) {
    if (reduced || !IO) { fan.classList.add('is-in'); return; }
    var o = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { fan.classList.add('is-in'); o.disconnect(); } }, { threshold: 0.3 });
    o.observe(fan);
  });

  /* ---------- Count up ---------- */
  function countUp(el) {
    var end = parseInt(el.getAttribute('data-count'), 10), from = parseInt(el.getAttribute('data-from') || '0', 10);
    if (reduced || isNaN(end)) return;
    var t0 = null;
    (function step(t) {
      if (!t0) t0 = t;
      var p = Math.min((t - t0) / 1500, 1), e = 1 - Math.pow(1 - p, 4);
      el.textContent = String(Math.round(from + (end - from) * e));
      if (p < 1) requestAnimationFrame(step);
    })(performance.now());
  }
  if (IO) {
    var cio = new IntersectionObserver(function (en) { en.forEach(function (x) { if (x.isIntersecting) { countUp(x.target); cio.unobserve(x.target); } }); }, { threshold: 0.6 });
    $$('[data-count]').forEach(function (el) { cio.observe(el); });
  }

  /* ---------- Pointer effects (desktop only) ---------- */
  if (fine && !reduced) {
    function tilt(el, maxX, maxY, glare) {
      var raf = null;
      el.addEventListener('pointermove', function (e) {
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = null;
          var r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
          el.classList.add('is-tilting');
          el.style.setProperty('--ry', ((px - 0.5) * maxX).toFixed(2) + 'deg');
          el.style.setProperty('--rx', ((0.5 - py) * maxY).toFixed(2) + 'deg');
          if (glare) { el.style.setProperty('--gx', (px * 100).toFixed(1) + '%'); el.style.setProperty('--gy', (py * 100).toFixed(1) + '%'); }
        });
      });
      el.addEventListener('pointerleave', function () {
        el.classList.remove('is-tilting');
        el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg');
      });
    }
    $$('.ptile').forEach(function (el) { tilt(el, 8, 6, true); });
    $$('.card3d').forEach(function (el) { tilt(el, 14, 10, false); });
    $$('.why-card').forEach(function (c) {
      c.addEventListener('pointermove', function (e) {
        var r = c.getBoundingClientRect();
        c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        c.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* ---------- Home process story ---------- */
  var figs = $$('#storyCards figure'), steps = $$('.step'), bar = $('#storyBar');
  function setStep(i) {
    figs.forEach(function (f, k) { f.classList.toggle('is-active', k === i); f.classList.toggle('is-past', k < i); f.classList.toggle('is-next', k === i + 1); });
    steps.forEach(function (s, k) { s.classList.toggle('is-active', k === i); });
    if (bar) bar.style.transform = 'scaleX(' + ((i + 1) / steps.length) + ')';
  }
  if (steps.length) {
    setStep(0);
    if (IO) {
      var sio = new IntersectionObserver(function (en) { en.forEach(function (x) { if (x.isIntersecting) setStep(steps.indexOf(x.target)); }); }, { rootMargin: '-48% 0px -48% 0px' });
      steps.forEach(function (s) { sio.observe(s); });
    }
  }

  /* ---------- FAQ ---------- */
  $$('.qa > button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var qa = btn.parentElement, open = !qa.classList.contains('is-open');
      $$('.qa.is-open', qa.parentElement).forEach(function (o) { if (o !== qa) { o.classList.remove('is-open'); $('button', o).setAttribute('aria-expanded', 'false'); } });
      qa.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
  });

  /* ---------- Products page: category tabs with sliding pill ---------- */
  var tabs = $('.cat-tabs');
  if (tabs) {
    var tabLinks = $$('a', tabs), tpill = $('.cat-pill', tabs), active = tabLinks[0];
    function moveT(a) {
      if (!a || !tpill) return;
      tpill.style.width = a.offsetWidth + 'px';
      tpill.style.transform = 'translate3d(' + a.offsetLeft + 'px,0,0)';
      tabLinks.forEach(function (l) { l.classList.toggle('is-active', l === a); });
      var sc = tabs.querySelector('.cat-scroll');
      if (sc && sc.scrollWidth > sc.clientWidth) sc.scrollTo({ left: a.offsetLeft - 16, behavior: reduced ? 'auto' : 'smooth' });
    }
    var scr = tabs.querySelector('.cat-scroll');
    if (scr) scr.addEventListener('scroll', function () { scr.classList.toggle('at-end', scr.scrollLeft + scr.clientWidth >= scr.scrollWidth - 4); }, { passive: true });
    requestAnimationFrame(function () { moveT(active); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { moveT(active); });
    window.addEventListener('resize', function () { moveT(active); });
    if (IO) {
      var targets = tabLinks.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
      var tio = new IntersectionObserver(function (en) {
        en.forEach(function (x) { if (x.isIntersecting) { active = tabLinks[targets.indexOf(x.target)]; moveT(active); } });
      }, { rootMargin: '-40% 0px -55% 0px' });
      targets.forEach(function (t) { if (t) tio.observe(t); });
    }
  }

  /* ---------- Size visualizer (3D) ---------- */
  var sizeStage = $('#sizeStage');
  if (sizeStage) {
    var chips = $$('.size-chips button'), rW = $('#sizeW'), rD = $('#sizeD'), rName = $('#sizeName'), sizeQuote = $('#sizeQuote');
    var pick = function (b) {
      var w = +b.getAttribute('data-w'), dd = +b.getAttribute('data-d');
      chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c === b)); });
      window.dispatchEvent(new CustomEvent('pallet-size', { detail: { w: w, d: dd } }));
      rW.textContent = w; rD.textContent = dd;
      rName.textContent = b.getAttribute('data-name') || 'Built to order';
      if (sizeQuote) sizeQuote.href = 'contact.html?p=' + encodeURIComponent('Custom sized pallet') + '&size=' + encodeURIComponent(w + ' × ' + dd + ' cm') + '#quote';
    };
    chips.forEach(function (b) { b.addEventListener('click', function () { pick(b); }); });
    var def = $('.size-chips button[aria-pressed="true"]') || chips[0];
    if (def) pick(def);
  }

  /* ---------- Opening status (Gulf time, Mon–Sat 06:00–18:00) ---------- */
  $$('[data-status]').forEach(function (el) {
    try {
      var parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
      var get = function (t) { return (parts.find(function (p) { return p.type === t; }) || {}).value; };
      var day = get('weekday'), h = parseInt(get('hour'), 10), mi = parseInt(get('minute'), 10), mins = h * 60 + mi;
      var open = day !== 'Sun' && mins >= 360 && mins < 1080;
      var txt;
      if (open) txt = 'Open now, closes at 6 pm';
      else if (day === 'Sun') txt = 'Closed today, opens Monday 6 am';
      else if (mins < 360) txt = 'Closed now, opens today at 6 am';
      else txt = day === 'Sat' ? 'Closed now, opens Monday 6 am' : 'Closed now, opens tomorrow 6 am';
      el.classList.toggle('is-open', open);
      $('span', el).textContent = txt;
    } catch (_) { el.hidden = true; }
  });

  /* ---------- Quote form ---------- */
  var form = $('#quoteForm');
  if (form) {
    var params = new URLSearchParams(location.search);
    var pSel = form.querySelector('[name="product"]');
    if (params.get('p')) { Array.prototype.some.call(pSel.options, function (o) { if (o.value === params.get('p')) { pSel.value = o.value; return true; } }); }
    if (params.get('size')) form.querySelector('[name="size"]').value = params.get('size').slice(0, 40);

    var err = $('#formErr'), via = 'wa';
    $$('button[type="submit"]', form).forEach(function (b) { b.addEventListener('click', function () { via = b.getAttribute('data-via'); }); });
    var clean = function (v) { return String(v || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim(); };
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(form), v = {};
      ['name', 'company', 'phone', 'product', 'qty', 'size', 'cond', 'heat', 'emirate', 'msg'].forEach(function (k) { v[k] = clean(fd.get(k)); });
      var bad = [];
      $$('.f', form).forEach(function (f) { f.classList.remove('is-bad'); });
      if (v.name.length < 2) bad.push('name');
      if (!/^[0-9+\s\-()]{7,20}$/.test(v.phone)) bad.push('phone');
      if (bad.length) {
        bad.forEach(function (n) { form.querySelector('[name="' + n + '"]').closest('.f').classList.add('is-bad'); });
        err.textContent = 'Please add your ' + (bad.length > 1 ? 'name and phone number' : bad[0] === 'name' ? 'name' : 'phone number') + ' so we can send you the price.';
        err.hidden = false;
        form.querySelector('[name="' + bad[0] + '"]').focus();
        return;
      }
      err.hidden = true;
      var rows = [['Product', v.product], ['Quantity', v.qty], ['Size', v.size], ['New or used', v.cond], ['Heat treatment', v.heat], ['Delivery', v.emirate]].filter(function (r) { return r[1]; });
      var contact = [['Name', v.name], ['Company', v.company], ['Phone', v.phone]].filter(function (r) { return r[1]; });
      var wa = ['Hello Al Madhi Carpentry,', '', 'I would like a quotation for the following:', ''];
      rows.forEach(function (r) { wa.push('• ' + r[0] + ': ' + r[1]); });
      if (v.msg) { wa.push('', 'Notes: ' + v.msg); }
      wa.push('');
      contact.forEach(function (r) { wa.push(r[0] + ': ' + r[1]); });
      wa.push('', 'Sent from almadhicarpentry.com');
      if (via === 'mail') {
        var subject = 'Quotation request: ' + v.product + (v.qty ? ' (' + v.qty + ')' : '') + ' – ' + (v.company || v.name);
        var body = ['Dear Al Madhi Carpentry team,', '', 'Please send me a quotation for the following:', ''];
        rows.forEach(function (r) { body.push(r[0] + ': ' + r[1]); });
        if (v.msg) body.push('', 'Additional details:', v.msg);
        body.push('', 'Kind regards,', v.name);
        if (v.company) body.push(v.company);
        body.push(v.phone);
        window.location.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body.join('\n'));
      } else {
        var a = document.createElement('a');
        a.href = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(wa.join('\n'));
        a.target = '_blank'; a.rel = 'noopener noreferrer';
        document.body.appendChild(a); a.click(); a.remove();
      }
      var sent = $('#quoteSent');
      if (sent) {
        $('#sentTitle').textContent = via === 'mail' ? 'Your email is ready' : 'WhatsApp is ready';
        $('#sentText').textContent = via === 'mail'
          ? 'We opened your email app with everything filled in. Press send there to finish.'
          : 'We opened WhatsApp with everything filled in. Press send there to finish. You can attach a drawing or photo in the same chat.';
        form.hidden = true; sent.hidden = false;
      }
    });
    var again = $('#sentAgain');
    if (again) again.addEventListener('click', function () { $('#quoteSent').hidden = true; form.hidden = false; });
    $$('input, select, textarea', form).forEach(function (i) { i.addEventListener('input', function () { var f = i.closest('.f'); if (f) f.classList.remove('is-bad'); }); });
  }
})();

/* ---------- Cookie consent ----------
   Essential storage only today. Optional groups stay off until switched on.
   Future scripts: add <script type="text/plain" data-consent="analytics" data-src="..."></script>
   and they will load only after consent. */
(function () {
  'use strict';
  var KEY = 'amc-consent', VERSION = 1, MAX_AGE = 365 * 24 * 3600 * 1000;
  var doc = document;
  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (v && v.v === VERSION && Date.now() - v.t < MAX_AGE) return v;
    } catch (_) {}
    return null;
  }
  function write(c) {
    var v = { v: VERSION, t: Date.now(), analytics: !!c.analytics, marketing: !!c.marketing };
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (_) {}
    apply(v);
    return v;
  }
  function apply(v) {
    window.amcConsent = v;
    doc.querySelectorAll('script[type="text/plain"][data-consent]').forEach(function (s) {
      if (!v[s.getAttribute('data-consent')] || s.dataset.loaded) return;
      s.dataset.loaded = '1';
      var n = doc.createElement('script'); n.src = s.getAttribute('data-src'); n.async = true; doc.head.appendChild(n);
    });
    try { window.dispatchEvent(new CustomEvent('amc-consent', { detail: v })); } catch (_) {}
  }

  var icoCookie = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.3A9 9 0 1 1 11.7 3a3.5 3.5 0 0 0 4.3 4.3 3.5 3.5 0 0 0 5 5Z"/><circle cx="8.5" cy="10" r="1"/><circle cx="12" cy="15.5" r="1"/><circle cx="16" cy="13" r=".8"/></svg>';
  var wrap = doc.createElement('div');
  wrap.innerHTML =
    '<div class="ck" id="ck" role="region" aria-label="Cookie choice" hidden>' +
      '<div class="ck-row"><span class="ck-ico">' + icoCookie + '</span><div><p class="ck-t">Your privacy, your choice</p>' +
      '<p class="ck-d">We only use what the site needs to work. Optional cookies stay off unless you turn them on. <a href="cookies.html">Cookie policy</a></p></div></div>' +
      '<div class="ck-btns"><button type="button" class="btn btn-ghost btn-sm" data-ck="reject">Reject all</button><button type="button" class="btn btn-dark btn-sm" data-ck="accept">Accept all</button></div>' +
      '<button type="button" class="ck-more" data-ck="open">Choose what to allow</button>' +
    '</div>' +
    '<div class="ckp" id="ckp" hidden>' +
      '<div class="ckp-scrim" data-ck="close"></div>' +
      '<div class="ckp-panel" role="dialog" aria-modal="true" aria-labelledby="ckpT">' +
        '<div class="ckp-head"><h2 id="ckpT">Cookie settings</h2><button type="button" class="ckp-x" data-ck="close" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>' +
        '<p class="ckp-lead">Choose which cookies this site may use. You can change this any time from “Cookie settings” at the bottom of every page.</p>' +
        '<div class="ckp-list">' +
          row('essential', 'Essential', 'Remembers this choice. The site needs it, so it is always on.', true, true) +
          row('analytics', 'Analytics', 'Counts visits to see which pages help customers. Not in use today; off unless you allow it.', false, false) +
          row('marketing', 'Marketing', 'Measures adverts. Not in use today; off unless you allow it.', false, false) +
        '</div>' +
        '<div class="ckp-btns"><button type="button" class="btn btn-ghost" data-ck="reject">Reject all</button><button type="button" class="btn btn-ghost" data-ck="accept">Accept all</button><button type="button" class="btn btn-acc" data-ck="save">Save choices</button></div>' +
        '<p class="ckp-foot"><a href="cookies.html">Cookie policy</a><a href="privacy.html">Privacy policy</a></p>' +
      '</div>' +
    '</div>';
  function row(id, name, text, on, locked) {
    return '<div class="ckp-row"><div><p class="ckp-n">' + name + (locked ? ' <span>Always on</span>' : '') + '</p><p class="ckp-d" id="ckd-' + id + '">' + text + '</p></div>' +
      '<button type="button" class="sw" role="switch" aria-checked="' + on + '" aria-describedby="ckd-' + id + '" aria-label="' + name + ' cookies" data-sw="' + id + '"' + (locked ? ' disabled' : '') + '><i></i></button></div>';
  }
  function init() {
    while (wrap.firstChild) doc.body.appendChild(wrap.firstChild);
    var bar = doc.getElementById('ck'), panel = doc.getElementById('ckp');
    var current = read();
    var lastFocus = null;
    function showBar() { bar.hidden = false; requestAnimationFrame(function () { requestAnimationFrame(function () { bar.classList.add('is-on'); doc.documentElement.classList.add('ck-open'); }); }); }
    function hideBar() { bar.classList.remove('is-on'); doc.documentElement.classList.remove('ck-open'); setTimeout(function () { bar.hidden = true; }, 450); }
    function setSw(id, on) { var b = panel.querySelector('[data-sw="' + id + '"]'); if (b && !b.disabled) b.setAttribute('aria-checked', String(!!on)); }
    function openPanel() {
      var c = read() || { analytics: false, marketing: false };
      setSw('analytics', c.analytics); setSw('marketing', c.marketing);
      lastFocus = doc.activeElement;
      panel.hidden = false;
      requestAnimationFrame(function () { requestAnimationFrame(function () { panel.classList.add('is-on'); panel.querySelector('.ckp-x').focus(); }); });
    }
    function closePanel() {
      panel.classList.remove('is-on');
      setTimeout(function () { panel.hidden = true; }, 400);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function done(c) { write(c); hideBar(); if (!panel.hidden) closePanel(); }
    doc.addEventListener('click', function (e) {
      var t = e.target.closest('[data-ck],[data-sw],[data-cookie-settings]');
      if (!t) return;
      if (t.hasAttribute('data-cookie-settings')) { e.preventDefault(); openPanel(); return; }
      if (t.hasAttribute('data-sw')) { if (!t.disabled) t.setAttribute('aria-checked', String(t.getAttribute('aria-checked') !== 'true')); return; }
      var a = t.getAttribute('data-ck');
      if (a === 'accept') done({ analytics: true, marketing: true });
      else if (a === 'reject') done({ analytics: false, marketing: false });
      else if (a === 'open') openPanel();
      else if (a === 'close') closePanel();
      else if (a === 'save') done({
        analytics: panel.querySelector('[data-sw="analytics"]').getAttribute('aria-checked') === 'true',
        marketing: panel.querySelector('[data-sw="marketing"]').getAttribute('aria-checked') === 'true'
      });
    });
    doc.addEventListener('keydown', function (e) {
      if (panel.hidden) return;
      if (e.key === 'Escape') closePanel();
      if (e.key === 'Tab') {
        var f = panel.querySelectorAll('button:not([disabled]), a[href]'); if (!f.length) return;
        if (e.shiftKey && doc.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && doc.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
    if (current) apply(current);
    else setTimeout(showBar, 1600);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
