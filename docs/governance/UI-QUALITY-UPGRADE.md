# WebUI 品质升级 — 车道口径（UI-QUALITY-UPGRADE）

日期: 2026-11-20 · 分支: lane/console-ui2

## 用户判定（原话）
「现在连基本 UI 框架都差得远、bug 多、还不如最初的预览 HTML。」
基准件（最初的预览 HTML）= `web/docs/console-v4-skeleton.html`。

## 车道分工与门禁
- **A 车道（UI-KD tokens 冻结）**：UI-KD 令牌/设计 tokens 冻结前，B/C 只交纸面表，**不动视觉、不动代码**。
- **B 分包 1（本口径首笔）**：值班台(duty) + 员工列表/详情(employees) 各一张「参考 HTML 功能 parity 表」——
  逐项对勾 9 项：**筛选 / 排序 / 分页 / 批量 / 深链 / 空态 / 错误 / 加载 / 键盘**；缺项点名并给严重度。
  - 严重度：P0 = 参考 HTML 有、现行完全没有或明显回归；P1 = 功能残缺/行为不一致；P2 = 细节差异。
  - 落点：`docs/governance/parity/B1-duty.parity.md`、`docs/governance/parity/B1-employees.parity.md`。
  - 性质：只读取证（纸面活）。**表交后**方可排期动 `web/src/modules/{duty,employees}/**`，且视觉部分必须等 A 冻结。
- **B 分包 2**：audit-status（审批/审计）项归此车，与审批/审计同车处理，不在 B1 表内。
- 取证纪律：每条证据必须 file:line 实核（grep/ls 实际跑过）；严禁编造路径/行号/sha；引用失败先 re-grep 修正或删条。

## 进度
- [x] 口径落地（本文件）
- [ ] B1 duty 表（车道执行中）
- [ ] B1 employees 表（车道执行中）
- [ ] 表交付 → 缺项修复排期（A 冻结后视觉项才可动）
