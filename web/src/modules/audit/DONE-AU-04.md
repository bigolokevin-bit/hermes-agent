# DONE · AU-04 请求号追踪一致性（前端腿，fixer，2026-11-24 重派新票）

基线=当拍 ls-remote 实读 fork `lane/hermes-console` **3e99506726cdf04f05b2b06743f73a45269c3601**；
起点态=全列 `grep -i au-04` **0 行**在录（lsrem-au04-all.txt，追证批后重实施，旧
0886589007 幻影死值不引不嵌=令面明令）。分支 `task/AU-04-rid`，树
`Projects/tasks/AU-04-rid-v2`（fork worktree，完工 remove 保分支）。
写域：仅 `web/src/modules/audit/`，**只落两文件**（本卡+契约例
`audit.rid.chain.test.tsx`），零源码改动、零他道文件触碰、无 force/`--no-verify`。

## 现状盘点结论（票面步骤①的模块域半）

审计四页失败面全部收敛在 states.tsx 共享 body：`ErrorPanel` / `DeniedPanel` /
`VerifyUnavailablePanel` / `InlineFailure`（RetentionModulePage 的自绘两面板亦
import 同一 `RequestIdLine`），且 `failure.requestId` 自 `lib/api.ts`
（`x-console-request-id` → `x-request-id` 两级取值）单源流入——**无面板私句、
无一格空白兜底缺失**。票面点名的 `requestIdLine(null)` 兜底句
「本次请求未记录编号，可复制时间与操作路径反馈」已在位且逐字统一。
故本件不修源码，交付=**矩阵钉**（14 例契约例把「恒显恒复制」钉成回归护栏，
面板若日后失手绕开 RequestIdLine 即打红）+ 缺口分流点名。

## rid 三形制矩阵（新钉部分）

| 面 | 32-hex | 方案号（req-aud-1101 族） | 无 rid |
|---|---|---|---|
| ErrorPanel | 短形上屏+title/剪贴板逐字全值+裸 32-hex 不上屏 ✓ | 原样上屏可逐字复制 ✓ | 逐字兜底句、无复制钮 ✓ |
| DeniedPanel | 同上 ✓ | ✓ | ✓ |
| VerifyUnavailablePanel | 同上 ✓ | ✓ | ✓ |
| InlineFailure | 同上 ✓ | ✓ | ✓ |
| RequestIdLine 直拼位 | — | ✓ | ✓ |
| technical 在位（折叠共存在） | rid 短形恒在折叠体外、全值不进折叠体 ✓ | | |

既有逐页证据位（只回不重写）：`AuditEventsModulePage.test.tsx` :436/:454/:470、
`audit.error.test.tsx` ①②、`audit.paging.test.tsx`（R161）、
`audit.verify.timeout.test.tsx`（AU-05）、`RetentionModulePage.test.tsx`。

## 读数

- 改动前基线：audit 面 **726 passed | 3 failed (729)**——三枚预存红全部在
  `audit.time.window.parity.test.tsx` R229 族（点名在案，非本件勿背）。
- 改动后：`vitest run src/modules/audit` → **3 failed | 740 passed (743)**
  =729+14，**零新增红**；新文件独跑 14 passed。
- `tsc -b` = 0 错（TSC-CLEAN，node 26.13.1）；本文件 eslint 0err。
- 环境：`source ./activate` + pnpm **12.15.0**（pm/lock.json 钉版）装锁，
  node v26.13.1（engines ≥26）。jsdom 需显式 `isSecureContext=true` 桩
  （否则 clipboard.writeText 旁路=execCommand 假绿），本卡已按真浏览器口径钉桩。

## 缺口分流（票面全域 − 本单边界差集，请 L0 转卡）

1. **serverExport 的 rid 行不可复制**：states.tsx `aud5-server-export-rid`
   用裸 `requestIdLine(...)` 文本（无 CopyValue 钮）——属 AU-02 已落面
   （令面红线勿越），DoD「恒显恒复制」在该面未满足；候 AU-02 域小单对齐。
2. **BFF 半（票面①矩阵后端列+「响应头与信封 body 同源」）**：502/超时/断连
   路径的 `X-Console-Request-Id` 恒在性在 `apps/console/server.py`，重派令
   明写勿越 server.py——本卡未动；H 仓 `apps/console/tests/test_bff_request_id.py`
   谱系已有钉，逐路由全矩阵审计候另开 BFF 腿卡（KB 面同卡）。
3. **knowledge 面同改**：票面「与 KB-06 合流一处」——KB 域越界，候 KB-06。
4. 校验态本地不发请求处（如自定义窗不完整、详情无标识 InlineFailure
   requestId:null）：现句=「未记录编号」兜底，语义为「无信封」非「未发起」——
   口径可接受（DoD「拿不到」文案成立），逐格文案润色候参谋口味件，本单不动。
