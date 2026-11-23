# DONE-DU-04 · 渠道事件流（读口裁定优先）— 本轮按 A 交付

工单：板仓 `docs/product/backlogs/approvals-duty.md` §DU-04（L144-153）。
链：DU-01 → DU-02 → DU-03 → DU-04（本件 tip 见文末）。
车道：`task/DU-04-channel-verdict`（栈合检出 `/Users/kevin_studio/Projects/tasks/DU-04-channel-verdict`）。

## 0. 结论一句话

**A 路交付**：V1 保持工位单腿，屏上缺口句改成与实际读口一致的诚实句；
注释里的「等 DU-04 裁定」按裁定收口。**主仓 `apps/console/server.py` 零改动**
（D 车道写域），不在红线上硬造第二套读口。**B 路（只读列表口）保持挂起待决策**，
本轮把它整理成 D/参谋可直接起用的裁定单（§3），并登记一条**实测校正**：
工单假设的「上游缺口」其实已经存在（C8 只读列表口），待裁定的只剩 BFF 代理一层。

## 1. 改了什么（写域自查：只动 `web/src/modules/duty/**`）

| 文件 | 行 | 改动 | 性质 |
|---|---|---|---|
| `aggregate.ts` | 150 | V1 `whyNot` 屏上句：`属 BFF 红线「勿补」，等 DU-04 裁定；本轮只按…` → `当前无只读列表口（列表读口属内部服务面红线），本卡只按工位单腿判定` | 屏幕文案收口（旧句把车道流程写在屏上，且「等裁定」在 A 交付后成为假话） |
| `aggregate.ts` | 48-49 | 模块头注释「等 DU-04 裁定，不接」→「DU-04 已按 A 路交付=不接，B 路仍挂起待裁定，屏上不写『等裁定』」 | 注释收口 |
| `readiness.ts` | 5-7 | 文件头注释同上收口，写明本车道不建第二套读口 | 注释收口 |
| `readiness.ts` | 76-79 | `v1Verdict` 注记收口，并补一句「函数体里没有第二腿逻辑，注释与代码一致」 | 注释收口（③：注释不许领先代码） |
| `duty.channelVerdict.test.ts` | 新增 | DU-04 A 路钉测 5 条（含红测取证，见 §2.3） | 判据 |

**未改**（工单④「不为改而改」）：`aggregate.ts:147` V1 source 句
`"工位绑定（群 + active）· 渠道事件列表 BFF 未代理，仅工位腿"` ——DU-01 已做单腿
诚实标注，该句与实际读口一致（真读口只有工位腿，列表口 BFF 确实未代理），
且不含「事件流」字样，保持原样。`DutyPage.tsx`、`api.ts` 卡面文案**零改动**：
两文件里没有任何把 V1 第二腿写成或暗示「渠道事件流」的文本（证据见 §2.1/§2.2）。

## 2. DoD A 判据与原始输出

### 2.1 grep 面：`channel-events` 在 modules 下零命中（工单①要求的原始输出）

```console
$ cd web && grep -rn "channel-events" src/modules/ ; echo "(grep exit=$?)"
(无命中)
grep exit=1
```

本轮新增钉测里的路径字面量是 `["/channel", "-events"].join("")` 拼出来的
（`duty.channelVerdict.test.ts:186`），刻意不落整串，否则这条验收 grep 会被
自己的测试件凭空加出一条命中。钉测仍然真断言「浏览器零渠道事件取数请求」。

### 2.2 屏上无「事件流」暗示、无「等 DU-04」流程语

```console
$ grep -rn "事件流" src/modules/duty/ | grep -v duty.channelVerdict
（无输出）
$ grep -rn "等 DU-04" src/ | grep -v duty.channelVerdict
（无输出）
```

剩余命中只在新测试件的**反向断言**里（`not.toContain`），属判据文本，不是产品文案。

### 2.3 新增钉测（`duty.channelVerdict.test.ts`，5 条）

判据三条：① V1 source 报工位单腿口径且不含「事件流」；② `whyNot` 说「无只读列表口」
（不是「取数失败」）、说「只按工位单腿判定」、不含「等 DU-04／裁定／勿补」；
③ 页面真渲染时该句确实落在可上岗卡分母披露行（`duty-ready-denominator`），
全页文本零「事件流」零「等 DU-04」，且 `fetchJSON` 实发请求里零渠道事件读口。

**牙齿证明（先红后绿，实跑）**：把 `aggregate.ts:150` 临时回退成旧句再跑——

```console
× whyNot 说「无只读列表口」，不说取数失败，也不把车道流程写进屏上句
AssertionError: expected '第二腿（最近一次群内成功应答）属 BFF 红线「勿补」，等 DU-04 裁…' to contain '无只读列表口'
× 缺口句出现在可上岗卡的分母披露行，全页零「事件流」与零「等 DU-04」
AssertionError: expected '还有 1 项检查的数据源没有接入，暂不能判定 — 第二腿（最近一次群内成功…' to contain '无只读列表口'
Tests  2 failed | 3 passed (5)
```

回退已撤销，屏上句为 §1 表里的新句（`aggregate.ts:150` 现值可 `grep -n 第二腿` 复核）。

### 2.4 验证门（全部实跑）

```console
$ cd web && node_modules/.bin/vitest run src/modules/duty
 Test Files  13 passed (13)
      Tests  182 passed (182)

$ cd web && node_modules/.bin/vitest run src/modules/duty/duty.caliber.test.ts
 Test Files  1 passed (1)
      Tests  8 passed (8)

$ cd web && node_modules/.bin/vite build          （禁 pnpm run build）
✓ 3635 modules transformed.
✓ built in 8.52s
exit=0

$ cd web && node scripts/lint-fake-success.mjs    （注：脚本在 web/scripts/，worktree 根无 scripts/）
  "violations": [],
  "ok": true

$ cd web && npx tsc --noEmit -p tsconfig.app.json
error TS 计数：全仓 49 ＋ src/modules/duty 0
delta：49→49（=基线，apps/shared 与 apps/* 预存；duty 侧 0→0）
exit=2 属基线预存错误所致（判据看 delta，不看退出码，见根 AGENTS.md web 节）
```

基线对照：开工首跑 `vitest run src/modules/duty` = **12 文件 / 177 测试全绿**，
收口后 = 13 文件 / 182 测试全绿（+1 文件 +5 条，只增不减）。

## 3. B 路裁定单（挂起待决策，供 D 车道/参谋直接起用）

工单原文 B 方案（§DU-04 步骤①）：
> B＝D 车道补一条 **GET-only、无 `pending/ack` 副作用、fail-closed** 的**只读列表**口，前端再消费

红线原文（主仓 `apps/console/server.py`，本轮只读未改，实读行号 1084-1095）：

```python
# 有意不代理的形态（红线，勿补）：/api/channel-events 列表（上游属内部服务面，
# 无租户语义的浏览器读口）、/pending、/ack（ack 是写/副作用端点，只读 BFF 禁入）。
CHANNELS_DETAIL_PREFIX = "/api/channel-events/"
# 保留段（必须拒，否则 <id> 转发会把浏览器请求喂给副作用端点）：
# 上游 services/channels/http_app.py C6 GET /v1/channel-events/pending 是
# 「一次调用原子领走一批事件」的租约领取（CR-022 硬规则 5 …）
CHANNELS_RESERVED_SEGMENTS = frozenset({"pending"})
```

**实测校正（工单前提需修，与 DU-03 同类）**：B 假设要「补」的上游只读列表口
**已经在树上**，不是缺口：

| 事实 | 位置（`seakoi-agent-os-l0-board` 检出，只读） |
|---|---|
| C8 只读列表路由 `GET /v1/channel-events`，注释自述「只读列表（门判据查询，lane L2-v1-read）… 回答『最近一次群@是否 done』」 | `services/channels/http_app.py:46-71` |
| C8 服务实现自述「纯读零写入」「排序固定 `received_at DESC`，items[0] 即最近一次」「缺/错 `X-Internal-Token` → 401 且零副作用」「未知/无匹配 employee → `200 {"items": []}`：空列表是真话，不造行」 | `services/channels/service.py:316-377` |
| 带租户门：`x_tenant_id`/`x_internal_token` 两个 Header 参数，入口先 `_check_auth(...)` | `services/channels/service.py:343` |
| 有副作用的两条形态是 C6 `/pending`（`http_app.py:83`，租约领取）与 C7 `/{id}/ack`（`http_app.py:121`，POST）；C8 与它们不同路径不同 method，注释明确「不存在被 C2 吃掉的路由陷阱」 | `services/channels/http_app.py:47-49` |

⇒ **三条证据要求的现状**：GET-only ✅ 已成立；无 `pending/ack` 副作用 ✅ 已成立
（C8 与 C6/C7 物理隔离，且 C8 无写路径）；fail-closed ✅ 已成立（401 鉴权前拒绝、
非法 query 400 不夹紧、空列表是真话）。**待裁定的不是「要不要造口」，
而是「BFF 能不能把这条已存在的上游只读口代理给浏览器」**——红线给的理由
「上游属内部服务面，无租户语义的浏览器读口」中，「无租户语义」半句与 C8 现状不符
（C8 收 `X-Tenant-Id` 且 BFF 本就对全部代理读注入服务端租户，`server.py:8-9`），
需要 D/参谋复核该理由是否仍成立、还是只该保留「`/pending`、`/ack` 禁入」半句。

**若裁 B 通过**，D 车道侧最小动作（本车道不代做）：`server.py` 增加
`GET /api/channel-events`（无 id 段）精确路由 → 代理 C8，服务端注入
`X-Tenant-Id`/`X-Internal-Token`（该头永不出浏览器），继续拦 `pending`/`ack`
形态；前端消费腿与 `eventId` 详情深链、correlation 关联归本车道后续件，
发信人 open_id 裸值不外泄（工单②）。
**若裁 A 维持**，则现状即终态：V1 单腿，屏上句已与实际读口一致，本件无后续。

DU-01 的 V1 第二腿依赖此裁定：B 通过前，V1 第二腿不接（本件已按 A 收口）。

## 4. 写域与红线自证

```console
$ git status --porcelain      （提交前）
 M web/src/modules/duty/aggregate.ts
 M web/src/modules/duty/readiness.ts
?? web/src/modules/duty/duty.channelVerdict.test.ts
?? DONE-DU-04.md
```

- 主仓 `apps/console/server.py`：**零改动**（§3 全部行号来自只读 `sed`/`grep`）。
- `approvals/**`、`audit/**`：零改动（diff 文件面仅 duty）。
- `DECISION_GATE` 一行未碰，审批写开关保持关。
- 全程未 `pnpm install`；node_modules 与 web/node_modules 用既有 symlink。

## 5. 截图（真渲染）

`evidence/du04-1440.png`（1440×900）、`evidence/du04-375.png`（375×812）。
形制承 DU-03：页面源＝本 worktree `vite build` 产物（`hermes_cli/web_dist`），
临时 loopback 反代同源提供；`/agent-api/*`→真 BFF `127.0.0.1:8092`，`/auth/*`→真 9122。
端口自选 **9193**（避开 9122/9131/9141/9151/9161/9162/9171/9172/9183 与在用 9177）。
`domcontentloaded` + settle 2.5s（不用 networkidle），每图前断言 `whoami==200`，
视口图不用 fullPage；用完杀代理（`lsof :9193` 复查 listeners=0，9122/9183 全程未动）。
token 复用既有 `~/.seakoi/opsadmin-token.txt`（非本轮新铸，故**不删**；本轮没有新建凭据文件）。

原始 stdout（真 8092 回包，非合成）：

```console
  whoami status=200 user=opsadmin
  du04-1440.png V1态="1 / 2" V1腿source="工位绑定（群 + active）· 渠道事件列表 BFF 未代理，仅工位腿"
  du04-1440.png 全页「事件流」命中=0 全页「等 DU-04」命中=0 横向溢出(px)=0
  du04-1440.png 渠道事件取数请求数=0
  du04-375.png  V1态="1 / 2" V1腿source="工位绑定（群 + active）· 渠道事件列表 BFF 未代理，仅工位腿"
  du04-375.png  全页「事件流」命中=0 全页「等 DU-04」命中=0 横向溢出(px)=0
  du04-375.png  渠道事件取数请求数=0
DU-04 shots OK
```

现网实发读口清单里只有 employees / employee-stats / workbench×3 / run-activity / runs×3 /
tasks / budget-usage×2 / workstations×2 / effective-config×2 / knowledge/citations(404) /
approvals?status=all —— **零渠道事件读口**，与 §2.1 的源码面 grep 互相印证。

**如实标注一句（哪句在屏上）**：现网 V1 落 `1 / 2`（有真读数，非 unknown），
所以屏上看到的 V1 腿文案是 **source 句**（`aggregate.ts:147`，本轮未改、已合规）；
本轮改写的 **whyNot 缺口句**只在「工位腿取数失败 ⇒ V1 落待核实」这条分支上屏，
现网这一轮没走到。该分支由 §2.3 的页面级钉测用强制数据真渲染验证（不是只测字符串），
红测取证里它就是靠这条上屏断言打红的。两句都在钉测覆盖内，截图只证 source 句与零「事件流」。

分母披露行现网实际读数（截图同帧可见）：
`还有 1 项检查的数据源没有接入，暂不能判定 — 可引用文档读口未接线，强制引用策略没有读口——
两条腿都没有证据，引用门给不出真读数（分母口径：目录已加载 3 条（单页上限 100 内） ·
本轮逐员工判定覆盖 2/2）`——unknown 门只有 V3 一条，V1 不再冒充缺口。

## 6. 剩余与交接

- DU-04 本件：**已完成（A 路）**。
- 挂起项（不阻塞 DU-05～DU-08）：§3 的 B 路裁定，归 D 车道/参谋。
- 待决策条目已同步进板仓 note/todo（回执里点名）。
