# imagine_next 方向参考清单（参谋点单，只读，2026-11-23 11:1x）

判据口径：逐条标 **已覆盖 / 可借 / 不要**，每条给依据。本轮零代码改动（急停令期内）。

## 0. 先报现查事实（点单里点名的文件大多不存在）

| 点单文件 | 盘上实况 |
|---|---|
| `README.md` | 存在 93 行，**内容是 GitLab 建仓模板 boilerplate，零设计信息** |
| `DESIGN_SYSTEM.md` | MISSING |
| `docs/design/**` | 存在，但**只有 15 张图**（`01-login.svg` … `12-prompt-editor-unified-entry-main.png`），无一份 md 规格 |
| `design/**` | MISSING（无此顶层目录） |
| `docs/adr/**` | MISSING（`docs/adr` 不存在，`docs/agent-rules/**` 才是治理规范落点） |
| `apps/studio/AGENTS.md` | MISSING（apps 下只有 `web`） |
| 实际可读的真素材 | `apps/web/src/styles/`{base,variables,theme,variants,utilities,index}.css 共 **297 行**；`.agents/skills/design-taste-frontend/SKILL.md` **1206 行**；`AGENTS.md` 63 行 + `docs/agent-rules/**`；`openspec/specs/**` 40+ 个能力目录；`docs/design/*.svg` 15 张原型图 |

另据实：记忆里那份「525 行带行号的 imagine_next 拆解」`docs/research/imagine-next-ui-reference-20261027.md` **在本仓不存在**（`docs/research/` 为空目录），故本轮全部改为现读。

参考稿真身路径口径（L0 10:24 亲验，一并更正）：`/Users/kevin_studio/Projects/seakoi-console-web/docs/console-v4-skeleton.html`（EXISTS）；`sekoi` 拼写的路径 MISSING。

## 1. 逐条对照

| # | 参考项（出处） | 我们这边的对应物 | 判定 | 依据 |
|---|---|---|---|---|
| 1 | oklch 色空间 + 语义角色名成对（`--card` / `--card-foreground` … `--primary` / `--primary-foreground`）`apps/web/src/styles/variables.css:2-40` | `web/src/shell/tokens.css` 骨架原名（`--bg --panel --fg …`）+ `web/src/styles/tokens.css` 的 62 个 `-ls` 语义名 | **已覆盖（形制相同）** | 我们是「一层真值 + 一层语义别名」，他们是「一层 oklch 值 + Tailwind @theme 转发」，结构同构 |
| 2 | `--chart-1..5` 五条图表色成一族（variables.css:23-27） | 我们图表色散在各模块 CSS，无契约名 | **可借** | 若要给总览/指标趋势色立口径，`--chart-ls-1..5` 是正解；但**属新增令牌名，须走冻结线 2026-11-23T20:57+08:00 后的 L0 并窗评审**，本拍不动 |
| 3 | `--status-active`（在 primary/secondary/accent 之外单列一个状态色，variables.css:17） | 我们的状态语义只有 `--color-success/warning/danger/info-ls` | **可借** | 值班台/员工列表的「在跑/激活」状态现在借 info 色，语义确实缺一位；同样属令牌增名，走并窗 |
| 4 | `.dark { … }` 整块只覆盖值不改名 + `theme.css` 的 `@theme inline` 只做转发（theme.css:1-43） | `web/src/shell/tokens.css` 只剩一行 `@import`、真值全在 `styles/tokens.css`；契约已写「浅色主题只改指向不改名」 | **已覆盖** | 迁移指南 §0 + 机检门 `token-source.test.ts` 甲（壳层定义数必须为 0） |
| 5 | `--workspace-sidebar-width: 13rem`（=208px，variables.css:34） | 骨架 `--side: 208px`；DIRECTION §③ 侧栏 208 展开 / 56 图标轨 | **已覆盖** | 数值完全一致，无需引入第二套宽度源 |
| 6 | 单一 `--radius: .625rem` 再 calc() 派生 sm/md/lg/xl/2xl/3xl/4xl（theme.css:38-43） | `--radius-ls-1/2/3` = 4/8/12 三档 | **不要** | 七档 calc 派生会造出 6 个新契约名且与 DIRECTION §②「圆角 4/8/12」冲突；三档已够 |
| 7 | §4.11 Page Theme Lock：主题只在一处设、区段不得各自反相（SKILL.md:341-351） | 返工单 3)「主题切换 + 根 `data-console-theme` 为同一状态 CSS 输出」 | **可借**（并作为条款 c 的判据语） | 正是我们要钉的形制：`set the theme ONCE at page root, sections must not override` |
| 8 | §6.B Reduced Motion 强制降级为静态（SKILL.md:525-530） | 令牌层 `@media (prefers-reduced-motion: reduce)` 已把 `--duration-ls-*` 归零；舰队卡设计要求「reduced-motion 关闭自动轮播」 | **已覆盖** | 双方同判据；舰队卡实现时按此落 |
| 9 | §6.C 双主题从一开始、默认跟随 `prefers-color-scheme`（SKILL.md:531-536） | DIRECTION §② 浅色「通过验收后方可开放」；返工单 3) 「浅色默认、首次跟随系统」 | **冲突，须 v2 合并裁** | 一个说浅色先验收再开放，一个说浅色即默认；我不在这轮自选，见 §2 |
| 10 | §6.F z-index 克制且层级要有文档（SKILL.md:547-550） | `--z-ls-sticky/dropdown/overlay/dialog` = 1/60/70/80，已进 62 名契约表并逐项机检 | **已覆盖** | 契约文档 §二 + 机检门 丙 |
| 11 | §4.7 布局硬规则：桌面导航必须单行、导航高 ≤80px（默认 64-72）（SKILL.md:240-241） | 契约条款 6（顶栏唯一 h1）+ 条款 7（筛选行单行）；DIRECTION §③ 顶栏最小 56px | **已覆盖（且更严）** | 我们把「顶栏 56px + 模块 tabs 32px」写死成 DOM 断言，比参考的「≤80px」更紧 |
| 12 | §4.7 Bento cell 数＝内容数，禁空格子；§4.9 内容密度（SKILL.md:243-245） | 三 KPI 卡返工「固定槽位、明细不进卡、超出走查看明细」；机检条款 5 | **已覆盖（同一判据的不同说法）** | 参考给的是营销页语汇，我们已有等价 DOM 断言，不需要引用来路 |
| 13 | §4.7 EYEBROW RESTRAINT：全页 ≤1/3 节数的小标题标签，并给出**机械计数判据**（SKILL.md:250-256） | 用户契约增补「页面内解释性文字一律收口 InfoHint，禁止随手一句说明/注/口径」 | **可借（方法）** | 它的价值不在结论而在**判据写法**：把「别太多」变成可机械数出来的阈值。建议我方对应门也写成计数式（可见解释块数 ≤ 页面区块数/3，且同一术语只允许一份 glossary 定义） |
| 14 | §1.B 三旋钮 VARIANCE/MOTION/DENSITY + 按用途给预设表，公共服务型＝3/2/5（SKILL.md:64-76） | 我们无量化旋钮；DIRECTION 只说「克制、紧凑、易扫读」 | **可借** | 控制台正是「Public-sector service」那一档（低变化/低动效/高密度）。v2 若要一句可验收的量化口径，这三档数字比形容词好用 |
| 15 | §5.B Horizontal-Pan 骨架＝GSAP ScrollTrigger `pin:true` + `scrub` 把横向位移绑到纵向滚动（SKILL.md:427-455） | 舰队卡列要求「卡带横向滚动 + 6s 自动轮播」，计划用原生 `overflow-x:auto` + `scroll-snap` + 定时器 | **不要** | 那是营销长页的滚动劫持；控制台里 pin+scrub 会夺走 51 路由壳的滚动权，也过不了 reduced-motion 与折叠重排的断言 |
| 16 | `apps/web/src/styles/` 六件分层（base/variables/theme/variants/utilities/index，共 297 行） | `web/src/styles/{tokens,table-density,detail}.css` + `web/src/components/ui/ui.css` | **已覆盖** | 形制相同：值→语义→组件形状 三层，我们的行数更少但职责一致 |
| 17 | `openspec/specs/<能力名>/` 一能力一目录（40+ 个，含 prompt-library-tab-navigation、canvas-selection、account-management、personal-center） | `docs/product/design/UI-FOUNDATION-CONTRACT.md` 十条 + `docs/_artifacts/ui-kd/**` 每单一台账 | **可借（组织法）** | 「一个能力一个可验收单元」与我们「先交表后动码」同构；若契约条目继续膨胀，可按能力拆文件而不是堆一份长文 |
| 18 | `AGENTS.md` 的读取顺序（根 AGENTS → 最近路径 AGENTS → 治理规范 → 领域索引 → conventions）+「非 trivial 必须先走 OpenSpec」 | 本仓 `AGENTS.md` 路由表 + `docs/governance/**`（正典归 L0） | **已覆盖** | 同族机制，不必移植 |
| 19 | `docs/design/` 15 张 SVG/PNG 原型（登录、仪表盘、工作台、账户、任务详情、后台 5 页、提示词流程 2 图） | 我们的等价物＝`web/docs/console-v4-skeleton.html` 单文件骨架 + parity 表 | **可借（IA 参考，不是规格）** | 没有任何一份 md 解释这些图，引用前需人读图并标注；本轮只登记存在性，不当规格用 |

## 2. 需要 v2 / L0 裁决的两点（我不动码）

1. **浅色主题的先后**（对照第 9 条）：DIRECTION 要「浅色过对比度门后才开放」，返工单要「浅色默认 + 首次跟随系统」。两者互斥，请 v2 合并时一句话定死，我按定稿实现主题切换件。
2. **是否引入 `--chart-ls-1..5` 与 `--status-active`**（第 2、3 条）：确有语义缺口，但都是冻结线后的新增令牌名，须走 L0 并窗；本轮不擅自加名（`var(--x, 兜底)` 造私有名也是禁项）。

## 3. 复跑命令（全部只读）

```bash
IN=/Users/kevin_studio/Projects/imagine_next
wc -l $IN/README.md $IN/.agents/skills/design-taste-frontend/SKILL.md $IN/apps/web/src/styles/*.css
sed -n '1,40p' $IN/apps/web/src/styles/variables.css
sed -n '234,262p;341,352p;427,455p;525,536p;547,552p;64,77p' \
    $IN/.agents/skills/design-taste-frontend/SKILL.md
ls $IN/docs/design $IN/openspec/specs
```
