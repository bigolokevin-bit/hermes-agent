# 知识冷启动深链：外层高亮 vs 内容落点（9122 验收脸第二证）

- 端口：`http://127.0.0.1:9122`（launchd `cn.seakoi.v4-serve`，根 `forks/hermes-agent/hermes_cli/web_dist`）
- entry（由页面 DOM 里 `script[src]` 实读，非 curl 推断）：`/assets/index-DiNZbuB-.js`
- 被测：该 face 已含 UI-KD `57d7216b`（manifest 冷链归一）+ L4 `4705edea`（壳侧 PANEL_TABS）
- 判据（UX r7 判词①）：冷启动 `?tab=sources|ingest|retrieval` 与 `?panel=retrieval`，
  外层 `[role=tab][data-tab]` 的 `aria-selected` 所属 tabId 必须等于内容面 `[data-testid=knw5-panel].data-tab` 的归属外层 Tab；
  并再点一次高亮 Tab，读数须与冷启动一致（点击进入同构）。
- 取图：1280×900 fullPage，逐条同名 PNG 在取证机 `$TMP/ev-r7-9122/`。

| 冷链接 | 落地地址 | 外层高亮 | 内容面 data-tab | 内层选中 | 面题 | 同构 |
|---|---|---|---|---|---|---|
| `?tab=sources` | `?tab=sources` | sources「数据源」 | ingest | 数据接入 | 文档命中,接入健康,接入任务,接入对象 | 是 |
| `?tab=ingest` | `?tab=ingest` | sources「数据源」 | ingest | 数据接入 | 文档命中,接入健康,接入任务,接入对象 | 是 |
| `?tab=retrieval` | `?tab=retrieval` | spaces「知识空间」 | retrieval | 检索 | 文档命中,检索命中,读取记录 | 是 |
| `?panel=retrieval` | `?panel=retrieval` | spaces「知识空间」 | retrieval | 检索 | 文档命中,检索命中,读取记录 | 是 |

- 结论：4/4 外层高亮==内容落点归属，点击进入同构 4/4，pageErrors 0（本轮未出现壳侧报错）。
- 与夹具面（9135，全知识读口 404）上一轮读数一致：`sources/ingest → 数据源+数据接入`，`retrieval → 知识空间+检索`。
- 原始逐字段读数：同目录 `knowledge-deeplink-outer-tab-9122-readings.json`（含 outer[] 全表、inner[]、viaClick）。
- 生成时间：2026-11-22 07:21 CST（脚本 `probe_deeplink.mjs`，playwright chromium-1255，每腿 fresh context = 真冷启动）。
