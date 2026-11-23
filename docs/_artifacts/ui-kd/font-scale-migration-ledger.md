# 字阶收敛批次台账（TOKENS 车道）

判据与映射表见 `docs/product/design/UI-FOUNDATION-CONTRACT.md` §1.1。
门：`web/src/components/ui/font-scale.test.ts`（纯源码层，不启服务、不读已部署产物）。

## 现算口径（node 逐处判定，旧 python 台账 319/31/86 作废）
- 扫描面：`web/src/**/*.css|scss`，`font-size:` 声明 **383 处**。
- 合规写法＝`var(--font-size-ls-1..6)` / `var(--font-size-1..6)` / `inherit`。
- 基线演进：批0 字面量 **323** / 离阶 **185** → 批1 后 **292 / 160**（只准下调）。

## 批1（本笔，已交付）：`web/src/modules/knowledge/knowledge.css`
- 改写 **31 处** 字面量为令牌：`11px×5`、`11.84px×2`、`12.16px×2`、`11.5px×1`、`11.52px×1`、`12.48px×2`、
  `10.56px×2`、`0.6875rem×5`、`0.74rem×3`、`0.76rem×4`、`0.72rem×1`、`0.78rem×1`、`0.66rem×1`；
  映射全部按 §1.1（11/10.56/10.88/11.2/11.5/11.84/0.64-0.74rem → `--font-size-ls-1`=12；
  12.16/12.48 → `-ls-2`=13）。
- 残留 **1 处**：`knowledge.css:841 font-size: 0.7em` —— 这是相对父级的缩放，换 12px 会改变与父字号的关系，
  属页面视觉裁决，不在本批硬改；已在门的离阶计数内如实保留（160 含此 1 处）。
- 门禁：`vitest run src/modules/knowledge` → **80 files / 312 tests 全绿**；
  `vitest run src/components/ui/font-scale.test.ts` → **4 passed**；`vite build` rc=0。

## 剩余靶子（按处数降序，均需 L0 开闸或按 owner 分派）
| 文件 | 非令牌处数 | 行数 | 归属建议 |
|---|---|---|---|
| `modules/health/health.css` | 59 | 830 | health owner（UI-SHELL/页面车道） |
| `modules/metrics/metrics.css` | 59 | 1276 | metrics owner |
| `modules/duty/duty.css` | 47 | 827 | 值班台车道（我曾持 duty 点单，现写域未开） |
| `modules/capabilities/counts.css` | 23 | 359 | capabilities owner |
| `modules/access/access.css` | 20 | 423 | access owner |
| `modules/overview/overview.css` | 18 | 367 | overview owner |
| `modules/tenant/tenant.css` | 18 | 282 | tenant owner |
| `modules/org/org.css` | 14 | 295 | org owner |
| `modules/skills/skills.css` | 10 | 184 | skills owner |
| `modules/people/people.css` | 5 | 148 | people owner |
| `index.css` | 1 | — | `var(--theme-base-size)` 根字号项，属令牌层裁决 |
| `modules/approvals/approvals-density.css` | 1 | — | approvals owner |

## 拆包计划（单次 ≤15 文件/1500 行）
- 批2 `health.css`(59/830 行) 或 `metrics.css`(59/1276 行) 单文件一笔。
- 批3 `duty.css`(47) + `counts.css`(23)。
- 批4 `access.css`(20) + `overview.css`(18) + `tenant.css`(18)。
- 批5 `org.css`(14) + `skills.css`(10) + `people.css`(5) + `approvals-density.css`(1)。
- 每批交付形制：逐处换令牌 → 门基线下调写进 commit → `vitest run src/modules/<页>` + `src/components` →
  `vite build` rc=0 → 该页 1440/375 **视口图**（遵守「测量腿三坑」：验收脸 `networkidle` 不收敛、`fullPage` 是 no-op）
  → 单笔推送 + 定向 `ls-remote` 回读。

## 运行时对照（真跑 4 腿，视口图，PORT/entry 随附）
| 腿 | 服务 | entry | 行数 | 字号种数 | 离阶种数 | 关键变化 |
|---|---|---|---|---|---|---|
| after 1440 | 9142（我的 dist，批1） | `assets/index-BdiaKefd.js` | 36 | 8 | 5 | `12px×261`（批0 是 ×190） |
| after 375 | 9142 | 同上 | 36 | 9 | 6 | `11.25px` 由 ×60 降到 ×12 |
| before 1440 | 9143（批0 dist 重建） | `assets/index-CksG0wOY.js` | 36 | 12 | 10 | 离阶含 11.25/11.4/11.1/10.8/9.9/15.75/16.88 |
| before 375 | 9143 | 同上 | 36 | 13 | 11 | 同上 |

PNG：`$D/fontscale-{after,before}-{1440,375}.png`（IHDR 实量 1440×900 / 375×812，视口图，遵守「测量腿三坑」不用 `fullPage`）。
数据形态＝本地夹具（`fixture_server.py`，知识读口回 36 行真实结构），`/auth/whoami` 用忠实回放 stub 200；
`errs=10` 是夹具对其它非知识读口返回 404/502 的噪声，非产品报错，两腿同值可对照。

## 口径更正（重要，影响整张映射表）
静态门把 rem 按 **16px** 折算，但现网/夹具实测**根字号是 15px**（`index.css` 的 `var(--theme-base-size)` 那处非令牌声明）。
证据：批0 运行时出现 `11.25px`＝`0.75rem×15`、`13.13px`＝`0.875rem×15`、`10.5px`＝`0.7rem×15`、`16.88px`＝`1.05rem×15`。
⇒ 两件事必须一起看：
1. rem 字面量的真实计算值随根字号漂移，**同一写法在不同页可能不是同一像素**；
2. 正解仍是换成 px 令牌（`--font-size-ls-*` 全是 px，脱离根字号依赖），批1 后知识页 12px 文本数 190→261 就是这个效果。
后续每批的收口判据应以**运行时 computed 字号集合 ⊆ 六档**为准，静态门只管写法（两者都要，且静态基线只准下调）。
