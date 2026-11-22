# skin.css `-ms-overflow-style: scrollbar` 负债处置提案（只提案，不动码）

- 车道：`lane/console-design`（UI-KD）· 提案时间：2026-11-23 03:2x +08:00
- 取证脸：`b35bdbeed7`（定向 `git ls-remote` 现查 == `origin/lane/hermes-console`）
- 现役验收面：PORT=9122 ENTRY=`assets/index-DWq8renW.js`（只读，未重建）

## 0. 先报盘上现查：这条单的前三项锚点对不上脸

| L0 单里的说法 | 脸上现查结果 | 取证命令 |
|---|---|---|
| `skin.css` | **`web/src/**` 内不存在任何 skin.css**；全仓 `git ls-tree -r --name-only <脸> \| grep -i skin` 只命中桌面端/TUI/网关的 `skin.ts`/`skin_engine.py` 等，与 web 样式层无关 | `git ls-tree -r --name-only origin/lane/hermes-console \| grep -i 'skin'` |
| 值 `-ms-overflow-style: scrollbar` | **0 处**。全仓该属性只以 `none` 出现 | `git grep -n 'ms-overflow-style: *scrollbar' <脸>` → 空 |
| 「第 15 处负债」 | **任何口径都数不出 15**：`git grep -n 'ms-overflow-style' <脸>` = **4 处**（web 1 + 桌面端 3）；web/src 内 `scrollbar` 关键词 = 11 行（其中 CSS 声明 6 行、tsx 用法 5 行，含 2 行注释） | 见上两行命令 |

⇒ 结论：这条单**不是我能据以动码的口径**。要么更正锚点后重派，要么按下面第 2 节对**真实存在的那一处**做处置。写域裁定归 L0，我不自改 `web/src/index.css`（该文件本就不在我写域）。

## 1. 真实负债普查（脸 `b35bdbeed7`，逐行可复跑）

`git grep -n 'ms-overflow-style' b35bdbeed7` 的四条：

| # | 位置 | 形制 | 所属应用 |
|---|---|---|---|
| 1 | `web/src/index.css:218` | `.scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }` + `::-webkit-scrollbar { display: none }`（:221-223） | web 控制台（唯一一处） |
| 2 | `apps/desktop/src/app/right-sidebar/terminal/rail.tsx:59` | Tailwind 任意变体 `[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden` | 桌面端（不在 web 迁移范围） |
| 3 | `apps/desktop/src/components/pane-shell/tree/renderer/tree-group.tsx:383` | 同上 | 桌面端 |
| 4 | `apps/desktop/src/components/pane-tab.tsx:306` | 同上 | 桌面端 |

`web/src` 内消费 `.scrollbar-none` 的站点（4 处，全在横向溢出容器上）：
`contexts/PageHeaderProvider.tsx:108`、`pages/SkillsPage.tsx:416`、`pages/ConfigPage.tsx:566`、`pages/EmployeeDetailPage.tsx:220`；另有 `PageHeaderProvider.tsx:146` 用 `[scrollbar-gutter:stable]`（不同属性，非本条负债）。

## 2. 处置提案（两条路线，供 L0 裁定）

### 路线 A（建议）：保留 `.scrollbar-none` 工具类，不令牌化
理由三条，都可核：
1. **它不是"魔法值负债"，是形制工具**。`-ms-overflow-style`/`scrollbar-width` 的合法取值只有 `auto | thin | none | scrollbar`，不存在需要统一的尺度或色值；把它做成 `--scrollbar-ls` 令牌＝给三值枚举造别名，只增加读解成本，不消除任何硬编码。
2. **令牌契约已冻结**：冻结线 `2026-11-23T20:57+08:00` 之后令牌增名/改名一律走 L0 并窗评审（出处：`docs/_artifacts/ui-kd/ui-page-migration-guide.md` §7）。现在加名要占一次并窗，收益为零。
3. **真正该钉的是"别处不要再各写一份"**：`index.css:217` 已是全站唯一出口，四个消费点都走类名。建议把这条收进棘轮门家族（纯源码层、不启服务、不读产物）：`-ms-overflow-style` 在 `web/src/**` 内的定义点数 **恒等于 1** 且必须位于 `index.css` 的 `.scrollbar-none` 块内；消费点只准出现 `scrollbar-none` 类名或 Tailwind 任意变体，不准新增裸声明。这条门我可以只动 `web/src/components/ui/`（我写域）落一个 `scrollbar-utility.test.ts`，等 L0 一句话。

### 路线 B：确要令牌化，则只令牌"是否隐藏"这一语义
- 在 `web/src/styles/tokens.css` 增 `--scrollbar-display-ls: none;`（与 `scrollbar-width`/`-ms-overflow-style` 成组），`.scrollbar-none` 三条声明改读该令牌；页面侧**不改**（继续用类名），因此零视觉变化、零路由变化。
- 代价：破冻结线需并窗评审；`tokens.css` 的机检门 `token-source.test.ts` 要求"契约名 ⇄ 定义"双向逐项相等（名中含 `-ls`，两侧各 **62**），所以新增一个名字必须同时补 `docs/_artifacts/ui-kd/ui-page-migration-guide.md` §1 契约名表，否则 戊 例立刻红（`expected 62 to be 63`）。这条我已用两向负控实测过形制，别踩第二次。

### 我的建议
**走 A**，并把第 1 节普查表当作这条队列行的正式读数。若 L0 要的是"web 与桌面端形制统一"，那是 `apps/desktop/**` 写域的独立单，不属 web 迁移口径。

## 3. 复跑命令（全部只读）

```bash
R=/Users/kevin_studio/Projects/forks/console-design
FACE=b35bdbeed7
git -C "$R" grep -n 'ms-overflow-style' "$FACE"                       # 4 行
git -C "$R" ls-tree -r --name-only "$FACE" -- web/src | grep -i skin   # 空
git -C "$R" show "$FACE:web/src/index.css" | sed -n '216,224p'         # 唯一声明块
grep -rn 'scrollbar' "$R/web/src" --include='*.css' --include='*.tsx'  # 11 行
```

## 4. 棘轮双口径豁免表落档笔（L0 问的那一句）
`4a096afaf3` = `docs(web/ui-f): 棘轮门读数改双口径落档——全形制 65/字面量 61/盲区 4 逐站点豁免表`，**单文件** `docs/_artifacts/ui-kd/inline-style-ratchet-readings.md`（+58/−0），内容＝现算读数表（全形制 `style={` 65 / 字面量 `style={{` 61 / 台账盲区 4 / 命中文件 16 / 非测试 `.tsx` 154 / `web/src/shell/console.tsx` 恒 0）＋负债分布（含归属列）＋**运行时值豁免表四行逐站点**（`components/ThemeSwitcher.tsx:128` 换行 `style={` 三元、`:294` `style={fontPreviewStyle(f)}`、`:323` `style={swatchCellStyle(color)}`、`components/LanguageSwitcher.tsx:117` 同形制弹层定位，逐条写明"为何不可令牌化"与**"内联仍在／形制迁移不算清偿"**）＋正向牙齿两把读数＋门禁读数。它就是 L0 要的那笔豁免表落档，可单独 cherry。
