# L4-controls2 收尾单 — 原生 select 字面量清零 + 顶栏产物核对

- 分支：`lane/L4-controls2`（基线 `origin/lane/hermes-console` @ `571011616189edbb153c6fd2203c03882a2f9f39`）
- 写域：仅 `web/src/**`（+本交付单）
- 改动笔：`5f44e2cc` chore(L4-controls2): 原生 <select> 字面量清零（9 行注释/测试名改写，0 行为改动）

## DoD① grep 归零 — 达成，且前提修正

工单口径"现为 2 处"与磁盘不符：基线实为 **9 处命中、0 处真实渲染**——全部是文档注释与测试名称提及，
无任何 JSX 渲染点，故无需换壳（无壳可换）。改写为"原生下拉控件 / native select element(control)"保语义。

基线原文（5710116）：

```
$ git grep -n "<select" 571011616189edbb153c6fd2203c03882a2f9f39 -- 'web/src/**/*.tsx'
571011616:web/src/components/ui/Select.tsx:7: * 下拉基元：自绘触发器 + role=listbox 面板。禁原生 <select>——设计系统的 Select
571011616:web/src/modules/approvals/ApprovalsHistoryModulePage.test.tsx:240:    // gate is `button.disabled` — reading it as a <select> was the retired protocol.
571011616:web/src/modules/audit/audit.filters.test.tsx:15:// R166 修红：wave-36 把筛选控件从原生 <select> 换成了 ConsoleSelect（合入的自定义下拉那一项改动），
571011616:web/src/modules/audit/audit.select.contract.test.tsx:3:// native `<select>`.
571011616:web/src/modules/audit/audit.select.contract.test.tsx:151:  it("puts every filter test id on a focusable combobox, and on no <select>", async () => {
571011616:web/src/modules/runs/runs.filters.test.tsx:129:  // wave-36 moved this filter off the native <select> onto ConsoleSelect, so the
571011616:web/src/modules/tasks/TasksBoardModulePage.test.tsx:262:    // `button.disabled` is the honest gate (a <select> read was the old protocol).
571011616:web/src/shell/ConsoleSelect.tsx:3: * `<select>` in the console surface.
571011616:web/src/shell/ConsoleSelect.tsx:10: * tests and IA assertions click. Native `<select>` is out for the visual
```

HEAD（5f44e2cc）之后，DoD 原命令：

```
$ grep -rn "<select" web/src --include=*.tsx
$ exit=1   # 零命中
```

旁证：`web/src` 内亦无任何 `createElement("select")`/`<select ` 渲染形制（全文件扫描仅
`selectHarness.ts:4` 与 `ui.css:67` 两条注释，均为 .ts/.css，不在 DoD 的 *.tsx 口径内；
selectHarness.ts 经通读只含注释提及，不含原生渲染——5f44e2cc 提交说明中"保留原生渲染"一句
以本文为准修正为"仅注释提及"）。运行时闸 `scripts/assert-ui-contract.mjs` 的
`native-select-zero` 条款计的是 DOM 活体 select 数（probe.selects===0），文本改写不受影响。

## DoD② 交互行为保留 — 达成（零行为差分）

9 行改动全部位于注释与 `it()` 名称字符串，DOM 结构、testid、事件、断言逻辑未触碰；
`audit.select.contract.test.tsx`/`runs.filters.test.tsx`/`audit.filters.test.tsx` 等选择交互契约测试全绿（见 DoD④）。

## DoD③ 构建产物核对 — 计数如实上报，锚点前提缺口待拍板

构建门用本仓 worktree  sanctioned 形制（官方 `npm run build` 前置 tsc solution-build 在本仓属既有红，按根 AGENTS.md 以差分判，不用它当闸）：

```
$ cd web && node_modules/.bin/vite build
vite v8.3.4 building client environment for production...
../hermes_cli/web_dist/assets/index-CiJcZ4mg.js                        174.88 kB │ gzip:  56.00 kB
✓ built in 26.75s
VITE_EXIT=0
```

- Entry：`hermes_cli/web_dist/assets/index-CiJcZ4mg.js`
- sha256：`73ebb88b8018380e13eeee0744850831cc258f5179116029a51f29ba42c35642`
- 产物计数：`console-topbar` **0**；对照 `shell-topbar` **4**（基线顶栏在产物内，锚点不在）

原因：验收锚点 token `console-topbar` 由 **lane/L4-shell** `5edb59c579`（TopBar.tsx 类名 +
console-chrome.css 规则 + topbar.contract.test.ts 源码闸）铸出，该笔**未并入** `origin/lane/hermes-console`
（本单基线）。在给定基线上 DoD③"bundle 内 console-topbar ≥1"结构性不可达——非构建缺陷，是分支前提缺口。
待总控/L0 拍板：L4-shell 并入基线后重跑构建即可验（entry hash 预期随之变化）。

构建验证后已删除本树 `hermes_cli/web_dist`（gitignored 构建产物，基线本就不存在），
恢复 e1Contract 门的基线语义，见 DoD④。

## DoD④ vitest 全绿 — 达成

```
$ cd web && node_modules/.bin/vitest run src
 Test Files  502 passed (502)
      Tests  3698 passed | 1 skipped (3699)
VITEST_EXIT=0
```

唯一 skip 为 e1Contract 自报（本树无部署脸，基线语义）：

```
PORT=9122 DISK_ENTRY=DIST-UNREADABLE SERVED_ENTRY=assets/index-DZVbT_9g.js (dist=.../console-ui-a/hermes_cli/web_dist/index.html)
VERDICT=SKIPPED-NOT-DEPLOYED reason=dist-unreadable PORT=9122 DISK_ENTRY=DIST-UNREADABLE SERVED_ENTRY=assets/index-DZVbT_9g.js
```

过程记录：首轮全量曾有 1 红——`e1Contract.test.ts` 报 `served entry drifted`
（期望盘上 `index-CiJcZ4mg.js`，实收 9122 下发 `index-DZVbT_9g.js`）。
归因：本机 9122 脸由 `/Users/kevin_studio/Projects/l7-ops/ops/v4_proxy.py` 服务，指向**另一棵树**的部署；
本树验证构建刚落盘 dist 即触发"盘≠脸"红。属环境耦合伪红（私域 worktree 结构必现），非本单改动引入；
删除 gitignored dist 复跑即绿。jsdom `Not implemented: navigation` 噪声按仓惯例不计红。

## 结论与遗留

1. DoD①②④ 达成；DoD③ 构建与计数如实上报，**console-topbar≥1 需 L4-shell 并入基线后验**（已随回执提决策）。
2. 工单前提两处修正已实证：`<select` 实为 9 提及/0 渲染（非 2 处渲染）；锚点 token 不在所给基线。
