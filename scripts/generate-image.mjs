#!/usr/bin/env node
/** Optional one-shot OpenAI image adapter. No key or HTTP call at import. */
import { readFile, writeFile, open } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseProject, validate } from '../src/core.js';
import { imagePrompt } from '../src/plan.js';

export function requestBody(project, model) {
  if (!validate(project).valid) throw Error('Corrija os erros geométricos antes de gerar uma imagem.');
  if (typeof model !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,99}$/.test(model)) throw Error('Informe explicitamente o modelo de imagem disponível na sua conta.');
  return { model, prompt: imagePrompt(project), n: 1, size: '1536x1024', quality: 'medium', output_format: 'png' };
}

export async function main(argv = process.argv.slice(2), { fetchImpl = fetch, key = process.env.OPENAI_API_KEY } = {}) {
  if (argv.includes('--help') || argv.length === 0) {
    console.log('Uso: node scripts/generate-image.mjs projeto.json imagem.png --model MODELO --confirm-paid-request\nLê OPENAI_API_KEY do ambiente. Uma chamada, sem retry. Sem --confirm-paid-request, apenas grava o prompt em stdout.'); return 0;
  }
  const [input, output, ...options] = argv;
  if (!input || !output || !output.endsWith('.png')) throw Error('Informe o JSON do projeto e um destino .png novo.');
  const modelAt = options.indexOf('--model');
  const paid = options.includes('--confirm-paid-request');
  if (options.some((s, i) => s !== '--confirm-paid-request' && s !== '--model' && i !== modelAt + 1) || options.filter(s => s === '--model').length > 1) throw Error('Argumentos inválidos.');
  const data = await readFile(input); if (data.length > 512000) throw Error('JSON acima do limite.');
  const project = parseProject(data.toString('utf8'));
  if (!paid) { console.log(imagePrompt(project)); return 0; }
  if (!key || typeof key !== 'string') throw Error('Defina OPENAI_API_KEY somente no seu ambiente local.');
  const body = requestBody(project, modelAt >= 0 ? options[modelAt + 1] : undefined);
  // Exclusive reservation prevents paid calls followed by overwriting a file.
  const target = await open(output, 'wx', 0o600);
  try {
    const response = await fetchImpl('https://api.openai.com/v1/images/generations', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(240000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(body),
    });
    if (!response.ok) throw Error(`Provedor recusou a chamada (HTTP ${response.status}). Não há retentativa automática.`);
    const raw = await response.text(); if (raw.length > 40_000_000) throw Error('Resposta acima do limite.');
    const result = JSON.parse(raw), encoded = result?.data?.[0]?.b64_json;
    if (typeof encoded !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw Error('O provedor não retornou imagem base64 válida.');
    const png = Buffer.from(encoded, 'base64');
    if (png.length > 25_000_000 || !png.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw Error('PNG inválido ou acima do limite.');
    await target.writeFile(png);
    const metadata = { generated: true, illustrative: true, model: body.model, size: body.size, reference: 'Use o JSON/SVG como fonte dimensional, não esta imagem.', provider_usage: result.usage ?? null };
    await writeFile(output + '.json', JSON.stringify(metadata, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log('Imagem ilustrativa salva. Nenhuma chave foi gravada.'); return 0;
  } catch (e) {
    // An empty reserved output can remain after an uncertain provider failure.
    // Preserve it as a visible failure; do not silently repeat a paid request.
    if (e.message?.includes('Provedor recusou') || e.message?.includes('PNG inválido')) throw e;
    throw Error('Geração não concluída. Verifique o destino e o uso no provedor antes de repetir.');
  } finally { await target.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(code => process.exitCode = code).catch(e => { console.error(e.message); process.exitCode = 2; });
}
