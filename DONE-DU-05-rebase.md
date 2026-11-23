# DU-05 — L0 退回单处置：重取基并入现线（rebase-onto 记录）

- 本道原 tip：`ed04e4f1f90b89d881b3301838e162e088d3ce3e`（task/DU-05-degraded-states）
- 并入的现线：`92ef2b4b3f63a0eba348a5da69fc237d7d5010c0`（refs/heads/lane/hermes-console，已含 DU-04@5d94dbea15）
- 合并方式：**merge commit**（禁 rebase / force / amend / --no-verify，全部遵守）
- 合并前工作区：仅 `evidence/**` 未跟踪文件，无已跟踪文件改动（不吞他道未提交改动）

## 冲突面与处置（裁定=语义共存，禁择一丢弃）

`git merge` 报 2 个冲突文件（工单预估 useDutyData.ts 约 5 hunk，实测该文件 4 个文本 hunk +
2 处 git 自动合并产出的**语义错位**）：

1. `web/src/modules/duty/useDutyData.ts` — 核心冲突
2. `web/src/modules/duty/DutyPage.tsx` — 1 处 hunk

### 自动合并的陷阱（必须先说清，否则读者会以为择一即可）

git 的行级自动合并把线侧 `collect` 函数体（引用 `opts` / `wantActivity`）**插进了本道
`legRequests(rangeId, deps)` 的函数头之下**，留下 `const wantActivity = opts.activity !== false;`
这一行指向一个 `legRequests` 并不存在的 `opts` 形参；同时保留了**第二个重复定义的
`collect`**（L176 线侧头 + L269 本道头，两处同名函数）。文本"干净"但语义断裂。
**处置：不信任该文件的自动合并结果**，以本道 `ed04e4f1f9` 的完整文件为骨架
（`git checkout --ours`），再把线侧 OM-04 的参数面按语义逐处缝合，而不是逐 hunk 挑边。

### 共存形制（两侧语义均在）

以**线侧 OM-04 `collect(rangeId, opts)` 参数面 + DU-02 `{batch, counts}` 形状为底**，
把本道 `legRequests` / `retryLegs` / `forced` 重试表接到底上：

- 新增具名 `export interface DutyReadOpts { activity?: boolean }`（线侧原本是内联
  `{ activity?: boolean }`，形制等价、可被两处签名共用）。
- `legRequests(rangeId, deps, opts: DutyReadOpts = {})`：**OM-04 的消费者开关挂在这张
  「原请求唯一出处」表上**，`activity` 腿改为
  `wantActivity ? load(() => fetchActivity(range.weeks)) : Promise.resolve({k:"loading"})`。
  于是首读与单卡重试共用同一条受开关约束的路，不会出现"首读不发、重试却发"的第二套口径
  ——这正是裁定要求的"重试/单卡刷新必须经新签名 collect 同路"。
- `collect(rangeId, opts: DutyReadOpts = {})`：保留 DU-02 的 `{batch, counts}` 返回形状，
  `legRequests(rangeId, NO_DEPS, opts)` 与二段 `legRequests(rangeId, {...ids}, opts)` 都下传开关；
  文档注释合并 OM-04④ 原文 + DU-02 计数说明。
- `useDutyData(rangeId, opts: DutyReadOpts = {}, forced: ForcedState | null = null)`：
  **`opts` 占第 2 位（线侧参数面为底），`forced` 顺延到第 3 位**。两两冲突的调用面按此归一：
  - `OverviewPage.tsx:461 useDutyData(rangeId, { activity: false })` — 线侧 OM-04 消费点，
    **一字未改**（因此它不出现在本道 diff 里）。
  - `DutyPage.tsx:1355` — 本道原 `useDutyData(rangeId, forced)` 改为 `useDutyData(rangeId, {}, forced)`；
    值班台要渲染活动热力，默认档 `{}` 即 activity 照常请求，本道行为逐字不变。
- `wantActivityRef`（线侧）与 `forcedRef` / `retryingRef`（本道）并存，四条读取路径全部带开关：
  首读 effect、`refresh`、切窗 effect、`retryLegs`；切窗 effect 保留线侧"关掉的腿不重画"
  的条件展开 `...(wantActivity ? {activity: loading()} : {})` 与 `...(activity ? {activity} : {})`，
  同时保留本道 `if (forced !== null)` 复现态早退。
- 本道独有语义全部保留：`?state=` 四态复现批（`forcedBatch`，error/denied 措辞分离、
  requestId 恒 null）、`LEG_KEYS` / `DEPENDENT_LEGS`、`retryLegs`（队列一次请求喂两卡、
  依赖目录腿如实退整批重读）、health chip 三态、403/404 拆句、`asError` 透传 `notWired`。
- `DutyPage.tsx` 唯一 hunk = 门控清单取**并集**：线侧 `data-gates="refresh,retry,copy,link,exportDaily"`
  （线侧新增 exportDaily 门，`dutyGates.ts` 已自动并入其实作）+ 本道 `{forced !== null && <DutyReproNote/>}`
  复现态说明行。全仓无测试钉该字符串（已 grep 验证），并集不破坏任何一侧。

## 门禁原始读数

PATH 前置 `/opt/homebrew/bin`；未跑 `pnpm install`（node_modules / web/node_modules 为符号链接，
指向 `forks/hermes-agent`，已核验）；未使用 `pnpm run build`。

### 1. duty 面：`node_modules/.bin/vitest run src/modules/duty` — exit 0

```
 Test Files  15 passed (15)
      Tests  206 passed (206)
   Duration  2.74s (transform 7.95s, setup 0ms, import 14.30s, tests 3.46s, environment 3.79s)
```

基线 14 件 / 198 例 → 实测 **15 件 / 206 例**，只增不减（+1 件来自线侧并入，+8 例为线侧
DU-04/OM-02 相关增量与本道 16 例 `duty.degraded.test.tsx` 同时在场）。
`duty.degraded.test.tsx` 在列且绿（该文件 `it(` 计数 = 16，与工单一致）。

### 2. 线侧 OM-04 相关件（不在 duty 目录内，故单独跑）：`vitest run src/modules/overview` — exit 0

```
 Test Files  5 passed (5)
      Tests  42 passed (42)
```

OM-04 的开关断言在场且绿：`overview.window.test.tsx`（**该文件为线侧独有**，
`ed04e4f1f9` 树里不存在）含 `expect(count('/run-activity')).toBe(0)` 与
`expect(added.filter(u => u.includes('/run-activity'))).toHaveLength(0)`
——关掉开关后一条活动请求都不发，语义未被本道重试表破坏。

### 3. 全量：`node_modules/.bin/vitest run src`

```
 FAIL  src/shell/e1Contract.test.ts > E1 取证自报: 端口 + entry 文件名（L0 硬规矩） > verifies the acceptance face when both sites exist, skips not-deployed otherwise
AssertionError: served entry drifted from the dist on disk: expected 'assets/index-C4jqbwEw.js' to be 'assets/index-BF9ZOmeg.js'
 Test Files  1 failed | 526 passed (527)
      Tests  1 failed | 3987 passed (3988)
```

**唯一 1 红为环境性的部署漂移闸，与本道合并无关，且合并前即红。** 四条独立证据：

1. 该用例读的 `disk` 侧是 `hermes_cli/web_dist/index.html`（`.gitignore:100` 已忽略，
   **不在 git 里**，是各 worktree 各自的本地构建残留），`served` 侧是**共享 9122 现脸**：
   `PORT=9122 DISK_ENTRY=assets/index-BF9ZOmeg.js SERVED_ENTRY=assets/index-C4jqbwEw.js`。
2. **对照组**：完全未被本单触碰的 DU-06 worktree（HEAD=`d1aed0fd46`，合并前原状）跑同一件
   得到**同样的红**，且 disk 哈希又是第三个值：
   `PORT=9122 DISK_ENTRY=assets/index-JMggQmvG.js SERVED_ENTRY=assets/index-C4jqbwEw.js`。
   即"每个车道 worktree 的本地 dist ≠ 9122 现脸"，与任何人的代码改动无关。
3. `web/src/shell/e1Contract.test.ts` 在合并两侧**逐字节相同**
   （`git diff --stat ed04e4f1f9 92ef2b4b3f -- .../e1Contract.test.ts` 输出为空），
   合并无法改变其结果。
4. 本道重跑 `vite build` 之后 disk 哈希按预期变化（`DkUiC7_O` → `BF9ZOmeg`）而红依旧、
   仍只差在 served，进一步证明红源是"现脸未重建"，不是本树代码。

按车道红线**不重建 9122、不碰共享现脸**，故本道不消解该红，仅如实上报。
jsdom 的 `Not implemented: navigation` 噪音按基线存在，未计入 fail。

### 4. 打包闸：`node_modules/.bin/vite build` — exit 0

```
✓ 3633 modules transformed.
../hermes_cli/web_dist/assets/api-error-BLmGh8VE.js   2.96 kB │ gzip: 1.48 kB
✓ built in 6.29s
```

（**未**用 `pnpm run build`；符号链接 worktree 下 pnpm 会拒跑 task script。）

### 5. 类型面：`npx tsc --noEmit -p tsconfig.app.json`

```
TSC_EXIT=2
error TS 计数 = 49
按目录分布：  49  ../apps/shared
```

全仓 **49 = 基线 49，delta 0**；`modules/duty` 错误 **0**，`modules/overview`（OM-04 消费面）
错误 **0**，`useDutyData` 无任何诊断。49 条全部落在 `apps/shared`（`total` 契约漂移，
AGENTS.md 记载的既有基线，非本道引入）。

## 写域核验

`git diff --name-status 92ef2b4b3f..HEAD` 只含：

```
A	DONE-DU-05.md
A	DONE-DU-05-rebase.md
M	web/src/modules/duty/DutyPage.tsx
M	web/src/modules/duty/api.ts
M	web/src/modules/duty/duty.css
A	web/src/modules/duty/duty.degraded.test.tsx
A	web/src/modules/duty/health.ts
M	web/src/modules/duty/types.ts
M	web/src/modules/duty/useDutyData.ts
```

全部在 `web/src/modules/duty/**` ＋ `DONE*DU-05*` 之内，无他道文件出现为 M/D
⇒ 合并方向正确（未把线侧内容反向覆盖）。`OverviewPage.tsx`（OM-04 消费点）未出现在 diff 中，
即线侧该处原样保留。
