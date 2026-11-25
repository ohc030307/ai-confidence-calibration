/* AI 후기 게시판: 분야별로 어떤 AI가 좋은지 평점·후기·댓글을 남긴다.
   저장소는 Supabase(공개 키만 사용). 쓰기·지우기는 서버의 함수로만 가능하고 비밀번호가 필요하다. */
(() => {
  const URL_ = 'https://rxtiiubaxydspedtoalo.supabase.co/rest/v1';
  const KEY = 'sb_publishable_m54UkLtWYVPT60e8aIaRUg_GqK5xydd';
  const H = { apikey: KEY, 'Content-Type': 'application/json' };
  const FIELDS = ['컴퓨터', '수학', '자연과학', '공학', '경제·경영', '인문', '사회과학', '어학', '예체능', '기타'];
  const AIS = ['ChatGPT', 'Claude', 'Gemini', 'Copilot', 'Perplexity', 'DeepSeek', 'Grok', '뤼튼', '기타'];
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
  const ago = (t) => { const s = (Date.now() - new Date(t)) / 1000; if (s < 60) return '방금'; if (s < 3600) return `${Math.floor(s / 60)}분 전`; if (s < 86400) return `${Math.floor(s / 3600)}시간 전`; return new Date(t).toLocaleDateString('ko-KR'); };
  let reviews = [], comments = [], field = '';

  async function api(path, opts = {}) {
    const r = await fetch(URL_ + path, { headers: H, ...opts });
    const t = await r.text();
    const j = t ? JSON.parse(t) : null;
    if (!r.ok) throw new Error(friendly(j?.message || r.statusText));
    return j;
  }
  const rpc = (fn, body) => api('/rpc/' + fn, { method: 'POST', body: JSON.stringify(body) });
  function friendly(m) {
    if (/비밀번호/.test(m)) return m;
    if (/check constraint|violates/.test(m)) return '입력 길이나 별점을 확인해 주세요. (후기 5~1000자, 닉네임 20자 이내)';
    if (/Failed to fetch|NetworkError/i.test(m)) return '인터넷 연결을 확인해 주세요.';
    return '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.';
  }

  async function load() {
    $('#cmStatus').textContent = '불러오는 중…';
    try {
      [reviews, comments] = await Promise.all([
        api('/reviews?select=id,created_at,field,ai,rating,task,content,nickname&order=created_at.desc&limit=500'),
        api('/comments?select=id,review_id,created_at,content,nickname&order=created_at.asc&limit=2000'),
      ]);
      $('#cmStatus').textContent = '';
      render();
    } catch (e) { $('#cmStatus').textContent = '게시판을 불러오지 못했어요. ' + e.message; }
  }

  function render() {
    // 분야 버튼
    const counts = Object.fromEntries(FIELDS.map((f) => [f, reviews.filter((r) => r.field === f).length]));
    $('#cmFields').innerHTML = [['', `전체 ${reviews.length}`], ...FIELDS.map((f) => [f, `${f} ${counts[f] || 0}`])]
      .map(([v, l]) => `<button type="button" data-f="${esc(v)}" aria-pressed="${v === field}">${esc(l)}</button>`).join('');
    // 순위표
    const list = reviews.filter((r) => !field || r.field === field);
    const byAi = {};
    for (const r of list) (byAi[r.ai] ||= []).push(r.rating);
    const rank = Object.entries(byAi).map(([ai, rs]) => ({ ai, n: rs.length, avg: rs.reduce((a, b) => a + b, 0) / rs.length }))
      .sort((a, b) => b.avg - a.avg || b.n - a.n);
    $('#cmRank').innerHTML = rank.length
      ? `<h3>${field ? esc(field) + ' 분야' : '전체'} AI 평점</h3><ol class="rank">${rank.map((x) =>
        `<li><b>${esc(x.ai)}</b><span class="bar"><span style="width:${(x.avg / 5) * 100}%"></span></span><span>${x.avg.toFixed(1)}점 · 후기 ${x.n}개</span></li>`).join('')}</ol>`
      : `<p class="muted">${field ? esc(field) + ' 분야에 ' : ''}아직 후기가 없어요. 첫 후기를 남겨 주세요.</p>`;
    // 실험 데이터 연결
    $('#cmData').hidden = !(field === '컴퓨터' || field === '수학');
    // 후기 목록
    $('#cmList').innerHTML = list.map((r) => {
      const cs = comments.filter((c) => c.review_id === r.id);
      return `<article class="item review" data-id="${r.id}">
        <div class="meta"><b>${esc(r.ai)}</b> · ${esc(r.field)}${r.task ? ' · ' + esc(r.task) : ''} · <span class="stars" aria-label="별점 ${r.rating}점">${stars(r.rating)}</span></div>
        <p class="qtext">${esc(r.content)}</p>
        <div class="meta">${esc(r.nickname)} · ${ago(r.created_at)} · <button type="button" class="link" data-act="del-review">삭제</button></div>
        <div class="cms">${cs.map((c) => `<div class="cm" data-cid="${c.id}"><b>${esc(c.nickname)}</b> ${esc(c.content)} <span class="muted">${ago(c.created_at)}</span> <button type="button" class="link" data-act="del-comment">삭제</button></div>`).join('')}
          <form class="cmform" data-act="add-comment">
            <input name="content" maxlength="500" placeholder="댓글 달기" required aria-label="댓글 내용">
            <input name="nickname" maxlength="20" placeholder="닉네임" required aria-label="닉네임">
            <input name="password" type="password" minlength="4" placeholder="비밀번호(삭제용)" required aria-label="비밀번호">
            <button>등록</button>
          </form></div>
      </article>`;
    }).join('');
  }

  function setup() {
    $('#rvField').innerHTML = FIELDS.map((f) => `<option>${f}</option>`).join('');
    $('#rvAi').innerHTML = AIS.map((a) => `<option>${a}</option>`).join('');
    $('#rvAi').addEventListener('change', () => { $('#rvAiEtc').hidden = $('#rvAi').value !== '기타'; });
    $('#cmFields').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; field = b.dataset.f; $('#rvField').value = field || '컴퓨터'; render(); });
    $('#rvForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const ai = f.get('ai') === '기타' ? (f.get('aiEtc') || '').trim() : f.get('ai');
      if (!ai) return alert('AI 이름을 적어 주세요.');
      const btn = e.submitter; btn.disabled = true;
      try {
        await rpc('add_review', { p_field: f.get('field'), p_ai: ai, p_rating: Number(f.get('rating')), p_task: f.get('task') || '',
          p_content: f.get('content'), p_nickname: f.get('nickname'), p_password: f.get('password') });
        e.target.reset(); $('#rvAiEtc').hidden = true; field = f.get('field');
        await load();
      } catch (err) { alert(err.message); } finally { btn.disabled = false; }
    });
    $('#cmList').addEventListener('submit', async (e) => {
      if (e.target.dataset.act !== 'add-comment') return;
      e.preventDefault();
      const f = new FormData(e.target), id = e.target.closest('.review').dataset.id;
      try { await rpc('add_comment', { p_review_id: id, p_content: f.get('content'), p_nickname: f.get('nickname'), p_password: f.get('password') }); await load(); }
      catch (err) { alert(err.message); }
    });
    $('#cmList').addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-act]'); if (!b) return;
      const pw = prompt('글을 쓸 때 정한 비밀번호를 입력하세요'); if (!pw) return;
      try {
        const ok = b.dataset.act === 'del-review'
          ? await rpc('delete_review', { p_id: b.closest('.review').dataset.id, p_password: pw })
          : await rpc('delete_comment', { p_id: b.closest('.cm').dataset.cid, p_password: pw });
        if (!ok) return alert('비밀번호가 맞지 않아요.');
        await load();
      } catch (err) { alert(err.message); }
    });
    load();
  }
  document.addEventListener('DOMContentLoaded', setup);
})();
