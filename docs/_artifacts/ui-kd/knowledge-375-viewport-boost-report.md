# knowledge 侧 375 全量复跑收口（视口加高法，无腿记 NOT_MEASURED）

- 取证脸：`PORT=9122`（验收脸，只读，未重启/未重建）；逐腿现读 DOM `script[src]` 的 entry = `/assets/index-INJI_bcS.js`
- 登录态：`$D/auth-127.json`（把 `~/.local/state/sekoi-ops/ui-qa-auth-state.json` 的 cookie domain 由 `100.117.184.117` 改写为 `127.0.0.1` + sameSite=Lax）。不改域名会得到 `401 console.unauthenticated` 全体伪像。
- 判据（原文）：可见元素 `boundingRect.right <= 视口宽 + 1` 且 `left >= -1`；整块推到左缘外（`right <= 1`）计 offscreenLeft，不算违规。document 级 `scrollWidth` 与壳层 `overflow-x-hidden` 不作绿签；可横滚容器单独查。
- **视口加高复测法**（破内部滚动壳造成的假 NOT_MEASURED）：对 `html/body/#root` 与每个 `overflowY ∈ {auto,scroll} 且 scrollHeight > clientHeight+1` 的元素**及其整条祖先链**强制 `overflow:visible; height:auto; max-height:none`（!important），把视口高抬到内容高（≤6000），等 400 ms 后 `fullPage:true` 取图；`pngH > 812` 才算「测得」，否则判 NOT_MEASURED。
- 每腿 fresh context 冷启动（真冷链，非页内切换）。

## 结果：11 腿，测得 11 腿，越界合计 0 处

| 腿 | 落地地址 | 外层高亮 | 内容面 data-tab | 内层选中 | 同名 | 折叠态可见/越界/最右缘 | 加高后越界 | 滚动壳数 | png | 测得 |
|---|---|---|---|---|---|---|---|---|---|---|
| kn-spaces | `/knowledge` | 知识空间 | `spaces` | 空间台账 | 0 | 187 / 0 / 375 | 0 | 1 | 375x1470 | Y |
| kn-tab-sources | `/knowledge?tab=sources&panel=ingest` | 数据源 | `ingest` | 数据接入 | 0 | 207 / 0 / 375 | 0 | 1 | 375x1665 | Y |
| kn-tab-ingest | `/knowledge?tab=sources&panel=ingest` | 数据源 | `ingest` | 数据接入 | 0 | 207 / 0 / 375 | 0 | 1 | 375x1665 | Y |
| kn-tab-retrieval | `/knowledge?panel=retrieval` | 知识空间 | `retrieval` | 检索 | 0 | 188 / 0 / 375 | 0 | 1 | 375x1476 | Y |
| kn-tab-citations | `/knowledge?panel=evidence` | 知识空间 | `evidence` | 运行事件引用 | 0 | 178 / 0 / 375 | 0 | 1 | 375x1375 | Y |
| kn-tab-scope | `/knowledge?panel=spaces` | 知识空间 | `spaces` | 空间台账 | 0 | 187 / 0 / 375 | 0 | 1 | 375x1470 | Y |
| kn-tab-evidence | `/knowledge?tab=evidence` | 审计证据 | — | — | 0 | 957 / 0 / 375 | 0 | 1 | 375x6707 | Y |
| kn-panel-spaces | `/knowledge?panel=spaces` | 知识空间 | `spaces` | 空间台账 | 0 | 187 / 0 / 375 | 0 | 1 | 375x1470 | Y |
| kn-panel-ingest | `/knowledge?tab=sources&panel=ingest` | 数据源 | `ingest` | 数据接入 | 0 | 207 / 0 / 375 | 0 | 1 | 375x1665 | Y |
| kn-panel-retrieval | `/knowledge?panel=retrieval` | 知识空间 | `retrieval` | 检索 | 0 | 188 / 0 / 375 | 0 | 1 | 375x1476 | Y |
| kn-panel-evidence | `/knowledge?panel=evidence` | 知识空间 | `evidence` | 运行事件引用 | 0 | 178 / 0 / 375 | 0 | 1 | 375x1375 | Y |

## 结论

1. **无腿记 NOT_MEASURED**：11 条知识腿的 `pngH` 为 1470, 1665, 1665, 1476, 1375, 1470, 6707, 1470, 1665, 1476, 1375，全部 > 812。此前队列 #11 的 12 条 NOT_MEASURED 全在 `access / employees / identity / metrics / sessions / system` 等他人写域（取图壳吃掉了高度），不是知识面问题，也不影响本报告结论。
2. **375 越界 0 处**：折叠态与视口加高后皆为 0，`worstRight` 恰 375（= 视口右缘，最右元素是壳侧栏）。可横滚容器：知识表都在 `.knw5-scroll` 内滚动，无外溢。
3. **同名不同内容 0**：外层「知识空间 / 数据源 / 审计证据」与内层「空间台账 / 数据接入 / 检索 / 运行事件引用」在每条腿 `collision=0`；`?tab=` 与 `?panel=` 两种写法落同一面（旧路径 301 已生效，见 `knowledge-nav-redirect-301-readings.md`）。
4. `kn-tab-evidence` 落 `#/knowledge?tab=evidence`，页面本体是 `web/src/modules/evidence/**`（957 元素 / pngH 6707 / 越界 0）——**跨写域**，此处只作对照，不在我的整改面内。
5. 本模块 `GET /agent-api/api/knowledge/spaces?limit=20` 在真登录态仍返 `404 knowledge.not_wired`（上游 Bisheng:7860 读口不可达），所以部分面 rows=0；这是 BFF 接线问题，非布局问题。

## 复跑

```bash
cd /private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/knw-density
node probe_knw375.mjs --base=http://127.0.0.1:9122 --auth=/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/knw-density/auth-127.json --out=/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/knw-density/ev-knw375
```

生成时间：2026-11-22T15:07:01（表格由 gen_knw375.py 从 json 代码生成，非手填）
