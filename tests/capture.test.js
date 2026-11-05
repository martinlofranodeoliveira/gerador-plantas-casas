import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { pngSize, frameDimensions } from '../src/capture.js';
import { generate, validate } from '../src/core.js';

test('PNG exports bound long side and total pixel allocation for all valid lot ratios', () => {
  for (const w of [3, 12, 20.44, 50, 100]) for (const d of [3, 24, 100]) {
    const s = pngSize(w, d); assert.ok(s.width <= 2200 && s.height <= 2200); assert.ok(s.width * s.height <= 4_000_000);
    assert.ok(s.width > 0 && s.height > 0);
    const ratio = (w + 4) / (d + 5.4);
    assert.ok(Math.abs(s.width - s.height * ratio) <= Math.max(1, ratio) + 1e-9, 'Rounding must differ by at most one output pixel on either dimension.');
  }
});
test('camera framing contains every lot/wall corner for portrait, wide and large lots', () => {
  for (const [w, d] of [[12,24], [100,100], [3,100], [100,3]]) for (const aspect of [.5, 1, 2]) {
    const h = 2.8, f = frameDimensions(w, d, h, aspect), target = new THREE.Vector3(w / 2, h / 2, (d - 1.3) / 2);
    const c = new THREE.PerspectiveCamera(42, aspect, .1, f.far); c.position.copy(target).add(new THREE.Vector3(.85,.95,.9).normalize().multiplyScalar(f.distance)); c.lookAt(target); c.updateMatrixWorld();
    assert.ok(f.maxDistance > f.distance);
    for (const x of [-.15, w + .15]) for (const y of [-.2,h]) for (const z of [-1.4,d + .15]) {
      const p = new THREE.Vector3(x,y,z).project(c); assert.ok(Math.abs(p.x)<1 && Math.abs(p.y)<1 && p.z<1, `${w}×${d}, aspect ${aspect}, ${p.toArray()}`);
    }
  }
});
test('generated services are compact and all bedroom doorways lead to the hall', () => {
  for (const bedrooms of [1,2,3,4]) {
    const p = generate({bedrooms}); assert.equal(validate(p).valid,true);
    const hall = p.rooms.find(r=>r.type==='hall'), bath = p.rooms.find(r=>r.type==='bath');
    assert.ok(bath.width <= 2.4 && bath.depth <= 2.4);
    for (const room of p.rooms.filter(r=>r.type==='bedroom')) {
      const o=p.openings.find(o=>o.roomId===room.id && o.kind==='door');
      assert.ok(o.wall==='east' ? Math.abs(room.x+room.width-hall.x)<1e-9 : Math.abs(room.x-hall.x-hall.width)<1e-9);
    }
  }
});
