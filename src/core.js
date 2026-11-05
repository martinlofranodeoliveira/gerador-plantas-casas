/** Pure metric geometry. Input/output metres; every calculation snaps to 1 mm. */
const mm = n => Math.round(n * 1000);
const metres = n => n / 1000;
export const clone = v => structuredClone(v);
export const snap = (n, step = 0.05) => Math.round(n / step) * step;
export const fmt = n => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const TYPES = { social: 'Sala', bedroom: 'Quarto', kitchen: 'Cozinha', bath: 'Banheiro', service: 'Serviço', garage: 'Garagem', hall: 'Circulação' };
export const COLORS = { social: '#e6d5b8', bedroom: '#d8dfcc', kitchen: '#ecd7c8', bath: '#c9dedb', service: '#e0d9bb', garage: '#d9d9d2', hall: '#eee6d9' };
const plain = v => v && Object.getPrototypeOf(v) === Object.prototype;
const exact = (v, keys) => plain(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const text = (v, max = 80) => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[\u0000-\u001f\u007f<>]/u.test(v);
const number = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max && Math.abs(v * 1000 - mm(v)) < 1e-6;
export class PlanError extends Error { constructor(message) { super(message); this.name = 'PlanError'; } }

export function validate(project) {
  const errors = [];
  if (!exact(project, ['schemaVersion', 'units', 'name', 'lot', 'settings', 'rooms', 'openings'])) throw new PlanError('Arquivo de projeto com campos ausentes ou desconhecidos.');
  if (project.schemaVersion !== 1 || project.units !== 'm' || !text(project.name)) throw new PlanError('Use versão 1, unidade m e um nome de até 80 caracteres.');
  if (!exact(project.lot, ['width', 'depth']) || !number(project.lot.width, 3, 100) || !number(project.lot.depth, 3, 100)) throw new PlanError('Largura e profundidade do terreno devem estar entre 3 e 100 m, com até 3 casas decimais.');
  const s = project.settings;
  if (!exact(s, ['wallThickness', 'wallHeight', 'setbacks']) || !number(s.wallThickness, 0.05, 0.5) || !number(s.wallHeight, 2, 5)) throw new PlanError('Parede: espessura de 0,05 a 0,50 m e altura de 2 a 5 m.');
  if (!exact(s.setbacks, ['front', 'back', 'left', 'right']) || Object.values(s.setbacks).some(v => !number(v, 0, 30))) throw new PlanError('Informe quatro recuos entre 0 e 30 m.');
  const b = s.setbacks;
  if (b.left + b.right + s.wallThickness >= project.lot.width || b.front + b.back + s.wallThickness >= project.lot.depth) throw new PlanError('Os recuos não deixam espaço para a edificação.');
  if (!Array.isArray(project.rooms) || project.rooms.length > 40 || !Array.isArray(project.openings) || project.openings.length > 160) throw new PlanError('Limite de 40 ambientes e 160 aberturas.');
  const ids = new Set();
  for (const r of project.rooms) {
    if (!exact(r, ['id', 'name', 'type', 'x', 'y', 'width', 'depth']) || !text(r.id, 40) || !/^[a-zA-Z0-9_-]+$/.test(r.id) || ids.has(r.id) || !text(r.name) || !Object.hasOwn(TYPES, r.type)) throw new PlanError('Ambiente inválido, identificador repetido ou tipo desconhecido.');
    ids.add(r.id);
    if (!number(r.x, 0, 100) || !number(r.y, 0, 100) || !number(r.width, s.wallThickness + 0.2, 100) || !number(r.depth, s.wallThickness + 0.2, 100)) throw new PlanError('Revise posição e dimensões dos ambientes. Resolução: 1 mm.');
    const half = mm(s.wallThickness) / 2;
    if (mm(r.x) - half < mm(b.left) || mm(r.y) - half < mm(b.front) || mm(r.x) + mm(r.width) + half > mm(project.lot.width) - mm(b.right) || mm(r.y) + mm(r.depth) + half > mm(project.lot.depth) - mm(b.back)) errors.push({ code: 'setback', roomId: r.id, message: `${r.name}: a face externa da parede ultrapassa o terreno ou o recuo informado.` });
  }
  for (let i = 0; i < project.rooms.length; i++) for (let j = i + 1; j < project.rooms.length; j++) {
    const a = project.rooms[i], c = project.rooms[j];
    if (Math.max(mm(a.x), mm(c.x)) < Math.min(mm(a.x) + mm(a.width), mm(c.x) + mm(c.width)) && Math.max(mm(a.y), mm(c.y)) < Math.min(mm(a.y) + mm(a.depth), mm(c.y) + mm(c.depth))) errors.push({ code: 'overlap', roomId: a.id, message: `${a.name} se sobrepõe a ${c.name}.` });
  }
  const openingIds = new Set();
  const spans = [];
  for (const o of project.openings) {
    if (!exact(o, ['id', 'roomId', 'kind', 'wall', 'offset', 'width', 'height', 'sill']) || !text(o.id, 40) || openingIds.has(o.id) || !ids.has(o.roomId) || !['door', 'window'].includes(o.kind) || !['north', 'south', 'east', 'west'].includes(o.wall)) throw new PlanError('Abertura inválida ou ambiente de referência inexistente.');
    openingIds.add(o.id);
    const room = project.rooms.find(r => r.id === o.roomId), length = ['north', 'south'].includes(o.wall) ? room.width : room.depth;
    if (!number(o.offset, 0, 100) || !number(o.width, 0.3, 6) || !number(o.height, 0.2, 5) || !number(o.sill, 0, 4) || mm(o.offset) < mm(s.wallThickness) / 2 || mm(o.offset) + mm(o.width) > mm(length) - mm(s.wallThickness) / 2 || mm(o.sill) + mm(o.height) > mm(s.wallHeight) || o.kind === 'door' && o.sill !== 0) throw new PlanError('Abertura fora dos limites da parede; portas devem ter peitoril zero.');
    const span = openingSpan(room, o);
    if (spans.some(v => v.axis === span.axis && v.line === span.line && v.start < span.end && span.start < v.end)) throw new PlanError('Aberturas sobrepostas na mesma parede.');
    spans.push(span);
  }
  return { valid: errors.length === 0, errors };
}

export function parseProject(raw) {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > 512_000) throw new PlanError('O JSON deve ter até 512 KB.');
  let p; try { p = JSON.parse(raw); } catch { throw new PlanError('O arquivo não contém JSON válido.'); }
  validate(p); return p;
}

export function generate({ width = 12, depth = 24, bedrooms = 2, front = 3, back = 2, side = 1.5 } = {}) {
  for (const n of [width, depth, front, back, side]) if (!number(n, 0, 100)) throw new PlanError('Informe medidas numéricas com até 3 casas decimais.');
  if (!Number.isInteger(bedrooms) || bedrooms < 1 || bedrooms > 4) throw new PlanError('Escolha de 1 a 4 quartos.');
  const p = { schemaVersion: 1, units: 'm', name: 'Minha casa', lot: { width, depth }, settings: { wallThickness: 0.15, wallHeight: 2.8, setbacks: { front, back, left: side, right: side } }, rooms: [], openings: [] };
  validate(p);
  // Two equal columns, explicit shared centre lines; no fabricated AI geometry.
  const x0 = mm(side) + 75, y0 = mm(front) + 75;
  const usableW = mm(width) - 2 * mm(side) - 150, usableD = mm(depth) - mm(front) - mm(back) - 150;
  const names = [['Sala de estar', 'social'], ['Cozinha e jantar', 'kitchen'], ...Array.from({ length: bedrooms }, (_, i) => [`Quarto ${i + 1}`, 'bedroom']), ['Banheiro', 'bath'], ['Área de serviço', 'service']];
  const hall = 1150, col = Math.floor((usableW - hall) / 2), bedroomRows = Math.ceil(bedrooms / 2);
  const minimum = 3000 + bedroomRows * 2700 + 1800;
  if (col < 2200 || usableD < minimum) throw new PlanError('O programa não cabe nessa área. Reduza ambientes ou recuos, com orientação profissional.');
  const factor = Math.min(1, usableD / (4200 + bedroomRows * 3600 + 2400));
  const socialDepth = Math.floor(4200 * factor), bedroomDepth = Math.floor(3600 * factor), serviceDepth = Math.floor(2400 * factor);
  const totalDepth = socialDepth + bedroomRows * bedroomDepth + serviceDepth;
  p.rooms = names.map(([name, type], i) => {
    const bedroom = type === 'bedroom', service = ['bath', 'service'].includes(type), right = service ? type === 'service' : i % 2 === 1;
    const y = service ? y0 + socialDepth + bedroomRows * bedroomDepth : bedroom ? y0 + socialDepth + Math.floor((i - 2) / 2) * bedroomDepth : y0;
    const roomWidth = type === 'bath' ? Math.min(col, 2400) : col;
    return { id: `ambiente-${i + 1}`, name, type, x: metres(x0 + (right ? col + hall : col - roomWidth)), y: metres(y), width: metres(roomWidth), depth: metres(service ? serviceDepth : bedroom ? bedroomDepth : socialDepth) };
  });
  for (const [i, r] of p.rooms.entries()) {
    const right = mm(r.x) > x0 + col;
    p.openings.push({ id: `porta-${i + 1}`, roomId: r.id, kind: 'door', wall: right ? 'west' : 'east', offset: 0.4, width: 0.8, height: 2.1, sill: 0 });
    p.openings.push({ id: `janela-${i + 1}`, roomId: r.id, kind: 'window', wall: right ? 'east' : 'west', offset: metres(Math.min(mm(r.depth) - 1400, 1500)), width: 1, height: 1, sill: 1.1 });
  }
  p.rooms.push({ id: 'circulacao', name: 'Circulação', type: 'hall', x: metres(x0 + col), y: metres(y0), width: metres(hall), depth: metres(totalDepth) });
  p.openings.push({ id: 'entrada', roomId: 'circulacao', kind: 'door', wall: 'north', offset: 0.15, width: 0.85, height: 2.1, sill: 0 });
  validate(p); return p;
}

export function openingSpan(r, o) {
  const horizontal = ['north', 'south'].includes(o.wall);
  const base = horizontal ? mm(r.x) : mm(r.y);
  return { axis: horizontal ? 'x' : 'y', line: horizontal ? mm(r.y) + (o.wall === 'south' ? mm(r.depth) : 0) : mm(r.x) + (o.wall === 'east' ? mm(r.width) : 0), start: base + mm(o.offset), end: base + mm(o.offset) + mm(o.width), sill: mm(o.sill), top: mm(o.sill) + mm(o.height), kind: o.kind };
}

/** Atomic collinear wall segments, with shared walls emitted only once. */
export function wallSegments(p) {
  validate(p); const groups = new Map();
  for (const r of p.rooms) for (const wall of ['north', 'south', 'east', 'west']) {
    const horizontal = ['north', 'south'].includes(wall), a = horizontal ? mm(r.x) : mm(r.y), length = horizontal ? mm(r.width) : mm(r.depth);
    const line = horizontal ? mm(r.y) + (wall === 'south' ? mm(r.depth) : 0) : mm(r.x) + (wall === 'east' ? mm(r.width) : 0);
    const key = `${horizontal ? 'x' : 'y'}:${line}`;
    if (!groups.has(key)) groups.set(key, { axis: horizontal ? 'x' : 'y', line, ranges: [], cuts: [] });
    groups.get(key).ranges.push([a, a + length]);
    for (const o of p.openings.filter(o => o.roomId === r.id && o.wall === wall)) groups.get(key).cuts.push(openingSpan(r, o));
  }
  const result = [];
  for (const g of groups.values()) {
    const points = [...new Set([...g.ranges.flat(), ...g.cuts.flatMap(c => [c.start, c.end])])].sort((a, b) => a - b);
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1], mid = (a + b) / 2;
      if (!g.ranges.some(([x, y]) => mid >= x && mid <= y)) continue;
      const cut = g.cuts.find(c => mid >= c.start && mid <= c.end);
      result.push({ axis: g.axis, line: metres(g.line), start: metres(a), end: metres(b), bottom: cut ? metres(cut.sill) : null, top: cut ? metres(cut.top) : null, opening: cut?.kind ?? null });
    }
  }
  return result;
}

export function report(p) {
  const check = validate(p), t = mm(p.settings.wallThickness);
  const rooms = p.rooms.map(r => ({ id: r.id, name: r.name, clearWidth: (mm(r.width) - t) / 1000, clearDepth: (mm(r.depth) - t) / 1000, area: (mm(r.width) - t) * (mm(r.depth) - t) / 1_000_000 }));
  return { ...check, lotArea: mm(p.lot.width) * mm(p.lot.depth) / 1_000_000, clearArea: rooms.reduce((sum, r) => sum + r.area, 0), rooms, notes: ['As cotas dos módulos usam eixos de paredes. Medidas livres descontam a espessura total.', 'A proposta automática organiza módulos; circulação, acessos, ventilação, estrutura e regras locais exigem revisão profissional.'] };
}

export class History {
  constructor(value) { this.items = [clone(value)]; this.index = 0; }
  push(value) { validate(value); this.items = [...this.items.slice(0, this.index + 1), clone(value)].slice(-60); this.index = this.items.length - 1; return this.current(); }
  current() { return clone(this.items[this.index]); }
  undo() { this.index = Math.max(0, this.index - 1); return this.current(); }
  redo() { this.index = Math.min(this.items.length - 1, this.index + 1); return this.current(); }
}
