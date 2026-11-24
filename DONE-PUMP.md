# DONE-PUMP — pump 心跳面（READY-BACKLOG 自取件 pump-health）

- 车道：hermes-console（session ses_df7932bd1ffePEwuIsxLeGSkWe）
- 分支：task/pump-health ｜ 基线：85d395c197（origin/lane/hermes-console 现取）
- 写域：web/src/modules/health/**（l0-board task-lanes.json 登记）
- 日期：2026-11-24

## 现网事实（首态判据）
`curl` 带 opsadmin cookie `GET http://127.0.0.1:8092/api/pump-status` →
**404 application/json** `{"code":"console.unknown_route", …}`
（原始体存 /tmp/pump-ep.json，同文抄录于下）：

```json
{"code": "console.unknown_route", "message": "unknown console API route"}
```

⇒ 前端首态=诚实「出站 pump 状态未接入」，非 spinner、非空白、不伪造绿色。
BFF/pump 侧端点未提供——本件只消费、不新增后端依赖（卡片红线）。

## 改动（fixer ses_df517d956ffe 实现 + 总控验证/一处测试修正）
1. `pumpStatus.ts`（新 +152）：PUMP_PATH='/agent-api/api/pump-status'、
   PUMP_STALE_MS=90_000、readPumpStatus（键宽容 lastTickAt|tick_at|
   lastHeartbeat）、pumpVerdict 纯函数（notWired|alive|stale|unknown|failed，
   90s 边界）、isPumpNotWired（404 且 body.code∈
   {console.unknown_route, pump.status_not_wired}）、loadPumpStatus
   （same-origin + X-Hermes-Session-Token，**保留 raw body** 判 code——
   modules/models/fetchJson 的 fetchJsonStrict 会把 body 置空，不可复用）。
2. `PumpHeartbeat.tsx`（新 +154）：五态表驱动单路径渲染
   `sysP-pump[data-state]` + badge + text + 仅 failed 的单腿重试
   `sysP-pump-retry`；不报数进 refresh.finish；预览态整行不渲染（不给假结论）。
3. `HealthPage.tsx` +3：一行挂载（SystemHealthSurface 之后），未动既有行。
4. `health.css` +61：末尾 sysP- 段，只用既有语义令牌，**无 font-size/无 hex**
   （护 font-scale 棘轮）。
5. `pump.health.test.tsx`（新 9 例）：①404 未接入人话+无 spinner+无工程
   token+无重试钮；②10s 内 tick→绿+北京时刻上屏+ISO 只进 title；③120s→
   「超过 90 秒未心跳」；④500→「这次没读到」+单腿重试恰好一笔 pump URL+
   四条既有读口笔数不增+翻绿；④b 断网/假200HTML/裸404 归「没读到」；
   ④c 不进 sys6 矩阵；④d 预览零请求；⑤/⑤b pumpVerdict/readPumpStatus
   表驱动（89_999/90_000/90_001 边界）。

## 总控修正一处（测试记账语义）
例④ 原断言 `pumpCalls()==[PUMP,PUMP]`（挂载+重试累计）与其自身助手冲突：
`arm()` 内 `pumpFetch.mockReset()` 会清空挂载笔记账，重试后列表恰含重试一笔。
改为 `toEqual([PUMP_PATH])` + 注释——契约更强：重试**恰好一次**、URL 形状唯一、
既有读口不增仍由 legReads 钉。

## 门读数（原始）
- scoped：`vitest run src/modules/health` → **41 files / 185 tests 全绿**
  （既有 50+ 件零回归；fixer 疑点①解除：既有用例未被 pump 行打破）
- 红→绿取证（队列要求）：stash 实现四件 → 新测试
  `Error: Failed to resolve import "./pumpStatus"` + `Test Files 1 failed` →
  stash pop 恢复（5 项齐）→ 转绿。
- `tsc --noEmit -p .` → error TS 计数 **0**（并线验收必自跑全型面，MT-04 教训）
- `vite build` → **BUILD_EXIT=0**（/tmp/pump-build.log）

## 偏离与声明
- 不走 `@/lib/api` fetchJSON、不入 SOURCE_DEFS、不用 SystemStatePanel、
  不加 role=status/aria-live、前缀 sysP- 避开全部既有 sweep 族
  （撞点逐条审计见测试文件头注释）。
- `Date.now()` 仅用于判活（上屏时刻=上游 ISO）；如需完全无时钟，90s 规则
  应由服务端给 age 字段——归 BFF 接线时一并裁。
- 裸 404（无 code）按卡片字面归「这次没读到」而非「未接入」；信封变形
  只会退化成重试行，不会误报未接入。
- 端点由 BFF 提供后（READY 件 pump-status/后端票），本腿自动翻真态，
  无需前端再改。
