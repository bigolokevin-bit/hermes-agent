# DONE · AU-02 服务器导出前端消费面（fixer ses_df554b40f，L0 板 2026-11-24 第二枚）

- 票面现读=表账 `AU-02`（slug=a5，branch `task/AU-02-a5`，写域 `web/src/modules/audit/`，status READY）
  ＋backlog `knowledge-audit-sessions.md` §AU-02。**转述纠偏**：派工转述作「审计分页性能·A5 面」——分页=AU-05
  （已在面 658129dc），A5 面=服务端导出（本卡）。按表账+backlog 原文实施，未越 AU-05 面。
- 基线：fork `ls-remote origin refs/heads/lane/hermes-console` 当拍实读
  `5885e0ceaa68fa6eb0fa3cfd58d983484b8cd179`（与票面预期同值）；分支父=该脸。
- 起点态：fork `git ls-remote origin` 全列 **3655 行**，`grep -i au-02` = **0**（无同名抢占）；
  au-01 线在架 cbc7e72d、au-05 重推在架 658129dc（他道账，勿动）。
- lanes.yaml：H 仓自登 `au-02-a5`（state: external 免跨仓校验），板笔
  `da8eb3755ebb4ba569cf3d254abbff468ffc0e8d` 落 main 当拍回读同值；registered 14→**15** 回读核。

## 交付形制

三件新 + 三件接线，全部落 `web/src/modules/audit/`：
- `serverExport.ts`（契约纯层）：A5 体拼装（from/to 缺一不建单；filters 线名映射
  action/actorId/resourceId=域白名单 audit_export.py:47-49 子集）；幂等键 `au02-*`
  随单不随点（重试双击不重建）；错误族→人话表（403 角色/429 日上限/503 未开通/
  90天窗/网络断/未知 HTTP，各族指路下一步）；**downloadUrl 域内部路径→BFF Q10
  路径形态改写**（`/v1/audit/exports/<id>/download?...` →
  `/agent-api/api/audit-export/<id>/download?...`；形状不认识=null，不猜链）。
- `useServerExport.ts`（状态机）：idle→creating→polling→ready/failed/slow，
  竞态纪律逐字沿用 AU-05 useAuditVerify 定版（seq 票号吞迟到、AbortController 断在飞、
  卸载即掐、轮询串行不叠发、预算 50×1.2s 用尽=slow≠failed，「再查一次」对同一单续预算
  且**绝不二次 POST**；取消只停跟踪不下「失败/完成」结论）。
- `auditGates.ts`：新增 `exportServer` gate——**只吃地址窗不吃屏上行数**（服务端导出的
  意义正是比屏幕大的集合；denied/empty 不禁，窗草稿才禁），reason 写在 title。
- `states.tsx` `ServerExportControl`：按钮文案恒带「整窗」与屏上两枚快导（CSV 族）语义隔离；
  ready=真下载锚（target=_blank rel=noreferrer noopener，有效期/截断各有专行）；
  failed=人话+请求编号行（requestIdLine 复用）；polling=取消跟踪钮；slow=再查一次钮。
- `AuditEventsModulePage.tsx`：hook 一行 + bar 挂载点（audI 屏上文案行原样不动）。

## DoD 对号（票面四条）

| DoD | 落点 |
|---|---|
| 管理员建单→轮询→下载全链测试 | audit.export.server.test.tsx「链」组（pending→completed→改写锚逐字节；recheck 同单同键） |
| roView/普通角色 403+请求编号 | 403 族文案（console.forbidden/request.forbidden→管理员句）+ rid 行；轮询被拒族另例（429+rid 逐字面） |
| 导出>上限拒并给分页导出指引 | 429=「等明天或现在用『导出当前筛选 CSV』」；audit.query_too_broad=「收窄窗或屏上快导」；truncated=「不是全窗，再导小窗单」 |
| 前端两按钮语义清晰不混 | 在飞态专例：服务端单飞着，`aud5-export` 仍 enabled、audI 屏上文案原样、服务端按钮 disabled 防叠发；文案「整窗」vs「屏上这一份」互斥词面 |

## 判据读数（当拍实跑）

```
$ cd web && PATH="/opt/homebrew/bin:$PATH" pnpm exec vitest run src/modules/audit
 Test Files  1 failed | 92 passed (93)
      Tests  3 failed | 726 passed (729)
# 本卡前 face 同命令=717 例中 3 failed（=audit.time.window.parity.test.tsx R229 预存红，
# 逐名核对同三例，勿修勿背）；本卡 +12 例全绿，零新增红。
$ pnpm exec tsc --noEmit → exit 0
$ pnpm exec eslint src/modules/audit/ → 0 errors, 3 warnings（warnings 全部在
  useAuditData.ts AU-05 段，非本卡文件；本卡六件 0 error 0 warning）
$ git diff --stat（tracked 三件）
 AuditEventsModulePage.tsx |  11 ++-
 auditGates.ts             |  18 ++++
 states.tsx                | 111 ++++++++++
 新文件：serverExport.ts / useServerExport.ts / audit.export.server.test.tsx
```

## 边界与遗留

1. 勿越清单核账：AU-03/04/06 未触；KB/OM-16/SE-04 未触；server.py 未动（本卡消费端点=
   Q10 已落 main 的 /api/audit-export 三形制，BFF 腿零新增）。AU-01 已落
   contextLinks/详情面原样，未重写。
2. 轮询间隔/预算为前端自定常量（1.2s×50），非服务契约值；后端若有 retry-after 语义
   可后续对齐（不造假承诺，写成导出常量可注入）。
3. live 真链（真 BFF+domain+worker+AUDIT_EXPORT_SECRET）留 QA 部署腿（Q10 DONE 同注）；
   本卡全链在 fetchJSON 桩上钉形制。
4. fork 测试环境沿用他道既有形制：worktree 根/web 两处 `node_modules` 符号链指回主检出
   （AP-01 族先例；untracked，不入库）。
5. `just` 本机在位（/opt/homebrew/bin/just 1.59.0），提交走 lefthook 实拍无绕钩。
