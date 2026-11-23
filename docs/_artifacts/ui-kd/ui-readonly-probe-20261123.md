# 只读三件现查台账（急停令期内，2026-11-23）

本轮零代码改动。三件＝运行时 select 探测 / 现有字号分布 / glossary 候选。凡读数不成立处，
直说不成立，不拿骨架态冒充结论。

## 1. 运行时逐路由探测 —— 当前无效，待有效登录态复跑

- 脸：`PORT=9122`，`BASE=http://127.0.0.1:9122/agent-v2`，**entry=`assets/index-CCMhKt2U.js`**（现读，非旧值）。
- 路由集：现读取自 `web/src/shell/routes.ts`（只读 grep `hash:`）＝**70 条**，落盘 `$D/routes.json`。
- 探针：`$D/probe_ui_baseline.mjs`（playwright + 本机 ms-playwright chromium-1255；storageState 注入；1440×900；每路由 `domcontentloaded` + 1200ms 静置后计数）。
- 汇总读数：`{"routes":70, "selectsTotal":0, "routesWithSelects":[], "distinctFontSizes":28, "offLadderCount":24}`。
- **`/auth/whoami` 返回 401** ⇒ 70 条全部是**未登录骨架态**：68/70 条路由文本节点 <100（min 33 / median 54 / max 166），业务面未挂载。
  ⇒ 结论：
  1. `selectsTotal=0` **只能证明「登录页/骨架里没有原生 select」**，不能结案「运行时逐路由 select=0」。L0 口径的「9 处」是历史静态计数，两者不同源，不可互相替换。
  2. 字号分布同理无效，改用 §2 的源码直读台账作靶子。
  3. 两份登录态都失效：`$D/auth-127.json`（11-22 10:47）与从 `~/.local/state/sekoi-ops/ui-qa-auth-state.json` 改域重生成的 `$D/auth-fresh.json`（源时间 11-22 23:28）→ 仍 401。**这是 cookie 早衰，不是产品缺陷**；有效登录态是 opsadmin 代登/user_id=3 授权门那条线，已上报待拍。
- 副产品（未登录态也上屏，正好是返工单四条的靶子，逐字记录）：屏面可见 `HERMES | AGENT | 控制台`、`Nous Research`、`EN`、`未登录 / 去登录`。
- 复跑（拿到有效登录态后，只读）：
  ```bash
  node $D/probe_ui_baseline.mjs > $D/probe_ui_out.json
  ```

## 2. 字号/控件分布 —— 源码直读（不依赖登录，本轮主产出）

扫描面：`web/src` 下 **414 个非测试 `.tsx/.ts/.css`**。原始计数见本目录 `ui-readonly-probe-20261123.json`。

- `font-size:` 声明 **319 处**，**31 种不同值**（rem 已按 16px 基准折算）。六档令牌＝`12 / 13 / 14 / 16 / 20 / 24`。
- **离阶 24 档**，命中最重者：

| 值 | 处数 | 代表出处 |
|---|---|---|
| 11.0px | **95** | `modules/tenant/tenant.css:46,:121`、`modules/metrics/metrics.css:85` |
| 10.0px | 8 | `metrics.css:138,:883`、`capabilities/counts.css:170` |
| 10.56px | 8 | `access.css:124`、`knowledge.css:102,:400` |
| 11.2px | 8 | `access.css:101`、`knowledge.css:93,:841` |
| 11.5px | 8 | `metrics.css:277,:304,:315` |
| 11.84px | 7 | `knowledge.css:678,:765`、`duty.css:201` |
| 11.52px | 6 | （见 json） |
| 12.16px | 6 | `access.css:34,:52`、`knowledge.css:45` |
| 12.48px | 5 | `access.css:84,:114`、`knowledge.css:164` |
| 10.24px | 5 | `duty.css:329,:346,:433` |
| 9.0 / 9.6 / 9.92 / 10.88px | 2 / 2 / 1 / 2 | `overview.css:230`、`duty.css:155,:281,:172,:117` |

  ⇒ 离阶值里大量是 **12 与 13 档的 0.88/0.96 缩放产物**（10.56=12×0.88、11.52=12×0.96、11.84=13×0.91、12.16/12.48…）——说明**存在一个「局部缩放字号」的隐式机制**，这正是舰队卡 26px 那类需求该走的形状，而不是新增令牌名。这条是本轮最有用的发现，建议进 v2。
- 非 px 写法（「统一禁 rem 混写」的实据）：`0.6875rem ×35`、`0.75rem ×24`、`0.66rem ×8`、`0.8125rem ×7`、`0.7rem ×7`、`0.74rem ×7`、`0.76rem ×6`、`0.72rem ×6`。
- 内联 `style` 里的 fontSize 命中 **0 处** ⇒ 「清全部内联 fontSize」这一维已达标；剩下的内联债是非字号属性（棘轮双口径 65 全形制 / 61 字面量，只准下调）。
- 静态 `<select` 标签 **5 处**（是否真标签需逐条看；历史口径 9 处多为注释与测试叙述）。运行时逐路由结论待 §1 复跑。
- 标题标签：**h1×40 / h2×43 / h3×24 / h4×4** ⇒ 「全站唯一 h1」离达标很远，条款 6 是长活不是一页活。
- 控件高度声明 Top：`32px ×7`（事实标准）、36×4、28×3、40×2、**44×2**、18×3、220×2 ⇒ 44px 触点仍无令牌档；新增 `--touch-target-ls` 之类要走冻结线并窗。

## 3. glossary 候选（页面可见解释串，逐条出处）

已在 face 的 keys（`web/src/components/ui/glossary.ts`，commit `eb83157153`）：
`duty.ready`、`duty.runs`、`duty.cost`、`duty.notes`、`metrics.cost`、`approvals.pending`。

待收（本拍只登记，不改页面）：

| 出处 | 现文案（截） | 建议 term key | 备注 |
|---|---|---|---|
| `modules/duty/DutyPage.tsx:460` | 运行数口径：本卡 N · 读口 workbench/summary?range=1d · … | `duty.runs`（已有） | 卡外明细区，属「口径」字样命中源 |
| `modules/duty/DutyPage.tsx:477` | 账本口径 | `duty.cost`（已有） | 明细行标签 |
| `modules/duty/DutyPage.tsx:1031` | 口径说明：每个区块读哪个口、算哪一段、缺值怎么显示 | `duty.notes`（已有） | 折叠块 summary，命中「口径说明」 |
| `modules/duty/DutyPage.tsx:411` | 各项检查独立判定，标「待核实」的项既不算通过也不算不通过 | `duty.ready`（已有） | 与 glossary 语义重复，应删内联改引用 |
| `modules/knowledge/**` 多处 | 「读口」黑话上屏 | 需新增 `knowledge.readout` 一类 | r1 判词已记；属知识面，非本拍写域 |

- 指标（`metrics.cost`）与审批（`approvals.pending`）两样板面在 `modules/metrics/**`、`modules/approvals/**`，**非本轮开闸写域**，只落了 key 未落引用。

## 4. 复跑命令（只读）

```bash
D=/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/knw-density
node $D/probe_ui_baseline.mjs > $D/probe_ui_out.json          # 需有效登录态
# 静态台账（源码直读，与登录无关）见本目录 ui-readonly-probe-20261123.json
python3 - <<'PY'
import json; d=json.load(open("%s/ui-readonly-probe-20261123.json"))
print("字号声明", d["fontDeclCount"], "种值", len(d["fontHistogram"]), "离阶", len(d["fontOffLadder"]))
print("h1/h2/h3", d["headings"], "内联 fontSize", d["inlineFontSizeCount"], "静态 select", d["nativeSelectStatic"])
PY
```
