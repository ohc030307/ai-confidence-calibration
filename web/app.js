/* 결과 대시보드 + 라이브 데모 */
const $ = (s, el = document) => el.querySelector(s);
const pct = (v, d = 0) => (v == null ? '–' : (v * 100).toFixed(d) + '%');
const num = (v, d = 3) => (v == null ? '–' : v.toFixed(d));
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MODEL_KEY = { 'Haiku 5.5': 'haiku', 'Sonnet 5.5': 'sonnet', 'Opus 5.5': 'opus', 'Gemini Flash-Lite': 'glite', 'Gemini Flash': 'gflash' };
const MODEL_COLOR = (name) => `var(--${MODEL_KEY[name] || 'accent'})`;
const TYPE_ORDER = ['계산', '개념', '코드추적', '수표현', '알고리즘', '함정', '전제오류'];
let S = null; // summary.json
let LIVE = false;

// ───── 탭
function showTab(id) {
  document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === id));
  document.querySelectorAll('.panel').forEach((p) => (p.hidden = p.id !== id));
  history.replaceState(null, '', '#' + id);
}
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
document.addEventListener('click', (e) => { const g = e.target.closest('[data-goto]'); if (g) { showTab(g.dataset.goto); scrollTo(0, 0); } });

// ───── 데이터 불러오기
async function loadSummary() {
  for (const p of ['results/summary.json', '../results/summary.json']) {
    try { const r = await fetch(p, { cache: 'no-store' }); if (r.ok) return r.json(); } catch {}
  }
  throw new Error('summary.json 을 찾을 수 없습니다');
}
async function checkLive() {
  try { const r = await fetch('/api/health', { cache: 'no-store' }); return r.ok && (await r.json()).live; } catch { return false; }
}

// ───── 신뢰도 그림 (SVG)
function reliabilitySVG(bins, color, { w = 320, h = 300 } = {}) {
  const pad = { l: 44, r: 12, t: 12, b: 40 };
  const x = (v) => pad.l + v * (w - pad.l - pad.r);
  const y = (v) => h - pad.b - v * (h - pad.t - pad.b);
  const maxN = Math.max(...bins.map((b) => b.n), 1);
  let g = '';
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    g += `<line x1="${x(0)}" x2="${x(1)}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)"/>`;
    g += `<text x="${pad.l - 6}" y="${y(t) + 4}" font-size="11" text-anchor="end" fill="var(--muted)">${t * 100}%</text>`;
    g += `<text x="${x(t)}" y="${h - pad.b + 16}" font-size="11" text-anchor="middle" fill="var(--muted)">${t * 100}%</text>`;
  }
  g += `<line x1="${x(0)}" y1="${y(0)}" x2="${x(1)}" y2="${y(1)}" stroke="var(--muted)" stroke-dasharray="4 4"/>`;
  g += `<text x="${(x(0) + x(1)) / 2}" y="${h - 4}" font-size="12" text-anchor="middle" fill="var(--muted)">말한 확신도</text>`;
  g += `<text transform="translate(12 ${(y(0) + y(1)) / 2}) rotate(-90)" font-size="12" text-anchor="middle" fill="var(--muted)">실제 정답률</text>`;
  for (const b of bins) {
    const r = 4 + 14 * Math.sqrt(b.n / maxN);
    g += `<line x1="${x(b.conf)}" x2="${x(b.conf)}" y1="${y(b.conf)}" y2="${y(b.acc)}" stroke="${color}" stroke-opacity=".35" stroke-width="2"/>`;
    g += `<circle cx="${x(b.conf)}" cy="${y(b.acc)}" r="${r}" fill="${color}" fill-opacity=".75"><title>확신도 ${b.lo}~${b.hi}%: ${b.n}건, 평균 확신도 ${pct(b.conf, 1)}, 정답률 ${pct(b.acc, 1)}</title></circle>`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="신뢰도 그림">${g}</svg>`;
}

// ───── 난이도 사다리 그림: 단계별 정답률(실선)과 확신도(점선)
function ladderSVG(byModel, { w = 340, h = 230 } = {}) {
  const pad = { l: 40, r: 10, t: 10, b: 34 };
  const x = (lv) => pad.l + ((lv - 1) / 9) * (w - pad.l - pad.r);
  const y = (v) => h - pad.b - v * (h - pad.t - pad.b);
  let g = '';
  for (const t of [0, 0.5, 1]) {
    g += `<line x1="${x(1)}" x2="${x(10)}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)"/>`;
    g += `<text x="${pad.l - 6}" y="${y(t) + 4}" font-size="11" text-anchor="end" fill="var(--muted)">${t * 100}%</text>`;
  }
  for (let lv = 1; lv <= 10; lv += 3) g += `<text x="${x(lv)}" y="${h - pad.b + 15}" font-size="11" text-anchor="middle" fill="var(--muted)">${lv}</text>`;
  g += `<text x="${x(10)}" y="${h - pad.b + 15}" font-size="11" text-anchor="middle" fill="var(--muted)">10</text>`;
  g += `<text x="${(x(1) + x(10)) / 2}" y="${h - 3}" font-size="12" text-anchor="middle" fill="var(--muted)">난이도 단계 →</text>`;
  for (const [name, lv] of Object.entries(byModel)) {
    const c = MODEL_COLOR(name);
    const path = (k) => lv.map((p, i) => `${i ? 'L' : 'M'}${x(p.level)},${y(p[k])}`).join(' ');
    g += `<path d="${path('acc')}" fill="none" stroke="${c}" stroke-width="2.5"/>`;
    g += `<path d="${path('conf')}" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="5 4" opacity=".8"/>`;
    for (const p of lv) g += `<circle cx="${x(p.level)}" cy="${y(p.acc)}" r="3" fill="${c}"><title>${name} ${p.level}단계 (${p.why}): 정답률 ${pct(p.acc)}, 확신도 ${pct(p.conf)}</title></circle>`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="난이도 사다리">${g}</svg>`;
}
const LADDER_ORDER = ['곱셈', '요일', '코드추적', '글자세기', '숫자세기', '단어세기'];

// ───── 결과 탭
function renderResults() {
  const base = S.conditions.base;
  const o = base.overall;
  $('#kpis').innerHTML = [
    [o.n.toLocaleString(), `모델 응답 (문항 ${S.questions}개)`],
    [pct(o.acc, 1), '전체 정답률'],
    [pct(o.conf, 1), '평균 확신도'],
    [`${o.confident_wrong}건`, `확신도 90% 이상인데 틀린 응답 (틀린 ${o.wrong}건 중)`],
  ].map(([b, s]) => `<div class="kpi"><b>${b}</b><span>${s}</span></div>`).join('');

  const rows = Object.entries(base.models).map(([name, m]) => {
    const s = m.stated;
    return `<tr><td><span class="dot" style="background:${MODEL_COLOR(name)}"></span>${name}</td>
      <td>${s.n}</td><td>${pct(s.acc, 1)}</td><td>${pct(s.conf, 1)}</td><td class="${s.gap > 0.03 ? 'cell-bad' : ''}">${s.gap >= 0 ? '+' : ''}${(s.gap * 100).toFixed(1)}%p</td>
      <td>${num(s.ece)}</td><td>${num(s.brier)}</td><td>${num(s.auroc, 2)}</td>
      <td>${s.wrong}</td><td class="${s.confident_wrong ? 'cell-bad' : ''}">${s.confident_wrong}</td><td>${pct(s.conf_when_wrong, 0)}</td></tr>`;
  }).join('');
  $('#modelTable').innerHTML = `<div class="tablewrap"><table><thead><tr><th>모델</th><th>응답 수</th><th>정답률</th><th>평균 확신도</th><th>과신 폭</th><th>ECE</th><th>Brier</th><th>AUROC</th><th>틀린 응답</th><th>90%↑인데 틀림</th><th>틀렸을 때 평균 확신도</th></tr></thead><tbody>${rows}</tbody></table></div>`;

  $('#reliab').innerHTML = Object.entries(base.models).map(([name, m]) =>
    `<div class="chart"><h3><span class="dot" style="background:${MODEL_COLOR(name)}"></span>${name}</h3>${reliabilitySVG(m.reliability, MODEL_COLOR(name))}</div>`).join('');

  const names = Object.keys(base.models);
  const types = TYPE_ORDER.filter((t) => base.by_type[t]);
  const head = names.map((n) => `<th>${n}<br>정답률 / 확신도</th>`).join('');
  const body = types.map((t) => `<tr><td>${t} </td>${names.map((n) => {
    const s = base.models[n].by_type[t];
    const over = s.conf - s.acc;
    return `<td class="${over > 0.1 ? 'cell-bad' : ''}">${pct(s.acc)} / ${pct(s.conf)}</td>`;
  }).join('')}</tr>`).join('');
  $('#typeTable').innerHTML = `<div class="tablewrap"><table><thead><tr><th>유형</th>${head}</tr></thead><tbody>${body}</tbody></table></div>
    <p class="muted">빨간 칸: 확신도가 정답률보다 10%p 넘게 높음(과신).</p>`;

  const L = base.ladders || {};
  $('#ladders').innerHTML = LADDER_ORDER.filter((n) => L[n]).map((n) =>
    `<div class="chart"><h3>${n}</h3>${ladderSVG(L[n])}</div>`).join('');
}

// ───── 개선 탭
function renderFix() {
  const base = S.conditions.base, fix = S.conditions.fix;
  const el = $('#fixBody');
  const story = window.FIX_STORY || '';
  if (!fix) { el.innerHTML = story + '<p class="muted">개선 후 실험 결과가 아직 없습니다.</p>'; return; }
  const names = Object.keys(base.models).filter((n) => fix.models[n]); // 개선 후 결과가 있는 모델만
  const line = (label, f, better) => `<tr><td>${label}</td>${names.map((n) => {
    const a = f(base.models[n]), b = f(fix.models[n]);
    const good = a != null && b != null && (better === 'low' ? b < a : b > a);
    return `<td>${fmt(a)} → <b class="${good ? 'cell-good' : (a === b ? '' : 'cell-bad')}">${fmt(b)}</b></td>`;
  }).join('')}</tr>`;
  let fmt = (v) => v;
  const rows = [];
  fmt = (v) => pct(v, 1); rows.push(line('정답률', (m) => m.stated.acc, 'high'));
  rows.push(line('평균 확신도', (m) => m.stated.conf, 'none'));
  rows.push(line('틀렸을 때 평균 확신도', (m) => m.stated.conf_when_wrong, 'low'));
  fmt = (v) => (v == null ? '–' : v.toFixed(3)); rows.push(line('ECE (낮을수록 좋음)', (m) => m.stated.ece, 'low'));
  rows.push(line('Brier (낮을수록 좋음)', (m) => m.stated.brier, 'low'));
  fmt = (v) => (v == null ? '–' : v.toFixed(2)); rows.push(line('AUROC (높을수록 좋음)', (m) => m.stated.auroc, 'high'));
  fmt = (v) => `${v}건`; rows.push(line('90%↑인데 틀림', (m) => m.stated.confident_wrong, 'low'));
  fmt = (v) => pct(v, 0); rows.push(line('전제오류 문항 정답률', (m) => m.by_type['전제오류']?.acc, 'high'));
  el.innerHTML = `${story}
    <h2>모델별 개선 전 → 후</h2>
    <div class="tablewrap"><table><thead><tr><th>지표</th>${names.map((n) => `<th>${n}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>
    <h2>개선 후 신뢰도 그림</h2>
    <div class="smalls">${names.map((n) => `<div class="chart"><h3><span class="dot" style="background:${MODEL_COLOR(n)}"></span>${n} · 개선 후</h3>${reliabilitySVG(fix.models[n].reliability, MODEL_COLOR(n))}</div>`).join('')}</div>
    <h2>다른 방법: 같은 문제를 3번 물어 답이 일치하는 정도를 확신도로 쓰기</h2>
    <div class="tablewrap"><table><thead><tr><th>모델 (개선 전 데이터)</th><th>말한 확신도 ECE</th><th>일관성 확신도 ECE</th><th>말한 확신도 AUROC</th><th>일관성 AUROC</th></tr></thead><tbody>
    ${names.map((n) => { const m = base.models[n]; return `<tr><td>${n}</td><td>${num(m.stated.ece)}</td><td>${num(m.consistency.ece)}</td><td>${num(m.stated.auroc, 2)}</td><td>${num(m.consistency.auroc, 2)}</td></tr>`; }).join('')}
    </tbody></table></div>`;
}

// ───── 문항 탭
function renderItems() {
  const cond = $('#fCond').value, dom = $('#fDomain').value, typ = $('#fType').value, onlyWrong = $('#fWrong').checked;
  const items = (S.conditions[cond] || S.conditions.base).items.filter((it) =>
    (!dom || it.domain === dom) && (!typ || it.type === typ) &&
    (!onlyWrong || Object.values(it.models).some((rs) => rs.some((r) => !r.correct))));
  $('#itemCount').textContent = `${items.length}개 문항`;
  $('#itemList').innerHTML = items.map((it) => `<article class="item">
    <div class="meta">${it.id} · ${it.domain} · ${it.type} · 정답: <b>${esc(it.gold)}</b>${it.why ? ` <span>(${esc(it.why)})</span>` : ''}</div>
    <div class="qtext">${esc(it.question)}</div>
    <div class="reps">${Object.entries(it.models).map(([n, rs]) => `<div class="rep"><b style="color:${MODEL_COLOR(n)}">${n}</b><br>${rs.map((r) =>
      `<span class="r ${r.correct ? 'o' : 'x'}">${r.correct ? 'O' : 'X'}</span>${esc(r.answer)} <span class="muted">(${r.confidence}%)</span>`).join('<br>')}</div>`).join('')}</div>
  </article>`).join('');
}
function setupItems() {
  const types = TYPE_ORDER.filter((t) => S.conditions.base.by_type[t]);
  $('#fType').innerHTML += types.map((t) => `<option>${t}</option>`).join('');
  if (!S.conditions.fix) $('#fCond').querySelector('[value=fix]').disabled = true;
  ['#fCond', '#fDomain', '#fType', '#fWrong'].forEach((s) => $(s).addEventListener('change', renderItems));
  renderItems();
}

// ───── 데모 탭
const PRESETS = window.DEMO_PRESETS || [];
function setupDemo() {
  $('#presets').innerHTML = PRESETS.map((p, i) => `<button type="button" data-i="${i}">${esc(p.label)}</button>`).join('');
  $('#presets').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const p = PRESETS[b.dataset.i];
    $('#q').value = p.q; $('#q').dataset.gold = p.gold || ''; $('#q').dataset.goldFor = p.q; if (p.model) $('#model').value = p.model; if (p.cond) $('#cond').value = p.cond;
  });
  $('#livehint').innerHTML = LIVE
    ? '실제 모델에 연결되어 있습니다. 한 번 묻는 데 5~20초 걸립니다.'
    : '지금은 정적 페이지라 실제 모델에 연결되어 있지 않습니다. 로컬에서 <code>node web/server.mjs</code> 로 실행하면 라이브 데모가 켜집니다. 지금은 실험에 있던 문항만 기록된 응답으로 보여 줍니다.';
  $('#ask').addEventListener('submit', async (e) => {
    e.preventDefault();
    const question = $('#q').value.trim(); if (!question) return;
    const model = $('#model').value, cond = $('#cond').value, reps = Number($('#reps').value);
    const modelName = Object.keys(MODEL_KEY).find((n) => MODEL_KEY[n] === model);
    const out = $('#answer');
    if (!LIVE) return renderReplay(question, modelName, cond);
    $('#go').disabled = true;
    out.innerHTML = `<p><span class="spinner"></span>${modelName}에게 ${reps}번 묻는 중… (각각 새 대화)</p>`;
    try {
      const r = await fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, model, cond, reps }) });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      renderAnswer(j.results, modelName, cond);
      const qa = $('#q');
      if (qa.dataset.gold && qa.dataset.goldFor === question) $('#answer').insertAdjacentHTML('beforeend', `<p style="font-size:18px">실제 정답: <b>${esc(qa.dataset.gold)}</b></p>`);
    } catch (err) {
      out.innerHTML = `<p class="cell-bad">오류: ${esc(err.message)}</p>`;
    } finally { $('#go').disabled = false; }
  });
}

function normAns(a) {
  const s = String(a ?? '').toLowerCase().replace(/[\s'"`\[\]\(\),]/g, '').replace(/\.$/, '');
  return /전제오류|없음|존재하지않/.test(s) ? '전제 오류' : s;
}
// 말한 확신도가 들어가는 구간에서, 실험 때 이 모델이 실제로 맞힌 비율
function calibrated(modelName, conf, cond) {
  const bins = (S.conditions[cond] || S.conditions.base).models[modelName]?.reliability || [];
  const b = bins.find((x) => conf >= x.lo && conf < (x.hi === 100 ? 100.01 : x.hi));
  return b || null;
}

function renderAnswer(results, modelName, cond) {
  const ok = results.filter((r) => r.ok);
  if (!ok.length) { $('#answer').innerHTML = `<p class="cell-bad">응답을 해석하지 못했습니다.</p><pre>${esc(results[0]?.raw || results[0]?.error)}</pre>`; return; }
  const counts = {};
  ok.forEach((r) => { const k = normAns(r.answer); counts[k] = (counts[k] || 0) + 1; });
  const [topAns, topN] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const agree = topN / ok.length;
  const meanConf = ok.reduce((s, r) => s + r.confidence, 0) / ok.length;
  const cal = calibrated(modelName, meanConf, cond);
  let cls = 'ok', title = '믿어도 되는 편', why = '';
  if (ok.length > 1 && agree < 1) { cls = 'bad'; title = '답이 흔들림 — 검산 필요'; why = `같은 문제를 ${ok.length}번 물었는데 답이 ${Object.keys(counts).length}가지로 나왔습니다. 확신도가 높아도 실험에서 이런 경우는 틀릴 때가 많았습니다.`; }
  else if (cal && cal.acc < 0.9) { cls = 'caution'; title = '확신도만큼 믿기는 어려움'; why = `실험에서 ${modelName}가 확신도 ${cal.lo}~${cal.hi}%라고 답한 ${cal.n}건 중 실제로 맞은 것은 ${pct(cal.acc)}였습니다.`; }
  else { why = cal ? `실험에서 ${modelName}가 이 구간(${cal.lo}~${cal.hi}%)으로 답한 ${cal.n}건 중 ${pct(cal.acc)}가 맞았습니다.` : '이 확신도 구간은 실험 데이터가 부족합니다.'; if (ok.length > 1) why += ` ${ok.length}번 모두 같은 답이었습니다.`; }
  $('#answer').innerHTML = `
    <div class="runs">${ok.map((r, i) => `<div class="run"><div><span class="muted">${i + 1}번째 답</span><div class="ans">${esc(r.answer)}</div></div>
      <div class="conf">${r.confidence}%<small>모델이 말한 확신도</small></div>${r.check ? `<div class="chk">점검: ${esc(r.check)}</div>` : ''}</div>`).join('')}</div>
    <div class="facts">
      <div class="fact"><span>말한 확신도(평균)</span><b>${meanConf.toFixed(0)}%</b></div>
      <div class="fact"><span>실험상 실제 정답률</span><b>${cal ? pct(cal.acc) : '–'}</b></div>
      <div class="fact"><span>답 일치</span><b>${topN}/${ok.length}</b></div>
    </div>
    <div class="verdict ${cls}"><b>${title}</b><br>${why}</div>
    <p class="muted" style="font-size:13px">${cond === 'fix' ? '점검 프롬프트(개선 후)' : '기본 프롬프트(개선 전)'} · 응답 시간 ${ok.map((r) => (r.ms / 1000).toFixed(1) + '초').join(', ')}</p>`;
}

function renderReplay(question, modelName, cond) {
  const items = (S.conditions[cond] || S.conditions.base).items;
  const it = items.find((x) => x.question.replace(/\s/g, '') === question.replace(/\s/g, ''));
  if (!it) { $('#answer').innerHTML = '<p class="muted">정적 페이지에서는 실험에 있던 문항만 보여 줄 수 있습니다. 위의 예시 버튼을 눌러 보세요.</p>'; return; }
  renderAnswer(it.models[modelName].map((r) => ({ ok: true, answer: r.answer, confidence: r.confidence, ms: 0 })), modelName, cond);
  $('#answer').insertAdjacentHTML('afterbegin', `<p class="muted">기록된 실험 응답입니다 (정답: <b>${esc(it.gold)}</b>).</p>`);
}

// ───── 방법 탭
function renderMethod() { $('#methodBody').innerHTML = window.METHOD_HTML || ''; }

// ───── 시작
(async () => {
  [S, LIVE] = await Promise.all([loadSummary(), checkLive()]);
  renderResults(); renderFix(); setupItems(); setupDemo(); renderMethod();
  const h = location.hash.slice(1);
  if (h && document.getElementById(h)) showTab(h);
  else if (LIVE) showTab('demo'); // 발표용 로컬 서버에서는 데모부터, 공개 사이트에서는 게시판부터
})().catch((e) => { const p = document.getElementById('results'); if (p) p.insertAdjacentHTML('afterbegin', `<p class="cell-bad">결과를 불러오지 못했습니다: ${esc(e.message)}</p>`); });
