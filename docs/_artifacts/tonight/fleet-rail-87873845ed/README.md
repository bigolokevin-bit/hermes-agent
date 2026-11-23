# w190 FleetRail 样板 A 对照图（1440/375）＋条款6 全页 h1 live 读数

- 脸号：face-at-shot = `87873845ed2cda106b23db324b8b7a913c3f8ec1`（11:45 定向 ls-remote 落文件 /tmp/d-w190-lsr.txt 现取；本台账笔内另报 face-now）。
- 拍摄面：before = 现网部署 :9122（经 Caddy 8183 根路径直访，entry `/assets/index-DU9vDpj3.js`，含 FleetRail 未含 h1 降格）；after = console-aud 树本地构建（`vite build` BUILD_RC=0，entry `/assets/index-BLhDxkaC.js`，含 h1 降格 a98d657788 ＋ 375 轨宽修复笔，桩数据仅供版面对照）。端口自报：before 腿 = 100.117.184.117:8183；after 腿 = fixture 127.0.0.1:9127（静态本树 dist＋/auth、/agent-api 代理回 :9122＋仅 employees 桩）。
- token 来源：L0 假通道 E2E 留存 keep-jar（只读注入，未代登、未碰 plist、未请用户点登录）；每帧前浏览器内 `fetch('/auth/whoami').then(r=>r.status)===200` 紧贴断言：before-1440 200×2、before-375 200×2、after-1440 200×2、after-375 200×2、补拍腿 200×2；curl 级先验 200@11:45:32（granted:false 如实）。

## 判据读数（实拍，非推断）

- 条款6 全页 h1：before `h1Count=2`（『运营总览』『值班台』——部署面未含降格笔，如实）；after `h1Count=1`（仅 TopBar『运营总览』，n17 先例口径 live 收口实证）。
- H1 几何（after 9 卡实测 rect）：1440 档 320×176、1280 档 288×168、375 档 260×160；最大最小卡高差 0px ≤1px；单行 top 差 0px。375 滑轨可视宽：修复后 trackW=324，首张全显＋第二张 56px，可见比 (260+56)/260 = **1.215 ∈ [1.1,1.3]** ✓。修复前实读 trackW=262 比 1.000 出档——根因：≥8 张时箭头/暂停钮挤压 flex 轨，随本台账前一笔 `fix(web/duty): 375 档滑轨 flex-shrink 0 + stage wrap` 收口（控件换行不盖卡，符合『超窄时可用宽优先卡不盖内容』）。
- H3 轮播（补拍腿真实时钟）：t0 scrollLeft=0 → t3s=0（6s 内不动）→ t6500=328（=卡宽320+gap8 步进一张）✓；hover 8s moved=0 ✓；暂停钮文案 暂停轮播→继续轮播 ✓ 且暂停期过一拍 328 不动 ✓；键盘 ←→ 单步 ±328 生效（→ 读数 656 = 一拍自动轮播同窗竞入，已如实；← 精确 −328 钳位正常）；溢出且 9 张箭头渲染 2 枚 ✓（7 张 0 枚由 vitest 钉）。
- I4 未知态：granted:false 与桩数据下 `[data-metric-value]` 全为 `—`（单位『次/%』独立不并入），`[role=progressbar]` 计数 0 ✓（逐人日聚合端点未接入——数据面需求见下）。
- console 面：本轮四腿＋补拍 jsErrors=0、consoleErrors=0、res4xx=0——现网 /employees 本轮返回 200（3 名真实员工，before 卡数=3 由此来），w180/w185 的 10×403 业务面本轮缺席；如实记录，**不下同数判词**（面漂移非清账）。375 逐元素 rect 右界 ≤376、左界 ≥−1 违例 0（逐元素口径，非 scrollWidth）。
- 截图法：`domcontentloaded`＋显式 settle 1.8s（验收脸禁 networkidle）；内部滚动壳按『视口加高取图法』probe scrollHeight 后 setViewportSize 再取图（fullPage 在该脸为高危 no-op）；本机根字号 15px，几何一律按浏览器实测 px 报数。playwright 经 sibling createRequire（seakoi-console-web）解析， chromium-1255 实跑（版本披露）。

## UI-GATE 判据需求（assert-agent-rail.mjs 本体归 L5/GATE）

1. ①单行 top 差 ≤1px；②卡高差 ≤1px；③375 滑轨 324 可见比 ∈[1.1,1.3]；④hover 暂停（2s 内 scrollLeft 不变）；⑤无文本溢出（逐元素 rect）；⑥运行时字号集合 ⊆ 六档；⑦卡内无 /emp_|ou_|Hermes/i；＋双视口截图。
2. 变体：7/8/9 张 × prefers-reduced-motion × 视口 375/768/1024/1280/1440；H3 模拟时钟 5999 不动/6000 前进一张/末步钳位/到末回首/五况（hover·焦点·拖动·暂停·减弱动效）12s 不动＋条件翻转重新计时。
3. 钩子已挂：`[data-fleet-card]`、`[data-fleet-viewport]`、`[data-metric-value]`、testid `duty-fleet-prev/next/pause`。
4. 数据面欠项：逐人日聚合端点（今日处理数/成功率现依 §6④/§8 走未知态 `—`，接入后点亮）。

## 披露与纪律

- after 腿 employees 为桩数据（9 名合成员，含一名无 name 走 employeeLabel 回退），仅供版面对照，非现网数据；其余端点代理真实 :9122。
- 已知读数缺陷披露：主脚本 visibleRatio375 字段因守卫写错恒 null，正确可见比以 supplement.json legB 为准（track 边界口径）。
- 纪律：只读腿未代登/未碰 plist；真实群 id（oc_/ou_ 具体值）未入 git 与本档；合成 id 仅 emp_st_*；不自签全绿；375 总 PASS 放行权归 UX 总审；全量 vitest 归 L0（现基线 498 files/3677 tests 为 FleetRail 并脸后读数，本笔后待重跑）；幻影 sha 不引。
- 文件清单：readings.json（主腿四档）、supplement.json（轮播/钳位/暂停/键盘/375 轨宽）、fleet-{before,after}-{1440,375}.png 实物。
