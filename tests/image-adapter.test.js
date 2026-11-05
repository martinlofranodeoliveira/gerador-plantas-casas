import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generate } from '../src/core.js';
import { main, requestBody } from '../scripts/generate-image.mjs';
import { csvReport } from '../src/plan.js';

test('image request has exact endpoint contract, explicit model and illustrative scope', () => {
  assert.throws(() => requestBody(generate()));
  const r = requestBody(generate(), 'gpt-image-2.5-sunburst');
  assert.equal(r.n, 1); assert.equal(r.output_format, 'png'); assert.ok(r.prompt.includes('não é desenho técnico'));
  assert.ok(!JSON.stringify(r).includes('OPENAI_API_KEY'));
});
test('paid adapter is explicit, one shot, never overwrites and never persists credentials', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'casa-image-test-'));
  try {
    const input = join(dir, 'example.json'), output = join(dir, 'image.png'); await writeFile(input, JSON.stringify(generate()));
    let calls = 0; const png = Buffer.from([137,80,78,71,13,10,26,10,1,2,3]);
    const mock = async (url, request) => { calls++; assert.equal(url, 'https://api.openai.com/v1/images/generations'); assert.equal(request.redirect, 'error'); assert.equal(request.headers.Authorization, 'Bearer synthetic-key'); return new Response(JSON.stringify({ data: [{ b64_json: png.toString('base64') }], usage: { total_tokens: 10 } })); };
    await main([input, output, '--model', 'gpt-image-2.5-sunburst', '--confirm-paid-request'], { fetchImpl: mock, key: 'synthetic-key' });
    assert.equal(calls, 1); assert.deepEqual(await readFile(output), png);
    assert.ok(!(await readFile(output + '.json', 'utf8')).includes('synthetic-key'));
    await assert.rejects(() => main([input, output, '--model', 'gpt-image-2.5-sunburst', '--confirm-paid-request'], { fetchImpl: mock, key: 'synthetic-key' })); assert.equal(calls, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('CSV labels beginning with formulas are escaped for spreadsheet readers', () => {
  const p = generate(); p.rooms[0].name = '=1+1'; assert.ok(csvReport(p).includes('"\'=1+1"'));
});
