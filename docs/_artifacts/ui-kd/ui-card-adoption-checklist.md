# UiCard 槽位契约与页面接线清单（UI-TOKENS 车道）

出处：`web/src/components/ui/Card.tsx`（基元）＋`web/src/components/ui/ui.css` 的 `.ui-card*` / `.ui-card-row*` 块
＋契约钉测 `web/src/components/ui/Card.slots.test.tsx`（`vitest run src/components` 内）。
本清单给**页面车道**用；本车道不碰 `web/src/modules/**`，所以不做接线、不代拍页面截图。

## 一、槽位（只有这六个，顺序固定）
| 槽 | data 属性 | 放什么 | 不放什么 |
|---|---|---|---|
| head | `data-ui-card-slot="head"` | 标题（`--font-size-ls-3` 500） | 图标堆、二级标题 |
| subtitle | `="subtitle"` | 一行限定语（`-ls-1` muted） | 说明句（走 InfoHint） |
| metric | `="metric"` | **一个**主数字（`-ls-6`=24px，`--tabular-ls`）+ 标签 | 第二、第三个数字（去 `UiCardRow` 另起卡） |
| note | `="note"` | 一句状态（两行截断） | 长段解释、口径句 |
| body | `="body"` | 固定结构（进度条/状态点等），`overflow:hidden` | 列表、表格、筛选控件、明细行 |
| foot | `="foot"` | **唯一出口**：`查看明细`/`查看全部` 深链（≥32px 触点，手机档 44px 字面值） | 按钮堆、重试+刷新+导出并排 |

缺槽不渲染空节点；`foot` 恒在场（明细永远有路可走）。

## 二、等高与「不随内容变高」的唯一实现源
```
.ui-card-row            display:grid; align-items:stretch; gap:var(--space-ls-4)
.ui-card-row[data-cols] grid-template-columns:repeat(N,minmax(0,1fr))
.ui-card                display:flex; flex-direction:column; gap:var(--space-ls-2)
.ui-card > .ui-card-bd  flex:1 1 auto
.ui-card-foot           margin-block-start:auto      /* 底部对齐 ⇒ 同排高差 ≤1px */
```
三条都是**契约断言**（负控实测：把 `margin-block-start` 改成 `0` ⇒ `Card.slots.test.tsx` 立刻红，
`AssertionError: expected '.ui-card-foot {…' to match /margin-block-start:\s*auto/`，1 failed | 3 passed）。
页面侧**不要**再自己写 `min-height`、`align-self`、`items-stretch` 竞争，也不要给卡片补固定高度——
用户直令的规格是「高度由最高卡内容决定并统一」，这句在本基元里就是上面四行。

## 三、接线自检清单（页面车道每改一卡逐条打勾）
1. 三卡同一 `UiCardRow cols={3}`，`boundingRect.height` 差 ≤1px（DOM 断言，别用 CSS 目测）。
2. 卡内**无**列表/筛选/表格类子节点（正则面：`.duty-gates`、`.duty-list`、`.duty-ranges` 之类残留＝FAIL）。
3. 每卡恰一个 `foot` 且是链接或按钮；被截断的明细全部能从它到达（抽屉或审计页）。
4. 主数字只有一个，`font-variant-numeric: tabular-nums` 生效；数字缺值给「—」，**禁假 0**。
5. 屏面可见文本正则 `emp_|ce_|ob_|http|rid|correlation` 与 `口径|说明[:：]|注[:：]` 命中＝0
   （解释文字只走 `InfoHint term=...`，文本来自 `ui/glossary.ts` 全局唯一份）。
6. 1440 档卡内不留 >24px 空白块；375 档单列不横溢、触点 ≥44px。
7. 三态齐：加载＝同尺寸骨架；空＝一句人话 + 出口；错误＝人话 + 重试，不显示假数据。

## 四、可复跑命令（本车道已跑绿）
```
cd /Users/kevin_studio/Projects/forks/console-design/web && node_modules/.bin/vitest run src/components
→ Test Files 15 passed (15); Tests 103 passed (103)
  （逐文件构成：token-source 4 + StateBlock.internalid 4 + inline-style-ratchet 5
    + Tabs.keyboard 5 + scrollbar-utility 4 + Card.slots 5 + InfoHint 3 + 其余组件腿）
node_modules/.bin/vite build → rc=0（我的 dist，未部署；9122 重建权归 aud）
```

## 五、两处等裁决（别在页面里自行绕开）
- **26px 主数字**：六档令牌没有 26px，DIRECTION §②「24=主 KPI」⇒ 基元先落 `--font-size-ls-6`(24px)；
  要真 26px 只能（A）加档走冻结线并窗 /（B）组件内字面值登记豁免。待裁。
- **44px 手机触点**：令牌层无该档，现为字面值并已在本文件披露；加 `--touch-target-ls` 同样要走并窗。
