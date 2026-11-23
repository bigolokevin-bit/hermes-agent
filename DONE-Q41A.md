# DONE — Q41a 前端消费 identity-links/transitions 接线

- 板号：Q41a（L0 07:2x 勘误定名，Q41b=lane-digest 异号同号已分称）
- 分支：task/Q41a-identity-wiring；基线 fork lane/hermes-console 现读 `85d395c197df7b55510261706ff1fcf62cb15f4a`（当拍 ls-remote 定向）
- 写域：web/src（5 文件）

## 改了什么

| 文件 | ± | 内容 |
|---|---|---|
| web/src/modules/employees/detail/notWiredLeg.tsx | +110 | 共用「诚实未接探测」读腿：真 GET → 501 族→notWired（code/message/rid 全取服务端信封）/200→真行+防串护栏（rowOwner 放行无归属键行）/其余→error；NotWiredBlock 三态分离呈现；禁造假 200 |
| web/src/modules/employees/detail/IdentityPane.tsx | 30→95 行 | 静态占位换活腿 GET `/agent-api/api/identity-links?employeeId=`；testid `emp-detail-identity-not-wired/-empty/-rows/-error` 保留与新增；状态词表冻结 active/stale/revoked=生效中/已过期（不自动删）/已撤销 |
| web/src/modules/employees/detail/OverviewPane.tsx | FluxCard 活腿 | GET `/agent-api/api/employees/<enc>/transitions`；`emp-detail-flux-not-wired` testid 沿用；ErrorStateBlock 带 onRetry |
| web/src/pages/EmployeeDetailPage.tsx | 1 行 | IdentityPane 传 rawId/enc |
| web/src/modules/employees/employees.identity-wiring.test.tsx | +176 | 9 例契约：接线证明（精确 URL 实发）/501→未接入含 code+请求号位/200 真形渲染/200 空≠未接入/防串整块错误/500 不伪装未接入——两读腿 |

- 既有 employees.detail.zones.test.tsx 两处断言按活腿契约同步（静态「GAP/PE-04」文案 → 服务端 code 逐字；测试名注 Q41a）

## 上游契约出处（勿信记忆，皆现读）

- H 仓 main server.py：`IDENTITY_LINKS_GET_SPEC = {"not_wired": ("identity.not_wired", …)}`、`EMPLOYEE_TRANSITIONS_NOT_WIRED = ("employee_transitions.not_wired", 仅有 POST 写口…)`——两 GET 恒 501，域读口落地+BFF 删键后本接线零改动自动变真数据
- 板 people.md L56-61：identity-links GET 恒 501、前端零入口（全库 grep 仅 BFF/测试）→ 本票即「前端入口」补齐；transitions 读侧亦 501

## 验证（node26 = ~/.nvm/versions/node/v26.13.1/bin/node）

- `tsc -b . --force --noEmit` exit 0（apps/shared 假红=5 工作区软链补齐后消）
- vitest 全量 **542 files / 4175 passed / 1 skipped / 0 fail**（脸基线 541/4166+1skip，+1f/+9p=本票新约，零回退）
- 点名：employees.identity-wiring 9/9 绿 + employees.detail.zones 18/18 绿
- select 渲染点=0（1 注释级）；本票零内联样式、零滚动条声明（三棘轮在全量内绿）
- 未起 serve（served 腿归 QA）；未跑 build（tsc+vitest 双闸已覆盖，产物代次归章笔跟跑）

## 纪律自证

- 无 --no-verify、无 force、无 add -A；commit 经 lefthook（just 在 PATH）
- 只推 task/Q41a-identity-wiring，不 merge、不 push main
- worktree=/Users/kevin_studio/Projects/tasks/Q41a-web-identity（tasks 路径+板 lanes.yaml 自登；收工 remove 回收保分支）
- 数字人设：本文不含 push sha（本文件所在 commit 不可内嵌自身 sha，回读见会话回执）
