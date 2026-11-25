@echo off
rem 제미나이 무료 한도(모델별 하루 약 40~50회) 안에서 매일 이어서 실행한다.
rem 기본 81문항 x 1회, 개선 전(base) -> 개선 후(fix) 순서. 다 끝난 것은 건너뛴다.
cd /d "%~dp0.."
for /f "delims=" %%i in ('node -e "console.log(require('./data/questions.json').filter(q=>!q.ladder).map(q=>q.id).join(','))"') set CORE=%%i
for %%m in (gflash glite) do (
  node experiment\run.mjs --cond base --out base_gemini --models %%m --reps 1 --conc 2 --ids %CORE% >> results\gemini_daily.log 2>&1
  node experiment\run.mjs --cond fix --out fix_gemini --models %%m --reps 1 --conc 2 --ids %CORE% >> results\gemini_daily.log 2>&1
)
