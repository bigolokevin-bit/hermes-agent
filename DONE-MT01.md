# DONE-MT01 · 价目读口诚实化（GAP-MET6-01 前端半边）

- 卡源：seakoi-agent-os `docs/product/backlogs/metrics-detail.md` MT-01（用户令：MT-01 起串行）。
- 基线自证：`task/MT-01-pricing-gap` 建自 `git worktree add -b … 90a80aee6c`（origin/lane/hermes-console 现取读数）；
  `git diff --stat 648233693d 90a80aee6c -- web/src/modules/metrics/` = 空 ⇒ 模块零漂移。
- 车道登记：task-lanes.json MT-01 add（branch task/MT-01-pricing-gap，write_scope `web/src/modules/metrics/`）。

## 交付内容（fixer 实现 + 总控独立验证）
1. **metrics.ts `pricingFailure(error)`**：ApiError 且 status∈{403,404,501,503} → 诚实句
   「标价未接：上游价目数据源还没有接入（…）」+ gap=USAGE_GAP(`GAP-MET6-01`)；
   body 可解析且 `code==='models.pricing_not_wired'` 时句尾带 code 名，其余 code 回落通用归一；
   其它状态返回 null，由调用处回落 `blockFailure`（其余腿文案零改动，有哨兵测试钉住）。
2. **MetricsModulePage.tsx**：`readBlock` 加可选第三参 `onError`（仅 pricing 腿传 pricingFailure）；
   明细表「标价」列：仅 `view==='model'` 且 pricing ready 且 rows>0 时出现（th testid
   `metO-fmt-th-price`），行格按 modelId（label 兜底）原样相等匹配 → `formatUnitPrice`，缺价「—」；
   tfoot `metT-detail-total-price` 硬钉「—」（合计永不读标价列；无任何 标价×用量 计算，卡④）。
3. **新测试 `metrics.pricing.gap.test.tsx`（6 例共置）**：not_wired-404 / unknown_route-404 / 503 同句
   + GAP title + 采集时刻「—」+ DOM 无裸 404 文案；标价列出现/缺价「—」/支出格与合计逐行与 pricing
   缺席时 byte-equal（不反推）；rows=[] 无列且「价目表为空」态不变；stats 腿原句漂移哨兵。
4. `MetricsModulePage.test.tsx` 两处旧 pricing-404 句断言按 spec 改钉新句（其余哨兵未动）。

## 门读数（原始输出摘录）
- `node_modules/.bin/vitest run src/modules/metrics` → **Test Files 17 passed (17) / Tests 321 passed (321)**（含新 6 例与 empty.error 家族，硬门二全绿）。
- `cd web && node_modules/.bin/vite build` → exit 0（产物 `hermes_cli/web_dist/index.html` mtime 21:43:25 复核）。
- tsc：49 项错误全部在 apps/shared 既有基线（delta 口径，metrics 侧 0 新增）。

## DoD 对照
- not_wired 信封 → 屏显诚实句 + `met6-price-gap` title=GAP-MET6-01，无裸 404 文案 ✓（测试①②③）。
- 「estimated/推算」字样：页内命中仅注释/既有口径句 ✓。
- 标价列仅 ready 时出现、缺值行内「—」✓；标价×用量不出现在任何金额节点 ✓（合计硬钉「—」）。
- BFF 半边 **不在本车道重抄**：现网 8092 已回 `models.pricing_not_wired` 404 JSON（实现位于未并 main 的
  `lane/L7-r32-models-pricing@603a23e9`），DoD curl 判据现网已过；L0 处置并线，backlog 勾选已注记。

## 偏离/说明
1. 旧同名尝试 `task/MT-01@7478588021`（基 a0204cb03f 陈旧线脸，已推远端）仅含失败归一半边、无标价列；
   本分支按登记车道交付全 spec，旧笔不并（留 L0 裁决弃用）。
2. exportCsv 为逐字段构造、不遍历表列 ⇒ CSV 天然不含标价列，spec「显式跳过」条款空转，未加冗余代码。
3. GAP 号沿本页既有 met6-gap 形制只进 title tooltip（UI-B 现状，由 MetricsModulePage.test.tsx 钉住），
   可见文案不含编号字样。
