# w187 停令只读台账：运行时 select 逐路由探测

- 触发：用户 10:2x 直令冻结一切页面改造（knowledge 列表密度单挂起，等 UI-DIRECTION v2）。本目录 = 停令明确允许的只读准备：「若你有空可跑一遍运行时 select 逐路由探测读数（仅 document.querySelectorAll('select').length，只读不改码），落 docs/_artifacts/tonight/** 纯台账」。
- 未起笔自证：停令到件时 console-aud 树 PORC(非untracked)=0、HEAD==e472f9429f，无任何 knowledge 域代码改动、无红桩入仓（红稿只停在 /tmp 草稿，未落盘到仓）。

## 口径
- 脸：face `add934b0c3750d377c47ee81cd79fa6fabc930bf`（当拍 10:26:19+08 定向 ls-remote lane/hermes-console 落文件 /tmp/d-w187-lsr.txt 现取）。
- 部署面（与脸分列）：现役 entry `/assets/index-CCMhKt2U.js`（DOM performance 实测；:9122 docroot = 主树 dist，d40eeab987 代 build 09:08，脸 newer 未重建换代）。
- 端口：8183（Caddy bind 100.117.184.117 → 127.0.0.1:9122）。
- 登录腿：keep-jar 只读 token，storageState 注入 cookie name=access_token_cookie、domain=100.117.184.117、path=/；未代登、未碰 plist。每路由截前浏览器内 `fetch('/auth/whoami').status` 紧贴断言：**200 × 12/12**。
- 路由集来源：侧栏 ASIDE anchor 实测枚举（非硬猜）+ 知识页 tab 变体；12 条 = /overview、/overview?tab=usage、/employees、/work、/approvals、/identity、/knowledge、/knowledge?tab=spaces、/knowledge?tab=ingest、/capabilities、/system、/audit。
- 方法坑（如实）：首腿用 /agent-v2 前缀 URL goto，12/12 被归一化回 /overview（href 全等）⇒ 首腿读数为伪像，弃；终腿改用根路径 goto，各路由 href 独立归一（如 /knowledge?tab=spaces&panel=spaces、/capabilities?tab=skills）证明真渲染后计数。domcontentloaded + main-stability ≤4s + 800ms，无 networkidle。

## 读数（终腿）
| route | select 数 | whoami |
|---|---|---|
| /overview | 0 | 200 |
| /overview?tab=usage | 0 | 200 |
| /employees | 0 | 200 |
| /work | 0 | 200 |
| /approvals | 0 | 200 |
| /identity | 0 | 200 |
| /knowledge | 0 | 200 |
| /knowledge?tab=spaces | 0 | 200 |
| /knowledge?tab=ingest | 0 | 200 |
| /capabilities | 0 | 200 |
| /system | 0 | 200 |
| /audit | 0 | 200 |

- 结论读数：**全站 12 路由 `<select>` 原生控件数 = 0**（UI-DIRECTION select.length===0 验收线现状基线，v2 到件可直接对照）。
- jsErrors 0。
- res4xx 附带读数（整轮收集）：10 条全 **404** `/agent-api/...` 族（user/list、user/all、documents×4、knowledge/spaces×3、sources、ingest-status）——与 w180/w185 基线（10 条全 403 业务端点族）**URL 面不同**；本轮 overview 采样未现 403 族。不下「同既有面」判词，原样供 L0 参考（可能涉路由序列/缓存，未归因）。

## 纪律
- 零改码、未 push 任何代码笔；token/真实群 id 未入档（正则泄露检查 False）。
- 全量 vitest 归 L0；本台账纯 docs。
- 幻影 sha 不引；数据原件：select-probe-readings.json。
