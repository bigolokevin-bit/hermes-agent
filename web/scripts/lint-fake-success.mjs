#!/usr/bin/env node
// M0 gate 3/3 — fake-success wording lint over docs/console-v4-skeleton.html.
// HTML comments are blanked out (line numbers preserved) before scanning.
//
// Banned (fake success / over-claim wording):
//   已保存|已发送|已重试|已恢复|已处理|已创建|已删除   (success tone)
//   不可篡改|冷备|墓碑|已对账|无人可派                  (over-claims)
//   data-demo=                                        (demo-data markers)
// Allowed / required:
//   规划中  — allowed, and must appear >= 30 times (honest placeholder cadence)
//   不会保存 / 未接入 — explicitly allowed wording (reported as info only)
//
// Exit 0 only when violations === 0.

import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
// L0 二十九轮（2026-11-19）：--out=<path> 原子替换账本载荷（tmp+rename，禁 append）；缺省 stdout。
const OUT_FILE = (process.argv.find((a) => a.startsWith('--out=')) || '').slice(6) || null;
if (OUT_FILE) {
  console.log = (s) => {
    const tmp = `${OUT_FILE}.tmp.${process.pid}`;
    writeFileSync(tmp, `${s}\n`);
    renameSync(tmp, OUT_FILE);
  };
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML_PATH = path.join(ROOT, 'docs', 'console-v4-skeleton.html');

const raw = readFileSync(HTML_PATH, 'utf8');
// Blank HTML comments (same byte layout -> line numbers stay true).
const text = raw.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
const lines = text.split('\n');

const BANNED = [
  { rule: 'success-tone', re: /已保存|已发送|已重试|已恢复|已处理|已创建|已删除/ },
  { rule: 'over-claim', re: /不可篡改|冷备|墓碑|已对账|无人可派/ },
  { rule: 'demo-marker', re: /data-demo=/ },
];

const violations = [];
const countOf = (needle) =>
  lines.reduce((n, line) => n + (line.split(needle).length - 1), 0);

lines.forEach((line, i) => {
  for (const { rule, re } of BANNED) {
    const m = line.match(re);
    if (!m) continue;
    const snippet = line.trim().slice(0, 140);
    violations.push({ line: i + 1, rule, match: m[0], snippet });
  }
});

const planned = countOf('规划中');
if (planned < 30) {
  violations.push({ line: 0, rule: 'planned-min', match: '规划中', snippet: `found ${planned}, expected >=30` });
}

const allowedInfo = {
  '规划中': planned,
  '不会保存': countOf('不会保存'),
  '未接入': countOf('未接入'),
};

const out = {
  script: 'lint-fake-success',
  file: path.relative(ROOT, HTML_PATH),
  linesScanned: lines.length,
  allowedInfo,
  violations,
  ok: violations.length === 0,
};
console.log(JSON.stringify(out, null, 2));
process.exit(out.ok ? 0 : 1);
