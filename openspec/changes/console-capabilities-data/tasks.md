# Tasks: console-capabilities-data

## 1. 已交付读口接线

- [x] 1.1 工具清单改读工具组真读口 `/api/tools/toolsets`
  （原 `/api/tools` 上游 404，被显示成空集）（提交 `0ef7c3de03`）
- [x] 1.2 模型目录改读 `/api/model/options`
  （原 `/api/models` 上游不存在）（提交 `4ebcf08c44`）
- [x] 1.3 模型目录按 `providers[]` 摊平上屏（实测 5 供应商 / 148 模型，读数以
  evidence 为准），价目改从同包 `providers[].pricing` 读取并剥金额符号；
  无随包价目判「未接线」不编行（提交 `550611de60`）
- [x] 1.4 MCP 等空清单的「真 0 / 加载失败 / 缺读口」三态分声明口径落地
  （技能与工具两页按骨架重做时确立）（提交 `98ae4863b9`）

## 2. 测试

- [x] 2.1 `web/src/modules/capabilities/panes.test.tsx` 随各提交更新：
  端点改名同步、providers 摊平行断言、价目同源解析、502/404 不画空表（随上列提交）
- [ ] 2.2 补行为用例：模型口 503 restart required 时断言页面呈现故障且
  目录计数不落 0（钉住「故障不伪装成空集」条款）

## 3. 提案链路接通（未完成，本 change 收口条件）

- [x] 3.1 BFF 的 `/api/skill-proposals` 已改指提案服务 8104 的
  `/v1/skill-proposals`（bff-v4-serve 提交 `f337ceae`，分支
  `lane/L7-r32-models-pricing`）：新增 `CONSOLE_SKILL_PROPOSALS_BASE`
  （默认 `http://127.0.0.1:8104`），列表/详情/approve|reject/建单四条路径统一
  经 `_route_base(spec)`；测前 8101 同路径回 404 `{"detail":"Not Found"}`，
  改后经 BFF 转发实测 200 `{"items":[],"nextCursor":null}`（8104 台账 sqlite
  `skill_proposal` 表 0 行=真 0，非读取失败）；受管 BFF 已 kickstart，
  启动 banner 自报 `proposals=http://127.0.0.1:8104`，匿名请求仍 401
  （鉴权门未被改动）。
- [ ] 3.2 提案服务当前是临时进程，需转 launchd 常驻（重启不丢）
- [x] 3.3 提案页接线：提案队列接台账真读数、计数核对；「提案差异」「准入线」
  两块随详情读口接通后上屏
  （提交 `1480fe10be`）：`web/src/modules/capabilities/SkillsPane.tsx` 的提案列按 8104
  真实回包投影——`proposalId`→行键、`name`→提案、`submittedBy.id`→提出人、
  `status` 码译中文（pending_review/approved/rejected/withdrawn → 待审/已批准/
  已驳回/已撤回，未知码原样上屏）；`kind`/`impact` 上游未回传 → 类型、影响两列
  整列不画，卡头「按影响面排序」改「按提交时间倒序」并按 `submittedAt` 倒序排
  （上游无影响面字段，不能假称按影响面）。计数核对：页头副行与卡底「N 条」同源
  取列表长度，空集计 0 并写「真零，不是加载失败」。用例：`panes.test.tsx` 新增
  「接通后按真值列行」「台账真零」两条，读 `vitest run` 14 passed；
  `npm run build` 成功。详情读口仍缺：8104 只挂 `POST/GET /v1/skill-proposals`
  与 `{id}/approve|reject`，无详情端点，「提案差异」「准入线」继续按缺读口
  如实声明（不画示例行）。9122 实机往返证据见 4.2。

## 4. 实机证据

- [x] 4.1 9122 构建上工具/模型两页真读数截图与回包对账
  （`docs/_artifacts/capabilities-parity/`，models-final-* 系列）
- [ ] 4.2 提案链路接通后补：台账行数与页面计数一致的一次往返证据

## 5. 收尾

- [ ] 5.1 归档本 change（`openspec archive console-capabilities-data`），
  把 `capabilities-data` 能力并入主 specs（可在提案链路接通后）
