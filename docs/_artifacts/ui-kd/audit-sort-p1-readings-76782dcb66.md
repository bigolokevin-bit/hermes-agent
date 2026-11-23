# audit-sort-p1 台账腿：同脸复拍读数 + H2 产物五件

- 取证时间：2026-11-23 08:1x（+08:00）｜车道 `lane/console-design`
- 脸（内容判据，不看 tip）：`76782dcb66` = merge 笔，含本笔代码。核验读数：
  - `git show 76782dcb66:web/src/modules/audit/audit.sort.scope.test.tsx | wc -c` → **7186**
  - `git show 76782dcb66:web/src/modules/audit/AuditEventsModulePage.tsx | grep -c sortScopeOf` → **2**
  - 车道 `git merge --ff-only 76782dcb66` 成功 ⇒ 车道 tip == 脸 tip == `76782dcb66`

## 0. 现役验收脸 vs 本笔构建（据实）

- 现役 9122 入口 `assets/index-Cv4DBs--.js`；在部署产物 `forks/hermes-agent/hermes_cli/web_dist/assets` 内 `data-aud-sort-scope` 命中 **0** 个 chunk ⇒ **现役脸尚未包含本笔代码**（该 dist 的 `index.html` mtime 05:01，早于并窗）。
- 按站定规矩，我不重启、不重建 9122（重建权归 aud）。所以台账腿在**车道同源码重建产物**上复拍，并把产物五件与「标记 chunk 命中数」一并交，供 aud 换代后逐值比对。
- 车道重建后 `data-aud-sort-scope` 命中 **1** 个 chunk（`AuditEventsModulePage-f45_9etX.js`）⇒ 行级 scope/position 形制确实进了产物，不是只在源码里。

## 1. H2 产物五件（车道 dist，静态服务 127.0.0.1:9148，cwd=dist）

| 件 | 值 |
|---|---|
| entry 名 | `assets/index-CjZDGcv-.js` |
| entry sha256 | `8f36bdbef4f5aabe7ab90c639231b40b08d45ddcc443f3fbffb106a3c2eda69b` |
| entry bytes | 173255 |
| entry mtime | 2026-11-23T08:11:03 |
| served curl == disk | `curl http://127.0.0.1:9148/assets/index-CjZDGcv-.js` sha256 = 同值 ✔；`index.html` sha256 `133573499f3911e3feb679fbe8dd043f1c2305fa866283e29d4d4d1b9450b33b` 亦 served==disk ✔ |

携带本笔代码的 chunk（换代判据）：

- `assets/AuditEventsModulePage-f45_9etX.js` sha256 `4b03fe2f1d859c7dd58d70b19d8d447e64dc91331231435d87088a28d21e7def`，bytes 62353，mtime 2026-11-23T08:11:03，served curl sha256 同值 ✔

构建：`cd web && node_modules/.bin/vite build` → BUILD_RC=0（vitest/vite 二进制只在 `web/` 下）。

## 2. 同脸复拍读数（两档真 fullPage）

- 形制：playwright chromium；`/auth/whoami` **真转发 9122** 并在浏览器内紧贴断言 `whoami===200`（cookie 域改写注入 `auth-127.json`）；审计列表用**忠实回放 stub**（现网读口在授权门下 403 `console.forbidden` 属预期，见 §4）；先等 `.animate-pulse` 消失再读，随后 `force()` 展开内部滚动壳 + `fullPage:true`。

| 档 | whoami | entry | rows | NaN | 首屏 consoleErrors |
|---|---|---|---|---|---|
| 1440×900 | 200 | /assets/index-CjZDGcv-.js | 3 | false | 1（非审计端点 `run-activity` 兜底反代 502） |
| 375×812 | 200 | /assets/index-CjZDGcv-.js | 3 | false | 0 |

行级读数（`data-aud-sort-scope` / `data-aud-sort-position`，来自隐藏探针 `audK-row-*`）：

| 档 | 态 | scope | position | 屏上行序 |
|---|---|---|---|---|
| 1440 | plain（无排序） | service-order ×3 | 1,2,3 | evt-1, evt-2, evt-3 |
| 1440 | 点时间列一次（升序） | local-page ×3 | 1,2,3 | evt-3, evt-1, evt-2 |
| 1440 | 二次（降序） | local-page ×3 | 1,2,3 | evt-2, evt-1, evt-3 |
| 1440 | 三次（清除） | service-order ×3 | — | evt-1, evt-2, evt-3；四列 `aria-sort`=none |
| 375 | plain | service-order ×3 | 1,2,3 | evt-1, evt-2, evt-3 |
| 375 | 升序 | local-page ×3 | 1,2,3 | evt-3, evt-1, evt-2 |
| 375 | 降序（本腿 fixture 让 evt-2 缺 `occurred_at`） | local-page ×3 | 1,2,3 | evt-1, evt-3, **evt-2 恒末** |
| 375 | 清除 | service-order ×3 | — | evt-1, evt-2, evt-3；四列 `aria-sort`=none |

披露同源（两档逐字相同）：`aud-sort-scope-note` 上屏 = 「仅在当前已加载的 3 条内排序——服务端没有可用的排序参数（本轮实测拿不到生效证据），清掉排序就回到服务给的回行顺序。」；披露条数 3 == 参与重排的行数 3。

PNG 真实尺寸（IHDR，均 > 视口高 ⇒ 真 fullPage 非首屏）：

- `audit-sort-f76-1440-plain.png` 1440×1159（208970 B）
- `audit-sort-f76-1440-sorted.png` 1440×1174（219114 B）
- `audit-sort-f76-375-plain.png` 375×1744（176701 B）
- `audit-sort-f76-375-sorted.png` 375×1774（186542 B）

PNG 落在取证目录（不入仓，`docs/_artifacts` 之外）：`/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/knw-density/`

## 3. 原始读数附件

- 本文同批附 `audit-sort-p1-readings-76782dcb66.json`（脚本原样输出，10505 B；键 `dist` / `upstreamWhoami` / `legs`）。

## 4. 判据与边界

- 并窗判据＝看脸文件内容（§0 两条 grep/wc 读数），不看 tip 存在性。
- **现役验收脸不含本笔**：部署 dist `data-aud-sort-scope` 命中 0 ⇒ §1 五件是车道同源码重建值，供 aud 换代后比对；比对成立前，任何「屏上已见行级标注」的话都不该写。
- 审计行是忠实回放 stub：现网 `/agent-api/api/audit` 在授权门下 403 `console.forbidden`（opsadmin 代登/授权两路径待参谋拍），L0 明示属预期，非故障口径；因此「行在屏上」的证据只证形制渲染，不证现网数据可读。
- 空扫描面不算证据：两腿 rows=3 非空才记读数；1440 腿那条 502 来自非审计端点，与本笔无关（另一跑互换）。
- 本笔只做车道内可交付面：服务端排序参数越域（API/BFF 契约），需 L0 派后端。

## 5. 复跑命令

```bash
cd /Users/kevin_studio/Projects/forks/console-design && git merge --ff-only 76782dcb66
cd web && node_modules/.bin/vite build        # BUILD_RC=0
cd /Users/kevin_studio/Projects/forks/console-design/hermes_cli/web_dist && nohup python3 -m http.server 9148 --bind 127.0.0.1 >/dev/null 2>&1 &
cd /private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/knw-density && node shot_audit_sort.mjs --dist=http://127.0.0.1:9148 --out=/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/knw-density --label=audit-sort-f76 --upstream=http://127.0.0.1:9122
pkill -f 'http.server 9148'
```

门禁：`cd web && node_modules/.bin/vitest run src/modules/audit` → 90 files / 699 tests（改前红原文 `Tests 4 failed | 695 passed (699)`，FAIL `expected [ null, null, null ] to deeply equal [ 'service-order', …(2) ]`）；L0 亲跑全量 490 files / 3625 tests 绿。本台账笔为 docs-only，不改测试结论，未重跑全量。
