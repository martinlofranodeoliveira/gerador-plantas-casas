import { validate, wallSegments, openingSpan, report, fmt, COLORS } from './core.js';
export const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

export function planSVG(p, { selected = '', scale = 100, interactive = false } = {}) {
  validate(p);
  if (![50, 100, 200].includes(scale)) throw Error('Escala inválida.');
  const margin = 2, w = p.lot.width + margin * 2, h = p.lot.depth + margin * 2 + 1.4;
  const textSize = Math.max(0.3, Math.min(0.42, p.lot.width / 28));
  const roomText = r => `${fmt(r.width - p.settings.wallThickness)} × ${fmt(r.depth - p.settings.wallThickness)} m`;
  const line = (x1, y1, x2, y2, cls = '') => `<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  const dim = (x1, y1, x2, y2, label, vertical = false) => `<g class="dimension">${line(x1, y1, x2, y2)}${line(x1 - .08, y1 - .08, x1 + .08, y1 + .08)}${line(x2 - .08, y2 - .08, x2 + .08, y2 + .08)}<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - .14}" ${vertical ? `transform="rotate(-90 ${(x1 + x2) / 2} ${(y1 + y2) / 2 - .14})"` : ''}>${escape(label)}</text></g>`;
  const a = report(p);
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 1000 / scale}mm" height="${h * 1000 / scale}mm" viewBox="${-margin} ${-margin} ${w} ${h}" role="${interactive ? 'group' : 'img'}" aria-label="Planta cotada de ${escape(p.name)}"><style>text{font-family:Arial,sans-serif;fill:#283d35;text-anchor:middle;font-size:${textSize}px}.room-name{font-weight:600}.small{font-size:${textSize * .82}px;fill:#52645a}.wall{stroke:#304538;stroke-width:${p.settings.wallThickness};stroke-linecap:butt;fill:none}.dimension{stroke:#607568;stroke-width:.014;fill:none}.dimension text{stroke:none;fill:#40594a}.room:focus rect{stroke:#244b32;stroke-width:.08}.room{cursor:${interactive ? 'pointer' : 'default'}}</style><rect x="${-margin}" y="${-margin}" width="${w}" height="${h}" fill="${interactive ? 'transparent' : '#fbf9f3'}"/><rect width="${p.lot.width}" height="${p.lot.depth}" fill="${interactive ? '#e5eae4' : '#e5ecd9'}" stroke="#879d94" stroke-width=".035"/>`;
  if (interactive) {
    svg += '<defs><pattern id="move-grid-minor" patternUnits="userSpaceOnUse" width=".1" height=".1"><path d="M.1 0H0V.1" fill="none" stroke="#9bae8e" stroke-width=".008"/></pattern><pattern id="move-grid-major" patternUnits="userSpaceOnUse" width="1" height="1"><rect width="1" height="1" fill="url(#move-grid-minor)"/><path d="M1 0H0V1" fill="none" stroke="#829776" stroke-width=".028"/></pattern></defs>' +
      '<rect data-move-grid="" width="' + p.lot.width + '" height="' + p.lot.depth + '" fill="url(#move-grid-major)" pointer-events="none"/>';
  }
  const b = p.settings.setbacks;
  svg += `<rect x="${b.left}" y="${b.front}" width="${p.lot.width - b.left - b.right}" height="${p.lot.depth - b.front - b.back}" fill="none" stroke="#7b8d70" stroke-width=".02" stroke-dasharray=".12 .1"/>`;
  for (const r of p.rooms) {
    const error = a.errors.some(e => e.roomId === r.id);
    svg += `<g class="room${error ? ' room-invalid' : ''}" data-room="${escape(r.id)}" ${interactive ? `role="button" tabindex="0" aria-pressed="${selected === r.id}" aria-describedby="move-status" aria-label="Editar ${escape(r.name)}"` : ''}><rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.depth}" fill="${COLORS[r.type]}" stroke="${error ? '#b64635' : !interactive && selected === r.id ? '#315d3d' : 'none'}" stroke-width=".08"/>`;
    if (r.type === 'hall') svg += `<text class="small" x="${r.x + r.width / 2}" y="${r.y + r.depth / 2}" transform="rotate(-90 ${r.x + r.width / 2} ${r.y + r.depth / 2})">${escape(r.name)} · ${fmt(r.width - p.settings.wallThickness)} m livres</text>`;
    else {
      const maxName = Math.max(6, Math.floor((r.width - .35) / (textSize * .54))), label = r.name.length > maxName ? r.name.slice(0, maxName - 1) + '…' : r.name;
      svg += `<text class="room-name" x="${r.x + r.width / 2}" y="${r.y + r.depth / 2 - .4}"><title>${escape(r.name)}</title>${escape(label)}</text><text style="font-size:${Math.min(textSize, (r.width - .3) / 10)}px" x="${r.x + r.width / 2}" y="${r.y + r.depth / 2 + .12}">${roomText(r)}</text><text class="small" x="${r.x + r.width / 2}" y="${r.y + r.depth / 2 + .6}">${fmt((r.width - p.settings.wallThickness) * (r.depth - p.settings.wallThickness))} m² livres</text>`;
    }
    svg += '</g>';
  }
  svg += '<g pointer-events="none">';
  for (const s of wallSegments(p)) {
    const x1 = s.axis === 'x' ? s.start : s.line, y1 = s.axis === 'x' ? s.line : s.start, x2 = s.axis === 'x' ? s.end : s.line, y2 = s.axis === 'x' ? s.line : s.end;
    if (!s.opening) svg += line(x1, y1, x2, y2, 'wall');
    else if (s.opening === 'window') svg += `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="#4f8990" stroke-width=".055"/>`;
  }
  for (const o of p.openings.filter(o => o.kind === 'door')) {
    const r = p.rooms.find(r => r.id === o.roomId), s = openingSpan(r, o), x = s.axis === 'x' ? s.start / 1000 : s.line / 1000, y = s.axis === 'x' ? s.line / 1000 : s.start / 1000;
    svg += `<path d="${s.axis === 'x' ? `M${x} ${y}v${o.width} A${o.width} ${o.width} 0 0 0 ${x + o.width} ${y}` : `M${x} ${y}h${o.width} A${o.width} ${o.width} 0 0 1 ${x} ${y + o.width}`}" fill="none" stroke="#8d714b" stroke-width=".025"/>`;
  }
  svg += dim(0, -.7, p.lot.width, -.7, `${fmt(p.lot.width)} m`) + dim(-.7, 0, -.7, p.lot.depth, `${fmt(p.lot.depth)} m`, true);
  const bar = Math.min(5, p.lot.width / 2), y = p.lot.depth + .7;
  svg += `<text x="${p.lot.width / 2}" y="-1.35" class="room-name">${escape(p.name)} · estudo preliminar</text><text class="small" x="${p.lot.width / 2}" y="${p.lot.depth + 1.8}">Cotas livres em metros · eixos nas coordenadas · revise com profissional</text>${dim(0, y, bar, y, `0 — ${fmt(bar)} m`)}<text class="small" x="${p.lot.width - 1}" y="${y}">1:${scale} a 100%</text></g></svg>`;
  return svg;
}

export function csvReport(p) {
  const r = report(p), quoted = v => {
    let text = String(v);
    if (typeof v === 'string' && /^[\s\uFEFF]*[=+\-@\t\r\n]/u.test(text)) text = "'" + text;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return ['"Ambiente","Largura livre (m)","Profundidade livre (m)","Área livre (m²)"', ...r.rooms.map(x => [x.name, x.clearWidth, x.clearDepth, x.area.toFixed(4)].map(quoted).join(','))].join('\r\n') + '\r\n';
}

export function imagePrompt(p) {
  const r = report(p);
  return `Crie uma visualização arquitetônica ilustrativa, aconchegante e realista de uma residência térrea brasileira. Jardim simples, madeira natural e reboco claro. Exemplo fictício: terreno ${p.lot.width} × ${p.lot.depth} m; paredes ${p.settings.wallHeight} m de altura; programa: ${r.rooms.map(x => `${x.name} (${x.clearWidth} × ${x.clearDepth} m livres)`).join('; ')}. Não invente texto, cotas, certificações, pessoas ou endereço. Esta imagem é conceitual: não é desenho técnico nem evidência de execução dimensional. A planta JSON/SVG é a referência das medidas.`;
}
