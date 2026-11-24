# DONE · AU-07 审计事件详情右栏「这次运行」卡（fixer ses_df554b40f，判死重派全新实施）

## 判死案背景与本单起点（勿引作废值）

- 旧 AU-07 案（task/AU-07-runs-aside）：板注 09:4x 盘上否证终裁=未交付
  （7218226229/69446d03b3 fork 库 cat-file missing 三轮 + 行零=幻影/竞代吞窗谱系）；
  两值入勿引册。**本单从零重实施，未找旧对象、未引用任何旧 sha。**
- 票面现读：表账 task-lanes.json AU-07 **零行**（判死回退后条目未回填——如实记，非本卡补齐物）；
  范围=本令票面「审计 runs 详情右栏」+设计规格 `docs/product/design/console-v2/deep/04-runs.md`
  §3.9 错误态谱系（403/404 同体、unknown_route 未接入不重试、分块降级）现读引用。
- 开工基线原文：
  ```
  $ git ls-remote origin refs/heads/lane/hermes-console
  13dd51148e8af2fe335e4fa1cfeb3c5de8a48c6c	refs/heads/lane/hermes-console
  $ git ls-remote origin | grep -i au-07
  （无输出，rc=1）
  ```
  全列 3659 行起点态；face 含 AU-01/02/04/05/06 已落面。
- lanes.yaml 自登 `au-07-runs-aside-v2`（state: external）：板笔
  `4bc38637adc1fa0537a92eae0386b6a24ce97ab4` 落 main（registered 15→16 回读核），
  完工 remove 保分支。

## 实施

新三件 + views 接线，全落 `web/src/modules/audit/`：
- `runAside.ts`：`GET /agent-api/api/run-detail?id=`（既有 BFF R2 腿，零路由新增）
  防御性 normalize（runId 缺=无卡；run/detail 嵌套形状兼容同 detail 族先例）；
  状态四词表封闭（succeeded/failed/running/queued→成功/失败/运行中/排队中，
  表外原样、缺值「—」，OM-07 谱系）；花费 null=「该字段未返回」、真 0=「$0.00」
  两态字面必异；失败族表——**403/404 同体**「运行不存在或你无权访问」
  （不泄露存在性，AGENTRUN §3 契约同体律）、`console.unknown_route`「尚未接入」
  且不给重试承诺（deep/04 G-05 纪律）、网络断/HTTP n 族各归其人话+请求编号。
- `useRunAside.ts`：read-once 钩子（一卡一问，不轮询不追问）；seq 票号+abort：
  **换记录旧答作废**（AU-05 竞态谱系）；runId=null → idle 零请求。
- `views.tsx`：右栏 record pane 内新增 `RunAsideSection`——事件带 runId 才挂
  「这次运行」Section（无 run 不空心卡；链位「无关联」已是答案）；
  五格（状态/员工/开始/结束/花费）值只来自运行读口原值（不拿事件字段补数，
  机器证明=测试②：事件 actor 带 8812、读口缺 employeeId → 屏上「该字段未返回」
  且卡内文本零 8812）；北京时到秒复用 beijingSeconds；
  **链出口问 AU-01 单表 runChainOf**（href 逐字同值，第二真源禁止）；
  失败态=人话+`RequestIdLine`（AU-04 组件复用）+「重试这一问」。
- 零越界：AU-01 contextLinks/AU-02 serverExport·useServerExport/AU-04 rid 矩阵/
  AU-05 useAuditData·verify/AU-06 令牌面均未改；server.py、KB 域、evidence/ 未触。

## 判据读数（当拍实跑）

```
$ cd web && PATH="/opt/homebrew/bin:$PATH" pnpm exec vitest run src/modules/audit   # 改前基线（09:44 拍）
      Tests  3 failed | 748 passed (751)
$ pnpm exec vitest run src/modules/audit/audit.run.aside.test.tsx                   # 本卡小样
 Test Files  1 passed (1)
      Tests  9 passed (9)
$ pnpm exec vitest run src/modules/audit                                            # 改后全量
 Test Files  1 failed | 96 passed (97)
      Tests  3 failed | 757 passed (760)
# 3 failed 逐名=audit.time.window.parity.test.tsx（R229 预存三枚，勿背勿修，改前后同名单）；
# 760=751+9 零新增红。
$ pnpm exec tsc --noEmit → exit 0
$ pnpm exec eslint（本卡四件）→ 0 errors / 2 warnings
  （warning=exhaustive-deps 对 seq ref cleanup 的已知保守告警，同族先例在册）
```

小样先行纪律（Q44 教训入册后本车道例行）：本卡 9 例先单跑——首轮即抓到
1 枚自家断言字面碰撞（「不重试」含「重试」），收紧断言语义（not.toContain("可以重试")）
后 9/9 绿，未污染批量读数。

测试清单（9 例）：pure×4（normalize/缺键不补、四词表+真 0 字面、403·404 同体+
unknown_route 不承诺、读口地址形状）+ pane×5（带 run 全链 1 问+五格+链出口与单表
逐字同值、缺键不拿事件补、404→错误态 rid→重试恢复且第二问、无 run 整卡不挂零问+
链位「无关联」互证、换记录迟到答吞掉）。

## 遗留

1. 表账 AU-07 零行：本卡不代登表账（登记侧=参谋/L0 谱系），回件点名。
2. 设计 E-16~E-18 的 runs L1 页右栏（按员工分布/失败原因聚合）属 modules/runs+
   多问成本裁定，非本单「audit 右栏」范围——如需另票。
3. queued 状态词为 runs 契约枚举内补全（queued=排队中）；若上游枚举扩展，
  runStatusWord 表外原样上屏不吞值。
4. live 真链（run-detail 经 9122 现脸）留 QA 部署腿；本卡全在 fetchJSON 桩上钉形制。
