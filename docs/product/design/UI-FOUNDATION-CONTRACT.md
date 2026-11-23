# UI 基础层契约（UI-FOUNDATION-CONTRACT）

拍板口径：用户现场直令两批（2026-11-23 上午）＋参谋转达。本文是**基础层与页面壳的
唯一契约**；批量改页面一律暂停，等全局方向文档
`docs/product/design/UI-DIRECTION-20261123.md`（参谋在产）到达并由 L0 转发、与本契约
合并后才许铺页。唯一例外＝总览值班台三卡返工（样板页，见条款 5），不许外溢到其它页。

验收闸：`node scripts/assert-ui-contract.mjs --url=<脸> [--auth=<storageState>] [--stage=duty]`
十条逐项出 PASS/FAIL，全绿才许报「合格」；`--stage=duty` 是**逐页爬坡口径**——
先把样板页（总览值班台）跑绿，其余页面按车道认领后逐条转绿，不允许把闸放宽成恒真。

---

## 一、十条契约（DOM 可判，逐条对应脚本里的断言名）

| # | 条款 | 机器判据（脚本断言名） |
|---|---|---|
| 1 | **唯一字阶**：页面字号只准取令牌字阶，禁 px/rem 同尺寸两种写法混用 | `font-scale-token-only`：采样所有可见元素 computed `font-size`，集合 ⊆ 令牌集合（10.5/11.5/12.5/13.5/15/20/26/32，px 统一） |
| 2 | **间距只走阶梯** 4/8/12/16/24/32 | `spacing-ladder-only`：采样 margin/padding/gap 的非零值 ⊆ 阶梯 |
| 3 | **禁原生 `<select>`**（筛选器一律自绘） | `native-select-zero`：`document.querySelectorAll("select")` 计数 = 0 |
| 4 | **禁内联字号**（`style` 上的 fontSize 全部清零） | `no-inline-font-size`：带 `style` 属性且含 `font-size` 的元素计数 = 0 |
| 5 | **卡片固定槽位**：卡内只留 标题 / 主数字 / 一句状态 / 「查看明细」；明细进卡外折叠区，卡片不随数据行数长高；同行三卡等高 | `card-slots-and-equal-height`：同排卡片 `boundingRect.height` 差 ≤ 1px；卡内不得出现 `.duty-gates/.duty-list/.duty-ranges/.duty-runs-caliber`；「查看明细」深链在场；卡外明细区在场（信息不删） |
| 6 | **顶栏唯一 h1**：页面标题只出现在顶栏，内容区不得重复 | `single-h1-in-topbar`：`h1` 计数 = 1 且位于顶栏内；内容区无同名重复标题 |
| 7 | **控件位次固定**：筛选行紧贴标题下、单行、搜索左/筛选右（`gap ∈ {8,12}`）；每页恰好 1 个主按钮；次级操作收进「更多」；危险操作独立并确认 | `filter-row-single-line` + `one-primary-per-page` |
| 8 | **侧栏折叠真适配**：折叠后主区必须重排（宽度变化 ≥ 120px、内容不溢出、顶栏/筛选行不错位），折叠态持久化 | `sidebar-collapse-reflows`：折叠前后 `main.clientWidth` 差 ≥ 120；折叠后无横向溢出；`localStorage` 记有折叠态 |
| 9 | **底栏清理**：语言选择（只有中文）去掉，换成「日间/夜间」主题切换（与现有主题键一致）；`Nous research` 等上游字样全部移除 | `footer-no-lang-has-theme-toggle`：底栏内无语言 `select`/菜单、存在主题切换、无上游字样 |
| 10 | **身份区重做**：头像/姓名/角色/租户一行紧凑展示，点击或长按出菜单（切换主题、退出）；**不许裸 ID、不许英文角色名** | `identity-no-bare-id-no-english-role`：身份区文本零命中裸 ID 形制（`emp_`/`ce_`/`ob_`/`http`/`rid`/`correlation`/UUID/32 位 hex），角色名必须是中文人话，存在可展开菜单 |

第 1-7 条＝T1/T2 原六类口径的展开；第 8-10 条＝用户第二批现场意见四条的并入
（第四条「字号与控件继续收」已落在条款 1/6/7）。

### 1.1 字阶收敛映射表（2026-11-23 现查实测，唯一真值＝`web/src/components/ui/font-scale.test.ts` 的棘轮基线）

现查口径：扫 `web/src/**/*.css|scss` 的 `font-size:` 声明（剥注释后逐处判定），看是否写成 `var(--font-size-ls-[1-6])`/`var(--font-size-[1-6])`。
读数：**声明共 383 处；非令牌写法 323 处；其中离阶（不等于 12/13/14/16/20/24）185 处**；`web/src/styles/**` 与 `web/src/components/ui/**` 内非令牌写法 **0 处**（基元层已达标）。
最重靶子：`11px ×60`、`0.6875rem(=11px) ×35`、`10px ×8`、`11.5px ×8`、`0.66rem(=10.56px) ×8`，另 `0.64/0.7/0.72/0.74/0.76/0.78rem` 各 5-7 处。
重要结论：**没有 calc / em / 百分比继承缩放源**（全仓此类写法 0 处），离阶值全是「手填 px」或「按 16px 基准手算的 rem 字面量」⇒ 正解＝逐处换成令牌，不需要拆缩放机制。

| 现值（字面量） | 折算 | 归入令牌 | 处数量级 |
| --- | --- | --- | --- |
| `9.0/9.6/9.92/10.0/10.24/10.56/10.88/11.0/11.2/11.5/11.84px`、`0.64/0.66/0.6875/0.7/0.72/0.74rem` | 9.0-11.84px | `--font-size-ls-1`（12px） | ≈110（含 11px×60、0.6875rem×35） |
| `12.16/12.48/12.5px`、`0.76/0.78rem` | 12.16-12.5px | `--font-size-ls-2`（13px） | ≈13 |
| `13.12/14.4px`、`0.8125/0.875rem` | 13.12-14.4px | `--font-size-ls-3`（14px） | ≈11 |
| `15/16.8/17px`、`1.05rem` | 15-16.8px | `--font-size-ls-4`（16px） | ≈6 |
| `19px` | 19px | `--font-size-ls-5`（20px） | 1 |
| `22/22.4/26/30.4px` | ≥22px | `--font-size-ls-6`（24px）；唯一页标题处取 `-ls-5`(20px) | ≈5 |

- 归整规则：**向下取最近档，但不得低于 12px**（11px 归 12，不归 13——13 是表格正文档，把说明文字升到 13 会反向挤版式）。
- 折算基准更正（批1 后补，真跑证据）：本表第一列按 **16px** 折 rem，但实测本树运行时根字号是 **15px**（`0.75rem` 算出 11.25px、`0.875rem` 算出 13.13px、`1.05rem` 算出 16.88px；根因＝`index.css` 的 `font-size: var(--theme-base-size)`）。`--font-size-ls-*` 全是 px，所以换令牌即脱离根字号依赖；**收口判据以运行时 computed 字号集合 ⊆ 六档为准**，静态门只管写法并只准下调棘轮基线。
- 同档不同写法（`0.75rem`=12px、`0.875rem`=14px）也必须换成令牌写法，否则机检门继续红。
- 后果披露：11px→12px 会带来行高/宽度重排 ⇒ 每文件一笔、每笔附 1440/375 双档截图对照；缺值仍走「—」，不许借收敛之名塞内容改动。

逐文件靶子（非令牌写法处数，即收敛顺序）：

| 文件 | 处数 | 归属 |
| --- | --- | --- |
| `modules/health/health.css` | 59 | L2 线 |
| `modules/metrics/metrics.css` | 59 | L5 线 |
| `modules/duty/duty.css` | 47 | UI-KD（本车道点单） |
| `modules/knowledge/knowledge.css` | 32 | UI-KD（本车道点单） |
| `modules/capabilities/counts.css` | 23 | UI-SHELL |
| `modules/access/access.css` | 20 | UI-P2 |
| `modules/overview/overview.css` | 18 | UI-SHELL |
| `modules/tenant/tenant.css` | 18 | UI-P2 |
| 其余 `org/skills/people/approvals-density/index.css` | 27 | 各 owner |

执行门（已入库，纯源码层，未部署 worktree 也绿）：`cd web && node_modules/.bin/vitest run src/components/ui/font-scale.test.ts`
甲 基元层与令牌层零字面量（硬钉 0）；乙 全仓 323 / 离阶 185 只准下调；丙 扫描面非空（CSS>20、声明>300）；丁 四大靶子文件归属不得偷换。

## 二、令牌与骨架落点（T1）

- 字阶：`web/src/styles/tokens.css` 的 `--font-size-ls-*`（px 统一，禁 rem 混写）。
  现网仍存在的 12px/11px/0.6875rem/0.75rem/13px/14px/11.5px/10px/0.66rem/0.8125rem 等
  十几种写法属**待清偿负债**，由 assert 闸逐页爬坡收口；铺页冻结期间只立闸不批量改。
- 间距：`--space-ls-1/2/3/4/6/8` ＝ 4/8/12/16/24/32；圆角 `--radius-ls-1/2/3`；
  描边 `--border-ls-1/--border-strong-ls`；阴影 `--shadow-ls-1/2`。
- 基元：`web/src/components/ui/**` ＝ Button（三级；危险独立并确认）、Input/Textarea、
  **Select（自绘，禁原生）**、Table（密度/行高）、Card（固定槽位）、Tabs、Badge、
  Empty/Error/Loading、Dialog。
- 令牌契约冻结线 `2026-11-23T20:57+08:00` 之后，任何令牌增名/改名走 L0 并窗评审。

## 三、页面壳契约（T2）

- 顶栏 56px：左＝`面包屑 › 页面标题`（唯一 h1），右＝主操作；标题不再掉进内容区。
- 筛选行：紧贴标题之下，单行；搜索左、筛选右；同 `gap ∈ {8,12}`。
- 次级操作收进「更多」；危险操作单独成列并带确认；每页只允许 1 个实心主按钮。
- 侧栏：折叠态持久化；折叠后主区重排（≥120px 宽差）且不溢出。
- 底栏：只留主题切换（日间/夜间）与状态信息，不留语言选择，不留上游字样。
- 身份区：一行紧凑（头像/姓名/角色/租户）＋可展开菜单（主题、退出）。

## 四、边界与协作（不许越写域）

- 条款 8/9/10 的**实现**落在 `web/src/shell/**`（顶栏、侧栏、底栏、身份块）与公共 lib，
  均非本车道写域 ⇒ 本拍只交「契约 + 机检闸」；版式改动由 L0 协调 shell 车道，
  我不自改（参谋口径：动 shell/公共 lib 先回报）。
- 只读参考：`/Users/kevin_studio/Projects/imagine_next`（侧栏折叠与身份块的交互形态）。
  **禁引入其依赖**、禁复制其构建配置。
- 禁碰 pump / 68183；批量改页面暂停；铺页需等 `UI-DIRECTION-20261123.md` 合并。

## 五、现算台账（动手前复核，报口径差异）

| 用户现场数 | 我这侧现算 | 差异原因 |
|---|---|---|
| 字体 14 种以上（12px 69、11px 60、0.6875rem 35…） | 待逐页采样后由 `font-scale-token-only` 给集合 | 静态 grep 只能数声明，DOM computed 才是判据 |
| 9 个原生 select | 我早前口径＝6 文件 / 8 命中（生产码 0 命中，9 命中全在注释与测试叙述） | 用户数的含测试/注释面；本闸只判 DOM 里真实 `<select>` |
| 61 处内联 style、38 个散 hex | 棘轮双口径：字面量 `style={{` 61 / 全形制 `style={` 65，差 4＝盲区站点须落登记豁免面 | 盲区＝换行形制与 `style={变量}`；豁免表见 `docs/_artifacts/ui-kd/inline-style-ratchet-readings.md` |

## 六、机检闸的运行形制（写死，别再靠口口相传）

- 唯一形制：**仓根执行** `node scripts/assert-ui-contract.mjs --url=http://127.0.0.1:<端口> --auth=<storageState.json> --stage=<duty|none>`。
  `cd web` 里跑同一脚本不再算合规形制（`REPO` 由脚本自身位置解析，仓根最稳）。
- 只读闸：不启服务、不改产物、不写文件；退出码只由 FAIL 驱动，DEFERRED 不判绿也不掩盖。
- **闸需要浏览器**这个事实：条款 1/2/5/6/7/8/9/10 要真页面。`web/package.json` 已钉
  `playwright: 1.64.0`（devDependencies，用户 10:1x 明文授权；其余依赖版本一律未动），
  但 **devDep 要一次 `pnpm install` 才会链接进 node_modules**。在此之前脚本按解析链兜底：
  `import("playwright")` → `web/package.json` 的 require → `UI_GATE_PLAYWRIGHT` 指路 →
  同级 `../hermes-agent/node_modules/.pnpm/playwright@1.64.0*`。浏览器可执行文件同理：
  `UI_GATE_CHROMIUM` → 本机 `~/Library/Caches/ms-playwright/chromium-*` 实存优先。
- 全链落空时打印 `RUNTIME-CLAUSE-SKIPPED …` 并按 DEFERRED 收尾，**不伪装 PASS、不崩栈**。
- 新闸 `scripts/assert-agent-rail.mjs`（舰队卡列七判据）沿用同一形制与同一解析链。
