// 실험에 쓰는 프롬프트. 웹 데모 서버도 같은 파일을 불러 쓴다.

export const SYSTEM = '너는 사용자가 낸 문제에 답하는 AI 비서다.';

// 조건 base: 아무 장치 없이 답과 확신도만 묻는다.
export function basePrompt(question) {
  return `다음 문제에 답하세요.

[문제]
${question}

[답하는 방법]
- 아래 JSON 한 줄로만 답하세요. 다른 말은 쓰지 마세요.
- answer: 최종 답만 짧게 씁니다. 숫자는 숫자만, 분수는 a/b, 객관식은 기호만, 코드 출력은 출력된 그대로 씁니다.
- 문제의 전제가 틀렸거나 답이 존재하지 않으면 answer에 "전제 오류"라고 씁니다.
- confidence: 이 답이 맞을 확률을 0~100 사이 정수로 씁니다.

{"answer": "...", "confidence": 0}`;
}

// 조건 fix: base 실험에서 찾은 문제를 고치기 위해 넣은 장치 (README의 '개선' 절 참고)
//  base에서 본 문제
//   - 쉬운 세기·계산에서 한 번씩 실수하고도 확신도 98~99 (M02 Opus '86', M17 Haiku '144')
//   - 긴 문자열 글자 세기에서 정답률이 0%까지 떨어져도 확신도 80 (Opus, 사다리 10단계)
//  장치
//  1) 전제 점검      → 틀린 전제를 받아들이지 않게 (base에서는 이미 잘했으므로 유지 여부만 확인)
//  2) 다른 방법으로 검산 → 한 번의 실수를 스스로 잡게
//  3) 세기는 묶어서 세고 합계를 다시 확인 → 긴 문자열 세기 오류
//  4) 확신도는 검산 결과에 따라 정하게 → 검산이 어긋났는데도 높은 확신도를 말하지 않게
export function fixPrompt(question) {
  return `다음 문제에 답하세요.

[문제]
${question}

[답하기 전에 반드시 할 일]
1. 전제 점검: 문제 속 설명이나 가정이 사실인지 먼저 확인합니다. 거짓이거나 서로 모순이면 답을 지어내지 말고 "전제 오류"로 답합니다.
2. 검산: 계산이나 코드 실행 결과는 처음과 다른 방법(역산, 다른 공식, 작은 예로 확인 등)으로 한 번 더 확인합니다.
3. 세기: 글자나 개수를 세는 문제는 10개씩 묶어 묶음별 개수를 적고, 합계를 한 번 더 더해 확인합니다.
4. 확신도: "이런 문제 100개에 지금 같은 확신도로 답하면 몇 개를 맞힐까"로 정합니다. 두 방법의 결과가 일치하면 그 근거만큼, 어긋났거나 한 번에 확인하기 어려웠다면 그만큼 낮게 씁니다.

[답하는 방법]
- 아래 JSON 한 줄로만 답하세요. 다른 말은 쓰지 마세요.
- check: 전제 점검과 검산을 어떻게 했는지 한 문장
- answer: 최종 답만 짧게 씁니다. 숫자는 숫자만, 분수는 a/b, 객관식은 기호만, 코드 출력은 출력된 그대로 씁니다.
- 문제의 전제가 틀렸거나 답이 존재하지 않으면 answer에 "전제 오류"라고 씁니다.
- confidence: 이 답이 맞을 확률을 0~100 사이 정수로 씁니다.

{"check": "...", "answer": "...", "confidence": 0}`;
}

export const PROMPTS = { base: basePrompt, fix: fixPrompt };

export const MODELS = {
  haiku: 'claude-haiku-5-5',
  sonnet: 'claude-sonnet-5-5',
  opus: 'claude-opus-5-5',
  gflash: 'gemini-3.5-flash',
  glite: 'gemini-3.5-flash-lite',
};

// 응답 텍스트에서 JSON 하나를 꺼낸다.
export function parseReply(text) {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (!m) return { ok: false };
  try {
    const j = JSON.parse(m[0]);
    const c = Number(j.confidence);
    return { ok: Number.isFinite(c), answer: String(j.answer ?? ''), confidence: c, check: j.check ?? null };
  } catch {
    const a = m[0].match(/"answer"\s*:\s*"([^"]*)"/);
    const c = m[0].match(/"confidence"\s*:\s*(\d+(?:\.\d+)?)/);
    if (a && c) return { ok: true, answer: a[1], confidence: Number(c[1]), check: null };
    return { ok: false };
  }
}
