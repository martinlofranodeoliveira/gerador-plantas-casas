import test from 'node:test';
import assert from 'node:assert/strict';
import { generate, validate, report, wallSegments, clone, History, parseProject } from '../src/core.js';
import { planSVG, csvReport, imagePrompt } from '../src/plan.js';

test('all room counts fit the supplied setbacks, keep a shared hall and exact millimetres', () => {
  for (const bedrooms of [1, 2, 3, 4]) {
    const p = generate({ bedrooms });
    assert.equal(validate(p).valid, true);
    assert.equal(p.rooms.filter(r => r.type === 'bedroom').length, bedrooms);
    assert.equal(p.rooms.filter(r => r.type === 'hall').length, 1);
    assert.equal(p.openings.filter(o => o.kind === 'door').length, p.rooms.length);
    for (const r of p.rooms) for (const n of [r.x, r.y, r.width, r.depth]) assert.ok(Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6);
  }
});
test('centre lines, clear dimensions and area have a known independent result', () => {
  const p = generate(); p.openings = []; p.rooms = [{ id: 'r', name: 'Sala', type: 'social', x: 2, y: 4, width: 4, depth: 5 }];
  const r = report(p);
  assert.equal(r.rooms[0].clearWidth, 3.85); assert.equal(r.rooms[0].clearDepth, 4.85); assert.equal(r.clearArea, 18.6725);
  assert.equal(r.lotArea, 288);
});
test('overlap and face-outside-setback are flagged without changing the input', () => {
  const p = generate(); p.openings = []; p.rooms[1].x = p.rooms[0].x; const original = clone(p);
  assert.ok(validate(p).errors.some(e => e.code === 'overlap')); assert.deepEqual(p, original);
  p.rooms[0].x = 1.5; assert.ok(validate(p).errors.some(e => e.code === 'setback'));
});
test('bad types, unknown fields, extreme dimensions and malformed imports are rejected', () => {
  for (const mutate of [p => p.units = 'cm', p => p.lot.width = true, p => p.lot.depth = Infinity, p => p.rooms[0].width = .1, p => p.rooms[1].id = p.rooms[0].id, p => p.unknown = 1, p => p.rooms[0].name = '<script>']) {
    const p = generate(); mutate(p); assert.throws(() => validate(p));
  }
  assert.throws(() => generate({ width: 4, depth: 5 })); assert.throws(() => parseProject('bad'));
  assert.throws(() => parseProject(' '.repeat(512001))); assert.throws(() => generate({ bedrooms: 5 }));
});
test('shared collinear walls are not duplicated, including partial overlaps', () => {
  const p = generate(); p.openings = [];
  p.rooms = [{ id: 'a', name: 'A', type: 'social', x: 2, y: 4, width: 3, depth: 4 }, { id: 'b', name: 'B', type: 'bedroom', x: 5, y: 5, width: 3, depth: 2 }];
  const parts = wallSegments(p).filter(s => s.axis === 'y' && s.line === 5);
  assert.equal(parts.reduce((n, s) => n + s.end - s.start, 0), 4);
  assert.equal(new Set(parts.map(s => `${s.start}:${s.end}`)).size, parts.length);
});
test('doors/windows cut actual shared geometry and invalid/overlapping holes fail closed', () => {
  const p = generate(); const parts = wallSegments(p);
  assert.ok(parts.some(s => s.opening === 'door' && s.bottom === 0 && s.top === 2.1));
  assert.ok(parts.some(s => s.opening === 'window' && s.bottom === 1.1 && s.top === 2.1));
  const bad = clone(p); bad.openings.push({ ...bad.openings[0], id: 'duplicate-hole' }); assert.throws(() => validate(bad));
  for (const mutate of [o => o.offset = 100, o => o.roomId = 'missing', o => o.sill = 1, o => o.width = 0]) {
    const q = clone(p); mutate(q.openings[0]); assert.throws(() => validate(q));
  }
});
test('undo/redo are isolated, bounded and discard obsolete future', () => {
  const p = generate(); const h = new History(p); p.name = 'Changed'; h.push(p);
  assert.equal(h.undo().name, 'Minha casa'); assert.equal(h.redo().name, 'Changed');
  h.undo(); p.name = 'New branch'; h.push(p); assert.equal(h.redo().name, 'New branch');
  for (let i = 0; i < 70; i++) h.push(p); assert.equal(h.items.length, 60);
  const current = h.current(); current.name = 'Mutation'; assert.equal(h.current().name, 'New branch');
});
test('SVG exports physical scale and escapes labels; CSV retains exact numeric meaning', () => {
  const p = generate(); p.name = 'Casa & jardim';
  const svg = planSVG(p, { scale: 100 });
  assert.ok(svg.includes('width="160mm"')); assert.ok(svg.includes('Casa &amp; jardim')); assert.ok(svg.includes('1:100 a 100%'));
  assert.ok(svg.includes('stroke-linecap:butt')); assert.ok(!svg.includes('stroke-linecap:square'), 'Segment caps must not reduce the measured door opening.');
  assert.throws(() => planSVG(p, { scale: 42 })); assert.ok(csvReport(p).startsWith('"Ambiente"'));
  assert.ok(imagePrompt(p).includes('conceitual')); assert.deepEqual(parseProject(JSON.stringify(p)), p);
});
