# /overview 改吃 workbench 读模型（2026-11-20）

## 变动的四个读口（BFF 已上线，`a7bccdf`）
| 卡片 | 旧来源 | 新来源 |
|---|---|---|
| 今日运行（统计） | `GET /api/run-stats?from&to` | `GET /api/workbench/summary?range=1d`（KPI `runs`/`failed`/`costUsd`） |
| 近 14 天运行（趋势） | `GET /api/run-stats` 14d 窗口 | `GET /api/workbench/timeseries?range=14d&bucket=day&metric=runs` |
| 待我处理（计数 + 行） | `GET /api/approval-stats` + `GET /api/approvals` | `GET /api/workbench/queue?page_size=100`（一次取数，两张卡同源） |

未动：员工目录、员工统计、24 小时活跃热力（`/run-activity`）、成本账本（`/budget-usage`）、最近运行（`/runs`）、阻塞（`/tasks`）、能力矩阵（仍走 `/matrix` 的未接入态）。

## 口径
- `asOf` 只取响应顶层 ISO-8601（带时区）→ 北京时间到分；缺失或非法显示「—」，`title` 说明，绝不拿本机时钟顶上。
- 缺数字留 `null` → 「—」；`summary` 没有 succeeded/running，不补、不按 0 记。
- `queue` 源不可用时 BFF 返回 200 + `available:false`：计数为 `undefined`（「—」）并透传 reason，不当成空队列。
- `timeseries` 的 `point.value` 为 null 的桶被丢弃，不参与求和；`totals.value` 优先。
- 单口失败只让对应卡片进错误/GAP 态，其余卡片照常（局部可用），不整页白屏。

## 证据
- `vitest run src/modules/duty` → 3 files / 54 passed。
- 全量 `vitest run` → 147 files / 1928 passed（本刀前 1926）。
- `tsc -b . --noEmit` → 本域 0 条（全仓既存基线不变）。
- build `vite build --outDir /tmp/build-ovwb` → EXIT 0；entry `assets/index-De_nG8ln.js` sha256 `46aabeb84ac00b5bd83fcf6552d8ca5ca2e933af66c0c87661d46c31164a0bee`；entry 内 `summary?range=` 命中 0；本页 chunk `assets/DutyPage-CKqhFx4d.js`：`summary?range=`=1、`/agent-api/api/workbench`=1。
- 测试断言：`/run-stats`、`/approval-stats`、`/approvals` 不再被请求；`/workbench/queue` 恰 1 次；`ov6-asof` 显示 workbench `asOf` 的北京时间；`timeseries` 404 时趋势卡「—」而今日运行仍显示 2。

## 未测项
- 四口 200 实例体未在浏览器实测（cookie 已过期，仅按 BFF 源码形状消费；未登录裸打为 401 + rid，证明路由在线）。
- 真实 BFF 局部 `available:false` 与 `degraded` 文案上屏未走查。
- 375/1440 视觉未实机复核（沿用既有栅格与 ov6-* testid 未改）。
## 复用令 B 第二步：剩余区块去 fixture 盘点（2026-11-20）

`git grep -n "fixture|FIXTURE" web/src/modules/duty` + `useDutyData.ts` 现查，六个区块的真实来源：

| 区块 | 当前数据来源 | 定性 |
| --- | --- | --- |
| 员工概览 / 可上岗 | `/api/employees?limit=100` + `/api/employee-stats` | 真数据（BFF 路由 319/425 行） |
| 24 小时活跃热力 | `/api/run-activity?weeks=1&tz=Asia/Shanghai` | 真数据（457 行） |
| 账本（今日成本 / 月累计） | `/api/budget-usage?employeeId=…&periodKind=day|month` | 真数据（464 行） |
| 最近运行 / 失败运行 | `/api/runs?since=…&limit=3[&status=failed]` | 真数据（406 行） |
| 阻塞任务 | `/api/tasks?status=blocked&limit=3` | 真数据（383 行） |
| 矩阵 | `/api/matrix?limit=50` → 域 `/v1/matrix/employees` | 真数据路由已在（server.py 552 行）；`MatrixView` 未挂到 `/overview`，仅由 `modules/duty/index.ts` 导出给测试 |

结论与改动：
- 前五块本波已吃真读口，无需换源；`?state=` 变量名里的 `fixture` 只是复现腿的旧命名，不产生数据。
- 矩阵的 `MATRIX_FIXTURE` 样例行从未被渲染（`MatrixView` 的 404 分支是「未接入」卡，不回落到样例），已删除该常量与 barrel 导出，文件保留 normaliser + `CAP_RESOURCES` 目录；文件头注释改为「无样例行」。
- GAP-06 文案纠正：BFF 转发路由已部署，未接入指的是上游 `/v1/matrix/employees`；`matrix-unwired` 卡 title 与正文同步改写，并新增测试断言「无 `data-fixture` 属性、正文不出现样例」。
- 闸门 V1/V2/V3 仍是 unknown（无读口，按设计不给假值），V6 为负责人推断——不属于夹具。

验证（本单）：`vitest run src/modules/duty` 3 files / 54 passed；全量 147 files / 1928 passed；tsc 本域 0；eslint 0 error / 3 既有 warning；build 见回执（`ov6-asof` entry 0、DutyPage chunk 1）。
