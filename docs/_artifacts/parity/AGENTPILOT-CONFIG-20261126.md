# Agent 配置面：agent-pilot 对照与缺口（2026-11-26）

盘点方式：直接读 agent-pilot 源码（不经子代理转述），逐条给出文件行号。
我方基线取 `web/src/modules/employee-detail/EmployeeDetailModulePage.tsx`（九分类配置面）。

---

## 一、agent-pilot 的配置面是怎么组织的

### 1. 四个写入目标（白名单外一律拒）
`backend/core/actions/platform.py:48-55`

```python
AGENT_CONFIG_TARGETS = ("profile", "prompt", "dify_config", "role_profile")
AGENT_CONFIG_FIELDS = {
    "profile": ("access_mode","allowed_open_ids","display_name","note",
                "owner_open_id","persona"),
    "prompt": ("prompt",),
    "dify_config": ("display_name","model","temperature"),
    "role_profile": ("draft",),
}
```

### 2. 一次白名单两次拦截
- 提案时：`_config_field_check(target, changes)` → 400 `config_field_invalid`
- 生效时：`_apply_agent_config` 再查一次 → `effect=config_field_invalid`
（`platform.py:527-535`、`:973-995`；注释明写「不靠单点，防止绕过入口直接建审批行」）

### 3. 版本快照 + 回滚
- 每次真写前把旧值存 `agent_config_versions(tenant,agent,target,version_no,...)`
  `routers/agents.py:1422-1455`
- 读版本：`GET .../config-versions`（`:2194`）
- 回滚：`POST .../config-rollback/{version_id}`（`:2235`），回滚本身也走 `_write_agent_config`，origin=`rollback`

### 4. 来源可追溯（contextvar，不覆盖）
`routers/agents.py:1403-1413`：`direct`（HTTP 直写）/ `config_proposal`（带 approval_id）/ `rollback`。
回滚链路已先设标记时不覆盖 —— 避免「回滚被记成提案生效」。

### 5. 提案 → 审批 → 生效三态
`platform.py:974-1000`：`config_applied` / `not_permitted` / `config_field_invalid`，
另加 `payload_invalid` / `config_target_invalid`。一律不抛异常，返回结构化结果。

### 6. 审计只记字段名，不记正文
`platform.py:936-955`：只写 `target` + `changed_fields`，注释「提示词可能是整段」。
理由：提示词正文进审计库等于二次泄露。

### 7. 限额常量
`SUMMARY_MAX=200`、`CHANGES_MAX=20000`（与 dify-prompt 的上限同口径）。

---

## 二、agent-pilot 配置页的 UI 结构（可直接借）

`portal/src/views/AgentConfigView.vue`（482 行，嵌进详情页「配置中心」页签）

| 结构 | 做法 | 行号 |
|---|---|---|
| 二级锚点导航 | `section id=agent-config-{identity,model,knowledge,access,governance,effective}` + `scroll-mt` | 315/345/378/393/408/450 |
| 嵌入模式不重复页头 | 页头让位给配置中心二级导航；保存改成 **常驻条贴在内容最上面** | 32、287-301 |
| 三层保存态 | `saving / saved(含 revision) / syncing / failed`，返回文案四种 | 169-185 |
| 保存后的下一步强制披露 | 「平台配置已保存；Dify 侧的名称、模型、温度要用『Dify 写回』卡单独写回」 | 184 |
| 平台侧 vs 上游侧分离 | 运行参数区标题写「只读 · 来自 Dify 应用侧」 | 347 |
| 未保存编辑保护 | 状态轮询只更新 profile 事实，**不回填表单** | 218 |
| 访问三态卡片 | 仅负责人 / 白名单（≤50）/ 不限制，每项带一句说明 | 72-74、397 |
| 白名单计数 | `{{ allowlist.length }} / 50`，满 50 禁用输入 | 399 |
| 负责人选择 | open_id 输入 + 人员姓名/ID 搜索（不手抄 open_id） | 398 |
| 权限收窄语义 | 「配置只能收窄访问范围，不能扩大环境白名单」 | 396 |
| 只读能力披露 | 飞书通道：App ID / Secret 掩码 / Token 有效期 / 机器人 / 平台已接执行点 | 403 |

---

## 三、我方现状（九分类，`EmployeeDetailModulePage.tsx:577-585`）

| 分区 | 现状 | 证据 |
|---|---|---|
| 身份与组织 | 三个字段可改（姓名/岗位/责任人），有 PATCH | `employeeEdits.ts` |
| 生命周期 | 六态可切，带交接对象选择 | `:1213` |
| 权限与授权 | grants 可增可撒；有效配置披露版本/快照/解析时刻/证据项数 | `:1350-1353` |
| 能力与技能 | 矩阵行 skillCount/skillRefs（真 0 与缺值分离） | `:1703-1704` |
| 工具与 MCP | 26 toolset / 0 MCP，只读 | 盘点基线 |
| 预算与成本 | 账期/实扣/token/预留/asOf，缺行不作 0 | `:1871-1881` |
| 版本与变更 | 发布版本可发（已到 v6），但**不是配置版本快照** | 盘点基线 |
| 知识与范围 | 知识空间 3 + 文档数，只读 | 盘点基线 |
| 模型与提示词 | **零读口**，页面如实写「本代次没有按员工的只读读口」 | `:2375-2380` |

---

## 四、差距矩阵（按管理员价值排序）

| # | 项 | agent-pilot | 我方 | 缺什么 | 最小代价 |
|---|---|---|---|---|---|
| 1 | 提示词可见可改 | `prompt` target 白名单 | 无读口 | 域侧不返回 prompt | **BFF + 域服务**：先只做读，能读再谈写 |
| 2 | 模型参数 | `dify_config.model/temperature` | 无 | 同上 | BFF 读口，只读起步 |
| 3 | 配置版本回滚 | `agent_config_versions` + rollback 端点 | 只有「发布版本」 | 写前快照表 + 回滚动作 | **BFF + 表**：每次 PATCH 前存旧值，配置页给「回滚到 vN」 |
| 4 | 字段白名单双拦 | 提案层 + 生效层各拦一次 | `employeeEdits.ts` 前端校验 | 服务端白名单 | BFF：逐 target 字段白名单，未知键 400 |
| 5 | 保存态四分 | saving/saved/syncing/failed + 下一步口径 | 保存后 toast | 状态机与「未写回」披露 | **纯前端**：本节最高性价比 |
| 6 | 访问收窄三态 | owner/allowlist/anyone + 50 上限 | grants 只能撒 | 「收窄」语义 + 计数 | 前端可先做，生效需 BFF |
| 7 | 只读来源标注 | 「只读 · 来自 Dify 应用侧」 | 部分有，部分笼统 | 逐块标来源与时刻 | 纯前端 |
| 8 | 未保存编辑保护 | 轮询不回填表单 | 未验证 | dirty 保护 | 纯前端 |
| 9 | 审计只记字段名 | 明写不记正文 | 未核对 | 核对 BFF 审计写入口 | 审计（S） |
| 10 | 提案走审批 | config_proposal → 审批 → apply | 审批页有，配置页无提案入口 | 提案按钮 + 审批类型 | BFF + 前端（L） |

**我方比它强的一处**：生效配置的事实披露（版本 / 快照 ref / resolvedAt / evidence 计数）比 agent-pilot 更完整 —— 不要为了「对齐」把它做薄。

---

## 五、明确不抄

1. **不抄 Dify 双写模型**。它的「平台保存 + Dify 写回」两段式是因为配置真身在上游 Dify；我们没有这个上游，硬抄会造出一个假的「写回」按钮。
2. **不抄 open_id 手输**。它保留手输是给无人员目录的租户兜底；我们有人员目录，一律走人员选择器。
3. **不抄 20000 字提示词上限**。定上限要按我们的模型上下文与存储口径单独定，不继承别人的常量。
4. **不抄「配置中心」嵌入双壳**（独立页 + 页签两套壳）。我们详情页只有一套外壳，重复壳正是当前 tab 叠层的病根。

---

## 六、立即执行（纯前端三项，先拿到手感与一致性）

- A. 保存态四分 + 「已保存 · 已发布 vN」/「仅平台配置已保存」下一步口径。
- B. 逐块只读来源标注（来源系统 + 采集时刻）；缺读口的块保持现在的如实说明，不铺假值。
- C. 未保存编辑保护：状态轮询不回填表单，离开分区提示未保存。

配置版本快照（#3）与字段白名单（#4）需要 BFF + 表，排在读口（#1/#2）之后。
