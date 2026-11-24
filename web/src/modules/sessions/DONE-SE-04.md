# DONE-SE-04 — 会话详情消费面：messages[].requestId + citations「有才出现」

- 票（表账现读）：SE-04 / slug requestid-citations / branch task/SE-04-requestid-citations
  / write_scope web/src/modules/sessions/ / status READY（原文粘贴于回执首段）。
- 基线：fork lane/hermes-console 当拍实读 **13dd51148e8af2fe335e4fa1cfeb3c5de8a48c6c**
  （令面预期 7baac3f069 已被翻代，按实读不嵌死值）；起点全列 grep -i se-04=0 行
  （lsrem-se04-all.txt）。

## 改了什么（4 files）

- sessionsApi.ts：详情读口消费——`sessionDetailUrl`（encodeURIComponent 单段，
  非法段交上游 404 不本地猜）、`parseSessionDetail`（messages 形状不认识即抛，
  role 白名单外=null，**citations 缺键/空数组/非列表/无 doc 一律 null=没带回**，
  绝不把「上游没给」洗成空列表或 0）、`fetchSessionDetail`。
- SessionsList.tsx：行「查看详情」钮（aria-expanded）→ 行内详情面板：
  消息按上游顺序全量（不重排，乱序 seq 牙齿例钉住）；每条 requestId 原样上屏
  + 复制钮（成功=已复制；**剪贴板失败=「复制失败：文本已保留，可手动选取」
  并就地选区，禁假成功**）；缺 rid=「—（上游未回传）」无假复制钮；
  assistant 有引用=「引用（N）：…」，没有=「这次回答没有带回引用。」；
  404（不存在与跨租户同体）=不推断存在性、零消息；换行/收起 detailReq 序号
  作废在飞（迟到不回填）；卸载双 ref 作废。
- index.ts：新出口（fetchSessionDetail/parseSessionDetail/sessionDetailUrl + 类型）。
- 新契约 sessions.requestid.citations.test.tsx：**10 例**（URL 编码/rid 上屏复制/
  失败不假报/缺键诚实/citations 四形制 it.each/404/乱序保序/竞态作废）。

## 后端缺口点名（另开卡，非本票）

- 列表行无 messageCount 之外的引用汇总；**列表级无 citations 计数**——若总览要
  「带引用会话数」，需 runtime 列表侧字段（归 L2 数据面票），本票只在 detail
  如实消费，未造任何列表假数。
- 并发同 requestId 败方 502 未收敛缺口＝形状文档 §4 刀③在案，归 L0 裁定，未动。

## 验证（当拍实跑）

- tsc -b --force --noEmit exit 0（node 26.13.1）
- 点名：sessions.requestid.citations 10/10 + SessionsList 既有 13/13 绿
- vitest 全量：551 files / 4268 passed / 1 skipped / **5 failed——5 枚全为
  clean face 既有红**（audit.time.window.parity R229×3 + shell/console.test×2，
  stash 复现钉死与本票无关；令载勿背勿修）
- select 渲染点=0；未触 web/src/modules/audit/（AU 族）、server.py、KB 域；
  样式零内联、复用既有 se6-* 类形制，无新 css 裸声明。

## 交报处置

push 与本回执同拍（ls-remote 命令行原文随回执）；树 remove 保分支；lanes 条目
随收口摘除；375/a11y 真机探针腿归 QA served 轨。
