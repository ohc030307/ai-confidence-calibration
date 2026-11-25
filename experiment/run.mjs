// 실험 실행기
//   node experiment/run.mjs --cond base --models haiku,sonnet,opus --reps 3 --conc 6
//   node experiment/run.mjs --cond fix  ...
// 결과는 results/raw/<cond>.jsonl 에 한 줄씩 쌓인다. 중간에 끊겨도 다시 실행하면 이어서 한다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROMPTS, MODELS, parseReply } from './prompts.mjs';
import { callClaude } from './claude.mjs';
import { callGemini } from './gemini.mjs';

const call = (id, prompt) => (id.startsWith('gemini') ? callGemini(id, prompt) : callClaude(id, prompt));
let quotaHit = false; // 제미나이 무료 하루 한도에 걸리면 멈추고, 다음 날 다시 실행하면 이어서 한다

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const cond = arg('cond', 'base');
const models = arg('models', 'haiku,sonnet,opus').split(',');
const reps = Number(arg('reps', 3));
const conc = Number(arg('conc', 6));
const only = arg('ids', '') ? new Set(arg('ids').split(',')) : null;

const questions = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/questions.json'), 'utf8'))
  .filter((q) => !only || only.has(q.id));
const outFile = path.join(ROOT, 'results/raw', `${arg('out', cond)}.jsonl`);
fs.mkdirSync(path.dirname(outFile), { recursive: true });

const done = new Set();
if (fs.existsSync(outFile)) {
  for (const line of fs.readFileSync(outFile, 'utf8').split('\n').filter(Boolean)) {
    let r; try { r = JSON.parse(line); } catch { continue; } // 끊긴 줄은 건너뜀
    if (r.parsed) done.add(`${r.qid}|${r.model}|${r.rep}`);
  }
}

// 문항·모델·반복 순서를 섞어서, 같은 모델 호출이 몰리지 않게 한다(시드 고정).
let seed = 20261125;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const jobs = [];
for (const q of questions) for (const m of models) for (let r = 1; r <= reps; r++) {
  if (!done.has(`${q.id}|${MODELS[m]}|${r}`)) jobs.push({ q, m, r });
}
for (let i = jobs.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [jobs[i], jobs[j]] = [jobs[j], jobs[i]]; }

console.log(`[${cond}] ${jobs.length} calls to run (${done.size} already done)`);
let finished = 0, failed = 0;
const t0 = Date.now();

async function worker() {
  while (jobs.length && !quotaHit) {
    const { q, m, r } = jobs.shift();
    let res, parsed;
    for (let attempt = 1; attempt <= 3; attempt++) {
      res = await call(MODELS[m], PROMPTS[cond](q.question));
      if (res.error === 'DAILY_QUOTA') { quotaHit = true; break; }
      parsed = res.ok ? parseReply(res.text) : { ok: false };
      if (parsed.ok) break;
      await new Promise((s) => setTimeout(s, 5000 * attempt));
    }
    if (quotaHit) { console.log('  제미나이 하루 한도 도달: 여기서 멈춤 (내일 다시 실행하면 이어서 함)'); break; }
    if (!parsed.ok) failed++;
    fs.appendFileSync(outFile, JSON.stringify({
      qid: q.id, model: MODELS[m], cond, rep: r, parsed: parsed.ok,
      answer: parsed.answer ?? null, confidence: parsed.confidence ?? null, check: parsed.check ?? null,
      raw: res.text, version: res.version ?? null, ms: res.ms, cost: res.cost, error: res.error, ts: new Date().toISOString(),
    }) + '\n');
    finished++;
    if (finished % 20 === 0) {
      const rate = finished / ((Date.now() - t0) / 60000);
      console.log(`  ${finished} done, ${failed} failed, ${rate.toFixed(1)}/min, ~${(jobs.length / rate).toFixed(0)} min left`);
    }
  }
}
await Promise.all(Array.from({ length: conc }, worker));
console.log(`[${cond}] finished: ${finished} calls, ${failed} unparsed`);
