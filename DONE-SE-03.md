# DONE-SE-03 · 会话详情渲染（messages/citations）

分支 `task/SE-03-session-drawer` ｜ 基线 HEAD `689e8d46d1f87b35fa6e5035eacae0257ffe0b66`（live face=SE-02 VERIFIED 盖章链）
工单正典：`seakoi-agent-os-l0-board/docs/product/backlogs/knowledge-audit-sessions.md` §SE-03
契约参照：`seakoi-agent-os-l0-board/services/runtime/CONSOLE-SESSIONS-SHAPE.md` §3
写域：`web/src/modules/employee-detail/**` ＋ 本文件。employees/people/org/duty/approvals/shell/主仓零触碰。
`node_modules`/`web/node_modules` 沿用 symlink，**未跑 pnpm install**。

---

## 1. 数据腿：opsadmin 真登录实测（原始 JSON 落 evidence/，不提交）

BFF＝现网 `127.0.0.1:8092`（pid 740，cwd=`/Users/kevin_studio/Projects/bff-v4-serve`，`apps/console/server.py`）。
登录腿＝`~/.seakoi/opsadmin-token.txt`（cookie `access_token_cookie`），全程 `GET /auth/whoami`→200 `{"user_id": 1, …, "display": "opsadmin"}`。

| 请求（经 BFF，禁打不存在路由） | HTTP | rid 头 | 响应原文摘要（evidence/ 同名文件） |
|---|---|---|---|
| `GET /api/console-sessions?limit=20` | 200 | `32694434775b4ea3bda249fbdfaadc59` | `raw-sessions-list.json`：`{"items":[{"sessionId":"cs_01M80F82TJCHKCKQWPBSE8K54R","tenantId":"t_seakoi_pilot","employeeId":"emp_86A81CE8FF6F42E187BCF2B540","createdAt":"2026-11-22T01:52:03.410Z","updatedAt":"2026-11-22T01:52:06.696Z","messageCount":2}]}`（现网真会话仅此 1 条） |
| `GET /api/console-sessions?employeeId=emp_86A8…&limit=20` | 200 | — | `raw-sessions-list-emp.json`：同上单行 |
| `GET /api/console-sessions/cs_01M80F82TJCHKCKQWPBSE8K54R` | 200 | `4c942b1af7524fbd886315d7157d427d` | `raw-sessions-detail-real.json`：全量 2 行，逐字含 `{"seq":1,"role":"user","content":"演练台 M1：请用一句话回复当前时间","requestId":"drill-a-1651","createdAt":"2026-11-22T01:52:06.696Z"}` 与 `{"seq":2,"role":"assistant","content":"The current time is Sunday, November 22, 2026, 00:00:00 CST (UTC+08:00).","requestId":"drill-a-1651","createdAt":"2026-11-22T01:52:06.696Z"}` ——**assistant 行无 citations 键**（契约 §3「有才出现」实况） |
| `GET /api/console-sessions/cs_NONEXISTENT000000000000000` | 404 | `64874dc8a6214b319701d096c3b9f82b` | `raw-sessions-detail-404.json` 全文＝`{"code":"console_session.not_found","message":"console session not found"}`（跨租户与不存在逐字同体，前端无从区分） |

## 2. 实装（按工单①–⑤）

| 文件 | 改动 |
|---|---|
| `web/src/modules/employee-detail/SessionDrawer.tsx`（新建） | 详情抽屉：`GET /agent-api/api/console-sessions/{id}` 直连无分页；① messages[] 全字段渲染 seq/role/content/requestId/createdAt（缺值「—」不折 0，未知 role 照实+待核实）；② citations「有才出现」=assistant 行 ∧ 键存在 ∧ 非空数组，缺键/`[]`/非数组/user 行一律零引用区节点；③ 长会话前端渲染切片 `RENDER_WINDOW=100`＋「继续渲染」，切片注记恒报服务端真实总数，全量渲染完成才说「全部 N 条已渲染上屏」，全文无「已全部加载」句式；messageCount≠回传行数时双数上屏不折算；④ Markdown 复用 fork `@/components/Markdown`（named export `Markdown`，读源码确认导出面后引用）；⑤ 404→人话态+`RequestIdCopy` 可复制请求号，不存在/跨租户共用同一句（单分支=结构上不可区分）；401/403/502/形状不认识各归其句；未知字段前向兼容忽略 |
| `web/src/modules/employee-detail/EmployeeDetailModulePage.tsx` | 仅 SessionsZone：行内新增「详情」按钮（`ed9-sessions-detail-{i}`）挂载抽屉；原 `Link to="/chat"` 一字未动（基线 65 例钉 `href="/chat"`）；页脚补一句详情口径 |
| `web/src/modules/employee-detail/SessionDrawer.test.tsx`（新建） | 15 例（见 §3 点名） |

lib/api 零改动（无新封装，抽屉与页面同走 `fetchJSON` seam）；evidence/ 与 fixture 未上生产屏（现网响应原文仅进 evidence/ 与本文件，测试夹具仅 test 内）。

## 3. 门禁（原始 stdout）

```
$ cd web && ./node_modules/.bin/vitest run src/modules/employee-detail --reporter=dot
 Test Files  2 passed (2)
      Tests  80 passed (80)
   Duration  1.32s
```

基线 1 件/65 例 → 现 2 件/80 例（只增不减）。点名新增 `SessionDrawer.test.tsx` 15 例：citations 有键两态（非空数组出引用区 / `[]` 不出空块）、缺键零引用痕迹（用 §1 实测原文同形制）、user 行零引用（含防御性带键例）、404 同体文案（不存在与跨租户两次渲染 textContent 逐字相等）、全字段渲染、Markdown 复用、缺值不折 0、切片诚实（150 条只渲 100＋注记含真总数＋无「已全部加载」＋继续渲染到全量）、messageCount 口径差双数上屏、真实零空态、URL 与请求次数、关闭钮+Esc。

```
$ cd web && ./node_modules/.bin/vitest run src --reporter=dot
 FAIL  src/shell/e1Contract.test.ts > E1 取证自报: 端口 + entry 文件名（L0 硬规矩） > verifies the acceptance face when both sides exist, skips not-deployed otherwise
 Test Files  1 failed | 533 passed (534)
      Tests  1 failed | 4080 passed (4081)
   Duration  46.80s
```

唯一红＝`e1Contract`（9122 环境红，工单单列禁消解，未动）；其余全绿。

```
$ cd web && node_modules/.bin/vite build
 ✓ 3637 modules transformed.
 ✓ built in 6.03s
BUILD_EXIT=0
```

（禁 `pnpm run build`；产物＝`hermes_cli/web_dist`。）

```
$ node web/scripts/lint-fake-success.mjs
{ "script": "lint-fake-success", …, "violations": [], "ok": true }
LINT_EXIT=0
```

```
$ cd web && ./node_modules/.bin/tsc -b . --noEmit | grep -c "error TS"
49
$ … | grep "error TS" | grep -c "src/modules/employee-detail"
0
```

tsc 49＝基线（全在 `../apps/shared/` 的 vitest 类型解析历史红），写域 0 错，delta＝0。

## 4. 截图（ap01-shoot.mjs 形制）

脚本 `evidence/se03-shoot.mjs`：build 产物 + 临时 v4_proxy（`V4_SERVE_PORT=9153` 自选 loopback，非黑名单；`/agent-api→8092`；用完按 pid 精确 kill，`lsof -iTCP:9153` 回读=0 行）+ opsadmin 腿 + `domcontentloaded` + settle + 每图前断言 `whoami==200`。

- `evidence/se03-1440.png`、`evidence/se03-375.png`：详情抽屉实态（真会话 `cs_01M8…E8K54R`，全字段上屏，浏览器实发 `200 …console-sessions?employeeId=…&limit=20` + `200 …console-sessions/cs_01M8…`）。
- **引用区实态不可拍**（如实记录）：现网全部真会话仅 1 条，其 assistant 行无 citations 键（§1 原文逐字为凭）；以 DOM 断言钉住——出图脚本每次采样 `[data-testid^="sd-citations-"]` 计数=0，与响应原文互证；有键态由 `SessionDrawer.test.tsx` 双态例覆盖。禁 stub 冒充，未造会话。
- 375 抽屉全宽无横滚；面板实底 `bg-[#141414]`（对齐既有 `emp-edit-drawer` 形制，修正首拍半透明叠字）。

## 5. 偏差清单

1. **入口深链为路径式**：App 用 BrowserRouter（`main.tsx:22`），AP-01 形制的 `#/…` hash 对本页无效（首拍落回运营总览），改 `/employees/<empId>?zone=sessions`。
2. **引用区实态不可拍**：见 §4，按工单预案「如实记录＋DOM 断言＋响应原文钉住」执行。
3. **列表接线（SE-02 遗留的 SessionsList 替换）未做**：本卡写域内只加「详情」入口，旧 Link/GAP 悬停一字未动——避免破基线 65 例判据，且列表换件属页面车道裁定，非 SE-03 条款。
4. **e1Contract 红**：环境红单列，禁消解，未触碰。
5. **无 lib/api 窄封装**：抽屉直接 `fetchJSON`（既有 seam），未新增/未改任何既有函数签名。
6. 工单③「详情 GET 直连无分页」按 §1 实测确认：BFF `_console_sessions_detail_spec` 透传全量，前端只做渲染切片。

## 6. 交付

- commit：`feat(employee-detail): SE-03 session drawer with full-field messages and citations-only-if-present`
- push：`git push origin task/SE-03-session-drawer`（无 force、无 --no-verify）
- 定向 ref 回读见会话回执；evidence/ 不提交（`git status --porcelain` 逐项确认写域外零触碰）。
