// Gemini API로 모델을 한 번 호출한다. 매 호출은 대화 기록 없는 새 요청이다.
// 키는 환경변수 GEMINI_API_KEY 에서 읽는다(저장소에 넣지 않는다).
import { execSync } from 'node:child_process';
import { SYSTEM } from './prompts.mjs';

function readKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  if (process.platform === 'win32') {
    // 셸을 연 뒤에 사용자 환경변수로 등록한 경우를 위해 레지스트리에서 직접 읽는다.
    try {
      const out = execSync('reg query HKCU\\Environment /v GEMINI_API_KEY', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const m = out.match(/GEMINI_API_KEY\s+REG_\w+\s+(\S+)/);
      if (m) return m[1];
    } catch { /* 없음 */ }
  }
  return null;
}
const KEY = readKey();

export async function callGemini(model, prompt, { timeoutMs = 300000 } = {}) {
  if (!KEY) return { ok: false, text: '', ms: 0, cost: null, error: 'GEMINI_API_KEY 없음' };
  const t0 = Date.now();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  };
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const r = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
        body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 429 || r.status >= 500) {
        // 무료 한도: 분당 요청 수를 넘으면 잠시 기다렸다 다시 보낸다.
        const wait = Number(j?.error?.details?.find?.((d) => d.retryDelay)?.retryDelay?.replace('s', '')) || 15 * attempt;
        // '하루 한도'는 실제로 위반된 항목(violations)의 quotaId에 PerDay가 있을 때만으로 판단한다.
        // (분당 한도 초과 메시지에도 PerDay 라는 글자가 섞여 있어, 전체 문자열로 판단하면 너무 일찍 멈춘다.)
        const violated = (j?.error?.details || []).flatMap((d) => d.violations || []).map((v) => v.quotaId || '');
        if (violated.length && violated.every((q) => /PerDay/i.test(q))) {
          console.log('  제미나이 하루 한도:', violated.join(', '));
          return { ok: false, text: '', ms: Date.now() - t0, cost: null, error: 'DAILY_QUOTA' };
        }
        await new Promise((s) => setTimeout(s, wait * 1000));
        continue;
      }
      if (!r.ok) return { ok: false, text: '', ms: Date.now() - t0, cost: null, error: JSON.stringify(j).slice(0, 500) };
      const parts = j.candidates?.[0]?.content?.parts || [];
      const text = parts.filter((p) => !p.thought).map((p) => p.text || '').join('');
      return { ok: true, text, version: j.modelVersion ?? null, ms: Date.now() - t0, cost: null, error: null };
    } catch (e) {
      if (attempt === 6) return { ok: false, text: '', ms: Date.now() - t0, cost: null, error: String(e) };
      await new Promise((s) => setTimeout(s, 5000 * attempt));
    }
  }
  return { ok: false, text: '', ms: Date.now() - t0, cost: null, error: 'retries exhausted' };
}
