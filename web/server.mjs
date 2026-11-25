// 라이브 데모 서버
//   node web/server.mjs   →  http://localhost:5173
// 정적 파일(web/)과 결과(results/summary.json)를 보여 주고,
// /api/ask 로 들어온 문제를 Claude Code CLI로 실제 모델에 보내 답과 확신도를 받아 온다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROMPTS, MODELS, parseReply } from '../experiment/prompts.mjs';
import { callClaude } from '../experiment/claude.mjs';
import { callGemini } from '../experiment/gemini.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 5173);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

async function ask({ question, model, cond, reps }) {
  const id = MODELS[model];
  const make = PROMPTS[cond];
  if (!id || !make || !question?.trim()) throw new Error('잘못된 요청');
  const n = Math.max(1, Math.min(3, Number(reps) || 1));
  const runs = await Promise.all(Array.from({ length: n }, () => (id.startsWith('gemini') ? callGemini : callClaude)(id, make(question.trim()), { timeoutMs: 120000 })));
  return runs.map((r) => ({ ...(r.ok ? parseReply(r.text) : { ok: false }), ms: r.ms, error: r.ok ? null : r.error, raw: r.text }));
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === '/api/health') return send(res, 200, { live: true });
    if (url.pathname === '/api/ask' && req.method === 'POST') {
      let body = '';
      for await (const c of req) body += c;
      return send(res, 200, { results: await ask(JSON.parse(body)) });
    }
    let p = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    const file = p.startsWith('/results/') ? path.join(ROOT, p) : path.join(ROOT, 'web', p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, 'not found', 'text/plain');
    send(res, 200, fs.readFileSync(file), TYPES[path.extname(file)] || 'application/octet-stream');
  } catch (e) {
    send(res, 500, { error: String(e.message || e) });
  }
}).listen(PORT, () => console.log(`데모 서버: http://localhost:${PORT}`));
