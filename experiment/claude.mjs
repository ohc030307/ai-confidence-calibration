// Claude Code CLI(`claude -p`)로 모델을 한 번 호출한다.
// 매 호출은 빈 임시 폴더에서 새 대화로 실행하고, 도구·MCP·사용자 설정을 모두 끈다.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SYSTEM } from './prompts.mjs';

const WORK = path.join(os.tmpdir(), 'acc-calib-run');
const LOCAL = path.join(os.homedir(), '.local', 'bin', process.platform === 'win32' ? 'claude.exe' : 'claude');
const CLAUDE_BIN = process.env.CLAUDE_BIN || (fs.existsSync(LOCAL) ? LOCAL : 'claude');
fs.mkdirSync(WORK, { recursive: true });

export function callClaude(model, prompt, { timeoutMs = 300000 } = {}) {
  return new Promise((resolve) => {
    const args = ['-p', '--model', model, '--tools', '', '--no-session-persistence',
      '--strict-mcp-config', '--setting-sources', '', '--system-prompt', SYSTEM,
      '--output-format', 'json'];
    const t0 = Date.now();
    // shell을 거치지 않아야 빈 문자열 인자('--tools', '')가 그대로 전달된다.
    const p = spawn(CLAUDE_BIN, args, { cwd: WORK, windowsHide: true });
    let out = '', err = '';
    const timer = setTimeout(() => p.kill(), timeoutMs);
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => {
      clearTimeout(timer);
      let j = null;
      try { j = JSON.parse(out); } catch { /* 아래에서 오류로 처리 */ }
      resolve({
        ok: !!j && !j.is_error,
        text: j?.result ?? '',
        ms: Date.now() - t0,
        cost: j?.total_cost_usd ?? null,
        error: j ? (j.is_error ? j.result : null) : (err || out || `exit ${code}`).slice(0, 500),
      });
    });
    p.stdin.end(prompt);
  });
}
