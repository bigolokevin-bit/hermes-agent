# DONE-AP-04 — 决策写开关（默认关＋负例先行）：本轮＝探测形制＋禁用形态

- 车道：`task/AP-04-write-probe`，基线 `3c227efa80`（=AP-06 tip；合链 …AP-05f ebd88ad72f→AP-06 3c227efa80→**AP-04 本 tip**，L0 合并顺序须如此）。
- 工单原文：`seakoi-agent-os-l0-board/docs/product/backlogs/approvals-duty.md` §AP-04（已读全文，含 §三 开闸硬门）。
- 写域：只 `web/src/modules/approvals/**` ＋ 本文件。**主仓 seakoi-agent-os、apps/console/**、modules/audit/duty/** 零触碰**；`CONSOLE_APPROVAL_WRITE_ENABLED` 未动、生产写开关保持关；**本轮零真写尝试**（探测只用 OPTIONS 读侧方法——见 §二与证据）。
- 本轮范围＝工单四步的「探测与禁用形态」，**不改默认、不开闸**；开闸判定必须引用 AP-05＋AP-06 绿色输出（§三 硬门，代码里由 `NEGATIVE_PROOFS_ACCEPTED=false` 钉住）。

---

## 一、① 合取门控：`writeGate.ts` 由常量改为「服务端探测 ∧ 构建期旗标 ∧ AP-05/06 负例证明」

```
DECISION_GATE.disabled = !(serverOpen ∧ FRONTEND_WRITE_FLAG ∧ NEGATIVE_PROOFS_ACCEPTED)
```

- `DECISION_GATE` 保留原导出名与 `{disabled,title}` 读取面，但改为 **getter 活视图**：
  `batch.ts`（调用时读）与页面（渲染时读）拿到的都是同一时刻的同一事实——消费点零改动，
  `batch.ts` writeOff 分支继续走 `DECISION_GATE.title` **同一句原话逐字**（禁第二套词汇，
  approvals.batch.test.tsx＋approvals.write.probe.test.tsx 双重钉死，含逐字相等断言）。
- 缺任一输入 ⇒ `disabled:true` ＋ **P0-1r 原句原样保留**；AP-05f 的
  `ACTION_HASH_MISSING_REASON` 第二原因句并存逻辑一字未动（`decisionBlockReasons` 顺序不变）。
- 开闸后代不再「删常量」，而是让三输入各自变真：探测=开且拒绝、旗标构建期置 1、
  负例证明随部署评审翻源码一行。

## 二、② 探测腿（`api.ts`）：确定性答复判据，禁「猜测成功」

| 写路由答复（实测形制） | verdict | 门控 |
|---|---|---|
| 405 `console.read_only`（`Allow: GET, HEAD`） | `closed` | 关（现网态） |
| 401 `console.unauthenticated` | `unauthenticated` | 按关（保守） |
| 403 `approval.*` 专码 | `open-denied` | 服务端腿=开（仍受旗标∧证明合取） |
| 其余（2xx OPTIONS/502/超时/断连/非专码 403） | `unknown` | 按关（工单：探测失败/超时=按关） |

- **2xx OPTIONS 不算开**：代理层可能替源站应答探测，那是别人的答复（「猜测成功」即此腿）。
- 探测只发 `OPTIONS /agent-api/api/approval/decision`（`PROBE_METHOD`/`PROBE_SOURCE` 单点），
  永不发 POST/PUT/DELETE；请求形制由新测试以方法计数钉死（含「恰好一发、幂等缓存」用例）。
- `unknown` 腿不记采集时刻（答复不可依赖时那秒不算采集）；重试与超时=8s AbortController。
- 真链取证（opsadmin→8092，evidence/ 不提交）：
  ```
  live-options-decision-authed: HTTP 405 allow=GET, HEAD code=console.read_only
  live-options-decision-anon:   HTTP 401 allow=- code=console.unauthenticated
  live-get-decision-authed:     HTTP 404 allow=- code=console.unknown_route
  live-get-list-authed:         HTTP 200
  ```
  前两行＝分类器两档的浏览器外独立证据；第三行说明为何 GET 无 id 不可作探测腿（404 不可判⇒unknown）。
  AP-06 道存证 `raw-decision-route-options.headers`（写口 OPTIONS→405）与本轮一致；
  11-24 01:12 起的 7860/8101 下线窗口本轮未再撞上，实测时段（01:36-01:39）栈可读（pending=0、expired=11）。

## 三、③ 页头只读 chip（新文件 `WriteGateChip.tsx`，措辞单点在 `writeGateChipReadout`）

实屏文本（真链原样，见 §六截图读数）：

```
写开关：关 ｜ 服务端：写路由未开 ｜ 前端旗标：关 ｜ 采集时刻：2026-11-24 01:39
```

- 缺数=「—」＋原因句（tooltip：探测还没有回话/没有拿到答复（超时/不可达/答复不可判），绝不拿当前时间冒充）。
- **no path echo 契约**：本页既有测试钉死整页 innerHTML 不得出现 `/agent-api`——chip 来源句
  因此用形制描述「对决定提交路由的 OPTIONS 只读探测」，完整路由留在数据层 `PROBE_SOURCE`
  与本 DONE/证据里。新测试同时钉了 `chip outerHTML 不含 /agent-api`。
- 裸码不上屏：`console.read_only`/`405` 等永不出现在文本（测试钉死）。

## 四、④ `VITE_AGENT_APPROVAL_WRITE`：本轮新建消费点＋深度文档偏差记录

- 现状证据为实：该常量在本 fork **grep=0 命中、从未存在过**——深度文档 §2.2 与记忆里
  「前端开关 VITE_AGENT_APPROVAL_WRITE==="1" 控制按钮可见性」的描述**没有对应实物**（偏差照实登记）。
- 按工单「若立项实现，走构建期常量、不热读」实现：`import.meta.env.VITE_AGENT_APPROVAL_WRITE === "1"`
  在 **import 期读一次**固化进 bundle（与 BFF 启动期纪律同形制）；缺省/空串/非 `"1"` ⇒ 关；
  **默认值不变=关**。开闸需「BFF 设 `CONSOLE_APPROVAL_WRITE_ENABLED=1` 并重启 ＋ 前端 `VITE_AGENT_APPROVAL_WRITE=1` 重新构建」双条件（另加 §三 硬门的负例证据，见下）。
- DoD「开关开但未过 AP-05/AP-06 仍为关」的语义：由源码常量 `NEGATIVE_PROOFS_ACCEPTED=false`
  在合取里钉住，并有独立用例（服务端 403 专码 ∧ 旗标=1 ⇒ 仍 disabled＋原句）。

## 五、验证门（全部实跑，原始 stdout）

点名三件（实存核对=三件俱在）：
```
$ node_modules/.bin/vitest run src/modules/approvals/approvals.decision.parity.test.tsx approvals.decision.parity2.test.tsx approvals.batch.test.tsx
 Test Files  3 passed (3)
      Tests  21 passed (21)
```
全模块基线（91 files/507 只增不减 ⇒ 本轮新增 1 件 13 案）：
```
$ node_modules/.bin/vitest run src/modules/approvals
 Test Files  92 passed (92)
      Tests  520 passed (520)
```
新文件 `approvals.write.probe.test.tsx`（分类器真值表/探测请求形制/合取三输入真值表/
禁用形态＋chip 页面级）：13/13 绿；负例「writes=0／零 dialog」由本道新钉＋既有
ApprovalsPendingModulePage.test.tsx P0-1r 案双保险（后者原案未改一字仍绿）。

audit 件只跑不改：`Test Files 90 passed (90) / Tests 699 passed (699)`（含 approvals 外的 duty 面未触）。
构建门（禁 pnpm run build）：
```
$ node_modules/.bin/vite build   →  EXIT=0
```
假成功闸：`node scripts/lint-fake-success.mjs` → `"violations": [] , "ok": true`。
类型面：`npx tsc --noEmit -p tsconfig.app.json` → 全仓 49 错=基线，`modules/approvals` 命中 **0**（delta 0）。
eslint：0 errors；新文件 0 warnings，ApprovalsPendingModulePage.tsx 8 warnings=基线 8（delta 0）。

## 六、真链截图（build 产物＋9347 临时同源反代，非 stub 渲染）

- `evidence/ap04-proxy.mjs`（一次性，用后按端口 pid 精确清理，未碰黑名单口；9122/8092 均为他人进程）；
  每图前 `whoami status=200 user=opsadmin`；domcontentloaded＋settle，视口图。
- **ap04-1440.png / ap04-375.png**：页头 chip 实态上屏（§三文本为截图同帧读数），
  浏览器网络实录：产品探测腿 `405 OPTIONS /agent-api/api/approval/decision` 恰好一发/加载，
  `非 GET/HEAD/OPTIONS 请求计数=0（零写）`；375 档 scrollWidth=375 无横向溢出。
- 如实盘点：**「三钮禁用＋原因句」的真链图拍不了**——现网 pending 队列实数=0
  （`{"items": []}`，全 8 态扇出仅 expired=11），没有真实待批单；为拍摄而造单=写请求，红线禁止。
  故三钮禁用形态以 jsdom 真门控真页面钉死（disabled＋aria-disabled＋title 逐字=原句＋点击零请求零 dialog），
  截图腿交付 chip＋零写网络账。**不拿 stub 渲染冒充真链图。**

## 七、部署说明（开闸双条件，工单要求写入 DONE）

1. **BFF 腿**：`CONSOLE_APPROVAL_WRITE_ENABLED=1` 写进部署 **且重启 BFF**（import 期读，禁请求期热读）；
   且必须先满足 §三 硬门——AP-05＋AP-06 三条负例证据原文附在部署记录（403 非审批人＋先落拒绝审计、
   缺 hash/形态非法折叠、幂等重放返回既有票），否则前端 `NEGATIVE_PROOFS_ACCEPTED=false` 仍全线禁用。
2. **前端腿**：`VITE_AGENT_APPROVAL_WRITE=1` **重新构建**（构建期常量，非运行时开关）。
3. 两腿齐备后，浏览器探测腿对写路由答出 `403 approval.*` 专码 ⇒ 服务端腿变真；三输入合取成立才亮按钮。
   任一腿缺失/探测超时/502 ⇒ 按钮保持禁用＋原句，零请求零 toast。

## 八、遗留与后续波（不在本道）

- 「要求修改」提交钮本 fork 不存在（`Verdict="approve"|"reject"`，revise 仅状态标签）——DoD 三钮口径
  按既有两钮＋备注输入落地；revise 钮若立项，必须同读 `DECISION_GATE`（合取单点已就绪）。
- AP-05f 的 hash 缺失句与门控接成钮级合取（`disabled = DECISION_GATE ∨ 指纹缺失`）＝开闸评估波（注释已钉）。
- GAP-APR-10（运行时开关查询端点）仍未立项：本探测腿以「写路由确定性答复」替代开关查询，端点落地后可换源不换形制。
