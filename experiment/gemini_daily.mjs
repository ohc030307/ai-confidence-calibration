// 제미나이 무료 한도(모델별 하루 약 40~50회) 안에서 매일 이어서 실행한다.
// 기본 81문항 x 1회, 개선 전(base) -> 개선 후(fix) 순서. 이미 끝난 것은 건너뛴다.
// 윈도우 작업 스케줄러가 gemini_daily.cmd 를 통해 매일 실행한다.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const core = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/questions.json'), 'utf8')).filter((q) => !q.ladder).map((q) => q.id).join(',');
console.log(`\n===== ${new Date().toLocaleString('ko-KR')} 제미나이 매일 실행 =====`);
for (const model of ['gflash', 'glite']) {
  for (const cond of ['base', 'fix']) {
    spawnSync(process.execPath, [path.join(ROOT, 'experiment/run.mjs'), '--cond', cond, '--out', `${cond}_gemini`,
      '--models', model, '--reps', '1', '--conc', '2', '--ids', core], { cwd: ROOT, stdio: 'inherit' });
  }
}
