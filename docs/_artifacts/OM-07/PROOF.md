# OM-07 最近活动三行与钻取 — PROOF

分支 `task/OM-07`，叠于 OM-06（`925e2ab885`，链 OM-01→03→04→05→06）。
改动：`OverviewPage.tsx`（RecentActivity 两处）、新增 `overview.activity.test.tsx`（6 例）。

## 实现裁定

1. **状态四词表封闭**：徽标文本只出 成功/失败/运行中/—。原兜底 `run.status ?? '—'`
   会把上游任意原值（如 `cancelled`）印进徽标 —— 已改为词表外一律「—」，
   原值落徽标 `title=「上游状态：<raw>」` 供核对（不吞信息、不扩词表）。
2. **「全部运行」带窗参**：`/runs?window=7d`，与卡数据腿同窗
   （`fetchRuns(3, w7.from)`；runs 页实读参数 `window|status|state|run|employee`，
   窗值形制 `24h|7d|30d`，见 metrics.ts runsDrill 注释）。
3. **读 3 显 3 单源**：三条 `/runs` 腿（today/recent/failed）全部 `limit=3`
   （useDutyData.ts:125-127），页内 `slice(0, 3)` 与读口上限一致；测试同时钉 URL `limit=3`
   与行数 ≤3（stub 回 9 行也只显 3）。
4. 空态文案维持精确「近 7 天没有运行记录。」+ 导 `/employees`；错误态 rid + 重试钮沿用。

## 门禁

- `vitest run src/modules/overview` → **42 passed**（36 + 6 新增）
- 宽面（overview+duty+shell，预构建）→ **312 passed | 1 skipped**（skip=e1Contract 环境腿）
- `lint-fake-success.mjs` → `ok:true, violations:[]`
- `vite build` → exit 0（构建后 e1Contract 翻红 = 环境红，判环境不判 diff）

## 现网脸实证（本地 dist 9183 代理 9122，jar 会话）

- AUTH employee-stats 200 total=3
- 最近活动卡：`ov6-activity-row` = 3，行 href 均 `/runs/rn_01M…` 真 run 钻取；
  「全部运行」href = `/runs?window=7d` ✓；截图 `overview-activity-1440.png`。
- 注：现网近 7 天有真运行记录，空态分支由测试夹具钉（文本精确匹配断言）。

## 待 L0 回写

deep 文档活动条款可加：「状态词表封闭四值，未知原值仅入 title；全部运行钻取携 window=7d」（供移植）。
