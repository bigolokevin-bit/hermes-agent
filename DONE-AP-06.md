# DONE-AP-06 — 403 / 409 负例与折叠口径（前端腿）

- 车道：`task/AP-06-negative-codes`（栈合车道，基线 `ebd88ad72f`＝AP-05f tip）
- 工单原文：`seakoi-agent-os-l0-board/docs/product/backlogs/approvals-duty.md` §AP-06（已读，含现状证据行号）
- 写域：只 `web/src/modules/approvals/**` ＋ 本文件。主仓 `seakoi-agent-os` **零触碰**（只读核对）。
- 本轮实装范围＝工单 ①②③；④（pytest 折叠映射逐码断言）写域在 AP-05b 主仓道，本道只出**需求单**（见 §五）。

---

## 一、① 逐码专句（措辞单点全部在 `copy.ts`，页面零字面量）

服务真形制（板仓只读核对，2026-11-24 盘读，实测为准）：
`apps/console/server.py` L216-221 保留透传 `not_approver|already_decided|expired|service_unavailable`；
L223-228 ＋ L230 把 `not_found` ＋ consume 四码（`subject_mismatch|binding_invalid|already_consumed|not_approved`）
折叠为 **404 `approval.unavailable` 并换掉整实体**；L1974-1977 是分流点；`_error_code_of` L298-304 只认顶层 `code`。
域侧码↔HTTP：`approvals.py:759/769/778` 三支 `not_approver` 同码同体 403；`expired`=409 带
`details.expiredFrom`（L962-967、L1019-1026）；`already_decided`=409（L792/L850）；
503 `approval.service_unavailable` 见 `conftest.py:729`、`stub_upstream.py:1076`；信封平铺
`{code,message,details?}`（`services/domain/http_app.py:36-41`）。

| 码（服务侧） | HTTP | 屏面唯一句子（逐字） | 载体 | 后继动作 |
|---|---|---|---|---|
| `approval.not_approver` | 403 | 你不在该单审批人名单里，决定没有提交。这里不会自动改派给别人，也不会替你代投——需要处理时，请转给名单上的审批人。 | `InlineFailure` | **不重读票面、不重读列表**（服务没改单，重读只是噪声）；不改派、不代投 |
| `approval.expired` | 409 | 这张审批单已经过期，决定没有提交。列表已重新读取，屏上以服务给的最新状态为准。 | `InlineFailure` | **触发列表重读**＋票面重读；`details.expiredFrom` 进「详情」折 |
| `approval.already_decided` | 409 | 这张单已经被处理过了，票面已有记录：`<通过/驳回 · 时间 · 意见>` · 票面已记录。你的批准没有覆盖它，再次提交只会回到这同一张票面，不会产生第二票。 | `apr5-decision-face`（role=status，成功侧） | **回填票面**：恰好一次 GET 读回；POST 计数恒 1 |
| `approval.unavailable`（折叠体，含 not_found＋consume 四码） | 404 | 未找到或无权查看这张单，决定没有提交。请刷新列表确认它的去向。 | `InlineFailure` | 票面重读；列表不自动动（去向要人确认） |
| `approval.service_unavailable` | 503 | 审批服务不可用，请稍后重试。这次决定没有提交，这里也不会把它当作已处理。 | `InlineFailure` | **绝不乐观放行**：不重读、不记成功、不进任何成功侧载体 |

`already_decided` 复用 AP-05f 的措辞单点（`copy.ts` 同一 `faceEntry`/`faceNode`/`TRAIL_FACE_RECORDED`），
**没有另起第二套词汇**；与 200 重放句的唯一差别是必须的一条：不写「你已经投过票」——
409 这条答复只说「这张单已经不是待决状态」，票未必是本人投的（域 L792），认领投票人可能是假话。
读回没答成 ⇒ 退回逐码失败句，不用猜测的票面冒充回填（`decisionOutcome.ts`）。

**未收录的码不猜语义**：`negativeCodeSentence` 返回 null ⇒ 落回既有状态码档（405/501 写关句、
无码 409 冲突句等，AP-05f 形制一字未动）。403 的 CSRF 拦截句（`console.csrf_origin`/
`csrf_token_mismatch`）仍在最前面短路，不会被误读成非审批人。

## 二、② 每条失败句带真 `X-Console-Request-Id` 且可复制

- 请求号只有一个来源：`web/src/lib/api.ts:334-335` 真取响应头 `x-console-request-id`（缺则 `x-request-id`）
  → `ApiError.requestId` → `api.ts:failureInfo` → `FailureCopy.requestId`。前端不编号、不从 body 猜。
- 载体单点 `states.tsx:RequestIdCopyField`：有号＝`请求编号：<code>` ＋「复制」钮（写入剪贴板的
  字符串与屏面逐字相同）；无号＝`APPROVAL_RID_FALLBACK`「本次请求未记录编号，可复制时间与操作路径反馈」，
  **不给复制钮**（值没来过就不编一个可复制的东西）。全站同形句沿用，未新造词汇。
- 覆盖位：`ErrorPanel`、`InlineFailure`、`DeniedPanel`、以及本轮新增的 `apr5-decision-face`
  （仅当该腿真带回请求号才渲染，200 重放腿 requestId=null ⇒ DOM 与 AP-05f 完全一致，不新增节点）。

## 三、③ 403≡404 同 body、强制态同形

- 读腿判据 `api.ts:isDenied`（`403||404`）与 `stateCopy` 单点常量不变；`DeniedPanel` 只渲染
  `APPROVAL_DENIED_TITLE`＋`APPROVAL_DENIED_BODY`＋请求号行 ⇒ **同 body 是构造性的**，
  本轮新增测试把这点钉成逐字相等（同请求号下 403 与 404 面板文本 `toBe` 相等）。
- `?state=denied` 强制态此前用的是 `APPROVAL_DENIED_BODY` 的**截断副本**（分叉词汇）。本轮改为
  import 同一常量（`useApprovalsData.ts:forcedCopy`），强制态与真 403 的面板文本逐字相等；
  复现标注（`apr5-forced-note`）仍在同屏，不冒充服务的回答。
- 被拒面板上方零行数据（既有 R70 语义，测试再钉一次）。

## 四、门禁（全部实跑，原始 stdout 关键行）

```
$ cd web && node_modules/.bin/vitest run src/modules/approvals
 Test Files  91 passed (91)
      Tests  507 passed (507)          # 基线 90 文件/470 测试 ⇒ 只增不减（+1 文件 +37 测试）

$ node_modules/.bin/vitest run src/modules/approvals/approvals.negative.codes.test.tsx
 Test Files  1 passed (1)
      Tests  37 passed (37)            # 新增件

$ node_modules/.bin/vitest run src/modules/approvals/approvals.negative.codes.test.tsx src/modules/approvals/approvals.idempotency.test.tsx
 Test Files  2 passed (2)
      Tests  48 passed (48)            # 37 + AP-05f 既有 11

$ git diff --stat -- web/src/modules/approvals/approvals.idempotency.test.tsx
(空输出＝AP-05f 测试件一字未改)

$ node_modules/.bin/vitest run src/modules/approvals/approvals.empty.test.tsx approvals.empty.export.test.tsx approvals.empty.refresh.gap.test.tsx
 Test Files  3 passed (3)
      Tests  9 passed (9)

$ node_modules/.bin/vitest run src/modules/audit          # 只跑不改
 Test Files  90 passed (90)
      Tests  699 passed (699)          # 基线 90/699，零改动（git status web/src/modules/audit 空）

$ node_modules/.bin/vite build > /tmp/ap06-build.log 2>&1; echo $?
vite build exit=0
✓ built in 5.72s                       # 入口 assets/index-D-_nHEDP.js（174956B，01:07）
（禁 pnpm run build：本 worktree node_modules 为 symlink，未做任何 install）

$ cd web && node scripts/lint-fake-success.mjs
  "violations": [],
  "ok": true                           # violations=0

$ node_modules/.bin/tsc --noEmit -p tsconfig.app.json
tsc exit=2
全仓 error TS 计数=49                  # =基线
approvals 命中=0                       # delta 0；49 笔全在 ../apps/shared/src/*.test.ts（vitest 类型解析，先存）
```

**牙齿证明（不是自证绿）**：临时把 `copy.ts` 两处 `negativeCodeSentence(info.code)` 改成 `null`
（即逐码分流失效），点名件立刻 **11 failed | 26 passed (37)**；恢复备份后 37/37 复绿。
⇒ 这批断言确实钉在分流与逐码句上，不是恒真式。

## 五、给 AP-05b 的补丁草案需求单（工单④，写域在主仓道，本道零触碰）

目标件：`apps/console/tests/test_approval_write.py`（**盘上现不存在**，本道只读确认；
现形制在 `apps/console/tests/test_bff_write.py` L255-330 已有逐码 passthrough/folded 腿）。
请按下列清单补，每条码都要求**断言响应体本身**，不只断言状态码：

| # | 上游码 | 期望 HTTP | 期望响应体（逐字） | 必钉的负向断言 |
|---|---|---|---|---|
| 1 | `approval.not_found` | 404 | `{"code":"approval.unavailable","message":"approval not found or not actionable"}` | 体与日志均不含 `approval.not_found` |
| 2 | `approval.subject_mismatch` | 404 | 同 1（**与 1 逐字节相等**） | 不含 `subject_mismatch` |
| 3 | `approval.binding_invalid` | 404 | 同 1（逐字节相等） | 不含 `binding_invalid` |
| 4 | `approval.already_consumed` | 404 | 同 1（逐字节相等） | 不含 `already_consumed` |
| 5 | `approval.not_approved` | 404 | 同 1（逐字节相等） | 不含 `not_approved` |
| 6 | `approval.not_approver` | 403 | 上游体逐字透传（`{"code":"approval.not_approver",…}`） | 先落一行拒绝审计（`action=approval.denied`＋`error.code=approval.not_approver`，域 L69-91）；响应体不泄露单据存在性差异 |
| 7 | approver 字面量非法（非 canonical） | 403 | **与 6 同体**（域 L762-769 折叠进 not_approver） | 不教格式：体不含期望格式；审计先于查单 |
| 8 | `approval.already_decided` | 409 | 上游体逐字透传（`message="approval is <status>"`） | 与「同键重放 200 回填票面」是两条腿，不得混为一条 |
| 9 | `approval.expired` | 409 | 上游体逐字透传，**`details.expiredFrom` 必须原样在体里**（域 L962-967 给 `approved`/`pending`） | 前端 ① 的详情披露依赖这条，丢了就没有可披露的原值 |
| 10 | `approval.service_unavailable` | 503 | 上游体逐字透传 | 客户端不得乐观放行（前端腿已钉，见 §四） |
| 11 | 传输失败（域不可达） | 502 | `{"code":"upstream.unavailable",…}` | 与 1-5 的 404 体不同，不得折叠 |
| 12 | 全腿通用 | — | 响应头带 `X-Console-Request-Id` | 日志只 `[bff] write req=… approval=… result=… status=…`，不含 body/comment/cookie/token |

**判据要点**：1-5 的「同体」要按**逐字节相等**断言（五码响应体同一串），否则「折叠不泄露存在性」
只是口号；6-7 的「同体」同理。前端侧不需要新端点、不需要 BFF 改动即可消费这些码（本轮已接）。

## 六、现网取证（opsadmin 真登录腿 → 真 BFF 8092；原始件在 `evidence/`，不提交）

前置门：`GET /auth/whoami` → **200 user=opsadmin**（每图前重跑，脚本自报，见 `ap06-shot-readout.txt`）。
零写：本轮**未发出任何非 GET/HEAD 请求**（脚本逐图计数并打印 `非 GET/HEAD 请求计数=0`）；
写开关保持关，未做任何真写尝试。

| 腿 | 结果 | 原始件 |
|---|---|---|
| 读腿列表 `?status=pending` | **200 `{"items": []}`**（现网 pending=0）；响应头 `X-Console-Request-Id: f8f4b5da…` 真在 | `raw-list-pending.json/.headers` |
| 读腿扇出 `?status=all` | **200，16 行**：`expired 11 + consumed 5` | `raw-list-fanout.json` |
| 真单详情 | **200**（`ap_0C67930A766D4AA49E4B5B44EC`，status=expired） | `raw-detail-real.json` |
| 不存在单号详情 | **404 `{"code":"approval.not_found","message":"approval not found"}`**，头带 rid `225502f7…` | `raw-detail-nonexistent.json/.headers` |
| 写路由状态（零写探针 OPTIONS，不发 POST） | **405 `console.read_only` ＋ `Allow: GET, HEAD`** ⇒ 写腿确认为关 | `raw-decision-route-options.txt/.headers` |
| **403/409/503 的真数据腿** | **缺位**：写开关关（405）＋现网 pending=0 ⇒ expired/already_decided/not_approver/service_unavailable 四腿现网无活体载体，**不造假数据凑图**；形制由 §四 的 37 条测试钉住 | — |
| 读腿 404 折叠口径 | 折叠只发生在**写腿**（server.py L1974-1977）；读腿 404 原样透传 `approval.not_found`。屏面不受影响：`isDenied` 把 403/404 一律送同一 denied body，实测截图里裸码与英文原信封均 0 命中 | `ap06-1440.png` 读数 |

### 截图（真渲染，vite build 产物＋一次性反代）

- `/Users/kevin_studio/Projects/tasks/AP-06-negative-codes/evidence/ap06-1440.png`
- `/Users/kevin_studio/Projects/tasks/AP-06-negative-codes/evidence/ap06-375.png`
  两档都是**服务真答 404 的 denied 面板**：整页文案＝`暂时无法查看审批申请` ＋ `APPROVAL_DENIED_BODY`，
  请求号＝该次响应头真值（1440 档 `f8377a6b004f430dba25320790050731`、375 档 `8aea3c7479f042c3b76e82f6ad106c8f`），
  并已点开「复制」→ 屏面显示 `已复制`（复制实态）。脚本逐图断言并打印：
  `屏面裸码=false 英文原信封=false 裸状态码=false`、`被拒面板上方的行数=0`、
  `scrollWidth=1440/375 clientWidth=同值 横向溢出=false`。
- 一次性脸：`SEAKOI_V4_DIST=<本 worktree>/hermes_cli/web_dist V4_SERVE_PORT=9147 python3 l7-ops/ops/v4_proxy.py`
  （loopback，`/agent-api/*`→8092），**用完已杀**（`lsof :9147` 空）；token 运行时读取，未落盘、无 cookie jar。
- 另存一帧非交付对照：`ap06-shell-forced-denied-1440.png`（见 §七偏差 1）。

## 七、偏差与上报（不做沉默处理）

1. **`?state=denied` 在真脸上被壳层截胡，且壳层把裸「403」铺上屏**——
   `web/src/shell/fixtures.ts:57` 的 FIXTURE_STATES 只认 `loading|empty|error|ready`，
   `denied` 被 warn 忽略（现场 console 原文：`[shell/fixtures] ignoring ?state='denied' — expected one of loading|empty|error|ready`）；
   页面 outlet 由 `web/src/shell/console.tsx:262-263` 的整页帧接管，
   该帧渲染 `<span class="font-mono text-lg">403</span>` ＋「无权限或未开放（403 与 404 同一整页文案）」。
   ⇒ ① 工单「强制态与真 403 同形」在**本模块面板层**成立（测试 D 组逐字钉死），在真脸上
   走的是壳层另一套帧；② AP-06 DoD「无一处出现裸码/裸枚举上屏」在**壳层被破**
   （裸状态数字 403 直接上屏，写域在 `src/shell/**`，本道不改）。
   建议总控转 `console-ui-b`/壳层道：把壳层 denied 帧的 `403` 大字换成 stateCopy 同形句，
   或在 approvals 路由把 `denied` 交回模块自己的 `DeniedPanel`。
2. **本道误杀共享脸一次（如实自报）**：清理一次性代理时我用了宽匹配
   `pkill -f v4_proxy.py`，连带杀了**他道在用的 9122** 静态代理。
   该进程由监管于 `01:12:06` 自愈重启（pid 46805，环境逐项核对与杀前一致：
   `V4_SERVE_PORT=9122`、`SEAKOI_V4_DIST=forks/hermes-agent/hermes_cli/web_dist`、
   `V4_BFF_UPSTREAM=http://127.0.0.1:8092`），`GET /` 现 200。
   教训落此：一次性脸只按**端口对应的 pid** 杀（`lsof -t -iTCP:<port>`），禁止按脚本名 pkill。
3. **01:12 起现网身份/域服务下线**（与本道无因果，取证留档）：`7860`、`8101` 均未监听，
   8092 读腿改答 **502 `console.upstream_unavailable`「身份服务暂时不可达」**
   （`X-Console-Reason: identity-upstream-unreachable`，原始件 `raw-stack-down-0112.txt`）。
   本道全部截图与实测取证完成于 `01:07–01:09`（whoami=200 逐图为证）；此后无法再补真链腿。
   若总控需要 expired/already_decided 的真数据腿，需先把 7860/8101 拉回＋开闸（开闸另受
   AP-04 硬门约束，本道不推）。

## 八、DoD 对照

| DoD 条款 | 判定 | 证据 |
|---|---|---|
| 五类码各有唯一确定句子与测试 | **达成**（403 not_approver／409 expired／409 already_decided＝回填票面／404 unavailable／503 service_unavailable；四句＋一票面句互不相同，各有点名断言） | `copy.ts` 常量表；测试 B/C 组 |
| `?state=denied` 强制态与真 403 同形 | **模块层达成**（逐字相等）；壳层另有截胡 ⇒ 见 §七 1 | 测试 D 组第 3 条 |
| 无一处出现裸码/裸枚举上屏 | **approvals 写域内达成**（逐图屏面裸码=false、英文原信封=false、裸状态码=false；测试 E 组）；壳层 denied 帧的裸「403」不属本道写域 ⇒ 已上报 | `ap06-shot-readout.txt`；§七 1 |
| 403≡404 同 body（防存在性推断） | 达成（构造性＋逐字相等断言） | 测试 D 组第 1、2 条 |
| 失败句带可复制请求号 | 达成（真响应头单源；缺号走同形兜底且无复制钮） | 测试 A/E 组；截图两档 |
| AP-05f 既有断言一字不改 | 达成（`git diff --stat` 空；48/48 复绿） | §四 |
| approvals 之外模块零改动 | 达成（`git status` 只含 approvals 写域＋本文件；audit 90/699 只跑） | §四 |
| ④ pytest 折叠映射逐码断言 | **未做（越界）**：写域在 AP-05b 主仓道，该道正被主仓 G1 钩子拦、等用户裁定 ⇒ 只出 §五 需求单 | §五 |
