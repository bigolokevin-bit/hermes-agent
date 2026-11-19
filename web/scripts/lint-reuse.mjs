#!/usr/bin/env node
// lane-D gate — PRD §11 "reuse discipline" lint over web/src/modules/**.
// Pure static scan (no browser, no TypeScript import). Exit 0 only when
// violations === 0.
//
// Rules (ids are stable so the JSON artifact stays auditable):
//   R1 local-impl-needs-marker
//      A module file that locally defines useChat / TaskBoard / SchemaForm must
//      declare reuse in the same file — those surfaces are reuse obligations.
//   R2 hardcoded-matrix
//      Employee-id x skill arrays hardcoded in the front end
//      (/skills\s*:\s*\[[^\]]*emp_/) — must come from the data port.
//   R3 chat-host-not-unique
//      More than one module file importing ChatPage / ChatHost (static OR
//      `lazy(() => import("@/pages/ChatPage"))`). The chat entry point is one
//      shell host, reused, never re-mounted per module.
//   R4 reuse-marker-incomplete
//      The five §11 reuse surfaces must each carry a declaration. A surface
//      counts as declared when EITHER (a) some `reuse:` marker text names it,
//      OR (b) the surface's owning module manifest declares `kind: 'reuse'`.
//      That (b) branch is the convention lanes actually shipped (T10 duty,
//      T12 employees, T13 matrix) — recognising it does not loosen the gate,
//      it stops the gate from crying wolf on declared work.
//   R5 exemption-stale
//      An exemption whose surface is now declared/implemented must be deleted
//      from the list ("每有一块模块落地就从清单里删"). Without this rule the
//      exemption file silently rots into a permanent whitelist.
//
// Exemptions (R1/R4 only, never R2/R3/R5):
//   docs/_artifacts/tonight/lint-reuse-exemptions.json
//   [{ "module", "reuse", "pending", "reason", "evidence", "rules"? }]
//   A pending entry exempts exactly one (module, surface) pair and must carry a
//   task id + one-line reason + the disk evidence that the surface is NOT
//   landed yet. Missing file => zero exemptions (and the artifact says so).
//
// Artifact: docs/_artifacts/tonight/lint-reuse.json
//   {violations:[{file,line,rule,message}], count:N, scanned:<files>,
//    exempted:[...], exemptionCount, exemptionStale, scanned, reuseMarkers}
// The artifact stays pure JSON (no exit line appended — other gates read it);
// raw stdout + exit live in lint-reuse.stdout.txt and gates.exit.json.
// Exit 1 when violations > 0. Exit 1 with `MISSING <path>` when the scan root
// does not exist.

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
// L0 二十九轮（2026-11-19）：账本写出= tmp+rename 原子替换（禁 append/中间态可读）。
const atomicWrite = (file, text) => {
  const tmp = `${file}.tmp.${process.pid}`;
  writeFileSync(tmp, text);
  renameSync(tmp, file);
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // web/
const REPO = path.resolve(ROOT, '..');
const MODULES_DIR = path.join(ROOT, 'src', 'modules');
const ARTIFACT = path.join(REPO, 'docs', '_artifacts', 'tonight', 'lint-reuse.json');
const EXEMPTIONS = path.join(REPO, 'docs', '_artifacts', 'tonight', 'lint-reuse-exemptions.json');
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
    exempted: [],
    missing: [REL(MODULES_DIR)],
  };
  mkdirSync(path.dirname(ARTIFACT), { recursive: true });
  atomicWrite(ARTIFACT, `${JSON.stringify(payload, null, 2)}\n`);
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

/** Blank comments, preserving byte layout so line numbers stay true. */
function stripComments(text) {
  let out = '';
  let quote = null;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quote) {
      out += c;
      if (c === '\\') {
        out += text[i + 1] ?? '';
        i += 1;
        continue;
      }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      out += c;
      continue;
    }
    if (c === '/' && text[i + 1] === '/') {
      const nl = text.indexOf('\n', i);
      const end = nl === -1 ? text.length : nl;
      out += text.slice(i, end).replace(/[^\n]/g, ' ');
      i = end - 1;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      const close = text.indexOf('*/', i + 2);
      const end = close === -1 ? text.length : close + 2;
      out += text.slice(i, end).replace(/[^\n]/g, ' ');
      i = end - 1;
      continue;
    }
    out += c;
  }
  return out;
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

// R1: local definitions that owe a reuse declaration.
const LOCAL_IMPLS = [
  { name: 'useChat', re: /(?:function|const)\s+useChat\b/, surface: '对话 ChatPage' },
  { name: 'TaskBoard', re: /(?:function|const|class)\s+TaskBoard\b/, surface: '任务看板 TasksListPage' },
  { name: 'SchemaForm', re: /(?:function|const|class)\s+SchemaForm\b/, surface: 'schema 表单 AutoField' },
];

// R4: the five §11 reuse surfaces. `owner` is the module directory that is
// supposed to declare the surface; `aliases` are matched (case-insensitively)
// against `reuse:` marker text.
const REUSE_CHECKLIST = [
  { name: '对话 ChatPage', aliases: ['ChatPage', 'ChatHost'], owner: 'chat', where: 'web/src/modules/chat/（该目录无 manifest.ts，只能靠 reuse: 标记声明）' },
  { name: '运行详情 RunDetailPage', aliases: ['RunDetailPage', 'RunsModulePage'], owner: 'work', where: 'web/src/modules/work/manifest.ts（row 6 runs tab）' },
  { name: '任务看板 TasksListPage', aliases: ['TasksListPage', 'TasksBoardModulePage'], owner: 'work', where: 'web/src/modules/work/manifest.ts（row 5 board tab）' },
  { name: 'schema 表单 AutoField', aliases: ['AutoField', 'SchemaForm'], owner: 'system', where: 'web/src/modules/system/manifest.ts' },
  { name: '能力矩阵 /v1/matrix/employees 数据口', aliases: ['/v1/matrix/employees'], owner: 'employees', where: 'web/src/modules/employees/manifest.ts（matrix tab）' },
];

/**
 * R3 — chat host importers, detected STRUCTURALLY from import specifiers
 * (static `from '…'`, re-exports, and dynamic `import('…')`), never from raw
 * text: a module that merely shows the string "生产环境在此 import Hermes
 * ChatPage" as a placeholder is not mounting a second host, and matching on
 * prose produced a false "入口不唯一" red. Returns the matched specifier so the
 * artifact records which import triggered it.
 */
function chatHostSpecifiers(code) {
  const specs = [];
  for (const m of code.matchAll(/\bfrom\s+(['"])([^'"]+)\1/g)) specs.push({ spec: m[2], form: 'static' });
  for (const m of code.matchAll(/\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g)) specs.push({ spec: m[2], form: 'dynamic' });
  for (const m of code.matchAll(/\bexport\s*\*\s*(?:as\s+\w+\s+)?from\s+(['"])([^'"]+)\1/g)) specs.push({ spec: m[2], form: 're-export' });
  const hits = specs.filter((s) => /(?:^|[/])(ChatPage|ChatHost)$/.test(s.spec.replace(/\.(tsx?|jsx?)$/, '')) || /ChatPage|ChatHost/.test(s.spec));
  // JSX mount of a local ChatHost symbol also counts as a host.
  const jsxMount = /<ChatHost[\s/>]/.test(code);
  return { hits, jsxMount };
}


const violations = [];
const files = listFiles(MODULES_DIR);
const chatHostFiles = [];
const markerText = [];
const declaredSurfaces = new Set(); // via marker text
const reuseKindModules = new Set(); // modules whose manifest declares kind:'reuse'
const modulesWithManifest = new Set();

// --- per-file scan ----------------------------------------------------------

for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  const code = stripComments(raw); // matches must come from code, not prose
  const rel = REL(file);
  const moduleName = path.relative(MODULES_DIR, file).split(path.sep)[0];

  if (/manifest\.ts$/.test(file)) {
    modulesWithManifest.add(moduleName);
    if (/kind:\s*['"]reuse['"]/.test(code)) reuseKindModules.add(moduleName);
  }

  // R1 — local implementation must declare what it reuses.
  const fileDeclaresReuse = /\breuse\s*:/.test(code) || /kind:\s*['"]reuse['"]/.test(code);
  for (const { name, re } of LOCAL_IMPLS) {
    const m = re.exec(code);
    if (!m || fileDeclaresReuse) continue;
    violations.push({
      file: rel,
      line: lineOf(code, m.index),
      rule: 'local-impl-needs-marker',
      message: `本地定义 ${name}() 缺少 reuse 声明（§11：reuse: 注释或 manifest kind:'reuse'）`,
    });
  }

  // R2 — hardcoded employee x skill matrix (never exemptible).
  for (const m of code.matchAll(/skills\s*:\s*\[[^\]]*emp_/g)) {
    violations.push({
      file: rel,
      line: lineOf(code, m.index),
      rule: 'hardcoded-matrix',
      message: `硬编码员工×技能数组（${m[0].replace(/\s+/g, ' ').trim().slice(0, 80)}…），能力矩阵必须走 /v1/matrix/employees 数据口`,
    });
  }

  // R3 — collect chat host importers (code only, comments blanked).
  const hostProbe = chatHostSpecifiers(code);
  if (hostProbe.hits.length > 0 || hostProbe.jsxMount) {
    chatHostFiles.push({
      file: rel,
      via: hostProbe.jsxMount ? '<ChatHost> mount' : hostProbe.hits.map((h) => `${h.form}:${h.spec}`).join('+'),
    });
  }

  // R4 — collect every `reuse:` marker in code AND in comments: marker
  // declarations legitimately live in doc comments (matrix/matrix.ts:5) as well
  // as in manifest fields, so this scan uses the raw text deliberately.
  for (const m of raw.matchAll(/\breuse\s*:[^\n]*/g)) {
    markerText.push({ file: rel, line: lineOf(raw, m.index), text: m[0] });
  }
}

if (chatHostFiles.length > 1) {
  violations.push({
    file: REL(MODULES_DIR),
    line: 0,
    rule: 'chat-host-not-unique',
    message: `对话入口不唯一：${chatHostFiles.length} 个模块文件 import ChatPage/ChatHost（${chatHostFiles.map((c) => `${c.file} [${c.via}]`).join(', ')}），壳层只允许一个 host`,
  });
}

// --- exemptions -------------------------------------------------------------

let exemptionList = [];
let exemptionFile = 'present';
if (existsSync(EXEMPTIONS)) {
  try {
    exemptionList = JSON.parse(readFileSync(EXEMPTIONS, 'utf8'));
    if (!Array.isArray(exemptionList)) throw new Error('not an array');
  } catch (e) {
    exemptionList = [];
    exemptionFile = `invalid (${String(e.message ?? e).slice(0, 80)})`;
  }
} else {
  exemptionFile = 'missing';
}

const exempted = [];
const isExempt = (surface, moduleName, rule) => {
  for (const ex of exemptionList) {
    if (ex.reuse !== surface) continue;
    const rules = ex.rules ?? ['reuse-marker-incomplete', 'local-impl-needs-marker'];
    if (!rules.includes(rule)) continue;
    if (ex.module !== moduleName && moduleName !== null) continue;
    return ex;
  }
  return null;
};

// --- R4 surface evaluation --------------------------------------------------

const surfaceState = [];
for (const { name, aliases, owner, where } of REUSE_CHECKLIST) {
  const byMarker = markerText.find((mk) => aliases.some((a) => mk.text.toLowerCase().includes(a.toLowerCase())));
  const byManifestKind = owner !== null && reuseKindModules.has(owner);
  const declared = Boolean(byMarker) || byManifestKind;
  // How many module files mention the surface at all (code, not markers): the
  // reader must be able to tell "not built yet" from "built, never declared".
  const codeMentions = files.filter((f) => {
    const t = stripComments(readFileSync(f, 'utf8'));
    return aliases.some((a) => t.includes(a));
  }).length;
  surfaceState.push({
    surface: name,
    owner,
    declaredWhere: where,
    declared,
    codeMentions,
    via: byMarker ? `marker ${byMarker.file}:${byMarker.line}` : byManifestKind ? `manifest kind:'reuse' (${owner})` : null,
  });
  if (declared) declaredSurfaces.add(name);

  if (declared) continue;
  const ex = isExempt(name, owner, 'reuse-marker-incomplete');
  if (ex) {
    exempted.push({
      surface: name,
      module: ex.module,
      pending: ex.pending ?? null,
      reason: ex.reason ?? null,
      evidence: ex.evidence ?? null,
    });
    continue;
  }
  violations.push({
    file: REL(MODULES_DIR),
    line: 0,
    rule: 'reuse-marker-incomplete',
    message: `五处复用标记缺一：${name} 未声明（无 reuse: 标记，宿主模块 manifest 也无 kind:'reuse'）。应补声明处：${where}。模块内提及该面的文件数=${codeMentions}${codeMentions > 0 ? '（代码已在、只差声明）' : '（代码未见）'}；豁免清单外命中 = 违规`,
  });
}

// --- R5 stale exemptions ----------------------------------------------------

for (const ex of exemptionList) {
  if (!declaredSurfaces.has(ex.reuse)) continue;
  violations.push({
    file: REL(EXEMPTIONS),
    line: 0,
    rule: 'exemption-stale',
    message: `豁免已失效须删除：${ex.reuse} 现已声明（pending=${ex.pending ?? '-'}），落地了就按纪律从清单移除`,
  });
}

// --- report -----------------------------------------------------------------

console.log(`violations=${violations.length}`);
for (const v of violations) console.log(`${v.file}:${v.line} ${v.rule} ${v.message}`);
console.log(`exempted=${exempted.length}`);
for (const e of exempted) console.log(`  exempted ${e.module ?? '-'} / ${e.surface} (pending ${e.pending ?? '-'}): ${e.reason ?? ''}`);

const summary = {
  script: 'lint-reuse',
  root: REL(MODULES_DIR),
  scanned: files.length,
  reuseMarkers: markerText.length,
  chatHostFiles,
  modulesWithManifest: [...modulesWithManifest].sort(),
  reuseKindModules: [...reuseKindModules].sort(),
  exemptionFile,
  exemptionCount: exemptionList.length,
  exempted,
  surfaces: surfaceState,
  violations,
  count: violations.length,
  ok: violations.length === 0,
};
console.log(JSON.stringify(summary, null, 2));

mkdirSync(path.dirname(ARTIFACT), { recursive: true });
atomicWrite(ARTIFACT, `${JSON.stringify(summary, null, 2)}\n`);

process.exit(violations.length > 0 ? 1 : 0);
