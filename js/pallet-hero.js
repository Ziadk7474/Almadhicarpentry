/* Interactive 3D pallet — ported from the original Hero3D component.
   Same model, same assembly animation, same Explode / Dimensions / Reset
   controls, now plain JS (no React / Babel at runtime). */
import * as THREE from '../assets/vendor/three/three.module.js';
import { OrbitControls } from '../assets/vendor/three/OrbitControls.js';

const NAIL_XZ = [-0.4, -0.2, 0, 0.2, 0.4].flatMap((z) => [-0.4, 0, 0.4].map((x) => ({ x, z })));
const SPEC = { W: 1.2, D: 1.0, topT: 0.022, barH: 0.038, blockH: 0.068, botT: 0.022 };
const TOP_SURFACE = SPEC.botT + SPEC.blockH + SPEC.barH + SPEC.topT;
const WOOD_HEX = { top: 0xf0dcb4, bar: 0xdec091, block: 0xe2c393, bottom: 0xe8cda0 };
const MIN_POLAR = (55 * Math.PI) / 180;
const MAX_POLAR = (82 * Math.PI) / 180;
const DEFAULT_AZ = (30 * Math.PI) / 180;
const DEFAULT_POLAR = (74 * Math.PI) / 180;
const IDLE_RESUME_MS = 5000;
const AUTO_ROTATE_SECONDS_PER_REV = 26;

class PalletHero {
  constructor() {
    this.heroEl = document.querySelector('.hero');
    this.stageEl = document.getElementById('palletStage');
    this.canvasEl = document.getElementById('palletCanvas');
    this.fallbackEl = document.getElementById('palletFallback');
    this.dimsEl = document.getElementById('palletDims');
    this.leadersEl = document.getElementById('palletLeaders');
    this.hintEl = document.getElementById('palletHint');
    this.explodeBtnEl = document.getElementById('btnExplode');
    this.explodeLabelEl = document.getElementById('explodeLabel');
    this.dimsBtnEl = document.getElementById('btnDims');
    this.cards = {};
    document.querySelectorAll('.pcard').forEach((el) => { this.cards[el.dataset.card] = el; });
    this.leaders = {};
    ['top', 'block', 'bar'].forEach((k) => {
      this.leaders[k] = { line: this.leadersEl.querySelector(`[data-l="${k}"]`), dot: this.leadersEl.querySelector(`[data-d="${k}"]`) };
    });
    this._dimRefs = {};
    this.dimsEl.querySelectorAll('[data-k]').forEach((el) => { this._dimRefs[el.dataset.k] = el; });

    this._reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this._disposables = [];
    this._exploded = false;
    this._dimsOn = false;
    this._hintShown = true;

    document.getElementById('btnReset').addEventListener('click', () => this._playResetView());
    this.explodeBtnEl.addEventListener('click', () => this._playToggleExplode());
    this.dimsBtnEl.addEventListener('click', () => this._playToggleDims());

    this._init();
  }

  _showFallback() {
    this.canvasEl.style.display = 'none';
    this.dimsEl.style.display = 'none';
    this.leadersEl.style.display = 'none';
    this.hintEl.style.display = 'none';
    Object.values(this.cards).forEach((c) => { c.style.display = 'none'; });
    const tb = this.stageEl.querySelector('.toolbar');
    if (tb) tb.style.display = 'none';
    this.fallbackEl.hidden = false;
  }

  _init() {
    const mobile = this._mobileLayout();
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: this.canvasEl, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (err) { this._showFallback(); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this._renderer = renderer;

    const scene = new THREE.Scene();
    this._scene = scene;
    const camera = new THREE.PerspectiveCamera(27, 1, 0.05, 20);
    this._camera = camera;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xd8dbe0, 1.05));
    const key = new THREE.DirectionalLight(0xffffff, 0.95);
    key.position.set(2.1, 3.3, 2.0);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xfff1e6, 0.5);
    fill.position.set(-2.3, 1.7, -1.5);
    scene.add(fill);

    const shadowTex = this._makeShadowTexture();
    const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
    const shadowGeo = new THREE.PlaneGeometry(1.75, 1.55);
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -0.003;
    scene.add(shadowMesh);
    this._shadowMesh = shadowMesh;
    this._disposables.push(shadowGeo, shadowMat, shadowTex);

    const grainTex = this._makeGrainTexture();
    this._disposables.push(grainTex);
    const makeWood = (hex) => {
      const m = new THREE.MeshStandardMaterial({ map: grainTex, color: hex, roughness: 0.82, metalness: 0 });
      this._disposables.push(m);
      return m;
    };
    const matTop = makeWood(WOOD_HEX.top), matBar = makeWood(WOOD_HEX.bar), matBlock = makeWood(WOOD_HEX.block), matBottom = makeWood(WOOD_HEX.bottom);

    const Y = {
      bottomA: SPEC.botT / 2,
      blockA: SPEC.botT + SPEC.blockH / 2,
      barA: SPEC.botT + SPEC.blockH + SPEC.barH / 2,
      topA: SPEC.botT + SPEC.blockH + SPEC.barH + SPEC.topT / 2,
    };
    this._Y = Y;
    const GAP = mobile
      ? { bottom: -0.045, block: 0.115, bar: 0.205, top: 0.32, nail: 0.44 }
      : { bottom: -0.06, block: 0.16, bar: 0.30, top: 0.46, nail: 0.62 };
    this._GAP = GAP;

    const group = new THREE.Group();
    scene.add(group);
    this._group = group;

    const bevel = (geo) => this._bevelBoxGeometry(geo, 0.0025);
    const geoTop = bevel(new THREE.BoxGeometry(SPEC.W, SPEC.topT, 0.17, 6, 1, 2));
    const geoBottom = bevel(new THREE.BoxGeometry(SPEC.W, SPEC.botT, 0.22, 6, 1, 2));
    const geoBar = bevel(new THREE.BoxGeometry(0.095, SPEC.barH, SPEC.D, 1, 1, 6));
    const geoBlock = bevel(new THREE.BoxGeometry(0.1, SPEC.blockH, 0.1, 2, 2, 2));
    this._disposables.push(geoTop, geoBottom, geoBar, geoBlock);

    const parts = [];
    const addPart = (geo, mat, x, z, yAssembled, yExploded, kind) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, yExploded, z);
      group.add(mesh);
      parts.push({ mesh, x, z, yAssembled, yExploded, kind });
    };
    [-0.4, -0.2, 0, 0.2, 0.4].forEach((z) => addPart(geoTop, matTop, 0, z, Y.topA, GAP.top, 'top'));
    [-0.35, 0, 0.35].forEach((z) => addPart(geoBottom, matBottom, 0, z, Y.bottomA, GAP.bottom, 'bottom'));
    [-0.4, 0, 0.4].forEach((x) => addPart(geoBar, matBar, x, 0, Y.barA, GAP.bar, 'bar'));
    [-0.4, 0, 0.4].forEach((x) => [-0.35, 0, 0.35].forEach((z) => addPart(geoBlock, matBlock, x, z, Y.blockA, GAP.block, 'block')));
    this._parts = parts;
    this._buildNails();

    this._explodedRadius = this._measureRadiusAndCenter(false).radius;
    const assembled = this._measureRadiusAndCenter(true);
    this._assembledRadius = assembled.radius;
    this._orbitTarget = assembled.center.clone();
    this._measureRadiusAndCenter(false);

    this._sizeRenderer();

    const controls = new OrbitControls(camera, this.canvasEl);
    controls.target.copy(this._orbitTarget);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.enablePan = false;
    controls.enableZoom = false; // page scroll stays page scroll
    controls.rotateSpeed = 0.75;
    controls.minPolarAngle = MIN_POLAR;
    controls.maxPolarAngle = MAX_POLAR;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 60 / AUTO_ROTATE_SECONDS_PER_REV;
    controls.enabled = false;
    this._controls = controls;
    // Touch: sideways drag turns the pallet, up/down still scrolls the page.
    this.canvasEl.style.touchAction = 'pan-y';

    this._setCameraSpherical(DEFAULT_AZ, DEFAULT_POLAR, this._distanceForRadius(this._explodedRadius, this._explodedMargin()));
    controls.update();
    controls.addEventListener('start', () => this._onUserInteractStart());
    controls.addEventListener('end', () => this._onUserInteractEnd());
    this._bindInteractionListeners();

    this._ro = new ResizeObserver(() => this._handleResize());
    this._ro.observe(this.stageEl);

    this.stageEl.classList.add('is-ready');

    if (this._reduced) { this._applyReducedMotionState(); return; }

    if ('IntersectionObserver' in window) {
      this._io = new IntersectionObserver((entries) => {
        const visible = !!(entries[0] && entries[0].isIntersecting);
        if (visible) { this._startLoop(); if (this._masterTl) this._masterTl.resume(); }
        else { this._stopLoop(); if (this._masterTl) this._masterTl.pause(); this._clearIdleTimer(); }
      }, { threshold: 0.05 });
      this._io.observe(this.stageEl);
    } else this._startLoop();

    document.addEventListener('visibilitychange', () => { if (document.hidden) this._stopLoop(); else this._startLoop(); });

    this._startIntroTimeline();
  }

  _sizeRenderer() {
    const w = this.stageEl.clientWidth || 1, h = this.stageEl.clientHeight || 1;
    this._renderer.setSize(w, h, false);
    this._camera.aspect = w / h;
    // Desktop: nudge the model left so the part labels get their own column.
    if (this._cardsLayout()) this._camera.setViewOffset(w, h, Math.round(w * 0.1), 0, w, h);
    else this._camera.clearViewOffset();
    this._camera.updateProjectionMatrix();
  }

  _applyReducedMotionState() {
    this._parts.forEach((p) => { if (p.mesh) p.mesh.position.y = p.yAssembled; });
    this._nailShared.y = TOP_SURFACE;
    this._updateNailInstances();
    this._setCameraSpherical(DEFAULT_AZ, DEFAULT_POLAR, this._distanceForRadius(this._assembledRadius, this._assembledMargin()));
    this._controls.enabled = true;
    this._controls.update();
    this._reveal();
    this._startLoop();
  }

  _buildNails() {
    const shaftGeo = new THREE.CylinderGeometry(0.0026, 0.0026, 0.02, 8);
    const headGeo = new THREE.CylinderGeometry(0.0058, 0.0058, 0.0026, 12);
    const matNail = new THREE.MeshStandardMaterial({ color: 0x5b6066, metalness: 0.6, roughness: 0.45 });
    this._disposables.push(shaftGeo, headGeo, matNail);
    const n = NAIL_XZ.length;
    this._nailShaftMesh = new THREE.InstancedMesh(shaftGeo, matNail, n);
    this._nailHeadMesh = new THREE.InstancedMesh(headGeo, matNail, n);
    // Instanced meshes cache their bounds the first time they are measured,
    // which would freeze the nails at their exploded height for framing and
    // culling. Turn culling off and clear the cache before every measure.
    this._nailShaftMesh.frustumCulled = false;
    this._nailHeadMesh.frustumCulled = false;
    this._group.add(this._nailShaftMesh, this._nailHeadMesh);
    this._nailDummy = new THREE.Object3D();
    this._nailShared = { y: this._GAP.nail };
    this._updateNailInstances();
  }

  _updateNailInstances() {
    if (!this._nailShaftMesh) return;
    const y = this._nailShared.y, d = this._nailDummy;
    NAIL_XZ.forEach((p, i) => {
      d.position.set(p.x, y - 0.01, p.z); d.updateMatrix(); this._nailShaftMesh.setMatrixAt(i, d.matrix);
      d.position.set(p.x, y + 0.0013, p.z); d.updateMatrix(); this._nailHeadMesh.setMatrixAt(i, d.matrix);
    });
    this._nailShaftMesh.instanceMatrix.needsUpdate = true;
    this._nailHeadMesh.instanceMatrix.needsUpdate = true;
  }

  _bevelBoxGeometry(geo, amount) {
    const pos = geo.attributes.position;
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const nX0 = Math.abs(x - bb.min.x) < 1e-6, nX1 = Math.abs(x - bb.max.x) < 1e-6;
      const nY0 = Math.abs(y - bb.min.y) < 1e-6, nY1 = Math.abs(y - bb.max.y) < 1e-6;
      const nZ0 = Math.abs(z - bb.min.z) < 1e-6, nZ1 = Math.abs(z - bb.max.z) < 1e-6;
      const edges = (nX0 || nX1 ? 1 : 0) + (nY0 || nY1 ? 1 : 0) + (nZ0 || nZ1 ? 1 : 0);
      if (edges >= 2) {
        if (nX0) x += amount; if (nX1) x -= amount;
        if (nY0) y += amount; if (nY1) y -= amount;
        if (nZ0) z += amount; if (nZ1) z -= amount;
        pos.setXYZ(i, x, y, z);
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }

  _measureRadiusAndCenter(assembled) {
    this._parts.forEach((p) => { if (p.mesh) p.mesh.position.y = assembled ? p.yAssembled : p.yExploded; });
    this._nailShared.y = assembled ? TOP_SURFACE : this._GAP.nail;
    this._updateNailInstances();
    [this._nailShaftMesh, this._nailHeadMesh].forEach((m) => { m.boundingBox = null; m.boundingSphere = null; });
    this._group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this._group);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    return { radius: sphere.radius, center: sphere.center.clone() };
  }

  _distanceForRadius(radius, margin) {
    const w = this.stageEl.clientWidth || 1, h = this.stageEl.clientHeight || 1;
    const vFov = (this._camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (w / h));
    return Math.max(radius / Math.sin(vFov / 2), radius / Math.sin(hFov / 2)) * margin;
  }

  _mobileLayout() { return window.matchMedia('(max-width: 960px)').matches; }
  _cardsLayout() { return window.matchMedia('(min-width: 1181px)').matches; }
  _narrowDesktopLayout() { return window.matchMedia('(min-width: 961px) and (max-width: 1180px)').matches; }
  _assembledMargin() { return this._mobileLayout() ? (window.innerWidth > 600 ? 0.86 : 1.0) : this._narrowDesktopLayout() ? 0.98 : 1.03; }
  _explodedMargin() { return this._mobileLayout() ? (window.innerWidth > 600 ? 0.94 : 1.08) : this._narrowDesktopLayout() ? 1.08 : 1.14; }

  _setCameraSpherical(theta, phi, radius) {
    const offset = new THREE.Vector3().setFromSphericalCoords(radius, phi, theta);
    this._camera.position.copy(this._orbitTarget).add(offset);
    this._camera.lookAt(this._orbitTarget);
  }

  _currentSpherical() {
    const target = this._controls ? this._controls.target : this._orbitTarget;
    return new THREE.Spherical().setFromVector3(this._camera.position.clone().sub(target));
  }

  _tweenSpherical(theta, phi, radius, duration, opts) {
    const gsap = window.gsap;
    const cur = this._currentSpherical();
    const dTheta = ((theta - cur.theta + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    const proxy = { theta: cur.theta, phi: cur.phi, radius: cur.radius };
    const apply = () => {
      const offset = new THREE.Vector3().setFromSphericalCoords(proxy.radius, proxy.phi, proxy.theta);
      this._camera.position.copy(this._controls.target).add(offset);
      this._controls.update();
    };
    if (this._viewTween) this._viewTween.kill();
    if (!gsap) {
      Object.assign(proxy, { theta: cur.theta + dTheta, phi, radius }); apply();
      if (opts && opts.onComplete) opts.onComplete();
      return;
    }
    this._viewTween = gsap.to(proxy, {
      theta: cur.theta + dTheta, phi, radius, duration, ease: 'power3.inOut',
      onUpdate: apply,
      onComplete: () => { if (opts && opts.onComplete) opts.onComplete(); },
    });
  }

  _bindInteractionListeners() {
    const el = this.canvasEl;
    el.addEventListener('pointerdown', () => { this._isPointerDown = true; this.stageEl.classList.add('is-dragging'); this._hideHint(); this._onUserInteractStart(); });
    window.addEventListener('pointerup', () => {
      if (!this._isPointerDown) return;
      this._isPointerDown = false; this.stageEl.classList.remove('is-dragging'); this._onUserInteractEnd();
    });
    el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') this._onUserInteractStart(); });
    el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !this._isPointerDown) this._onUserInteractEnd(); });
    el.addEventListener('keydown', (e) => {
      if (!this._controls || !this._controls.enabled) return;
      const step = (8 * Math.PI) / 180;
      const cur = this._currentSpherical();
      let theta = cur.theta, phi = cur.phi;
      if (e.key === 'ArrowLeft') theta -= step;
      else if (e.key === 'ArrowRight') theta += step;
      else if (e.key === 'ArrowUp') phi = Math.max(MIN_POLAR, cur.phi - step);
      else if (e.key === 'ArrowDown') phi = Math.min(MAX_POLAR, cur.phi + step);
      else return;
      e.preventDefault();
      this._hideHint(); this._onUserInteractStart();
      const offset = new THREE.Vector3().setFromSphericalCoords(cur.radius, phi, theta);
      this._camera.position.copy(this._controls.target).add(offset);
      this._controls.update();
      this._onUserInteractEnd();
    });
  }

  _hideHint() {
    if (!this._hintShown) return;
    this._hintShown = false;
    this.hintEl.classList.add('is-hidden');
  }

  _onUserInteractStart() {
    if (!this._controls || !this._controls.enabled) return;
    this._clearIdleTimer();
    this._controls.autoRotate = false;
    this._setCardsVisible(false);
    this.leadersEl.classList.remove('is-visible');
  }

  _reveal() {
    this._updateDims(); this._updateCards(); this._setCardsVisible(true);
    if (this._cardsLayout()) this.leadersEl.classList.add('is-visible');
  }

  _onUserInteractEnd() {
    if (!this._controls || !this._controls.enabled) return;
    this._clearIdleTimer();
    this._idleTimer = setTimeout(() => {
      if (!this._reduced) this._controls.autoRotate = true;
      this._reveal();
    }, IDLE_RESUME_MS);
    setTimeout(() => { if (!this._isPointerDown) this._reveal(); }, 260);
  }

  _clearIdleTimer() { if (this._idleTimer) { clearTimeout(this._idleTimer); this._idleTimer = null; } }

  _setCardsVisible(v) {
    const show = v && this._cardsLayout();
    Object.values(this.cards).forEach((c) => c.classList.toggle('is-visible', show));
  }

  _handleResize() {
    if (!this._renderer) return;
    this._sizeRenderer();
    if (this._controls && this._controls.enabled) {
      const radius = this._exploded
        ? this._distanceForRadius(this._explodedRadius, this._explodedMargin())
        : this._distanceForRadius(this._assembledRadius, this._assembledMargin());
      const cur = this._currentSpherical();
      const offset = new THREE.Vector3().setFromSphericalCoords(radius, cur.phi, cur.theta);
      this._camera.position.copy(this._controls.target).add(offset);
      this._controls.update();
    }
    this._updateDims(); this._updateCards();
    if (!this._active) { this._updateNailInstances(); this._renderer.render(this._scene, this._camera); }
  }

  _startLoop() {
    if (this._active || !this._renderer) return;
    this._active = true;
    const loop = () => {
      if (!this._active) { this._raf = null; return; }
      this._updateNailInstances();
      if (this._controls) {
        this._controls.update();
        if (this._controls.autoRotate) { this._updateCards(); if (this._dimsOn) this._updateDims(); }
      }
      this._renderer.render(this._scene, this._camera);
      this._raf = requestAnimationFrame(loop);
    };
    loop();
  }

  _stopLoop() {
    this._active = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
  }

  _makeGrainTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    let seed = 11;
    const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 46; i++) {
      const y = rand() * c.height, h = 0.5 + rand() * 1.6, s = 0.86 + rand() * 0.18;
      ctx.fillStyle = `rgba(${Math.round(140 * s)},${Math.round(112 * s)},${Math.round(74 * s)},${0.08 + rand() * 0.1})`;
      ctx.fillRect(0, y, c.width, h);
    }
    for (let i = 0; i < 3; i++) {
      const x = rand() * c.width, y = rand() * c.height, r = 2 + rand() * 3;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(120,86,50,0.22)'); g.addColorStop(1, 'rgba(120,86,50,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 1.2);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _makeShadowTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
    g.addColorStop(0, 'rgba(16,19,24,0.26)'); g.addColorStop(0.55, 'rgba(16,19,24,0.12)'); g.addColorStop(1, 'rgba(16,19,24,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _startIntroTimeline() {
    const gsap = window.gsap;
    if (!gsap) {
      let tries = 0;
      this._gsapPoll = setInterval(() => {
        tries++;
        if (window.gsap) { clearInterval(this._gsapPoll); this._startIntroTimeline(); }
        else if (tries > 60) { clearInterval(this._gsapPoll); this._applyReducedMotionState(); }
      }, 80);
      return;
    }
    const parts = this._parts;
    const byKind = (k) => parts.filter((p) => p.kind === k);
    const bottom = byKind('bottom'), block = byKind('block'), bar = byKind('bar'), top = byKind('top');
    const posArr = (list) => list.map((p) => p.mesh.position);
    const toAssembled = (list) => (i) => list[i].yAssembled;

    parts.forEach((p) => { p.mesh.position.y = p.yExploded; });
    this._nailShared.y = this._GAP.nail;

    const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
    this._masterTl = tl;
    tl.to({}, { duration: 0.45 })
      .addLabel('assemble')
      .to(posArr(bottom), { y: toAssembled(bottom), duration: 0.55, stagger: 0.05 }, 'assemble')
      .to(posArr(block), { y: toAssembled(block), duration: 0.55, stagger: 0.025 }, 'assemble+=0.35')
      .to(posArr(bar), { y: toAssembled(bar), duration: 0.6, stagger: 0.07 }, 'assemble+=0.85')
      .to(posArr(top), { y: toAssembled(top), duration: 0.65, stagger: 0.05 }, 'assemble+=1.4')
      .to(this._nailShared, { y: TOP_SURFACE, duration: 0.45, ease: 'power2.in' }, 'assemble+=2.15')
      .addLabel('settle', 'assemble+=2.65')
      .to(this._group.position, { y: -0.008, duration: 0.14, ease: 'power1.out' }, 'settle')
      .to(this._group.position, { y: 0, duration: 0.28, ease: 'elastic.out(1, 0.5)' }, 'settle+=0.14')
      .call(() => {
        this._tweenSpherical(DEFAULT_AZ, DEFAULT_POLAR, this._distanceForRadius(this._assembledRadius, this._assembledMargin()), 0.8);
      }, null, 'settle+=0.05')
      .addLabel('reveal', 'settle+=0.85')
      .call(() => {
        this._controls.enabled = true;
        this._controls.update();
        this._reveal();
        this._controls.autoRotate = true;
      }, null, 'reveal');
  }

  _playToggleExplode() {
    if (!this._parts || this._tlBusy || !this._controls || !this._controls.enabled) return;
    const gsap = window.gsap;
    if (!gsap) return;
    this._tlBusy = true;
    this._exploded = !this._exploded;
    this._controls.autoRotate = false;
    this._clearIdleTimer();
    this._setCardsVisible(false);
    this.leadersEl.classList.remove('is-visible');
    const parts = this._parts;
    const targetY = (p) => (this._exploded ? p.yExploded : p.yAssembled);
    gsap.to(parts.map((p) => p.mesh.position), { y: (i) => targetY(parts[i]), duration: 0.9, stagger: 0.02, ease: 'power3.inOut' });
    gsap.to(this._nailShared, { y: this._exploded ? this._GAP.nail : TOP_SURFACE, duration: 0.7, ease: 'power3.inOut' });
    const radius = this._exploded
      ? this._distanceForRadius(this._explodedRadius, this._explodedMargin())
      : this._distanceForRadius(this._assembledRadius, this._assembledMargin());
    const cur = this._currentSpherical();
    this._tweenSpherical(cur.theta, cur.phi, radius, 0.9, {
      onComplete: () => { this._tlBusy = false; this._reveal(); },
    });
    this.explodeLabelEl.textContent = this._exploded ? 'Assemble' : 'Explode';
    this.explodeBtnEl.setAttribute('aria-pressed', String(this._exploded));
    this._onUserInteractEnd();
  }

  _playResetView() {
    if (!this._controls || !this._controls.enabled) return;
    this._hideHint();
    this._clearIdleTimer();
    this._controls.autoRotate = false;
    this._setCardsVisible(false);
    this.leadersEl.classList.remove('is-visible');
    const radius = this._exploded
      ? this._distanceForRadius(this._explodedRadius, this._explodedMargin())
      : this._distanceForRadius(this._assembledRadius, this._assembledMargin());
    this._tweenSpherical(DEFAULT_AZ, DEFAULT_POLAR, radius, 0.8, { onComplete: () => this._onUserInteractEnd() });
  }

  _playToggleDims() {
    this._dimsOn = !this._dimsOn;
    this.dimsEl.classList.toggle('is-on', this._dimsOn);
    this.dimsBtnEl.setAttribute('aria-pressed', String(this._dimsOn));
    if (this._dimsOn) this._updateDims();
  }

  _project(x, y, z) {
    const w = this.stageEl.clientWidth || 1, h = this.stageEl.clientHeight || 1;
    const v = new THREE.Vector3(x, y, z).project(this._camera);
    return { x: (v.x * 0.5 + 0.5) * w, y: (1 - (v.y * 0.5 + 0.5)) * h };
  }

  _updateCards() {
    if (!this._camera || !this._cardsLayout()) return;
    const w = this.stageEl.clientWidth || 1, h = this.stageEl.clientHeight || 1;
    const Y = this._Y;
    const anchors = this._exploded
      ? { top: [0.58, this._GAP.top, 0.3], block: [0.46, this._GAP.block, 0.36], bar: [0.4, this._GAP.bar, 0.5] }
      : { top: [0.58, TOP_SURFACE, 0.3], block: [0.46, Y.blockA, 0.36], bar: [0.4, Y.barA, 0.5] };
    const pts = { top: this._project(...anchors.top), block: this._project(...anchors.block), bar: this._project(...anchors.bar) };
    const order = ['top', 'bar', 'block'];
    // Right edge of the real silhouette (all eight corners), not just the anchors.
    const yTop = this._exploded ? this._GAP.top : TOP_SURFACE, yBot = this._exploded ? this._GAP.bottom : 0;
    let silX = 0;
    [-0.62, 0.62].forEach((x) => [-0.52, 0.52].forEach((z) => [yBot, yTop].forEach((y) => { silX = Math.max(silX, this._project(x, y, z).x); })));
    const colX = Math.min(silX + 28, w - 184);
    const spacing = 92;
    const halfSpan = spacing + 40;
    const rawCenterY = order.reduce((s, k) => s + pts[k].y, 0) / order.length;
    const centerY = Math.max(halfSpan + 50, Math.min(rawCenterY, h - halfSpan - 64));
    order.forEach((k, i) => {
      const ty = centerY + (i - 1) * spacing;
      const card = this.cards[k];
      if (card) { card.style.left = colX + 'px'; card.style.top = ty + 'px'; }
      const L = this.leaders[k];
      if (L.line) { L.line.setAttribute('x1', pts[k].x); L.line.setAttribute('y1', pts[k].y); L.line.setAttribute('x2', colX - 6); L.line.setAttribute('y2', ty); }
      if (L.dot) { L.dot.setAttribute('cx', pts[k].x); L.dot.setAttribute('cy', pts[k].y); }
    });
    this.leadersEl.setAttribute('viewBox', `0 0 ${Math.round(w)} ${Math.round(h)}`);
  }

  _updateDims() {
    if (!this._camera) return;
    const w = this.stageEl.clientWidth || 1, h = this.stageEl.clientHeight || 1;
    this.dimsEl.setAttribute('viewBox', `0 0 ${Math.round(w)} ${Math.round(h)}`);
    const set = (el, a) => { if (el) Object.keys(a).forEach((k) => el.setAttribute(k, a[k])); };
    const R = this._dimRefs, Y = this._Y;

    const wl = this._project(-0.62, Y.bottomA, 0.58), wr = this._project(0.62, Y.bottomA, 0.58);
    set(R.width, { x1: wl.x, y1: wl.y + 14, x2: wr.x, y2: wr.y + 14 });
    set(R.widthTickA, { x1: wl.x, y1: wl.y + 9, x2: wl.x, y2: wl.y + 19 });
    set(R.widthTickB, { x1: wr.x, y1: wr.y + 9, x2: wr.x, y2: wr.y + 19 });
    set(R.widthDotA, { cx: wl.x, cy: wl.y + 14 });
    set(R.widthDotB, { cx: wr.x, cy: wr.y + 14 });
    set(R.widthText, { x: (wl.x + wr.x) / 2, y: (wl.y + wr.y) / 2 + 32 });

    const textHalf = 30;
    const df = this._project(-0.62, Y.bottomA, 0.5), db = this._project(-0.62, Y.bottomA, -0.5);
    const dX = Math.max(Math.min(df.x, db.x) - 14, textHalf);
    set(R.depth, { x1: dX, y1: df.y, x2: dX, y2: db.y });
    set(R.depthTickA, { x1: dX - 6, y1: df.y, x2: dX + 6, y2: df.y });
    set(R.depthTickB, { x1: dX - 6, y1: db.y, x2: dX + 6, y2: db.y });
    set(R.depthDotA, { cx: dX, cy: df.y });
    set(R.depthDotB, { cx: dX, cy: db.y });
    set(R.depthText, { x: dX, y: (df.y + db.y) / 2 + 4 });

    const hb = this._project(-0.62, 0, 0.6), ht = this._project(-0.62, TOP_SURFACE, 0.6);
    const hX = Math.max(Math.min(hb.x, ht.x) - 14, textHalf);
    set(R.height, { x1: hX, y1: hb.y, x2: hX, y2: ht.y });
    set(R.heightTickA, { x1: hX - 6, y1: hb.y, x2: hX + 6, y2: hb.y });
    set(R.heightTickB, { x1: hX - 6, y1: ht.y, x2: hX + 6, y2: ht.y });
    set(R.heightDotA, { cx: hX, cy: hb.y });
    set(R.heightDotB, { cx: hX, cy: ht.y });
    set(R.heightText, { x: hX, y: (hb.y + ht.y) / 2 + 4 });
  }
}

try { new PalletHero(); }
catch (err) {
  const fb = document.getElementById('palletFallback');
  const cv = document.getElementById('palletCanvas');
  if (fb) fb.hidden = false;
  if (cv) cv.style.display = 'none';
}
