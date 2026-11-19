import test from 'node:test';
import assert from 'node:assert/strict';
import { generate, clone, History, parseProject } from '../src/core.js';
import { dragAxis, stepAxis, roomMove } from '../src/room-move.js';
import { planSVG } from '../src/plan.js';

test('grid movement uses millimetres and preserves the untouched imported axis', () => {
  assert.equal(dragAxis(4.5, .05), 4.6);
  assert.equal(dragAxis(3.075, 0), 3.075);
  assert.equal(stepAxis(3.075, 1), 3.1);
  assert.equal(stepAxis(3.075, -1), 3);
  assert.equal(stepAxis(3.1, -1), 3);
});

test('moving a room previews without mutating its openings, file or history', () => {
  const p = generate(), original = clone(p), id = 'ambiente-5';
  const room = p.rooms.find(r => r.id === id), history = new History(p);
  const move = roomMove(p, id, 2.7, 11.2);
  assert.equal(move.issue, undefined);
  assert.ok(move.changed);
  assert.deepEqual(p, original);
  assert.equal(history.index, 0);
  assert.ok(roomMove(p, id, room.x, room.y - 1).issue);
  assert.ok(roomMove(p, id, -.1, room.y).issue);
  const next = clone(p);
  Object.assign(next.rooms.find(r => r.id === id), { x: move.position.x, y: move.position.y });
  history.push(next);
  assert.deepEqual(history.undo(), original);
  assert.deepEqual(history.redo(), parseProject(JSON.stringify(next)));
  assert.deepEqual(next.openings, original.openings);
});

test('export contains the committed geometry without editor overlays or interactive roles', () => {
  const p = generate();
  assert.match(planSVG(p, { interactive: true }), /data-move-grid/);
  assert.doesNotMatch(planSVG(p), /data-move-grid|data-move-preview|aria-pressed|role="button"/);
});
