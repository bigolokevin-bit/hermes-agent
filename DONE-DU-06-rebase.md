# DU-06 — L0 退回单处置：重取 DU-05 新基并入（rebase-onto 记录）

- 本道原 tip：`d1aed0fd4611fe69fa183ced7aba650ff584660e`（task/DU-06-refresh-throttle，原栈基=DU-05 旧 tip `ed04e4f1f9`）
- 并入的新基：**DU-05 新 tip `fcce30db27bf44375a27a413fa295bc544ab47dc`**（该 tip 已含现线
  `92ef2b4b3f63a0eba348a5da69fc237d7d5010c0`，即 OM-04 `collect(rangeId,opts)` 签名 + DU-02 `{batch,counts}` 形状）
- 合并方式：**merge commit**（禁 rebase / force / amend / --no-verify，全部遵守）

## 冲突面与处置（裁定=语义共存）

实测冲突面确实小：只有 `web/src/modules/duty/useDutyData.ts` **1 处 hunk**（首读 effect），
`DutyPage.tsx` / `dutyGates.ts` 均自动合并干净。

该 hunk 两侧语义：

- **本道（DU-06③）**：`clearCooldown()` ＋ 首读单飞锁（`const seq = ++batchSeqRef.current`
  / `busyRef.current = true` / 回填时 `if (seq !== batchSeqRef.current) return`）——
  原实现只锁手动刷新，首读在飞时点刷新会再起一批 ⇒ mount 期间并发两遍全量读；
  调用面还是**旧签名** `collect(rangeRef.current)`。
- **新基（OM-04）**：`collect(rangeRef.current, { activity: wantActivityRef.current })`，
  回填只有 `if (alive)`，没有单飞锁。

**共存形制**：保留本道的首读锁全套（clearCooldown / seq / busyRef 归属最新一批），
把调用面换成带消费者开关的**新签名**——
`collect(rangeRef.current, { activity: wantActivityRef.current })`。
即"首读也占同一把锁"与"首读也走开关"同时成立，不是择一。

合并后本文件三条全量读路径全部经新签名，且都受 OM-04 开关与单飞锁共同约束：

| 路径 | 位置 | 开关 | 锁 |
|---|---|---|---|
| 首读 | `useDutyData.ts:491` | `{activity: wantActivityRef.current}` | `batchSeqRef` seq + `busyRef` |
| 手动刷新 | `useDutyData.ts:555` | 同上 | `busyRef` 单飞 + 5s 窗口 |
| 单卡重试 | `useDutyData.ts:631` | `legRequests(..., {activity: wantActivityRef.current})` | `retryingRef` 不叠加 |

调用面 arity（合并后一致）：`useDutyData(rangeId, opts: DutyReadOpts = {}, forced = null)` —
`opts` 第 2 位（线侧参数面为底）、`forced` 第 3 位；
`DutyPage.tsx:1356 useDutyData(rangeId, {}, forced)`（默认档，值班台要画活动热力）、
`OverviewPage.tsx:461 useDutyData(rangeId, { activity: false })`（OM-04 消费点，一字未改）。

## 四条受保护契约未回退（合并后逐条实测绿）

| 契约 | 落点 | 证据 |
|---|---|---|
| 5s 最小间隔 | `dutyGates.ts:22 DUTY_REFRESH_MIN_INTERVAL_MS = 5000` | `窗口没走完时再点还是零请求；过完窗口恢复发一整批`、`窗口值有测量来源` |
| 连点 10 次＝一整批封顶 | `duty.refresh.throttle.test.tsx:200` | `连点 10 次刷新 ⇒ 上游请求数封顶在一批之内` |
| 切窗两路 | `useDutyData.ts` 切窗 effect | `换窗口只重发 stats14＋activity，其余读口一条都不多发` |
| aria-disabled 形制 | `DutyPage.tsx:1456`（原生 disabled 会丢焦点，故不用） | `在飞与窗口内都 aria-disabled＋原因句；…` |

## 门禁原始读数

PATH 前置 `/opt/homebrew/bin`；未跑 `pnpm install`（node_modules 为符号链接）；未用 `pnpm run build`。

### 1. duty 面：`node_modules/.bin/vitest run src/modules/duty` — exit 0

```
 Test Files  16 passed (16)
      Tests  216 passed (216)
```

基线 15 件 / 208 例 → 实测 **16 件 / 216 例**，只增不减
（`duty.refresh.throttle.test.tsx` 在场，内含 10 例，全绿）。

### 2. 全量：`node_modules/.bin/vitest run src`

```
 FAIL  src/shell/e1Contract.test.ts > E1 取证自报: 端口 + entry 文件名（L0 硬规矩） > verifies the acceptance face when both sides exist, skips not-deployed otherwise
 Test Files  1 failed | 527 passed (528)
      Tests  1 failed | 3997 passed (3998)
```

唯一 1 红 = 与本道无关的 **E1 部署漂移闸**，其性质已在 `DONE-DU-05-rebase.md` 用四条证据钉死。
本道再补一条**决定性**证据：该用例自报的 `SERVED_ENTRY` 在同一次作业内**自己变了**——

```
DU-05 运行期：PORT=9122 DISK_ENTRY=assets/index-BF9ZOmeg.js SERVED_ENTRY=assets/index-C4jqbwEw.js
DU-06 运行期：PORT=9122 DISK_ENTRY=assets/index-JMggQmvG.js SERVED_ENTRY=assets/index-DZJ7eIFp.js
```

9122 现脸正被其它车道重建（`C4jqbwEw` → `DZJ7eIFp`），而 `DISK_ENTRY` 读的是各 worktree 自己的
`hermes_cli/web_dist/`（`.gitignore:100` 忽略，不在 git 里）。
**一个未跟踪的本地残留 去比一个正在被别道改动的共享现脸** ⇒ 该闸在任何车道 worktree 里都不可能靠
本车道代码变绿；且合并前对照（本道原 tip 未动时单跑该件）已复现同样的红。
按车道红线**不重建 9122、不碰共享现脸**，故不消解该红，仅如实上报。
jsdom `Not implemented: navigation` 噪音按基线在场，未计入 fail。

### 3. 打包闸：`node_modules/.bin/vite build` — exit 0

```
✓ 3634 modules transformed.
✓ built in 5.63s
```

### 4. 类型面：`npx tsc --noEmit -p tsconfig.app.json`

```
TSC_EXIT=2
error TS 计数 = 49
按目录分布：  49  ../apps/shared
modules/duty 错误 = 0
modules/overview 错误 = 0
```

全仓 49 = 基线 49，**delta 0**；duty 与 overview 各自 0 错。

## 写域核验

`git diff --name-status fcce30db27..HEAD` 只含 `web/src/modules/duty/**` ＋ `DONE*DU-06*`，
无他道文件被本道改成 M/D ⇒ 合并方向正确（本道站在 DU-05 新 tip 之上，只叠加节流改动）。
