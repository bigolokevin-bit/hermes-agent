#!/usr/bin/env node
// lane-D gate — PRD §11 "reuse discipline" lint over web/src/modules/**.
// Pure static scan (no browser, no TypeScript import). Exit 0 only when
// violations === 0.
//
// NOTE ON SOURCES: CONSOLE-PRD-v4.md is not present in this fork (present on
// disk: web/scripts/assert-ia.mjs, web/src/shell/routes.ts, web/src/modules/*/).
// The rule set below is therefore the four checks as written in the lane-D
// brief, each with its own id so the JSON artifact stays auditable:
//
//   R1 local-impl-needs-marker
//      A module file that locally defines useChat / TaskBoard / SchemaForm must
//      carry a `reuse:` marker in the SAME file — those five surfaces are reuse
//      obligations, not re-implementations.
//   R2 hardcoded-matrix
//      Employee id x skill arrays hardcoded in the front end, i.e. a literal
//      matching /skills\s*:\s*\[[^\]]*emp_/ — must come from the data port.
//   R3 chat-host-not-unique
//      More than one file under modules/ importing ChatPage or ChatHost: the
//      chat entry point is one shell host, reused, never re-mounted per module.
//   R4 reuse-marker-incomplete
//      The five §11 reuse markers (对话 ChatPage / 运行详情 RunDetailPage /
//      任务看板 TasksListPage / schema 表单 AutoField / 能力矩阵
//      /v1/matrix/employees 数据口) — counted across `reuse:` comments in
//      modules/; each must appear at least once, 5 total.
//
// Artifacts: docs/_artifacts/tonight/lint-reuse.json
//   {violations:[{file,line,rule,message}], count:N, scanned:<files>}
// Exit 1 when N > 0, and exit 1 with a `MISSING <path>` line when the scan root
// does not exist yet (lanes B/C/E may not have landed modules/ — fail loud).

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // web/
const REPO = path.resolve(ROOT, '..');
const MODULES_DIR = path.join(ROOT, 'src', 'modules');
const ARTIFACT = path.join(REPO, 'docs', '_artifacts', 'tonight', 'lint-reuse.json');
const REL = (p) => path.relative(REPO, p);

// --- scan root --------------------------------------------------------------

if (!existsSync(MODULES_DIR)) {
  console.log(`MISSING ${REL(MODULES_DIR)}`);
  console.log('violations=1');
  console.log(`${REL(MODULES_DIR)}:0 scan-root 扫描根缺失，复用纪律无法核对（lane B/C/E 未交付）`);
  const payload = {
    violations: [
      {
        file: REL(MODULES_DIR),
        line: 0,
        rule: 'scan-root',
        message: '扫描根缺失：web/src/modules/ 不存在，复用纪律无法核对（lane B/C/E 未交付）',
      },
    ],
    count: 1,
    scanned: 0,
    missing: [REL(MODULES_DIR)],
  };
  mkdirSync(path.dirname(ARTIFACT), { recursive: true });
  writeFileSync(ARTIFACT, `${JSON.stringify(payload, null, 2)}\n`);
  process.exit(1);
}

// --- helpers ----------------------------------------------------------------

function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      out.push(...listFiles(full));
      continue;
    }
    if (entry.isFile() && /\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out.sort();
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

// R1: local definitions that owe a `reuse:` marker.
const LOCAL_IMPLS = [
  { name: 'useChat', re: /(?:function|const)\s+useChat\b/ },
  { name: 'TaskBoard', re: /(?:function|const|class)\s+TaskBoard\b/ },
  { name: 'SchemaForm', re: /(?:function|const|class)\s+SchemaForm\b/ },
];

// R4: the five §11 reuse markers; every entry is satisfied by a `reuse:`
// comment mentioning one of its aliases (matched case-insensitively).
const REUSE_CHECKLIST = [
  { name: '对话 ChatPage', aliases: ['ChatPage'] },
  { name: '运行详情 RunDetailPage', aliases: ['RunDetailPage'] },
  { name: '任务看板 TasksListPage', aliases: ['TasksListPage'] },
  { name: 'schema 表单 AutoField', aliases: ['AutoField'] },
  { name: '能力矩阵 /v1/matrix/employees 数据口', aliases: ['/v1/matrix/employees'] },
];

const violations = [];
const files = listFiles(MODULES_DIR);
const chatHostFiles = [];
const markerText = [];

for (const file of files) {
  const text = readFileSync(file, 'utf8');

  // R1 — local implementation must declare what it reuses.
  const hasMarker = /\breuse\s*:/.test(text);
  for (const { name, re } of LOCAL_IMPLS) {
    const m = re.exec(text);
    if (!m) continue;
    if (hasMarker) continue;
    violations.push({
      file: REL(file),
      line: lineOf(text, m.index),
      rule: 'local-impl-needs-marker',
      message: `本地定义 ${name}() 缺少 reuse: 标记（§11 要求复用壳层实现）`,
    });
  }

  // R2 — hardcoded employee x skill matrix.
  for (const m of text.matchAll(/skills\s*:\s*\[[^\]]*emp_/g)) {
    violations.push({
      file: REL(file),
      line: lineOf(text, m.index),
      rule: 'hardcoded-matrix',
      message: `硬编码员工×技能数组（${m[0].replace(/\s+/g, ' ').trim().slice(0, 80)}…），能力矩阵必须走 /v1/matrix/employees 数据口`,
    });
  }

  // R3 — collect chat host importers.
  if (/import\s.*\b(ChatPage|ChatHost)\b|from\s+['"][^'"]*(ChatPage|ChatHost)['"]/.test(text)) {
    chatHostFiles.push(REL(file));
  }

  // R4 — collect every `reuse:` comment line.
  for (const m of text.matchAll(/\breuse\s*:[^\n]*/g)) {
    markerText.push({ file: REL(file), line: lineOf(text, m.index), text: m[0] });
  }
}

if (chatHostFiles.length > 1) {
  violations.push({
    file: REL(MODULES_DIR),
    line: 0,
    rule: 'chat-host-not-unique',
    message: `对话入口不唯一：${chatHostFiles.length} 个模块文件 import ChatPage/ChatHost（${chatHostFiles.join(', ')}），壳层只允许一个 host`,
  });
}

for (const { name, aliases } of REUSE_CHECKLIST) {
  const hit = markerText.find((mk) => aliases.some((a) => mk.text.toLowerCase().includes(a.toLowerCase())));
  if (hit) continue;
  violations.push({
    file: REL(MODULES_DIR),
    line: 0,
    rule: 'reuse-marker-incomplete',
    message: `五处复用标记缺一：未见 reuse: ${name}（modules/ 内现有 reuse: 标记 ${markerText.length} 处）`,
  });
}

// --- report -----------------------------------------------------------------

console.log(`violations=${violations.length}`);
for (const v of violations) console.log(`${v.file}:${v.line} ${v.rule} ${v.message}`);

const summary = {
  script: 'lint-reuse',
  root: REL(MODULES_DIR),
  scanned: files.length,
  reuseMarkers: markerText.length,
  chatHostFiles,
  violations,
  count: violations.length,
  ok: violations.length === 0,
};
console.log(JSON.stringify(summary, null, 2));

mkdirSync(path.dirname(ARTIFACT), { recursive: true });
writeFileSync(
  ARTIFACT,
  `${JSON.stringify(
    { violations, count: violations.length, scanned: files.length, root: REL(MODULES_DIR), reuseMarkers: markerText.length },
    null,
    2,
  )}\n`,
);

process.exit(violations.length > 0 ? 1 : 0);
