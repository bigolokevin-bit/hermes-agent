# sessions NaN=0 收尾帧 @a675c98a30（L0 03:2x 续派，nan-fix DoD 尾）

- 脸关系一句：nan-fix 链 0b51c8f0a4 fix(web/sessions) + b35bdbeed7 test 已在集成链；本拍现查 tip=a675c98a30（我 wave-173 台账笔，docs-only ⇒ 产物不变）。产物 entry=assets/index-kWaJfTXV.js 173255B mtime 03:11，served(:9122)==disk 同名实测。
- 登录态前置：urllib GET /auth/whoami 带 storageState cookie 头 = **200**（本拍时刻见 readings.json 的 whoami.at 字段；authState 旗标不算——页内 fetch whoami=401 属既有通道差异：storageState cookie domain=100.117.184.117，不回注 127.0.0.1 页内请求）。
- 判据串（计数本体）：**DOM 文本中 NaN 出现次数=0（main.innerText 与 document.body.innerText 双计，逐行元素 textContent 含 NaN 计数=0）**。

## 逐拍读数（readings.json 序列化全部计数本体）

| 拍 | mainNaN | bodyNaN | 行级 rows | 备注 |
|---|---|---|---|---|
| /sessions @1440 | 0 | 0 | msg/age/cardMeta 全 0（withNaN 0） | mainLen=106，空态 'No sessions yet' 真实可现 |
| /sessions @375 | 0 | 0 | 同上 0 | 同形 |
| /chat 哈希形 @1440/@375 | 0 | 0 | 0 | '#/chat' 未挂载——落值班台默认面（mainLen 1074，mainHead '运营 · 控制台…值班台…'），如实记事实 |
| /chat path 形 @1440/@375 | 0 | 0 | side=ASIDE sideNaN=0 sideRows=0 | 侧栏元素挂载，head='⠋ Loading chat…'——数据端点 401 未回，聊天行/缺值行**不可现**（原因：无会话数据，非 NaN 判据缺陷） |

- 缺值行可现性（L0 条款「若此刻无缺值行可现，如实记 rows 读数与不可现原因即闭」）：sessions 页与聊天侧栏 rows=0 均因数据端点 401（jsErrors/res4xx=6/6 与 11/11，全部 401 Failed-to-load-resource，属既有「鉴权外业务端点面」residual401Source156/themeConsoleErrorAudit166 归因，非新增面）；无缺值行可现，判据在可见文本范围内 NaN=0 成立。
- 幻影纪律：本文件所有数字均为当拍磁盘/浏览器实测序列化（readings.json 同目录），无引用任何未经磁盘证实的历史 sha/读数。
- 全量 vitest 归 L0 亲验基线（487 files/3596 tests），本车道未自跑。

## 补证轮（L0 wave-171 判定后，chat 腿）
- 根因：storageState cookie 域=100.117.184.117，浏览器打 127.0.0.1 页面不带 cookie ⇒ 旧 chat-path 拍（mainLen=15『⠋ Loading chat…』、res4xxSample=[401 /auth/whoami]）=未登录伪像，**作废不作数**（原帧仍在册仅供对照）。
- 正解形制：token 不动、仅把 cookie 域改写为 127.0.0.1 注入浏览器（urllib 带 cookie 头 whoami=200 先证 token 活）；每次截帧前在浏览器内 `await fetch('/auth/whoami').then(r=>r.status)` 紧贴断言。
- 读数（chat-补证-readings.json + chat-1440.png / chat-375.png）：
  - 1440x900：whoamiPre=200、whoamiAtShot=200、mode=live、实渲非骨架（loadingSkeleton=false）、jsErrors=0、4xx=0；ageCount=0（侧栏无行）⇒ 按『空态平凡真、覆盖不足』如实记，main/body/row NaN=0。
  - 375x812：whoamiPre=200、whoamiAtShot=200、mode=live、**ChatSessionList 真渲 1 行且 last_active 缺值落「—」**（ageCount=1、agesWithDash=1）、ageNaN=0、main/body/row NaN 全 0、jsErrors=0、4xx=0 ⇒ 缺值行上屏路径拿到真证据，无需 VG 桩。
- 判据串沿用：『DOM 文本中 NaN 出现次数=0（main.innerText 与 document.body.innerText 双计，逐行元素 textContent 含 NaN 计数=0）』；端口 9122 / entry index-kWaJfTXV.js / 脸 21c276dd0b。
