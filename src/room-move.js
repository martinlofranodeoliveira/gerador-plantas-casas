import { validate, snap } from './core.js';

export const GRID_METRES = 0.1;
const gridMillimetres = Math.round(GRID_METRES * 1000);

export function dragAxis(origin, delta) {
  if (Math.abs(delta) < 0.0005) return origin;
  return snap(Math.round((origin + delta) * 1000), gridMillimetres) / 1000;
}

export function stepAxis(value, direction) {
  const grid = Math.round(value * 1000) / gridMillimetres;
  const next = direction > 0 ? Math.floor(grid) + 1 : Math.ceil(grid) - 1;
  return next * gridMillimetres / 1000;
}

export function roomMove(project, id, x, y) {
  const room = project.rooms.find(r => r.id === id);
  if (!room) throw Error('Ambiente inexistente.');
  const position = { ...room, x, y };
  let issue;
  if (x < 0 || y < 0 || x > project.lot.width || y > project.lot.depth) {
    issue = 'A posição está fora do terreno.';
  } else {
    const draft = { ...project, rooms: project.rooms.map(r => r === room ? position : r) };
    try { issue = validate(draft).errors[0]?.message; }
    catch (error) { issue = error.message; }
  }
  return { position, issue, changed: room.x !== x || room.y !== y };
}

function svgPoint(inverse, event) {
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse);
  return Number.isFinite(point.x) && Number.isFinite(point.y) ? point : null;
}

const keys = { ArrowLeft: ['x', -1], ArrowRight: ['x', 1], ArrowUp: ['y', -1], ArrowDown: ['y', 1] };

export function setupRoomMover({ canvas, status, bar, actions, confirm, cancel, project, select, commit, editable }) {
  const help = status.textContent;
  let preview = null, pointer = null;
  const findRoom = id => canvas.querySelector('[data-room="' + id + '"]');
  const focusRoom = id => findRoom(id)?.focus({ preventScroll: true });

  function endPointer() {
    const tracked = pointer;
    pointer = null;
    if (tracked && canvas.hasPointerCapture(tracked.id)) canvas.releasePointerCapture(tracked.id);
  }

  function reset(refocus = false) {
    const id = preview?.position.id ?? pointer?.roomId;
    endPointer();
    canvas.querySelector('[data-move-preview]')?.remove();
    canvas.querySelector('.moving-source')?.classList.remove('moving-source');
    preview = null;
    actions.hidden = true;
    bar.classList.remove('invalid', 'pending');
    if (status.textContent !== help) status.textContent = help;
    if (refocus && id) focusRoom(id);
  }

  function show(id, x, y) {
    if (preview?.position.id === id && preview.position.x === x && preview.position.y === y) return;
    const next = roomMove(project(), id, x, y);
    preview = next;
    const { position, issue, changed } = next;
    const svg = canvas.querySelector('svg');
    const cls = issue ? 'invalid' : 'valid';
    const metric = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
    const xLabel = 'X ' + metric.format(x) + ' m', yLabel = 'Y ' + metric.format(y) + ' m';
    // Only numeric geometry and formatted numbers enter SVG. Project names stay in textContent.
    svg.querySelector('[data-move-preview]')?.remove();
    const matrix = svg.getScreenCTM();
    const fontSize = 11 / Math.max(1, Math.hypot(matrix.a, matrix.b));
    const labelWidth = fontSize * (Math.max(xLabel.length, yLabel.length) * .62 + 1);
    const labelHeight = fontSize * 3;
    const box = svg.viewBox.baseVal;
    const left = Math.min(Math.max(box.x, x), box.x + box.width - labelWidth);
    const top = Math.min(Math.max(box.y, y + position.depth + .16), box.y + box.height - labelHeight);
    svg.insertAdjacentHTML('beforeend',
      '<g data-move-preview="" class="move-preview ' + cls + '" aria-hidden="true" pointer-events="none">' +
      '<path class="move-rulers" d="M0 ' + y + ' H' + x + ' V0"/>' +
      '<rect class="move-footprint" data-move-handle="' + id + '" x="' + x + '" y="' + y + '" width="' +
      position.width + '" height="' + position.depth + '" pointer-events="all"/>' +
      '<circle class="move-origin" cx="' + x + '" cy="' + y + '" r=".11"/>' +
      '<g transform="translate(' + left + ' ' + top + ')">' +
      '<rect class="move-dimension-bg" width="' + labelWidth + '" height="' + labelHeight + '" rx=".1"/>' +
      '<text class="move-coordinate" x="' + fontSize*.45 + '" y="' + fontSize*1.13 + '" style="font-size:' + fontSize + 'px">' + xLabel + '</text>' +
      '<text class="move-coordinate" x="' + fontSize*.45 + '" y="' + fontSize*2.53 + '" style="font-size:' + fontSize + 'px">' + yLabel + '</text></g></g>');
    findRoom(id)?.classList.add('moving-source');
    actions.hidden = false;
    bar.classList.add('pending');
    bar.classList.toggle('invalid', Boolean(issue));
    confirm.disabled = Boolean(issue) || !changed;
    status.textContent = position.name + ' · ' + xLabel + ' · ' + yLabel + '. ' +
      (issue || (changed ? 'Posição válida.' : 'Posição original.'));
  }

  function finish() {
    if (!preview || preview.issue || !preview.changed || !editable()) return;
    const { id, x, y } = preview.position;
    reset();
    commit(id, x, y);
    focusRoom(id);
  }

  canvas.addEventListener('touchstart', event => {
    if (editable() && event.touches.length === 1 && event.target.closest('[data-room], [data-move-handle]')) event.preventDefault();
  }, { passive: false });

  canvas.addEventListener('pointerdown', event => {
    if (!editable() || !event.isPrimary || event.button !== 0 || pointer) return;
    const hit = event.target.closest('[data-room], [data-move-handle]');
    if (!hit) return;
    const id = hit.dataset.room ?? hit.dataset.moveHandle;
    const transform = hit.ownerSVGElement.getScreenCTM();
    if (!transform) return;
    const inverse = transform.inverse();
    const anchor = svgPoint(inverse, event);
    if (!anchor) return;
    const room = hit.hasAttribute('data-move-handle') && preview ? preview.position : project().rooms.find(r => r.id === id);
    if (!room) return;
    event.preventDefault();
    if (!hit.hasAttribute('data-move-handle')) { reset(); select(id); }
    focusRoom(id);
    pointer = { id: event.pointerId, roomId: id, anchor, inverse, x: room.x, y: room.y, clientX: event.clientX, clientY: event.clientY, dragging: false };
    canvas.setPointerCapture(event.pointerId);
  });

  function updatePointer(event) {
    if (pointer?.id !== event.pointerId) return;
    if (!pointer.dragging && Math.hypot(event.clientX - pointer.clientX, event.clientY - pointer.clientY) < 3) return;
    const point = svgPoint(pointer.inverse, event);
    if (!point) return;
    pointer.dragging = true;
    show(pointer.roomId, dragAxis(pointer.x, point.x - pointer.anchor.x), dragAxis(pointer.y, point.y - pointer.anchor.y));
  }
  canvas.addEventListener('pointermove', updatePointer);
  canvas.addEventListener('pointerup', event => {
    if (pointer?.id !== event.pointerId) return;
    updatePointer(event);
    endPointer();
  });
  for (const type of ['pointercancel', 'lostpointercapture']) canvas.addEventListener(type, event => {
    if (pointer?.id === event.pointerId) reset(true);
  });

  canvas.addEventListener('click', event => {
    // Assistive technologies can dispatch a click without pointer events.
    const id = event.target.closest('[data-room]')?.dataset.room;
    if (event.detail === 0 && id) { reset(); select(id); focusRoom(id); }
  });
  canvas.addEventListener('keydown', event => {
    const id = event.target.dataset.room;
    if (!id || !editable() || pointer || event.altKey || event.metaKey || event.ctrlKey) return;
    if (Object.hasOwn(keys, event.key)) {
      event.preventDefault();
      if (preview?.position.id !== id) { reset(); select(id); focusRoom(id); }
      const position = preview?.position ?? project().rooms.find(r => r.id === id);
      const [axis, dir] = keys[event.key];
      const next = { ...position, [axis]: stepAxis(position[axis], dir) };
      show(id, next.x, next.y);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (preview?.position.id === id) finish();
      else { reset(); select(id); focusRoom(id); }
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && (preview || pointer)) { event.preventDefault(); reset(true); }
  });
  confirm.addEventListener('click', finish);
  cancel.addEventListener('click', () => reset(true));
  return { reset };
}
