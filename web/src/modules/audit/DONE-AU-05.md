# DONE-AU-05 — 审计校验大窗不挂死：超时/取消/进度态+在飞竞态守卫（前端域）

- 票：板 task-lanes.json AU-05『审计分页性能』写域 web/src/modules/audit/（10h 原案含
  services/domain 异步化，本票面按板写域=前端域实施步骤③+分页契约回归，后端不动）。
- 基线：fork lane/hermes-console 当拍实读 db793b7b10e77b511a402d4b9475fab25f341cad；
  起点 ls-remote 全列 grep -i au-05 = 0 行（lsrem-au05-start.txt，前案幻影无包袱）。

## 改了什么（4 files）

- useAuditData.ts：useAuditVerify 升级——
  · VERIFY_TIMEOUT_MS=8000（依据：H 仓 server.py UPSTREAM_TIMEOUT=5.0 现读 :307，
    BFF 自身放弃走 502=unavailable 族；前端 8s=连接级挂死最后防线，keep-alive
    污染先例在册）；opts 注入短时限供牙齿例。
  · 新态 timeout（时限到 → abort + 「不是结果」文案，明说不推断服务侧）
    / canceled（取消 → 迟到回答被 seq 作废，绝不覆盖）；
  · elapsedMs 250ms 滴答（走过的秒数≠完成度，不编百分比）；
  · 连点竞态：后 run 主动 abort 前一条 + ticket 序号守卫；
  · 卸载清理：seq++/abort/clearInterval，无死组件 setState。
- api.ts：fetchVerify 透传 {signal}（URL/契约零变，ISO 界仍在 URL 不上屏）。
- AuditVerifyModulePage.tsx：loading 带「已等待 X.Xs／本页时限 8s」+取消按钮
  （aud01-verify-cancel）；timeout 卡（aud01-verify-timeout，重试=换窗口再跑）；
  canceled 卡（aud01-verify-canceled，「没有跑完就没有结论」）；状态行 aria-live 补两态。
- audit.verify.timeout.test.tsx：10 例牙齿——时限断连(signal.aborted) / timeout 后
  迟到覆盖被拒 / 取消作废在飞 / 小窗快路不降级 / 502 不被超时劫持 / 连点两窗各带
  ISO 界只取后答 / 默认 8000 常量入册 / 进度文本 / 页面取消重跑 / ISO 不上屏。

## 验证（当拍实跑）

- tsc -b --force --noEmit exit 0（node 26.13.1）
- 点名 4 文件（timeout+verify-page+window+parity）= 38 passed + 3 failed
  ——3 fail=parity 文件，**clean face 同码复现**（stash 后单跑依旧 3 红：
  alpha 组行集期望落空），属脸 db793b7b10 既有红（AU-01 相邻面），非本票产出、
  非我文件引入（本票 10 例全绿）。
- 全量 543 文件（+1 新测文件）：3 failed（同上既有）/ 4185 passed / 1 skipped。
- select 渲染点 0；断言均附命令与 testid 落点（见测试文件内注释）。

## 交报后处置

- 推 task/AU-05-paging → L0 同拍 ls-remote 四证并入；本树 remove 保分支；
  lanes 登记随收口摘除。真库 10 万行大窗手测与覆盖矩阵 L24 销账归后端异步化
  （services/domain 案，另票），本卡阈值先按 5s+余量=8s 入册候基线曲线修正。
