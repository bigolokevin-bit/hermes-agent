# 知识双层导航死路清扫读数（r14）

- 取证脸：`PORT=9122`（验收脸，只读，未重启/未重建）；逐腿现读 DOM `script[src]` 的 entry = `/assets/index-Dm2Mt71f.js`（全腿同值）
- 登录态：`$D/auth-127.json`（由 `~/.local/state/sekoi-ops/ui-qa-auth-state.json` 把 cookie domain 改写为 `127.0.0.1`+sameSite=Lax 而来）
  - 不改写域名的原 state 直放会得到 `401 console.unauthenticated`，知识读口全体报「没有读到/未接入」——那是取证伪像，不是产品态，故必须换域重放。
- 逐元素判据（原文）：可见元素 `boundingRect.right <= viewport宽 + 1` 且 `left >= -1`；整块被推到左缘外（`right <= 1`）记为 offscreenLeft 不计违规。document 级 `scrollWidth` 与壳层 `overflow-x-hidden` 不作绿签。
- 每条腿都是 fresh context 冷启动（真冷链，非页内切换）。

## 导航契约读数（7/7）

| 请求地址 | 落地地址 | 外层高亮 tabId / label | 内容面 data-tab | 内层选中 | 面题 | 行 | 375 越界 |
|---|---|---|---|---|---|---|---|
| `/#/knowledge` | `/knowledge` | `spaces` / 知识空间 | `spaces` | 空间台账 | 文档命中 / 空间台账 | 0 | 0
| `/#/knowledge?tab=sources` | `/knowledge?tab=sources&panel=ingest` | `sources` / 数据源 | `ingest` | 数据接入 | 文档命中 / 接入健康 / 接入任务 / 接入对象 | 0 | 0
| `/#/knowledge?tab=evidence` | `/knowledge?tab=evidence` | `evidence` / 审计证据 | `null` | — | — | 0 | 0
| `/#/knowledge?panel=spaces` | `/knowledge?panel=spaces` | `spaces` / 知识空间 | `spaces` | 空间台账 | 文档命中 / 空间台账 | 0 | 0
| `/#/knowledge?panel=ingest` | `/knowledge?tab=sources&panel=ingest` | `sources` / 数据源 | `ingest` | 数据接入 | 文档命中 / 接入健康 / 接入任务 / 接入对象 | 0 | 0
| `/#/knowledge?panel=retrieval` | `/knowledge?panel=retrieval` | `spaces` / 知识空间 | `retrieval` | 检索 | 文档命中 / 检索命中 / 读取记录 | 0 | 0
| `/#/knowledge?panel=evidence` | `/knowledge?panel=evidence` | `spaces` / 知识空间 | `evidence` | 运行事件引用 | 文档命中 / 引用台账 / 会话引用 | 0 | 0

## 375 逐元素读数

| 腿 | 可见元素 | 越界 | 最右缘 | 展开后越界 | 取图（真 fullPage） | PNG |
|---|---|---|---|---|---|---|
| outer-spaces | 187 | 0 | 375 | 0 | 375x1470 | `$D/ev-r14-login/r14login-outer-spaces-375.png` |
| outer-sources | 207 | 0 | 375 | 0 | 375x1665 | `$D/ev-r14-login/r14login-outer-sources-375.png` |
| outer-evidence | 957 | 0 | 375 | 0 | 375x6707 | `$D/ev-r14-login/r14login-outer-evidence-375.png` |
| panel-spaces | 187 | 0 | 375 | 0 | 375x1470 | `$D/ev-r14-login/r14login-panel-spaces-375.png` |
| panel-ingest | 207 | 0 | 375 | 0 | 375x1665 | `$D/ev-r14-login/r14login-panel-ingest-375.png` |
| panel-retrieval | 188 | 0 | 375 | 0 | 375x1476 | `$D/ev-r14-login/r14login-panel-retrieval-375.png` |
| panel-evidence | 178 | 0 | 375 | 0 | 375x1375 | `$D/ev-r14-login/r14login-panel-evidence-375.png` |

## 结论

1. **外层高亮 == 内容落点：7/7 成立**。`?tab=sources` 与 `?tab=ingest` 均钉在「数据源 / 数据接入」；`?tab=retrieval`、四个 `?panel=` 直达各自面；`?tab=evidence` 未被本模块归一器改写（`FOREIGN_TAB` 守卫生效），落壳侧「审计证据」。
2. **同名不同内容已清零**：外层三名「知识空间 / 数据源 / 审计证据」与内层四名「空间台账 / 数据接入 / 检索 / 运行事件引用」无交集。
3. **375 逐元素越界 = 0 条**（知识六腿 checked 178-207，evidence 腿 957；worstRight 恰 375 = 壳侧栏贴右缘）。
4. **真数据缺口不在本写域**：登录态直读 `GET /agent-api/api/knowledge/spaces?limit=20` 返回 `404 knowledge.not_wired`（上游 Bisheng:7860 逐 id 读口全部不可达），故各面 rows=0。知识侧代码无死路残留；该刀属 BFF/上游，请转派后端线。
5. `outer-evidence` 腿页面属 `web/src/modules/evidence/**`（跨写域），其「不可达」文案与接线归该模块车道。

## 复跑

```bash
cd /private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/knw-density
node probe_nav.mjs --base=http://127.0.0.1:9122 --out=ev-r14-login --label=r14login --auth=auth-127.json
```

生成时间：2026-11-22T10:50:04（表格由 `gen_r14.py` 从同目录 json 代码生成，非手填）
