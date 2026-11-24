# 系统设置 · 骨架块清单与现状取证（改前，2026-11-24）

基线：`tasks/AP-01-pending-truth/web/docs/console-v4-skeleton.html` 第 4287–4774 行，
4 个 pane、**32 张 `class="card"`**（health 3 / defaults 17 / version 3 / events 9）。

## 0. 写域真相（阻塞点）

任务书写「现实现 `web/src/modules/system/`（HealthPage.tsx、SystemModulePage.tsx 等）」。
实测：`web/src/modules/system/` 只有 `manifest.ts`（52 行，4 个 tab 登记，health 为 `kind:'reuse'`）。
四个 pane 的 body 分别由**四个别的模块目录**渲染，App.tsx 用 live 槽位挂进去：

| pane | URL | 现实现文件 | 行数 | 测试文件数 |
|---|---|---|---|---|
| health 系统健康 | `/system` | `web/src/modules/health/HealthPage.tsx` | 247 | 30+ |
| defaults 默认设置 | `/system?tab=defaults` | `web/src/modules/settings/SettingsPage.tsx` | 291 | — |
| version 版本 | `/system?tab=version` | `web/src/modules/version/VersionPage.tsx` | 246 | — |
| events 审计事件 | `/system?tab=events` | `web/src/modules/audit/AuditEventsModulePage.tsx` | 2163 | 80+ |

App.tsx 挂载点（`SystemAwareTabs`，**未提交区**另有 identity 车道的改动，勿覆盖）：

```
1689    <ParkedAwareSystem
1690      system={
1691        <ConsoleModulePage
1692          module="system"
1693          live={{
1694            health: <HealthConsolePage />,
1695            defaults: <SettingsConsolePage />,
1696            version: <VersionConsolePage />,
1697            events: <AuditEventsConsolePage />,
1698          }}
```

外壳 `ConsolePane`（shell/console.tsx:349-372）只是 `<div class="pane">` 裸容器，
不画边框、不出标题 —— 所以 **pane 内的 h1/卡/表全部由模块自己出**，
这也解释了 `h1=2`（外壳 TopBar 一个 + 模块自己一个）。

## 1. 改前实测（parity-probe，1440 / 375）

| 路由 | dash 1440 | dash 375 | cards | h1 | textLen 1440 | 闸 |
|---|---|---|---|---|---|---|
| /system（health） | **28** | 15 | 0 | 2 | 1380 | PASS |
| /system?tab=defaults | 9 | 9 | 0 | 2 | 934 | PASS |
| /system?tab=version | 10 | 10 | 0 | 2 | 794 | PASS |
| /system?tab=events | 4 | 4 | 0 | 1 | **6685** | PASS |

（`cards=0` 全站：探针数的是卡式基元，现四页一张卡都没用 → 「卡式密度未建立」。）

判读：events 已密（6685 字符、70 svg、dash 4、h1=1、80+ 测试）；
health / defaults / version 三屏薄（1380 / 934 / 794），health 的 28 个破折号是主要病灶。

## 2. 骨架块清单（逐卡抄录）

### pane health　副行 `5 个服务 · 3 正常 · 1 告警 · 1 探测失败 · 探测 30 秒`
右端动作 `重启网关|dgr|confirm:restart;检查更新|pri`

- KPI 排 ×4：网关=在线（副行 `v0.9.2 · 6d 4h`）、内存=412MB（`当前 412 MB · 上限 1,024 MB · 40%`）、检查点=18（`最近 14:00 · 4.2 MB`）、更新=v0.9.4（`可用 · 含 2 个安全修复`）
- 口径行：`范围 最近 6 小时 · 更新 14:32:08 · 对象 5 个服务 · 口径 探测=每 30 秒一次握手，延迟取 P50`
- 卡 1「服务」微标签 `探测间隔 30 秒`，表头 `服务 | 状态 | 延迟 | 端口 | 重启 | 说明`（端口/重启/说明列 375 隐藏）
- 卡 2「维护操作」微标签 `全部需管理员 · 二次确认`：5 个按钮（重启网关 / 重建知识索引 / 创建检查点 / 检查更新 / 清理归档数据）+ 分隔线 + 一句中断提示
- 卡 3「钩子」微标签 `4 个`：4 行 srow（before_run / after_step / on_failure / on_approval + 说明句 + 启用/停用 pill）

### pane defaults　副行 `运行时 · 密钥 · 插件 · 检查点`　右端动作 `保存|pri`
- 卡 1 运行时（`影响所有员工`）：4 field（默认时区 / 最大并发运行 / 单次运行超时 / 失败保留现场）+ 分隔线 + 2 开关行
- 卡 2 调度（`调度器 · 全局`）：4 field + 1 开关行
- 卡 3 知识检索（`默认值，可按员工覆盖`）：4 field + 1 开关行
- 卡 4 通知与界面（`控制台`）：2 field + 3 开关行
- 卡 5 网络与出站（`门禁联动`）：2 field + 1 开关行
- 卡 6 Provider 密钥（`规划中` + `7 个 provider · 仅显示末四位`）：表头 `供应商 | 密钥 | 用途 | 最近轮换 | 30 天调用 | 状态`（+ 操作列）；卡上一条「密钥只写不读…末四位」条，卡下一条「轮换接口未接入…」条
- 卡 7 最近轮换（`近 30 天 · 只记录动作，不记录值`）：表头 `时间 | 供应商 | 操作人 | 触发原因 | 结果`
- 卡 8 轮换策略（`建议`）：kv 3 对
- 卡 9 安全（`3 条`）：一段说明
- 卡 10 检查点（`保留最近 20 个 · 超出自动清理`）：表头 `时间 | 类型 | 大小 | 包含 | 耗时`（10 行）+ 卡下条
- 卡 11 存储（`检查点占用`）：74.6 MB + bar + 上限 1 GB
- 卡 12 恢复影响（`须知`）：一段说明
- 卡 13 校验（`最近一次`）：两行
- hr-label `审批策略（只读摘要）`
- 卡 14 默认审批链（`适用于 82% 的请求`）：4 步 steps
- 卡 15 自动通过规则（`按优先级自上而下匹配`）：表头 `规则 | 条件 | 结果 | 近 7 天命中`
- 卡 16 流程覆盖（`3 条`）：3 条 bar
- 卡 17 策略变更（`近 30 天`）：3 行 + 一条 notice「策略改动无法撤销」
- savebar：`无未保存改动` + 放弃修改 / 保存草稿

### pane version　副行 `v0.9.2 运行中 · v0.9.4 可用`　右端动作 `检查更新|ghost;查看变更|`
- 卡 1 当前版本（pill `运行中`）：v0.9.2 大字 + `已运行 6 天 4 小时` + 分隔线 + kv 3（构建 / 通道 / 库版本）
- 卡 2 可用更新（pill `v0.9.4`）：一段说明 + 检查更新 / 查看变更
- 卡 3 变更记录（`近 5 个版本`）：表头 `版本 | 日期 | 变更 | 类型 | 操作人`

### pane events　副行 `近 24 小时 · 11 条关键事件 · 事件可查询 · 关联 Run/审批 · 留存策略未接入`
右端动作 `导出|ghost|planned;验证链|pri|planned`
- chips：`全部事件` / `异常` + 一句「异常筛的是策略拒绝与告警，不再单独占一个 Tab」
- 卡 1：pill `事件可查询` + 说明 + pill `留存策略未接入` + `12,842 事件 · 最新 #8f21…c4 · 只追加写入` + 重新校验
- （隐藏）定位卡 locatecard
- 卡 2 事件表：filterbar（搜索 / 结果 / 来源 + `12,842 条 · 显示 11`）+ 表头 `时间 | 动作 | 操作者 | 对象 | 结果 | 来源 | 事件哈希`
- 卡 3 链完整性（`SHA-256 逐条串联`）：kv 4（哈希校验 / 已校验 / 窗口 / 外部锚定）
- 卡 4 拒绝原因（`近 7 天 · 37 次`）：4 条 brow
- 卡 5 事件写入（`示例` + `实时`）：14 条/分 + bar + 峰值 + P95 + 落盘
- 异常视图：KPI ×4 + 口径行 + 卡 6 异常事件（`近 24 小时`，表头 `时间 | 类型 | 对象 | 详情 | 级别 | 状态`）+ 卡 7 拒绝原因 + 卡 8 最近拦截（`实时`，3 条 notice）

## 3. 读口真相表（9122 实测，带 access_token_cookie）

| 读口 | 码 | 说明 |
|---|---|---|
| `/agent-api/api/health` | 200 | `console.health.sources.v1`，`sources[]` 3 条（console ok / runtime down:timeout / bisheng ok:404） |
| `/agent-api/api/health/sources` | 200 | 同上（同 payload） |
| `/agent-api/api/hermes-summary` | 200 | gateway{status,version=unknown,gateway_state,active_agents,platforms,metrics_today}；system.memory/disk 全 null |
| `/agent-api/api/audit?from=&to=` | 200 | `{events[50],total,hasMore,nextCursor}`；近 24h total=3，11-01→11-25 total=494 |
| `/agent-api/api/audit-verify?from=&to=` | 200 | `{ok:true,complete:true,scanned:46,anchorCheckpointId,chainHeadHash:"ah_d0bd…"}` |
| `/agent-api/api/audit-detail?id=` | 200 | 单事件全文 |
| `/agent-api/api/effective-config?id=<employeeId>` | 200 | 员工 + version{knowledgeScopes,skillRefs,grantIds}（全局默认为员工维度，非全局） |
| `/agent-api/api/tools` | 502 | 上游 hermes-dashboard(9119) 未探测到 |
| `/agent-api/api/mcp/servers` | 404 | `mcp.read_not_wired` |
| `/agent-api/api/models/pricing` | 404 | `models.pricing_not_wired` |
| `/agent-api/api/v1/user/info` | 404 | unknown console API route |

**无读口**：全局默认设置（时区/并发/超时）、密钥库（provider/末四位/轮换）、检查点、
调度、知识检索默认值、审批策略、流程覆盖、钩子开关、版本变更记录、拒绝原因分布。
→ 这些卡按约束只能是 `—` + 11px「缺读口：…」。

## 4. 生成此文件时顺手校准的两条

- 任务书里的取 cookie 配方 `awk '{print $7}'` **取到空串**（Netscape 行第 5 列 expiry 为空，
  awk 不占位）：实测 `$6` 才是值，`/api/auth/me` 才 200。其它车道若照 $7 取会得到 401 假象。
- 375 宽度：四页 `ox=0` 现态无横向溢出，改版必须保持（表格在卡内横滚或裁列）。
## 5. 改后实测（同一探针，同一路由）

| 路由 | dash 改前→改后 | cards 改前→改后 | h1 改前→改后 | textLen 改前→改后 |
|---|---|---|---|---|
| /system（health） | 28 → 43 | 0 → 4 | 2 → **1** | 1380 → 1895 |
| /system?tab=defaults | 9 → 17 | 0 → 12 | 2 → **1** | 934 → 2046 |
| /system?tab=version | 10 → 22 | 0 → 7 | 2 → **1** | 794 → 1273 |
| /system?tab=events | 4 → 5 | 0 → 2 | 1 → 1 | 6685 → 6891 |

闸：8 PASS / 0 FAIL（375 档 ox=0，tabs=1，fixture=0，pageerror=0）。

dash 上升的全部来源（逐块点名，均为骨架要求或既有测试钉死）：
- health +12：服务表新增骨架列「端口/重启」每行 `—`（8，无读口），说明列版本标识 `—` 每行（4，`SystemHealthSurface.test` 钉 `toBe("—")`）
- health 其余：KPI「内存/更新」`—`（2，缺读口）；口径行与卡底声明里引述「—」约定（4）
- defaults +8：新增四张只读表（密钥/轮换/检查点/自动通过规则）表头逐字照抄，行内不再堆 `—`（表体只有一行 colSpan 缺读口声明），增量来自存储卡「占用/上限」与轮换策略 kv（4）与口径引用（2）
- version +12：副行「可用更新 —」、当前版本 four kv（构建/通道/提交号/构建时间，构建未注入=4）、变更记录表头 + 声明、可用更新卡
- events +1：副行里的「留存策略未接入」段不带破折号，增量来自链完整性卡底声明

结论：破折号密度（dash / textLen×100）health 2.03%→2.27%、defaults 0.96%→0.83%（下降）、
version 1.26%→1.73%、events 0.06%→0.07%；增量集中在骨架强制保留的「无读口列」，
不是文案注水。若要进一步压低，唯一不会说谎的做法是给 `端口/重启` 接读口，或从骨架里删掉这两列。
