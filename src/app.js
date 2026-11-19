import './style.css';
import { generate, validate, report, clone, History, TYPES, COLORS, fmt, parseProject } from './core.js';
import { planSVG, csvReport, imagePrompt, escape } from './plan.js';
import { pngSize } from './capture.js';
import { setupRoomMover, roomMove } from './room-move.js';

const $ = id => document.getElementById(id), storageKey = 'casa-aberta:project:v1';
let project = generate(), selected, history, model, modelPromise, view = 'plan', zoom = 1, timer, suppressSave = false;
try { const raw = localStorage.getItem(storageKey); if (raw) project = parseProject(raw); } catch { /* Invalid/stale storage never executes or prevents starting. */ }
history = new History(project); selected = project.rooms[0]?.id;
function toast(message, error = false) {
  $('toast').textContent = message; $('toast').classList.toggle('error', error); $('toast').hidden = false; clearTimeout(timer); timer = setTimeout(() => $('toast').hidden = true, 5500);
}
function change(fn, { reset = false } = {}) {
  if (model?.recording) return toast('Aguarde a gravação terminar para editar.', true);
  try { const next = clone(project); fn(next); validate(next); project = history.push(next); render(reset); } catch (e) { toast(e.message, true); }
}
function save() {
  if (suppressSave) return;
  try { localStorage.setItem(storageKey, JSON.stringify(project)); document.querySelector('.local-label').textContent = 'Projeto salvo neste navegador'; }
  catch { document.querySelector('.local-label').textContent = 'Salvamento indisponível; exporte o JSON'; }
}
function render(reset = false) {
  mover.reset();
  const r = report(project); if (!project.rooms.some(x => x.id === selected)) selected = project.rooms[0]?.id;
  $('project-name').value = project.name; $('wall-thickness').value = project.settings.wallThickness; $('wall-height').value = project.settings.wallHeight;
  $('lot-area').textContent = `${fmt(r.lotArea)} m²`; $('clear-area').textContent = `${fmt(r.clearArea)} m²`;
  $('validation-badge').textContent = r.valid ? 'Geometria verificada' : `${r.errors.length} ajuste(s) necessário(s)`; $('validation-badge').classList.toggle('invalid', !r.valid);
  $('issues').innerHTML = r.errors.length ? `<strong>Revise antes de exportar</strong><ul>${r.errors.map(e => `<li>${escape(e.message)}</li>`).join('')}</ul><p>Você pode salvar o JSON para continuar depois.</p>` : '';
  for (const id of ['export-svg', 'export-png', 'export-video']) $(id).disabled = !r.valid || !!model?.recording;
  $('undo').disabled = history.index === 0; $('redo').disabled = history.index === history.items.length - 1;
  $('plan-canvas').innerHTML = planSVG(project, { selected, interactive: true, scale: Number($('scale').value) });
  $('room-list').innerHTML = project.rooms.map(room => `<button class="room-entry" data-select="${escape(room.id)}" aria-pressed="${selected === room.id}"><span class="swatch" style="background:${COLORS[room.type]}"></span><span>${escape(room.name)}</span><span class="area">${fmt(r.rooms.find(x => x.id === room.id).area)} m²</span></button>`).join('');
  renderProperties(); save(); if (model) model.update(project, reset);
}
function input(name, label, value, { min = 0, max = 100 } = {}) { return `<label>${label}<input name="${name}" type="number" step=".001" min="${min}" max="${max}" value="${value}" required></label>`; }
function renderProperties() {
  const r = project.rooms.find(r => r.id === selected);
  if (!r) { $('room-properties').innerHTML = '<p class="empty-state">Adicione um ambiente ou gere uma proposta para começar.</p>'; return; }
  const a = report(project).rooms.find(x => x.id === r.id), holes = project.openings.filter(o => o.roomId === r.id);
  $('room-properties').innerHTML = `<form id="property-form" class="property-form"><label>Nome do ambiente<input name="name" value="${escape(r.name)}" maxlength="80" required></label><label>Uso<select name="type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${r.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label><div class="field-pair">${input('x', 'Posição X (m)', r.x)}${input('y', 'Posição Y (m)', r.y)}</div><div class="field-pair">${input('width', 'Largura no eixo (m)', r.width, { min: .251 })}${input('depth', 'Profundidade no eixo (m)', r.depth, { min: .251 })}</div><div class="measure-line">Livre: ${fmt(a.clearWidth)} × ${fmt(a.clearDepth)} m<br>Área: ${fmt(a.area)} m²</div><button type="submit" class="primary">Aplicar medidas</button></form><section style="margin-top:24px"><h3>Portas e janelas</h3><div class="opening-list">${holes.length ? holes.map(o => `<div class="opening-row"><span>${o.kind === 'door' ? 'Porta' : 'Janela'} · ${wallLabel(o.wall)}<br>${fmt(o.width)} × ${fmt(o.height)} m · início ${fmt(o.offset)} m</span><button data-remove-opening="${escape(o.id)}" aria-label="Excluir abertura ${escape(o.id)}">Excluir</button></div>`).join('') : '<p class="field-help">Nenhuma abertura ligada a este ambiente.</p>'}</div><details style="margin-top:14px"><summary>Adicionar abertura</summary><form id="opening-form" class="opening-form"><div class="field-pair"><label>Tipo<select name="kind"><option value="door">Porta</option><option value="window">Janela</option></select></label><label>Parede<select name="wall">${['north', 'south', 'west', 'east'].map(w => `<option value="${w}">${wallLabel(w)}</option>`).join('')}</select></label></div><div class="field-pair">${input('offset', 'Início (m)', .2)}${input('width', 'Largura (m)', .8, { min: .3, max: 6 })}</div><div class="field-pair">${input('height', 'Altura (m)', 2.1, { min: .2, max: 5 })}${input('sill', 'Peitoril (m)', 0, { max: 4 })}</div><p class="field-help">Início medido da esquerda para direita (frente/fundos) ou frente para fundos (laterais). Portas: peitoril zero.</p><button type="submit">Adicionar abertura</button></form></details></section><button id="delete-room" class="text-button danger">Excluir ambiente e suas aberturas</button>`;
  $('property-form').onsubmit = e => { e.preventDefault(); const data = new FormData(e.currentTarget); change(p => { const room = p.rooms.find(x => x.id === selected); for (const key of ['x', 'y', 'width', 'depth']) room[key] = Number(data.get(key)); room.name = String(data.get('name')); room.type = String(data.get('type')); }); };
  $('opening-form').onsubmit = e => { e.preventDefault(); const d = new FormData(e.currentTarget); change(p => p.openings.push({ id: `abertura-${crypto.randomUUID().slice(0, 8)}`, roomId: selected, kind: String(d.get('kind')), wall: String(d.get('wall')), ...Object.fromEntries(['offset', 'width', 'height', 'sill'].map(k => [k, Number(d.get(k))])) })); };
  $('delete-room').onclick = () => change(p => { p.rooms = p.rooms.filter(x => x.id !== selected); p.openings = p.openings.filter(x => x.roomId !== selected); });
  document.querySelectorAll('[data-remove-opening]').forEach(b => b.onclick = () => change(p => p.openings = p.openings.filter(o => o.id !== b.dataset.removeOpening)));
}
function wallLabel(w) { return { north: 'Frente', south: 'Fundos', west: 'Esquerda', east: 'Direita' }[w]; }
function selectRoom(id) { selected = id; render(); }
$('room-list').onclick = e => { const b = e.target.closest('[data-select]'); if (b) selectRoom(b.dataset.select); };
const mover = setupRoomMover({
  canvas: $('plan-canvas'), status: $('move-status'), bar: $('move-bar'), actions: $('move-actions'),
  confirm: $('confirm-move'), cancel: $('cancel-move'), project: () => project,
  editable: () => view === 'plan' && !model?.recording,
  select(id) {
    if (selected === id) return;
    selected = id;
    for (const room of $('plan-canvas').querySelectorAll('[data-room]')) room.setAttribute('aria-pressed', String(room.dataset.room === id));
    for (const entry of $('room-list').querySelectorAll('[data-select]')) entry.setAttribute('aria-pressed', String(entry.dataset.select === id));
    renderProperties();
  },
  commit(id, x, y) {
    change(p => {
      const move = roomMove(p, id, x, y);
      if (move.issue) throw Error(move.issue);
      Object.assign(p.rooms.find(r => r.id === id), { x, y });
    });
  },
});
$('generate-form').onsubmit = e => { e.preventDefault(); const form = new FormData(e.currentTarget); change(p => Object.assign(p, generate(Object.fromEntries([...form].map(([k, v]) => [k, Number(v)])))), { reset: true }); };
$('project-name').onchange = e => change(p => p.name = e.target.value);
$('wall-thickness').onchange = e => change(p => p.settings.wallThickness = Number(e.target.value));
$('wall-height').onchange = e => change(p => p.settings.wallHeight = Number(e.target.value));
$('add-room').onclick = () => change(p => { const id = `ambiente-${crypto.randomUUID().slice(0, 8)}`; selected = id; p.rooms.push({ id, name: 'Novo ambiente', type: 'bedroom', x: p.settings.setbacks.left + .1, y: p.settings.setbacks.front + .1, width: 3, depth: 3 }); });
$('undo').onclick = () => { if (model?.recording) return; project = history.undo(); render(true); };
$('redo').onclick = () => { if (model?.recording) return; project = history.redo(); render(true); };
$('scale').onchange = () => render();
function setZoom(value) {
  zoom = Math.max(1, Math.min(8, value));
  $('plan-canvas').style.width = `${zoom * 100}%`; $('plan-canvas').style.height = `${zoom * 100}%`;
  $('zoom-value').textContent = `${Math.round(zoom * 100)}%`; $('zoom-out').disabled = zoom <= 1; $('zoom-in').disabled = zoom >= 8;
}
$('zoom-in').onclick = () => setZoom(zoom * 1.5);
$('zoom-out').onclick = () => setZoom(zoom / 1.5);
$('zoom-fit').onclick = () => { setZoom(1); $('plan-view').scrollTo(0, 0); };

async function showView(next) {
  mover.reset();
  view = next; const is3d = next === 'model'; $('move-bar').hidden = is3d;
  $('plan-view').hidden = is3d; $('plan-zoom').hidden = is3d; $('model-view').hidden = !is3d; $('tab-plan').setAttribute('aria-selected', String(!is3d)); $('tab-model').setAttribute('aria-selected', String(is3d));
  if (is3d) try {
    if (!modelPromise) modelPromise = import('./model.js').then(({ HouseModel }) => { model = new HouseModel($('model-canvas')); model.update(project, true); return model; }).catch(error => { modelPromise = null; throw error; });
    await modelPromise;
    model.resize();
  } catch { toast('Não foi possível abrir o 3D neste dispositivo. A planta e os demais arquivos continuam disponíveis.', true); }
}
$('tab-plan').onclick = () => showView('plan'); $('tab-model').onclick = () => showView('model');
for (const id of ['tab-plan', 'tab-model']) $(id).onkeydown = e => { if (['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); const next = id === 'tab-plan' ? 'tab-model' : 'tab-plan'; $(next).focus(); $(next).click(); } };
$('full-walls').onclick = () => { if (!model || model.recording) return; model.fullWalls = !model.fullWalls; model.update(project); $('full-walls').textContent = model.fullWalls ? 'Cortar paredes para ver dentro' : 'Mostrar paredes inteiras'; };
$('reset-camera').onclick = () => { if (!model?.recording) model?.reset(); };
$('model-canvas').addEventListener('model-error', e => toast(e.detail, true));
function download(blob, filename) { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 15000); }
function validVisual() { if (!validate(project).valid) throw Error('Corrija os avisos geométricos antes de exportar imagem ou vídeo.'); }
$('export-svg').onclick = () => { try { validVisual(); download(new Blob([planSVG(project, { scale: Number($('scale').value) })], { type: 'image/svg+xml' }), 'casa-planta.svg'); } catch (e) { toast(e.message, true); } };
$('export-json').onclick = () => download(new Blob([JSON.stringify(project, null, 2) + '\n'], { type: 'application/json' }), 'casa-projeto.json');
$('export-csv').onclick = () => download(new Blob(['\ufeff' + csvReport(project)], { type: 'text/csv;charset=utf-8' }), 'casa-areas.csv');
$('export-prompt').onclick = () => download(new Blob([imagePrompt(project)], { type: 'text/plain;charset=utf-8' }), 'casa-prompt-ilustrativo.txt');
$('import-trigger').onclick = () => $('import-json').click();
$('import-json').onchange = async e => { const file = e.target.files[0]; if (!file) return; try { if (file.size > 512000) throw Error('Use um JSON com até 512 KB.'); const next = parseProject(await file.text()); change(p => Object.assign(p, next), { reset: true }); toast('Projeto importado. Confira as medidas e os avisos.'); } catch (err) { toast(err.message, true); } finally { e.target.value = ''; } };
$('export-png').onclick = async () => {
  try {
    validVisual();
    if (view === 'model' && model) { const blob = await model.png(); if (!blob) throw Error('Não foi possível capturar a imagem.'); download(blob, 'casa-modelo-3d.png'); return; }
    const snapshot = clone(project), svg = planSVG(snapshot), blob = new Blob([svg], { type: 'image/svg+xml' }), url = URL.createObjectURL(blob), img = new Image();
    try { await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(Error('Falha ao converter a planta em imagem.')); img.src = url; });
      const canvas = document.createElement('canvas'), dimensions = pngSize(snapshot.lot.width, snapshot.lot.depth); canvas.height = dimensions.height; canvas.width = dimensions.width; canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png')); if (!png) throw Error('Exportação de imagem indisponível.'); download(png, 'casa-planta.png');
    } finally { URL.revokeObjectURL(url); }
  } catch (e) { toast(e.message, true); }
};
$('export-video').onclick = async () => {
  try { validVisual(); await showView('model'); if (!model) return; document.body.classList.add('recording');
    $('export-video').disabled = true; const blob = await model.video(progress => $('export-video').textContent = `Gravando ${Math.round(progress * 100)}%`); download(blob, 'casa-passeio-3d.webm'); toast('Passeio 3D salvo. É uma animação da geometria, sem serviço pago.');
  } catch (e) { toast(e.message, true); } finally { document.body.classList.remove('recording'); $('export-video').textContent = 'Vídeo 3D'; render(); }
};
$('clear-local').onclick = () => { try { localStorage.removeItem(storageKey); suppressSave = true; document.querySelector('.local-label').textContent = 'Cópia local apagada; exporte para guardar'; toast('Cópia do navegador removida. O desenho permanece aberto até você fechar a página.'); } catch { toast('O navegador recusou o acesso ao armazenamento.', true); } };
render();
