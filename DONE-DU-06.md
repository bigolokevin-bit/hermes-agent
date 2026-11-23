# DONE-DU-06 刷新节流与窗口切换一致性

工单：`seakoi-agent-os-l0-board/docs/product/backlogs/approvals-duty.md` §DU-06。
基线：`task/DU-06-refresh-throttle` @ `ed04e4f1f9`（=DU-05 tip）。
写域：只 `web/src/modules/duty/**` ＋ 本文件。`approvals/`、`audit`、主仓零触碰（`git status --porcelain` 见 §门禁）。

---

## 一、实装了什么

### ① 刷新钮最小间隔 ＋ 在飞 `aria-disabled` ＋ 原因句

**窗口值 5000ms，取自现网真测量**（不是沿用建议数就完事，测量见 §二）。

- 常量落 `dutyGates.ts`（本模块「所有原因句的唯一出处」这一既有约定）：
  `DUTY_REFRESH_MIN_INTERVAL_MS = 5000`、`DUTY_REFRESH_INFLIGHT_REASON`。
- `useDutyData.refresh()` 三道牙：复现腿 → 单飞锁 `busyRef` → 最小间隔 `lastBatchStartRef`。
  窗口内的点击**一条请求都不发**（不是发了再丢弃）。
- 窗口只在**读成功的批**之后开：失败批不开窗口，否则 DU-05 那条「这次刷新没成功 → 再试」
  的出路会被我自己的门挡住（工单没要求堵出路）。
- 切窗会作废在飞的旧批，那批欠的窗口同时清零（`clearCooldown()`），不给用户留一扇
  莫名其妙打不开的门。
- 按钮形制：`aria-disabled={!gates.refresh.enabled}` ＋ `title` ＋ 屏上原因句。
  **刻意不用原生 `disabled`**：原生 disabled 的按钮拿不到焦点，读屏与键盘都念不出那句
  原因，工单要的「原因句」就成了只有鼠标悬停才看得见的东西（DU-07 判据③要清 hover-only）。
  为了不出现「看着能用点了没用」，`duty.css` 补了 `.duty-refresh-btn[aria-disabled="true"]`
  的暗态＋`cursor: not-allowed`，截图见 §五。
- 节流窗口内屏上另起一行 `data-testid="duty-cooling-note"`（`role="status"`），
  文本就是 gates 那句，不复制第二套措辞。

### ② `refreshAt`＝上批真实读取时刻

**核对结论：现有实现已满足工单②，本轮没有改它的语义**，只补了测试把口径钉住：

- 注释 `Read time of the last successful batch; never a data time.` 保持（措辞由
  `refresh` 改成 `batch`，含义不变：一批读完的时刻，不是数据时刻）。
- 「失败时不更新」原样成立：`refresh()` 里只有 `failedLeg(batch)` 为空才 `setRefreshAt`。
- 屏上那行本来就写着「（读取时刻，不是数据时刻）」，真渲染已拍到（§五）。

**一处我试了又回退的改动，如实记在这里**：我一度把首读那一批也记进 `refreshAt`
（理由：页面刚打开时屏上没有任何读取时刻）。跑门禁后 `duty.caliber.test.ts` 与
`dutyPage.test.tsx` 各红一条——那两条是 DU-05 留下的**防伪哨兵**：把系统时钟冻在 2031 年，
断言整页文本里不许出现 `2031`，即「取不到服务端采集时刻时绝不用本机时间顶替」。
`refreshAt` 是 `new Date()` 造的本机时间，首读一记就等于把本机时间放上屏，撞的是别人的红线。
工单②写的是「上批真实读取时刻 `refreshAt`」，变量名与注释都指向**刷新批**，
所以这不是缺口，是我越界。**已回退**，`refreshAt` 仍只由手动刷新批写。
如果板仓认为首读也该有读取时刻，正解是让 BFF 在整批响应里带一个读时刻，前端不自己造。

### ③ 禁 mount 并发全量重读 —— 工单说「核对属实即记录」，**实测不属实，已修**

- 属实的一半：mount 确实只发**一整批**（`collect()` 单批，队列一条请求喂两卡），
  没有第二处全量入口（`useDutyData` 的另一个消费者是 `overview/OverviewPage`，
  与本页不是同一次挂载）。
- **不属实的一半是真洞**：`busyRef` 原来只由 `refresh()` 设，首读那一批**不占锁**。
  于是首读还在飞时点刷新 ⇒ 并发两整批全量读（≈36 条请求）。这正是工单③要禁的东西。
- 修法：首读批也走同一把锁，并加批代号 `batchSeqRef`——被更新的一批取代的晚到回答
  既不写屏也不解锁，锁归最新那批解。测试 `DU-06③` 两条把这两点各自钉住。

### ④ 自动刷新：**本页没有自动刷新**，如实记录，不臆造开关

- `grep -n "setInterval|setTimeout|requestAnimationFrame"` 扫 `duty/*.ts*.x`（非测试件），
  命中只有 `AgentFleetRail.tsx:99` 的 6s **轮播**：`tick` 只做 `scrollToLeft`，不发请求，
  且已经被 `c.reduced`（`(prefers-reduced-motion: reduce)`）与 paused/hover/focus/drag 关掉。
  它与数据刷新无关（工单现状证据也这么写）。
- 所以本轮没有新增自动刷新，也没有新增开关。为防将来有人加，补了一条静置哨兵测试：
  页面挂着不动推进 3 分钟虚拟时钟 ⇒ 上游请求数**一条都不涨**。

---

## 二、节流窗口值的测量来源（真 BFF ＋ 真登录腿）

脚本 `evidence/du06-measure.mjs`（不提交），按 `collect()` 的真实形状打
`127.0.0.1:8092`：phase1 十路并发，phase2 目录依赖腿（两本账 ＋ 证据扇出）。
前置门是 `/auth/whoami==200`（不通就抛，不测）。原始 stdout：

```text
whoami=200 user=opsadmin

── per-run batch wall clock (one refresh = one batch) ──
  run 1: phase1=397ms phase2=22ms batch=419ms legs=20 non200=-1@/api/workbench/timeseries,-1@/api/workbench/queue,-1@/api/run-activity,-1@/api/runs,-1@/api/tasks,404@/api/knowledge/citations
  run 2: phase1=12ms phase2=24ms batch=36ms legs=20 non200=404@/api/knowledge/citations
  run 3: phase1=11ms phase2=26ms batch=37ms legs=20 non200=404@/api/knowledge/citations
  run 4: phase1=13ms phase2=24ms batch=37ms legs=20 non200=404@/api/knowledge/citations
  run 5: phase1=15ms phase2=26ms batch=41ms legs=20 non200=404@/api/knowledge/citations

batch ms: n=5 min=36 p50=37 p95=41 max=419
phase1 ms p50=13 max=397
phase2 ms p50=24 max=26

── per-leg ms (p50 / max / n) ──
     396ms max |     13ms p50 | n=5 | /api/workbench/summary
     385ms max |      7ms p50 | n=5 | /api/employee-stats
     385ms max |      6ms p50 | n=15 | /api/runs
     242ms max |      6ms p50 | n=5 | /api/employees
      26ms max |     24ms p50 | n=5 | /api/approvals
      13ms max |     11ms p50 | n=15 | /api/effective-config
      13ms max |      8ms p50 | n=10 | /api/budget-usage
      11ms max |      9ms p50 | n=15 | /api/workstations
       9ms max |      7ms p50 | n=5 | /api/workbench/timeseries
       8ms max |      7ms p50 | n=5 | /api/run-activity
       8ms max |      5ms p50 | n=5 | /api/workbench/queue
       7ms max |      6ms p50 | n=5 | /api/tasks
       4ms max |      3ms p50 | n=5 | /api/knowledge/citations

── throttle window derivation ──
  single batch p50=37ms max=419ms
  slowest leg max=396ms
  rule: max(工单建议下限 5000ms, 一批实测 max 向上取整到 0.5s) => 5000ms
```

读数怎么解释（含不好看的那半）：

- **run 1 是冷启动**：5 条腿连不上（`-1`，BFF 聚合缓存没热），整批 419ms；
  run 2–5 全部 200，整批 36–41ms。取 max=419ms 是**故意按最坏那次算**。
- `/api/knowledge/citations` 恒 404 = 知识门**未接入**，与 DU-05 的「未接入不是失败」同口径，
  它是真读数不是测量事故，留着。
- 结论：**5s 窗口不是被时延逼出来的**。最坏一批 0.42s，5s 是它的 12 倍；
  窗口的约束来自「这么短的时间内重复读拿不到新数据」＋上游压力，不是等一趟往返。
  所以沿用工单建议下限 5000ms，且测量证明它不会挡住任何一次「本该发出去」的读。
- 现场另有一条独立证据（§五）：真浏览器里连点 10 次刷新，上游只多发**一整批 18 条**。

---

## 三、跨模块词汇的单点约束（工单①那句）

工单让「沿用 approvals `gates.ts:75` 同词汇」。AP-06 车道正在写 approvals，
本车道**既不 import 也不改那个文件**，只把这一句复制成 duty 侧常量：

```text
$ grep -n "这一轮读完成前重复点没有意义" web/src/modules/approvals/gates.ts
75:      retry: { enabled: false, title: `不能刷新：${reason}；这一轮读完成前重复点没有意义。` },
$ grep -n "这一轮读完成前重复点没有意义" web/src/modules/duty/dutyGates.ts
30:export const DUTY_REFRESH_INFLIGHT_REASON = "这一轮读完成前重复点没有意义";
$ diff <(grep -o "这一轮读完成前重复点没有意义" .../approvals/gates.ts | head -1) \
       <(grep -o "这一轮读完成前重复点没有意义" .../duty/dutyGates.ts | head -1) && echo YES_IDENTICAL
YES_IDENTICAL
```

**单点约束（请板仓记账）**：这一句现在**两处同文**——`approvals/gates.ts:75` 与
`duty/dutyGates.ts:30`。收口成一处（谁 import 谁、放哪个共享层）是跨车道裁定，不由本车道做。
裁定前改任一处都要同步另一处，否则同一句话在两个页面说两种口径。

---

## 四、改了哪些既有断言（只两处，都在 duty 写域内）

| 文件 | 断言 | 为什么 |
|---|---|---|
| `dutyPage.test.tsx` §derives one matrix | `busy.refresh.enabled` 由 `true` 改 `false`，并加一句 `title` 必须含复制来的词汇 | DU-06① 直接推翻了 DU-03 那一相「在飞时按钮照旧可点、点了静默吞掉」；现在要 `aria-disabled`＋说得出原因 |
| `dutyPage.test.tsx` §derives one matrix | 新增 `cooling` 相断言（含「5 秒」字样） | 工单①的窗口相没有测试就等于没实装 |

- **`duty.degraded.test.tsx`（DU-05 件）一字未改**，机器可验：
  `git diff -- web/src/modules/duty/duty.degraded.test.tsx | wc -c` → `0`。
- `dutyGates` 的新入参 `cooling?: boolean` 做成**可选**，是为了让 DU-03/DU-05 那几条
  旧调用（不传节流相）原样编译、原样通过，不逼着别人改测试。

---

## 五、DoD 计数证据

### vitest 侧（mock 计数，`fetchJSON` 是本页唯一出网口）

`duty.refresh.throttle.test.tsx` 10 条，其中三条就是 DoD 那三条：

- 连点 10 次 ⇒ `/employees?` 1 次、`/employee-stats` 1 次、`/workbench/summary` 1 次、
  `/workbench/queue` 1 次、`/runs?` 3 次，总新增 ≤ 首读整批条数 ⇒ **封顶在一批**。
- 切窗 ⇒ `added.length === 2`，且只 `/workbench/timeseries` 与 `/run-activity` 各 1，
  其余 7 个读口全部 `0`。
- 窗口内再点 ⇒ `urls.length` **不变**（零请求）；过完窗口 ⇒ 恢复发一整批。

### 真浏览器侧（playwright `request` 事件计数，真 BFF 8092）

`evidence/du06-shoot.log` 原始读数，两档视口各自独立跑：

```text
[1440] 首读完成，上游累计 18 条
[1440] 连点 10 次 ⇒ 上游新增 18 条（首读整批=18 条）
[1440] 切窗 14d→7d ⇒ 上游重发 2 条: workbench/timeseries?range=7d&bucket=day&metric=runs | run-activity?weeks=1&tz=Asia%2FShanghai
[375]  首读完成，上游累计 18 条
[375]  连点 10 次 ⇒ 上游新增 18 条（首读整批=18 条）
[375]  切窗 14d→7d ⇒ 上游重发 2 条: workbench/timeseries?range=7d&bucket=day&metric=runs | run-activity?weeks=1&tz=Asia%2FShanghai
```

⇒ 10 次点击 = 18 条 = **正好一整批**（不是 180 条）；切窗 = **2 条**。

### 真渲染形制（同批 stdout）

```text
[1440] 窗口内实态={"ariaDisabled":"true","ariaBusy":"false","nativeDisabled":false,
  "title":"不能刷新：这一批刚读完；5 秒内再点一次读不到新数据，稍后再刷新。",
  "cooling":"不能刷新：这一批刚读完；5 秒内再点一次读不到新数据，稍后再刷新。",
  "stamp":"刷新完成于 北京时间 2026-11-24 01:03（读取时刻，不是数据时刻）"}
[1440] 在飞实态={"ariaDisabled":"true","ariaBusy":"true","nativeDisabled":false,
  "title":"不能刷新：这一批还在读；这一轮读完成前重复点没有意义。",
  "busy":"更新中…（区块先保留上一次读到的数据）"}
```

`nativeDisabled:false` 是刻意的（见 §一①），`ariaDisabled:true` 两相都成立。

### 截图（真渲染，已逐张目视核对）

- `evidence/du06-1440.png`（1440×900）：节流窗口内——刷新钮暗态、原因句一行、
  「刷新完成于 北京时间 …（读取时刻，不是数据时刻）」同屏。
- `evidence/du06-375.png`（375×812）：同上，窄屏单列。
- `evidence/du06-1440-inflight.png` / `du06-375-inflight.png`：**一批真在飞**的实态
  （钮暗态＋图标在转＋「更新中…」）。
  为什么多两张：在飞与 refreshAt 同屏**物理上不可能**——`duty-updated-at` 的渲染条件
  是 `!refreshing && refreshAt`，在飞那一刻上一批的时刻被刻意藏起（DU-05 的形制）。
  工单要的两件事分在两类图里，主图给「窗口内＋refreshAt」，inflight 图给「在飞禁用」。
- 出图取证方式：`evidence/du06-proxy.mjs` 临时反代 **127.0.0.1:9311**（不在端口黑名单
  9122/9131/9141/9151/9161/9162/9171/9172/9181/9183/9193/9195/9201 内，跑前 `nc -z` 验过 FREE），
  `/agent-api/*`→真 8092、`/auth/*`→真 9122，页面源是本 worktree 的 `vite build` 产物；
  每图前断言 `whoami==200`；`domcontentloaded`＋显式 settle（不用 networkidle）；
  视口图不用 fullPage；为把「在飞」这一两百毫秒的状态拍下来，只对那一段加了
  CDP 网络时延（1200ms），主图段时延归零。**代理已杀**（`pkill -f du06-proxy.mjs` → 9311 down），
  登录态只在浏览器上下文内存里，没落盘 token jar（`find` 无 storage-state 文件）。
- 顺带读数（不是本单判据，留给 DU-07）：两档 `scrollWidth - innerWidth = 0`，根字号 15px。

---

## 六、门禁原始输出

```text
$ cd web && node_modules/.bin/vitest run src/modules/duty
 Test Files  15 passed (15)
      Tests  208 passed (208)
   Duration  2.51s
（基线 14 文件/198 测试 ⇒ +1 文件/+10 测试，只增不减）

$ node_modules/.bin/vitest run src/modules/duty/duty.aggregate.test.ts dutyPage.test.tsx \
    duty.degraded.test.tsx duty.refresh.throttle.test.tsx
 Test Files  4 passed (4)
      Tests  86 passed (86)
   Duration  1.94s

$ node_modules/.bin/vite build            # 禁 pnpm run build
vite build EXIT=0
built in 5.96s

$ node scripts/lint-fake-success.mjs
{
  "script": "lint-fake-success",
  "file": "docs/console-v4-skeleton.html",
  "linesScanned": 9252,
  "allowedInfo": { "规划中": 188, "不会保存": 1, "未接入": 22 },
  "violations": [],
  "ok": true
}
lint EXIT=0

$ npx tsc --noEmit -p tsconfig.app.json
tsc EXIT=2  total=49  duty=0
（49 = 全仓基线，apps/shared 预存；delta=0；duty 命中 0）
```

写域自查：

```text
$ git status --porcelain
 M web/src/modules/duty/DutyPage.tsx
 M web/src/modules/duty/duty.css
 M web/src/modules/duty/dutyGates.ts
 M web/src/modules/duty/dutyPage.test.tsx
 M web/src/modules/duty/useDutyData.ts
?? web/src/modules/duty/duty.refresh.throttle.test.tsx
?? DONE-DU-06.md
?? evidence/            # 不提交
```

---

## 七、剩余与交给板仓的事

1. **词汇单点收口**：§三那句复制句，等裁定收成一处。
2. **首读要不要有读取时刻**：§一② 记了我为何回退，正解在服务端带读时刻，不在前端造时间。
3. **窗口值将来可能要分档**：本页热批 37ms，5s 窗口对「刚读完就想再看一次」的人偏长；
   真要调，判据应是上游配额与用户手感，不是时延——测量已经把这一层分开了。
4. `duty.css` 只加了暗态一条；375 档的 44×44 与 hover-only 全判据归 DU-07。
