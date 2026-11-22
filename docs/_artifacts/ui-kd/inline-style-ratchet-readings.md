# 内联 style 棘轮门：读数是这份（A 车道，L0 令 §5 正向牙齿）

- 判据：`grep -rn 'style={{' web/src --include='*.tsx' | grep -v '\.test\.tsx'`，逐行计数。
- 本笔现算总数：**65 处**（基线常量 65，来源脸 `1f078a8aed`）；`web/src/shell/console.tsx` = **0 处**（L4 已清，棘轮恒 0）。
- 扫描面：`web/src` 下非测试 `.tsx` 共 **153** 个（含测试 525 个）；机检门 `web/src/components/ui/inline-style-ratchet.test.ts` 断言扫描面 >120 防走树失效假绿。

## 现算分布（本笔真值，按处数降序）

| 处数 | 文件 | 归属（L0 已发派单） |
|---|---|---|
| 22 | `web/src/modules/evidence/EvidenceModulePage.tsx` | ui-b |
| 10 | `web/src/pages/AnalyticsPage.tsx` | ui-b/ui2 先接者得 |
| 7 | `web/src/modules/employee-detail/EmployeeDetailWorkbench.tsx` | ui2 |
| 4 | `web/src/App.tsx` | 冻结：须 L0 裁决 |
| 4 | `web/src/components/ThemeSwitcher.tsx` | L4 |
| 4 | `web/src/modules/employee-detail/EmployeeDetailModulePage.tsx` | ui2 |
| 3 | `web/src/pages/ModelsPage.tsx` | 未派单（<3 处，随页顺带） |
| 2 | `web/src/shell/StatePlaceholder.tsx` | 未派单（<3 处，随页顺带） |
| 2 | `web/src/modules/matrix/MatrixModulePage.tsx` | 未派单（<3 处，随页顺带） |
| 2 | `web/src/pages/ChatPage.tsx` | 未派单（<3 处，随页顺带） |
| 1 | `web/src/shell/ConsoleSelect.tsx` | 未派单（<3 处，随页顺带） |
| 1 | `web/src/shell/ConsoleButton.tsx` | 未派单（<3 处，随页顺带） |
| 1 | `web/src/lib/chat-copy-last-button.tsx` | 未派单（<3 处，随页顺带） |
| 1 | `web/src/modules/org/OrgModulePage.tsx` | 未派单（<3 处，随页顺带） |
| 1 | `web/src/modules/overview/OverviewPage.tsx` | 未派单（<3 处，随页顺带） |

## 正向牙齿（必做项，真跑）
1. 临时新增一处内联 style（scratch 文件 `web/src/__ratchet_probe.tsx`，未碰任何页面）→
   `FAIL … 生产代码内联 style 不得超过冻结基线 65 处 / AssertionError: 现算 66 处，基线 65 处（脸 1f078a8aed）: expected 66 to be less than or equal to 65`，`Tests 1 failed | 2 passed (3)`。
2. 删除 scratch 后复跑 → `Test Files 1 passed (1); Tests 3 passed (3)`。
3. 顺带证明防空转腿有效：首版阈值我误写 `>200`（真值 153）→ 该例直接红，说明这条不是恒真断言；改成 `>120` 后绿。

## 门禁
- 本腿：`cd web && node_modules/.bin/vitest run src/components/ui/inline-style-ratchet.test.ts` → **3 passed (3)**。
- 全量：`cd web && pnpm exec vitest run` → **485 files / 3577 tests**（L0 基线 484/3574，本笔 +1 文件 +3 例）。
- 唯一红＝`src/shell/e1Contract.test.ts:205` disk==served 脸漂移：`PORT=9122 DISK_ENTRY=assets/index-D4QqzZ8Z.js SERVED_ENTRY=assets/index-Ceaj0F6k.js`（我的未部署 dist vs 现役脸）＝结构性环境腿，不判本 diff；该腿自足化已入板归 shell 车道。
- lefthook `lint web`：首轮拦下一条真错（`inline-style-ratchet.test.ts:37 'rel' is assigned a value but never used`），删除未用helper 后 ✔ 0.37s、0 errors（未用 --no-verify）。
- 交付：分支 `lane/console-design`，棘轮门 sha `c6c13285e5`（本读数文件随后一笔）。冻结线 2026-11-23T20:57+08:00 之后基线 65 **只允许下调**，上调走 L0 并窗评审。
- 生成时间：2026-11-22（由 `git grep`/文件系统实测生成，非手填）。
