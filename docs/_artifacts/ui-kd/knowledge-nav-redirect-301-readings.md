# 知识双层导航旧路径 301 归一读数（队列 #1 自证）

- 取证脸：`PORT=9122`（只读，未重启/未重建）；逐腿现读 DOM `script[src]` entry = `/assets/index-Dm2Mt71f.js`
- 登录态：`$D/auth-127.json`（cookie domain 改写为 `127.0.0.1`）。不改写会得 `401 console.unauthenticated` 伪像。
- 每腿 fresh context 冷启动＝真冷链（非页内切换）。同名判据 = 内层四面标签集合 ∩ 外层三 tab 标签集合。

| 腿 | 请求地址 | 301 落地 | 外层高亮 tabId / label | 内层选中 | 内容面 data-tab | 同名交集 | PNG |
|---|---|---|---|---|---|---|---|
| legacy-citations | `/#/knowledge?tab=citations` | `/knowledge?panel=evidence` | `spaces` / 知识空间 | 运行事件引用 | `evidence` | [] | $D/ev-r15/r15-legacy-citations.png (1280x900) |
| legacy-retrieval | `/#/knowledge?tab=retrieval` | `/knowledge?panel=retrieval` | `spaces` / 知识空间 | 检索 | `retrieval` | [] | $D/ev-r15/r15-legacy-retrieval.png (1280x900) |
| legacy-scope | `/#/knowledge?tab=scope` | `/knowledge?panel=spaces` | `spaces` / 知识空间 | 空间台账 | `spaces` | [] | $D/ev-r15/r15-legacy-scope.png (1280x900) |
| legacy-ingest | `/#/knowledge?tab=ingest` | `/knowledge?tab=sources&panel=ingest` | `sources` / 数据源 | 数据接入 | `ingest` | [] | $D/ev-r15/r15-legacy-ingest.png (1280x900) |
| outer-sources | `/#/knowledge?tab=sources` | `/knowledge?tab=sources&panel=ingest` | `sources` / 数据源 | 数据接入 | `ingest` | [] | $D/ev-r15/r15-outer-sources.png (1280x900) |
| outer-evidence | `/#/knowledge?tab=evidence` | `/knowledge?tab=evidence` | `evidence` / 审计证据 | — | `null` | [] | $D/ev-r15/r15-outer-evidence.png (1280x900) |
| panel-evidence | `/#/knowledge?panel=evidence` | `/knowledge?panel=evidence` | `spaces` / 知识空间 | 运行事件引用 | `evidence` | [] | $D/ev-r15/r15-panel-evidence.png (1280x900) |

## 结论

1. **旧路径 301 全部生效**：`?tab=citations → ?panel=evidence`、`?tab=retrieval → ?panel=retrieval`、`?tab=scope → ?panel=spaces`、`?tab=ingest → ?tab=sources&panel=ingest`（别名行在 `web/src/shell/routes.ts` compat-tab #244-#247 与本模块 `manifest.ts` 归一器共同实现）。
2. **同名不同内容 = 0**：七条腿 `collision` 全为空。内层四名（空间台账/数据接入/检索/运行事件引用）与外层三名（知识空间/数据源/审计证据）无交集。
3. **一个入口**：`?tab=evidence` 落壳侧「审计证据」页（`modules/evidence/**`，非本写域），知识模块不再复制同名面；知识侧引用台账唯一地址是 `?panel=evidence`。
4. 仍未达的是队列原文里隐含的「外层三 tab 真数据」：真登录态 `GET /agent-api/api/knowledge/spaces?limit=20` 返 `404 knowledge.not_wired`（上游 Bisheng:7860 读口不可达）＝BFF/后端线，不在 `web/src/modules/knowledge/**`。

## 复跑

```bash
cd /private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/knw-density
node probe_redirect.mjs --base=http://127.0.0.1:9122 --out=ev-r15 --auth=auth-127.json
```

生成时间：2026-11-22T12:08:23（表格由代码从同目录 json 生成，非手填）
