# 字阶收敛量化靶单（12:5x 登录态权威读数反查静态源）

用途：把 GATE 闸给出的**运行时 computed 离阶值**逐条反查到**静态声明 file:line**，让 UI-IMPL/TOKENS 的迁移有确定靶子，不再靠猜。
根字号实测 **15px**（`--theme-base-size`，见 `docs/_artifacts/ui-kd/ui-token-readings-1200-20261123.md`），
rem 折算按 ×15，判据＝computed 值是否落在令牌六档 {12,13,14,16,20,24}（`web/src/styles/tokens.css:29-30`）。

## 一、先报一条口径冲突（这条会让所有字号读数失真，必须先裁）

| 位置 | 用的字阶集 |
|---|---|
| `scripts/assert-ui-contract.mjs:31` | `FONT_SCALE = [10.5, 11.5, 12.5, 13.5, 15, 20, 26, 32]` |
| `web/src/styles/tokens.css:29-30`（现役令牌，UI-TOKENS 车道） | `--font-size-ls-1..6 = 12 / 13 / 14 / 16 / 20 / 24 px` |
| `UI-DIRECTION-20261123.md` §②（设计正典） | 字阶 12/13/14/16/20/24；24=主 KPI；20=唯一页标题 |

⇒ 闸的 `FONT_SCALE` 取自我 T1 早期**建议档**，而 DIRECTION §② 与已入库令牌都是六档；
于是闸把 **24px（合法主 KPI）判成离阶**，同时把 10.5/11.5/12.5/13.5/15/26/32 当合规——
这正好反向鼓励页面继续写 26px/13.5px 这类非令牌字号。
**建议处置（写域归 GATE，我不动 `scripts/**`）**：`FONT_SCALE` 改为 `[12,13,14,16,20,24]`，
或改为「读 `web/src/styles/tokens.css` 的 `--font-size-ls-*` 定义当唯一真值」，这样闸与令牌永不漂移。
裁之前，本靶单**同时给两套判据的读数**，避免我用未裁的口径下结论。

## 二、运行时 computed 离阶 → 静态源（按 15px 根字号反查）

| computed | 落闸 8 档？ | 落令牌六档？ | 目标档 | 静态声明命中 |
|---|---|---|---|---|
| 16.88px | ✘ | ✘ | 16 | `modules/metrics/metrics.css:80 font-size: 17px` |
| 15.75px | ✘ | ✘ | 16 | `modules/access/access.css:27 font-size: 1.05rem`；`modules/duty/duty.css:29 font-size: 1.05rem` |
| 28.50px | ✘ | ✘ | 24 | `modules/duty/duty.css:97 font-size: 1.9rem` |
| 21.00px | ✘ | ✘ | 20 | `modules/duty/duty.css:776 font-size: 1.4rem` |
| 9.60px | ✘ | ✘ | 12 | `modules/duty/duty.css:329/:346/:433/:457 font-size: 0.64rem`（×5 处） |
| 9.30px | ✘ | ✘ | 12 | `modules/duty/duty.css:172 font-size: 0.62rem` |
| 9.00px | ✘ | ✘ | 12 | `modules/overview/overview.css:230 font-size: 9px`；`modules/duty/duty.css:155/:281 font-size: 0.6rem`；`modules/duty/duty.css:254 font-size: 9px` |
| 24px | ✘（闸判离阶） | **✔ 合法主 KPI** | — | 见上条冲突，属闸口径问题不是页面问题 |

**归属汇总（按处数）**：`modules/duty/duty.css` 12 处、`modules/metrics/metrics.css` 1 处、
`modules/access/access.css` 1 处、`modules/overview/overview.css` 1 处。
⇒ 运行时字号离阶的**主靶就是 duty.css**（与我静态普查里 duty.css 47 处非令牌声明一致，它同时是
「KPI 26px 未落档」与「9px 级小字」两个毛病的来源）。

## 三、这批能立刻执行什么（写域口径写清）

- UI-TOKENS 车道（我）：`web/src/styles/tokens.css` + `web/src/components/ui/**`。
  令牌六档已到位、`ui.css` 零字面字号；**上面 15 处全部不在我写域**（都在 `modules/**`）。
  我这边唯一能立即再交的是：把闸的 `FONT_SCALE` 冲突以内容判据形式记档 + 待 GATE 改后复跑对照。
- UI-IMPL 车道：`duty.css` 12 处（批3）+ `metrics.css`/`access.css`/`overview.css` 各 1 处（批5），
  按 §1.1 映射表换 `var(--font-size-ls-N)`；每笔同批交门基线下调与 1440/375 视口图。
- 复跑判据（改前/改后各跑一次，逐字可跑）：
  1. `cd web && node_modules/.bin/vitest run src/components/ui/font-scale.test.ts`（静态棘轮，基线现值 292/160）
  2. `node scripts/assert-ui-contract.mjs --url=http://127.0.0.1:9122/agent-v2 --auth=$(whoami 有效的 storageState) --stage=duty`（运行时 23 种/离阶 8 种 → 目标：computed 集合 ⊆ {12,13,14,16,20,24}）

## 四、我的两笔仍在车道待并（内容判据现查）

| sha | 内容 | 在脸？ |
|---|---|---|
| `8f89c43501` | 字阶棘轮门 `font-scale.test.ts` + 契约 §1.1 | ✔ 已并入（脸内该文件 4883 B） |
| `00089c0f27` | 批1 knowledge.css 31 处 + 门基线 323/185→292/160 + 台账 | ✘ 未并（face 内台账 0 字节） |
| `909cc482cf` | 契约 §1.1 折算基准更正（根字号 15px） | ✘ 未并 |

⇒ 批1 与更正笔请随本靶单一并窗（否则面基线 323/185 与代码 292/160 不一致，门会假绿/假红互斥）。
