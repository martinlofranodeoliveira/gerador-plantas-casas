import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { wallSegments, validate, COLORS } from './core.js';
import { frameDimensions } from './capture.js';

export class HouseModel {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#edf0e4');
    this.camera = new THREE.PerspectiveCamera(42, 1, .1, 500);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.setAttribute('aria-label', 'Modelo 3D da planta com medidas em metros');
    container.append(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.minDistance = 3; this.controls.maxDistance = 160; this.controls.maxPolarAngle = Math.PI / 2.05;
    this.controls.addEventListener('change', () => this.draw());
    this.scene.add(new THREE.HemisphereLight('#fffaf0', '#7c8e70', 2.6));
    const sun = new THREE.DirectionalLight('#fff5dc', 3); sun.position.set(15, 30, 20); this.scene.add(sun);
    this.group = new THREE.Group(); this.scene.add(this.group);
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(container);
    this.fullWalls = false;
    this.renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); container.dispatchEvent(new CustomEvent('model-error', { detail: 'A placa gráfica interrompeu a vista 3D. Recarregue a página; seu JSON salvo continua disponível.' })); });
  }
  box(x, z, w, d, height, y, color, transparent = false) {
    if (height <= 0 || w <= 0 || d <= 0) return;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, height, d), new THREE.MeshStandardMaterial({ color, roughness: .85, transparent, opacity: transparent ? .35 : 1 }));
    mesh.position.set(x + w / 2, y + height / 2, z + d / 2); this.group.add(mesh); return mesh;
  }
  update(p, reset = false) {
    validate(p); this.project = p;
    while (this.group.children.length) {
      const child = this.group.children[0]; this.group.remove(child); child.geometry?.dispose(); child.material?.dispose();
    }
    this.box(-.15, -.15, p.lot.width + .3, p.lot.depth + .3, .12, -.17, '#9fae89');
    this.box(0, -1.3, p.lot.width, 1.1, .06, -.14, '#d0cbbb');
    const t = p.settings.wallThickness, wallHeight = this.fullWalls ? p.settings.wallHeight : Math.min(p.settings.wallHeight, 1.05);
    for (const r of p.rooms) {
      this.box(r.x, r.y, r.width, r.depth, .07, -.07, COLORS[r.type]);
      const cx = r.x + r.width / 2, cy = r.y + r.depth / 2;
      // Simple scaled furniture makes rooms readable without invented assets.
      if (r.type === 'bedroom') {
        const w = Math.min(1.5, r.width - .5), d = Math.min(2, r.depth - .5);
        this.box(cx - w / 2, cy - d / 2, w, d, .28, 0, '#ae9071');
        this.box(cx - w / 2, cy - d / 2, w, d * .9, .15, .28, '#f3eee1');
        this.box(cx - w / 2 + .1, cy - d / 2 + .12, w - .2, .35, .08, .43, '#c8cdbb');
      } else if (r.type === 'social') {
        this.box(r.x + .25, r.y + .3, Math.min(2.3, r.width - .5), .8, .45, 0, '#bea98d');
        this.box(cx - .4, cy - .25, .8, .5, .35, 0, '#8a6b4c');
      } else if (r.type === 'kitchen') {
        this.box(r.x + .1, r.y + .1, r.width - .2, .6, .9, 0, '#a6afa1');
        this.box(cx - .5, cy - .35, 1, .7, .74, 0, '#b49770');
      } else if (r.type === 'bath') {
        this.box(r.x + .2, r.y + .2, .7, .5, .82, 0, '#e6ece7');
        this.box(r.x + .2, r.y + r.depth - 1, .85, .8, .05, 0, '#93b4b0');
      } else if (r.type === 'service') this.box(r.x + .2, r.y + .2, .65, .65, .85, 0, '#dfe2d7');
    }
    for (const s of wallSegments(p)) {
      const length = s.end - s.start, x = s.axis === 'x' ? s.start : s.line - t / 2, z = s.axis === 'x' ? s.line - t / 2 : s.start;
      const w = s.axis === 'x' ? length : t, d = s.axis === 'x' ? t : length;
      if (!s.opening) this.box(x, z, w, d, wallHeight, 0, '#eee7d5');
      else {
        this.box(x, z, w, d, Math.min(s.bottom, wallHeight), 0, '#eee7d5');
        if (s.top < wallHeight) this.box(x, z, w, d, wallHeight - s.top, s.top, '#eee7d5');
        if (s.opening === 'window' && wallHeight > s.bottom) this.box(x, z, w, d, Math.min(s.top, wallHeight) - s.bottom, s.bottom, '#719c9c', true);
      }
    }
    if (reset) this.reset(); this.resize(); this.draw();
  }
  reset() {
    if (!this.project) return;
    const p = this.project, framing = frameDimensions(p.lot.width, p.lot.depth, p.settings.wallHeight, this.camera.aspect, this.camera.fov);
    this.controls.target.set(p.lot.width / 2, p.settings.wallHeight / 2, (p.lot.depth - 1.3) / 2);
    const offset = new THREE.Vector3(.85, .95, .9).normalize().multiplyScalar(framing.distance);
    this.camera.position.copy(this.controls.target).add(offset); this.controls.maxDistance = framing.maxDistance; this.camera.far = framing.far; this.camera.updateProjectionMatrix();
    this.controls.update(); this.draw();
  }
  resize() {
    const { width, height } = this.container.getBoundingClientRect(); if (!width || !height) return;
    const changed = Math.abs(this.camera.aspect - width / height) > .05;
    this.renderer.setSize(width, height, false); this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); if (changed && this.project) this.reset(); this.draw();
  }
  draw() { this.renderer.render(this.scene, this.camera); }
  png() { this.draw(); return new Promise(resolve => this.renderer.domElement.toBlob(resolve, 'image/png')); }
  async video(onProgress) {
    if (!globalThis.MediaRecorder || !this.renderer.domElement.captureStream) throw Error('Seu navegador não oferece gravação WebM. Use Chrome ou Firefox atualizado.');
    if (this.recording) throw Error('Já existe uma gravação em andamento.');
    const type = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t));
    if (!type) throw Error('Gravação WebM indisponível neste navegador.');
    this.recording = true; this.controls.enabled = false;
    const saved = this.camera.position.clone(), stream = this.renderer.domElement.captureStream(24), chunks = [];
    try {
      return await new Promise((resolve, reject) => {
        const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 3_000_000 });
        let timer, frame, done = false;
        const stop = () => { if (done) return; done = true; cancelAnimationFrame(frame); clearTimeout(timer); if (recorder.state !== 'inactive') recorder.stop(); };
        recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
        recorder.onerror = () => { stop(); reject(Error('O navegador interrompeu a gravação.')); };
        recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
        recorder.start(400); const start = performance.now(), duration = 8000;
        const target = this.controls.target.clone(), offset = saved.clone().sub(target), radius = Math.hypot(offset.x, offset.z), initial = Math.atan2(offset.z, offset.x);
        const tick = now => {
          const progress = Math.min(1, (now - start) / duration), angle = initial + progress * Math.PI * 2;
          this.camera.position.set(target.x + Math.cos(angle) * radius, saved.y, target.z + Math.sin(angle) * radius); this.camera.lookAt(target); this.draw(); onProgress?.(progress);
          if (progress < 1) frame = requestAnimationFrame(tick); else stop();
        };
        frame = requestAnimationFrame(tick); timer = setTimeout(stop, 11000);
      });
    } finally {
      stream.getTracks().forEach(track => track.stop()); this.camera.position.copy(saved); this.controls.enabled = true; this.controls.update(); this.recording = false; this.draw();
    }
  }
}
