/* Size viewer — the same 3D pallet as the home page (same boards, blocks,
   nails, wood and light), rebuilt live for any size. Tapping a size morphs
   the pallet smoothly: boards stretch, slide and are added or removed.
   The camera stays fixed, so you see the real difference between sizes. */
import * as THREE from '../assets/vendor/three/three.module.js';
import { OrbitControls } from '../assets/vendor/three/OrbitControls.js';

const T = { top: 0.022, bar: 0.038, block: 0.068, bot: 0.022 };
const Y = {
  bot: T.bot / 2,
  block: T.bot + T.block / 2,
  bar: T.bot + T.block + T.bar / 2,
  top: T.bot + T.block + T.bar + T.top / 2,
  surface: T.bot + T.block + T.bar + T.top,
};
const WOOD = { top: 0xf0dcb4, bar: 0xdec091, block: 0xe2c393, bottom: 0xe8cda0 };
const MAX_TOP = 9;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Board layout for a pallet L (along the boards) × D (across). Same rules as
   the 1200 × 1000 home pallet: 5 top boards per metre of depth, 3 bars,
   3 × 3 blocks, 3 bottom boards. */
function layout(L, D) {
  const n = Math.max(3, Math.min(MAX_TOP, Math.round(D / 0.2)));
  const bw = Math.min(0.17, (D / n) * 0.85);
  const tops = [];
  for (let i = 0; i < MAX_TOP; i++) {
    if (i < n) tops.push({ z: n === 1 ? 0 : -D / 2 + bw / 2 + (i * (D - bw)) / (n - 1), w: bw, s: 1 });
    else tops.push({ z: D / 2 - bw / 2, w: bw, s: 0 });
  }
  const barW = Math.min(0.095, L * 0.09);
  const bx = [-L / 2 + barW / 2 + 0.005, 0, L / 2 - barW / 2 - 0.005];
  const blockD = Math.min(0.1, D * 0.12);
  const bz = [-D / 2 + blockD / 2 + 0.005, 0, D / 2 - blockD / 2 - 0.005];
  const botW = Math.min(0.22, D * 0.2);
  const botZ = [-D / 2 + botW / 2, 0, D / 2 - botW / 2];
  return { L, D, n, tops, barW, bx, blockD, bz, botW, botZ };
}

function grainTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 256, 64);
  let seed = 11;
  const r = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let i = 0; i < 46; i++) {
    const s = 0.86 + r() * 0.18;
    x.fillStyle = `rgba(${Math.round(140 * s)},${Math.round(112 * s)},${Math.round(74 * s)},${0.08 + r() * 0.1})`;
    x.fillRect(0, r() * 64, 256, 0.5 + r() * 1.6);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 1.2);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 8, 128, 128, 128);
  g.addColorStop(0, 'rgba(16,19,24,0.26)'); g.addColorStop(0.55, 'rgba(16,19,24,0.12)'); g.addColorStop(1, 'rgba(16,19,24,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Unit box with a small bevel on its edges, scaled per board at runtime.
function unitBox(segX, segZ) {
  const g = new THREE.BoxGeometry(1, 1, 1, segX, 1, segZ);
  const p = g.attributes.position, a = 0.02;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ex = Math.abs(Math.abs(x) - 0.5) < 1e-6, ey = Math.abs(Math.abs(y) - 0.5) < 1e-6, ez = Math.abs(Math.abs(z) - 0.5) < 1e-6;
    if ((ex ? 1 : 0) + (ey ? 1 : 0) + (ez ? 1 : 0) >= 2) {
      if (ex) x -= Math.sign(x) * a * 0.12;
      if (ey) y -= Math.sign(y) * a;
      if (ez) z -= Math.sign(z) * a * 0.12;
      p.setXYZ(i, x, y, z);
    }
  }
  g.computeVertexNormals();
  return g;
}

class SizeViewer {
  constructor(stage) {
    this.stage = stage;
    this.canvas = stage.querySelector('canvas');
    const r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.r = r;
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(27, 1, 0.05, 30);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xd8dbe0, 1.05));
    const key = new THREE.DirectionalLight(0xffffff, 0.95); key.position.set(2.1, 3.3, 2.0); this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xfff1e6, 0.5); fill.position.set(-2.3, 1.7, -1.5); this.scene.add(fill);

    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = -0.003;
    this.scene.add(this.shadow);

    const grain = grainTexture();
    const mat = (hex) => new THREE.MeshStandardMaterial({ map: grain, color: hex, roughness: 0.82, metalness: 0 });
    const mTop = mat(WOOD.top), mBar = mat(WOOD.bar), mBlock = mat(WOOD.block), mBot = mat(WOOD.bottom);
    const gLong = unitBox(6, 2), gBar = unitBox(1, 6), gBlock = unitBox(2, 2);

    this.group = new THREE.Group();
    this.scene.add(this.group);
    const add = (g, m) => { const o = new THREE.Mesh(g, m); this.group.add(o); return o; };
    this.topM = Array.from({ length: MAX_TOP }, () => add(gLong, mTop));
    this.barM = Array.from({ length: 3 }, () => add(gBar, mBar));
    this.blockM = Array.from({ length: 9 }, () => add(gBlock, mBlock));
    this.botM = Array.from({ length: 3 }, () => add(gLong, mBot));

    const nailMat = new THREE.MeshStandardMaterial({ color: 0x5b6066, metalness: 0.6, roughness: 0.45 });
    this.nails = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0058, 0.0058, 0.0026, 12), nailMat, MAX_TOP * 3);
    this.nails.frustumCulled = false;
    this.group.add(this.nails);
    this.dummy = new THREE.Object3D();

    // Current (animated) state starts at the target
    this.cur = this.pack(layout(1.2, 1.0));
    this.tgt = this.pack(layout(1.2, 1.0));

    const c = new OrbitControls(this.cam, this.canvas);
    c.enableDamping = true; c.dampingFactor = 0.07; c.enablePan = false; c.enableZoom = false;
    c.rotateSpeed = 0.75; c.minPolarAngle = (55 * Math.PI) / 180; c.maxPolarAngle = (82 * Math.PI) / 180;
    c.autoRotate = !reduced; c.autoRotateSpeed = 60 / 30;
    c.target.set(0, -0.02, 0);
    this.controls = c;
    this.canvas.style.touchAction = 'pan-y';
    let idle;
    c.addEventListener('start', () => { clearTimeout(idle); c.autoRotate = false; });
    c.addEventListener('end', () => { clearTimeout(idle); idle = setTimeout(() => { c.autoRotate = !reduced; }, 4000); });

    this.resize();
    new ResizeObserver(() => this.resize()).observe(stage);
    new IntersectionObserver((e) => { this.visible = e[0].isIntersecting; if (this.visible) this.start(); }, { threshold: 0.02 }).observe(stage);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && this.visible) this.start(); });

    this.apply(this.cur);
    this.checkVisible();
    this.start();
    stage.classList.add('is-ready');
  }

  // Flatten a layout into numbers so it can be eased value by value
  pack(l) {
    const v = [l.L, l.D, l.barW, l.blockD, l.botW];
    l.tops.forEach((t) => v.push(t.z, t.w, t.s));
    l.bx.forEach((x) => v.push(x));
    l.bz.forEach((z) => v.push(z));
    l.botZ.forEach((z) => v.push(z));
    return v;
  }

  apply(v) {
    let k = 0;
    const L = v[k++], D = v[k++], barW = v[k++], blockD = v[k++], botW = v[k++];
    const tops = [];
    for (let i = 0; i < MAX_TOP; i++) tops.push({ z: v[k++], w: v[k++], s: v[k++] });
    const bx = [v[k++], v[k++], v[k++]], bz = [v[k++], v[k++], v[k++]], botZ = [v[k++], v[k++], v[k++]];

    tops.forEach((t, i) => {
      const m = this.topM[i];
      const s = Math.max(t.s, 0.0001);
      m.visible = t.s > 0.01;
      m.position.set(0, Y.top + (1 - s) * 0.12, t.z);
      m.scale.set(L * (0.6 + 0.4 * s), T.top, t.w * s);
    });
    this.barM.forEach((m, i) => { m.position.set(bx[i], Y.bar, 0); m.scale.set(barW, T.bar, D); });
    this.blockM.forEach((m, i) => { m.position.set(bx[i % 3], Y.block, bz[Math.floor(i / 3)]); m.scale.set(Math.max(barW, 0.06) * 1.05, T.block, blockD); });
    this.botM.forEach((m, i) => { m.position.set(0, Y.bot, botZ[i]); m.scale.set(L, T.bot, botW); });

    let n = 0;
    tops.forEach((t) => {
      if (t.s < 0.6) return;
      bx.forEach((x) => {
        this.dummy.position.set(x, Y.surface + 0.0013, t.z);
        this.dummy.scale.setScalar(Math.min(1, t.s));
        this.dummy.updateMatrix();
        this.nails.setMatrixAt(n++, this.dummy.matrix);
      });
    });
    this.nails.count = n;
    this.nails.instanceMatrix.needsUpdate = true;
    this.shadow.scale.set(L * 1.5, D * 1.6, 1);
  }

  checkVisible() {
    const r = this.stage.getBoundingClientRect();
    this.visible = r.bottom > 0 && r.top < (window.innerHeight || 800);
    return this.visible;
  }

  setSize(lengthCm, depthCm) {
    this.checkVisible();
    this.tgt = this.pack(layout(lengthCm / 100, depthCm / 100));
    if (reduced) { this.cur = this.tgt.slice(); this.apply(this.cur); this.render(); }
    this.start();
  }

  resize() {
    const w = this.stage.clientWidth || 1, h = this.stage.clientHeight || 1;
    this.r.setSize(w, h, false);
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
    // Fixed framing for the biggest size we list (1.4 m), so sizes compare honestly
    const radius = 0.98;
    const vF = (this.cam.fov * Math.PI) / 360, hF = Math.atan(Math.tan(vF) * this.cam.aspect);
    const dist = Math.max(radius / Math.sin(vF), radius / Math.sin(hF)) * (w < 600 ? 0.86 : 0.74);
    const off = new THREE.Vector3().setFromSphericalCoords(dist, (72 * Math.PI) / 180, (30 * Math.PI) / 180);
    if (this.framed) {
      const cur = new THREE.Spherical().setFromVector3(this.cam.position.clone().sub(this.controls.target));
      off.setFromSphericalCoords(dist, cur.phi, cur.theta);
    }
    this.framed = true;
    this.cam.position.set(0, -0.02, 0).add(off);
    this.cam.lookAt(0, -0.02, 0);
    this.render();
  }

  render() { this.r.render(this.scene, this.cam); }

  start() {
    if (this.raf || !this.visible) return;
    let last = performance.now();
    const tick = (now) => {
      this.raf = null;
      if (!this.visible || document.hidden) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const a = 1 - Math.exp(-dt * 7);
      let moving = false;
      for (let i = 0; i < this.cur.length; i++) {
        const d = this.tgt[i] - this.cur[i];
        if (Math.abs(d) > 0.0004) { this.cur[i] += d * a; moving = true; } else this.cur[i] = this.tgt[i];
      }
      this.apply(this.cur);
      this.controls.update();
      this.render();
      if (moving || this.controls.autoRotate || this.dragging !== false) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
}

const stage = document.getElementById('sizeStage');
if (stage) {
  let viewer = null;
  const pending = { w: 100, d: 120 };
  const init = () => {
    if (viewer) return;
    try { viewer = new SizeViewer(stage); viewer.setSize(pending.d, pending.w); }
    catch (e) { stage.classList.add('no-3d'); }
  };
  window.addEventListener('pallet-size', (e) => {
    pending.w = e.detail.w; pending.d = e.detail.d;
    if (viewer) viewer.setSize(pending.d, pending.w);
  });
  new IntersectionObserver((e, o) => { if (e[0].isIntersecting) { init(); o.disconnect(); } }, { rootMargin: '400px 0px' }).observe(stage);
}
