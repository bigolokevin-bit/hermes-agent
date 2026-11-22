# wave-154 骨架 NM 归因（ui-b，L0 催办单答复）

定案：**sessions/channels 的 `skeleton-below-threshold: mainTextLen=10` 不是页面渲染缺陷，
是「会话失效（401）× SPA 兜底假 200 复位风暴闸」的合成态**；aud 台账 authState=provided 那次
命中的是早衰 cookie（whoami 已 401 也记作 provided）。三组现脸读数（均 storm-window-probe.mjs 同口径，含 mainTextLen）：

| # | 脸 | 会话态 | sessions nav/401 | channels nav/401 | 翻倍? | mainTextLen |
|---|----|--------|------------------|------------------|-------|-------------|
| A | 现网 9122 · CCLAG-mZ（未含修复） | 死（匿名/401） | 645→1255 / 1930→3759 | （同型） | **是** | 10（aud 台账 navError）→NM |
| B | 现网 9122 · CCLAG-mZ（**未含修复也无需**） | 活（新 cookie，whoami 200） | 2→2 / 0→0 | 2→2 / 0→0 | 否 | 116 / 969 真渲染 |
| C | 忠实回放 9125 · DuhonhGE（fix f3c72902ff） | 风暴态复刻（401 信封+假 200） | 3→3 / 24→26 | 3→3 / 25→25 | 否 | 104 / 155 真渲染 |

- A 原始读数：real-9122-probe.txt（本目录，wave-154 早前入库）。
- B 原始读数：real-9122-logged-in-stable.txt（本轮）。脸 entry 逐行 = assets/index-CCLAG-mZ.js。
- C 原始读数：replay-green-duhon-render.txt（本轮，探针升级后含 mainTextLen/骨架节点数）。脸 entry = assets/index-DuhonhGE.js。
- 根因链（A 的机制）：v4_proxy 不转发 `/api/status` → 兜底 200+index.html → api.ts 2xx 块无条件清闩
  → 401 会话接口每页触发 reload-once → 文档导航风暴 → main 永远停在骨架。
  L0 候选清单第 1 条（SPA 假 200 看 content-type）即实锤项；302 链/静态计数两候选已证伪（见结论｜note）。
- 跨夹具不互销（CONSOLE-ACCEPTANCE §5.7）遵守：B 用的是**真实 9122 现脸**，不是 stub；C 只作机制绿证。
- 处置：f3c72902ff（并入后重建部署）让 A 态转 C 态；B 表明 aud 用**新鲜 auth-state** 跑当代脸即可得真读数。
- 探针升级：mainTextLen/骨架闸同口径并入 STORM 行、cookie 两种落盘形制都认、`--no-auth` 显式匿名。
