# DONE-AU-06 — 审计四页 375 触摸目标 + 表头 sticky + 滚动条负闸 + 字号令牌化

- 票：板 task-lanes.json AU-06『375-a11y-token』写域 web/src/modules/audit/（READY 判死重实施新票）。
- 基线：fork lane/hermes-console 当拍实读 3e99506726cdf04f05b2b06743f73a45269c3601；
  起点全列 grep -i au-06=0 行（lsrem-au06-start.txt），旧死值 286d1d1893/d79858a512 未引。

## 改了什么（6 files）

- 新增 web/src/modules/audit/audit-375-a11y.css：
  · 44 触点=knowledge UX-r1 P1-5 形制 `min-block-size: var(--touch-target-ls, 44px)`
    仅 ≤767.98px；小图标钮（copy/clear 族）::after 外扩命中区、相邻组横向不叠；
  · 字号=duty Q9 页根中和条款：[data-page=audit|audit-detail|audit-verify|retention]
    页根 var(--font-size-3)，.text-xs/code/kbd/samp/pre/.font-mono → -1，.text-sm → -2；
  · 零 hex/rgba、零尺寸字面量（44 为 rubric 回落值）、零滚动条禁词（含注释，
    防棘轮扫描误计——本波实测教训入册）。
- 四页各加一行 `import "./audit-375-a11y.css";`（属性选择器挂既有 data-page 锚，
  DOM 零变化，无新增类名/元素）。
- 新增 audit.a11y375.token.contract.test.ts：8 例源码契约（令牌回落/断点/字号
  var 形制/滚动条与色字面量负断言/四页根锚/内联 style=0/导入在位/原生 select=0）。

## 判据四项现状

1. 375 触摸目标 44px：新 css 落地（令牌+回落），契约钉。
2. 表头 sticky：**脸已具**——table-density.css:133-143 aud-sort-bar-block
   sticky（AU-03b 时代 wave-71 注），本票复核在位不重复加规则。
3. 滚动条：审计域无横滚壳（卡片流折行，wave-71 实测注），本票=零裸声明负闸
   （新 css 连注释避禁词），定义点唯一 index.css 棘轮复跑绿。
4. 字号令牌化：中和条款入册；「运行时值不可令牌化」先例遵守——未动调色板/
   字体 stack，**内联 style={{ 四页现读=0**（本票前已零，非本票归功，如实报）。

## 验证（当拍实跑命令）

- tsc -b --force --noEmit exit 0（node 26.13.1）
- vitest 全量：**546 files / 4213 passed / 1 skipped / 3 failed**——3 fail 全部
  =audit.time.window.parity.test.tsx R229（**clean face stash 复现的既有红**，
  L0 令明载勿背勿修，归 AU-01 相邻面处置）
- 点名：contract 8/8 + scrollbar-utility + font-scale 棘轮 16/16 绿
- select 渲染点=0；本票未触 App.tsx/shell/registry/server.py，未越 AU-01
  contextLinks 面与 AU-02 export 面。

## 交报后处置

push task/AU-06-375-a11y-token 与本回执同拍（ls-remote 命令行原文随回执）；
树 remove 保分支；lanes 条目随收口摘除；44px 真机探针腿（ego/playwright dsf）
归 QA served 轨，本卡为源码/契约轨。
