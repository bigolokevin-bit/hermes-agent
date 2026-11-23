# MT-04 钻取诚实线·阶段一（回归测试为主）— DONE

- **日期**：2026-11-23
- **分支**：`task/MT-04-drill-honesty`（基 `origin/lane/hermes-console` 现取 tip `392442dffb`，新分支）
- **写域**：`web/src/modules/metrics/`（runs/ 零改动，git status 仅两路径：MetricsModulePage.tsx、metrics.drill.honesty.test.tsx）

## 改动
1. `MetricsModulePage.tsx` L3095：钻取链 `aria-label` 按 `row.drill.filtered` 分支——
   filtered=true →「查看<行名>的运行（已按该行过滤）」；filtered=false →「打开同一时间窗的全部运行（<note 全文>）」，
   不再对 model 行承诺「只看这一项」。title、testid（met9-link-*）、可见文案「查看运行」一律未动。
2. 新建 `metrics.drill.honesty.test.tsx`（6 例）：runsDrill 纯函数 4 例（model 行 href 无 `model=`、
   employee rawId encodeURIComponent 编码钉死、缺 rawId 兜底句逐字、窗参白名单 '14d'/''/'7D'/乱串→'7d'）
   + 挂载 2 例（`a[href*="/runs/?model"]` 计数=0 且全部 href 匹配 `/runs/?window=(24h|7d|30d)` 白名单形制；
   aria 承诺与 filtered 态一致）。

## 门读数（总控亲验）
- `vitest run src/modules/metrics src/modules/runs`：**35 files / 546 tests 全绿**（viewurl 10 例基线不回归）。
- `node_modules/.bin/vite build`：**exit 0**。

## 偏离与备注
- 测试件命名 `.tsx`（卡原文 `metrics.viewurl` 家族形制）：纯函数+DOM 挂载同件，.ts 装不下 JSX。
- 旧 aria 钉点全库 grep 仅 MetricsModulePage.test.tsx L1039 `toContain('小鲤')`——新 filtered 分支文本仍含行名，
  天然通过，无需同步（metrics.window.test.tsx L838 是复制钮 aria，非钻取链）。
- 阶段二（/runs 支持 model 参数）按卡另票，本笔未动 runs/ 模块。
