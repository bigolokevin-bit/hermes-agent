# PE-07 — ?state= 四态贯通（档案名册 / 组织 / 详情分区）· DONE

分支 `task/PE-07-forced-states`（基=PE-03 tip merge 现线 29ad92208d）。禁 pnpm install / 禁 commit / 禁 push 均遵守；shell/routes.ts 未动（A 车道深链壳预嵌口径）。

## 改动文件

1. `web/src/modules/people/PeopleModulePage.tsx`
   - `Forced`/`readForced` 补 `denied` 档；`previewResource` 接受 `?rid=`（缺省 `preview-request`，形制抄 EmployeesModulePage.tsx L641-648），并新增 denied 预览腿。
   - unavailable/denied 共用壳拆成两腿：`ppl5-unwired`（未接入，GAP-02 入 title）与 `ppl5-denied`（新锚，「人员目录暂不可见」+ 标杆句 + RequestId 复制钮 L209-234 模式 + 审批真出口）。
   - 新增常量 `PEOPLE_DENIED_MESSAGE`＝EmployeesPage.tsx **L655** 逐字：「该数据源尚未开放，或你没有查看权限。请确认后台已接入对应服务，或联系管理员开通权限。」（整块替换口径＝**L391** 注释「403/404 → 无权限/未开放，整块替换」+ L625-629 合并话术说明）。
2. `web/src/pages/EmployeeDetailPage.tsx`
   - 页内 `?state=loading|empty|error|denied` 强制腿（`emp-detail-preview`+`data-phase`），强制态零请求（`useEmployeeDetail(rawId, enabled)` 门）、分区 Tab 与五分区锚一律不渲染（整块替换）。
   - error/denied 腿走 `ErrorStateBlock`（denied=status 403 → 标杆 L625-655 话术）；`?rid=` 透传，缺省 `preview-request`；请求号经 `RequestIdCopy`（req-copy 钮）可复制。重试＝摘 ?state= 回活体（真出口，对齐 shell T42-1）。
3. `web/src/modules/org/OrgModulePage.tsx`
   - `readState` 泛化为 `forcedParam(name)`（hash 内查询优先，回落 search）；forced error/denied 腿接 `?rid=`。
   - forced denied 腿从「未接入」壳拆出：「组织与部门暂不可见」+ 标杆句逐字，GAP-02 title 不再挂本腿，补重试真出口。活体 403/404→未接入合并腿原样保留（既有 13 例钉，含 OrgModulePage.test.tsx L190）。
4. `web/src/modules/people/people.states.forced.test.tsx`（新建，15 例）
   - 每页×每态：专属锚+专属文案在场、互斥锚/ready 体不在场、强制态零请求。
   - 禁词断言形制＝字面量 `not.toContain`：三条 denied 腿全页 ⊄「未接入」（含 ⊄GAP-）、两条 unavailable 活体腿（people 403/404、org 403）⊄「无权限」；people 预览空态亦双禁词不沾。
   - 请求号：people `ppl5-request-id-copy`、org `org5-copy-req`、详情 `req-copy`（?state=error&rid= 上屏）；另加一条分区活体失败腿剪贴板回环例（点 req-copy → writeText("req-ws-7") → 「已复制」）。
   - `consoleErrors=0`：每例 afterEach 计 `vi.spyOn(console,"error")`（本轮抓出 Button stub 透传 `outlined` 的 React warning 并在 mock 内修复）。

## 自检原样命令与结果

```
$ export PATH="$HOME/.nvm/versions/node/v26.13.1/bin:$PATH"
$ npx vitest run src/modules/employees src/modules/people src/modules/organizations src/pages
Test Files  30 passed (30)   Tests  238 passed (238)     # 基线 223 → 223+15 新增，零回归
$ npx vitest run src/modules/org
Tests  13 passed (13)                                    # 卡面命令的 organizations 路径不存在，org 目录补跑
$ npx vitest run src/modules/employees src/modules/people src/modules/organizations src/modules/org src/pages
Tests  251 passed (251)
$ npx tsc -b . --noEmit | grep -c "error TS"
49                                                        # 全部在 ../apps/shared/*（基线噪声），web/src 计 0 → delta 0 新增
$ npx tsc --noEmit -p tsconfig.app.json | grep "error TS" | grep -vc "^../apps/shared"
0
$ node_modules/.bin/vite build > /tmp/pe07-build.log 2>&1; echo exit=$?; grep -c "✓ built" /tmp/pe07-build.log
exit=0  count=1
# 牙齿自检：PEOPLE_DENIED_MESSAGE 掺「（未接入）」→ denied 例转红（1 failed | 14 passed）→ 还原后 grep=0，复跑 251/251 绿
```

## 边界与假定（记档）

- 现网无 403 fixture → jsdom 强制态即本契约真相源；denied 腿为预览专属腿（loadPeople 的活体 403/404→未接入合并口径不改，尊重既有 L129/L190 钉与「不泄露资源是否存在」标杆语义）。
- 「四态贯通」的详情=视图级整块替换（与深链壳 ConsolePane 同形制），非每分区各挂一条 ?state= 腿；分区自带失败腿的请求号/复制回环由新增例补钉。
- org 活体未接入腿 MISSING_REASON 含「无权查看」三字（非禁词字面「无权限」），系既有 13 例钉死句式，未动。
- 详情强制腿未新增 routes/shell 触点；Q12 17 例与 PE-03 18 例措辞零触碰。
