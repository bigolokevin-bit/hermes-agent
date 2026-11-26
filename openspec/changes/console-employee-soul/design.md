# Design: 两层人格的归属与写回时机

## 运行时事实（读代码取证，不是推断）

| 槽位 | 位置 | 语义 | 叠加还是替换 |
|---|---|---|---|
| 身份 | `<profile>/SOUL.md` | 「我是谁」 | **替换**默认身份：有 SOUL 就不再用 `DEFAULT_AGENT_IDENTITY`（`agent/system_prompt.py` `_identity_parts`） |
| 补充层 | `<profile>/config.yaml` → `agent.system_prompt` | 「额外要记住的」 | **叠加**：调用时 `system + "\n\n" + overlay`（`agent/turn_context.py`、`agent/conversation_loop.py`） |
| 行为约束 | `_guidance_parts()` | 任务完成、工具使用、执行指导 | 独立层，与身份无关 |

结论：换 SOUL 不影响 runtime 能力；叠加层保留但内容必须换成这位员工自己的，否则两处身份打架。

## 谁来写、什么时候写

- **建档**：新建员工 2xx 之后立即 `POST /api/profiles`（`clone_from_default` 只借模型/凭据，
  `soul` 用本人员工档案生成），随后 `PUT /api/config?profile=` 写叠加层。刻意不 await：
  不能拖慢「创建 → 重读确认」主链；失败由打开对话时兜底重试。
- **打开对话**：先读 `GET /api/profiles` 判断该档是否存在；存在则读 `SOUL.md` 比对：
  - 空 或 带受管标记 或 描述含「控制台自动创建」→ 归控制台管，可改写；
  - 非空且无标记且非控制台建档 → 用户自己的档，一字不改，直接可用。
- **幂等**：叠加层对控制台档每次打开都写一次（PUT 深合并，内容相同即无副作用）。
  只在校正 SOUL 时写是不够的——已校正过的档可能还留着上一位员工的组织说明（实测确实如此）。

## 受管标记

`SOUL.md` 首行写 `<!-- sekoi:employee-profile：… -->`，叠加层写 `<!-- sekoi:employee-overlay：… -->`。
标记的作用是「可以让控制台改写」的许可，而不是版权声明；用户删掉标记即接管该文件。

## 素材来源与 fail-closed

读 `GET /api/employees/<id>`（姓名/岗位/部门）与 `GET /api/employee-versions?id=` 的生效最新版
（`jobDescription`、`responsePolicy.triggers/mode`、`versionNo`、`effectiveFrom`）。
缺姓名/岗位/含职责的版本 → 抛错、不建档、界面写明原因。宁可没有独立档，也不要「长得像某个人」。

权威渲染器仍是 `l2-dataplane/ops/render_employee_prompt.py`；本仓前端只做控制台需要的那一份，
两者若分叉以 python 为准。

## 已知边界

- 网关切到旧配置：改完叠加层后，已存在的会话可能还带旧值；以新会话为准。
- `versionNo` 在回包里是数字（实测 `1`），不是字符串——按字符串读会永远空着版本行。
