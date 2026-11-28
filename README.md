# AI는 언제 자신 있게 틀리는가

AI가 답과 함께 말하는 확신도("99% 확신해요")가 실제 정답률과 얼마나 맞는지 수학·컴퓨터 문제로 측정하고, 확신도를 더 믿을 수 있게 만드는 방법을 시험한 프로젝트입니다.

서강대학교 ENG3510 인공지능을 위한 데이터분석 (2026년 2학기) 기말 프로젝트 · 오현철

## 핵심 결과

- **Claude 3개 모델**(Haiku·Sonnet·Opus 5.5)은 말한 확신도가 실제 정답률과 가까웠고, 오히려 약간 낮게 말했다.
- **Gemini 3.5 Flash-Lite**는 기본 문항 정답률이 약 86%인데 **모든 응답의 확신도가 100%**였다.
- 틀린 답은 **긴 문자열 세기**에 몰렸고, 쉬운 문제에서 한 번씩 실수하고도 98~99%라고 답한 경우가 있었다.
- 개선: 검산을 시키는 **점검 프롬프트**로 확신도 90% 이상 오답이 0건이 됐고, **같은 질문 3번 묻기**로 그런 오답을 모두 잡아냈다.

결과보고서: [report/report.pdf](report/report.pdf) · 대시보드: `node web/server.mjs` 후 http://localhost:5173 · 슬라이드: http://localhost:5173/slides.html

## 저장소 구성

| 경로 | 내용 |
|---|---|
| `data/build_questions.py` | 문항 생성기. 계산·코드 문항의 정답은 여기서 직접 계산하거나 실행해서 만든다 |
| `data/questions.json` | 문항 141개 (기본 81 + 난이도 사다리 60) |
| `experiment/prompts.mjs` | 개선 전(base)·개선 후(fix) 프롬프트 전문 |
| `experiment/run.mjs` | 실험 실행기. Claude는 Claude Code CLI, Gemini는 API(환경변수 `GEMINI_API_KEY`)로 매번 새 대화로 호출 |
| `results/raw/*.jsonl` | 모델 응답 원본 (응답 한 건당 한 줄) |
| `analysis/analyze.py` | 채점과 지표 계산 → `results/graded.csv`, `results/summary.json` |
| `analysis/test_grader.py` | 채점 규칙 테스트 50개 |
| `web/` | 결과 대시보드 + 라이브 데모 |
| `report/` | 결과보고서 |
| `slides/` | 발표 슬라이드 |

## 다시 실행하기

준비물: Node.js 20+, Python 3.10+, 로그인된 [Claude Code](https://claude.com/claude-code) CLI

```bash
python data/build_questions.py                      # 문항 만들기
node experiment/run.mjs --cond base --reps 3        # 개선 전 실험
node experiment/run.mjs --cond fix  --reps 3        # 개선 후 실험
python analysis/test_grader.py                      # 채점 규칙 확인
python analysis/analyze.py                          # 채점·분석
node web/server.mjs                                 # http://localhost:5173 (라이브 데모)
```

`web/`만 정적으로 열면(예: GitHub Pages) 대시보드와 기록된 응답은 볼 수 있고, 실제 모델에 묻는 라이브 데모는 `node web/server.mjs`로 실행했을 때만 켜집니다.
