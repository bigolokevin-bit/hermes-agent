# PE-08① DONE — 员工新建模态 + 空态文案修复（编辑抽屉禁用预接）

工作树 `/Users/kevin_studio/Projects/tasks/PE-08-create-edit` @ task/PE-08-create-edit（基线 08b2d24bcd）。未 commit（总控做）。

## 交付文件
- `web/src/modules/employees/CreateEmployeeModal.tsx`（新）：EMP-02 真实写入模态。
- `web/src/modules/employees/EmployeesModulePage.tsx`：新建入口（标题行 + 空态）、`verifyCreated` 重读确认、行级编辑钮 + `EditEmployeeDrawer`（保存禁用预接）、空态文案两分修复、页面级 success toast。
- `web/src/modules/employees/employees.create-modal.test.tsx`（新）：11 用例契约钉。

## 现网取证（2026-11-24，BFF 127.0.0.1:8092，TOK=$(cat ~/.seakoi/opsadmin-token.txt)）
未打实弹：名册 GET 前后均 3 条（`QA2 契约验证 1794894768` / `AgentOS 产品助理` ×2），探针全部在写入前被门拒。
```
# P1 浏览器形制、无 Idempotency-Key（Origin+双提交 cookie 齐，先过 CSRF 门）
curl -s --http1.1 -H "Authorization: Bearer $TOK" -H "Origin: http://127.0.0.1:8092" \
  -b "console_csrf=pe08probe" -H "X-Console-CSRF: pe08probe" -H "Content-Type: application/json" \
  -X POST -d '{"name":"QA-PE08-gate-勿留","title":"t","ownerUserId":"u_probe"}' http://127.0.0.1:8092/api/employees
→ 400 {"code": "request.missing_idempotency_key", "message": "Idempotency-Key header is required"}
# P2 带键、仅 name（幂等门过、体校验拦）
→ 400 {"code":"employee.invalid_initial_version","message":"title is required"}
# P3 带键、name(121字)+title+owner 齐、缺 initialVersion
→ 400 {"code":"employee.invalid_initial_version","message":"initialVersion is required"}（121 字 name 未被长度拦——长度非现跑服务的校验，见偏离②）
# P4 PATCH
curl -s --http1.1 -X PATCH -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" -d '{"name":"x"}' \
  http://127.0.0.1:8092/api/employees/emp_FAKEPE08PROBE
→ 405 {"code": "console.read_only", "message": "first console is read-only; only GET/HEAD allowed"}
```
curl 裸打（无 Origin/双提交）先撞 403 `console.csrf_origin`（P1 前置形态），浏览器腿由 `csrfWriteHeaders()` 供头、无 cookie 直接拒发（测试钉「不发注定被拦的请求」）。

## 卡面事实 vs 实测的偏离裁定（关键）
1. **请求体最小集 {name, title?, department?} 不成立**。域 `services/domain/service.py::validate_create`（bff-v4-serve 实测）要求 name/**title/ownerUserId 皆非空** + 嵌套 `initialVersion`（jobDescription 非空、knowledgeScopes/skillRefs/grantIds 数组、responsePolicy{triggers 非空子集/mode=realtime/loopGuard/四枚 fail-closed fallback 字面量}、memoryScope），P2/P3 实证逐字 400。按 2026-11-17 L4 裁定「initialVersion 由前端构造」实现：表单采集 姓名/岗位/责任人 id/职责说明/部门(可选)，`buildInitialVersion()` 出 fail-closed 缺省（仅 @ 触发、空授权、记忆 90 天、budget 键缺省→域套 DEFAULT_BUDGET），模态内注明缺省可在详情页补。**否则成功语义（重读见到新员工）永远走不通。**
2. **name≤120**：卡引域 schema `Field(max_length=120)`；现跑服务 dict 校验未检长度（P3 实证 121 字过形制校验）。表单仍按裁定钉 `maxLength=120` + 校验文案引用该值（更严不造假）。
3. **幂等门 code 拼写**：现网 `request.missing_idempotency_key`，卡面写 `request.idempotency_required`。前端恒带键，不据此分支；错误一律逐字透传。
4. **department**：创建体是投影快照写入口（`_build_records` 写 `"department": body.get("department")`，projections 恒出键）——**写侧持久化**；P-PE-2 被忽略的是读口 query 参数。表单如实采集，不加「上游暂不持久化」注（与代码事实不符）。
5. **同键重试范围**：卡「同键重试仅限 400 幂等门/502/503」；实测域**只在成功事务落 idempotency 行**（失败仅记 denied 审计，键未消耗）⇒ 本轮任意失败重试均沿用同键（同体安全），502/503 额外冻结字段防 409 `request.idempotency_conflict`；2xx 即换新键。与记忆口径「每次新提交生成一个，重试沿用同一个」一致。

## 落成的行为契约
- 头三件套：`Idempotency-Key`（每轮一密，ref 存）+ `X-Request-Id`（每趟一密）+ `Content-Type: application/json`，另带 `X-Console-CSRF` 双提交。
- 成功语义：2xx → **重读第一页**（按当前筛选）→ 回执 id 或提交名在列 → 才关表单、才发 success toast（toast 挂页面，卸载不吞）；重读落定前表单不关、按钮 disabled（双击不重发）；**无乐观插入**（牙齿见自检 5）。重读不见行（如在职态筛选挡住 draft 新员工）→ 如实「已成功但未在列，勿重复提交」，不假成功。
- 502/503：「已提交状态未知，请刷新列表确认」+ 同键同体重放；上游 400/其它 code/message 逐字 + 可复制请求号。
- 空态：`没有匹配的员工`（筛选腿，保留清除出口）vs `还没有数字员工` → 原死链文案「员工创建后会出现在这里。」删除，换 `新建员工` 实钮直开模态。
- 编辑抽屉：行级编辑钮 → 抽屉渲染、字段预填；保存钮 `disabled + aria-disabled="true" + title=写接口未接入（等 T-PE-D，PATCH 现 405 console.read_only）`；点击（.click 与 dispatch 双路）零请求零 toast（测试⑧钉）。
- 每 pane 主操作 ≤1：标题行「新建员工」outlined 次级；空态卡内「新建员工」为该态唯一实心主操作（对齐 TasksBoard 先例）；非 ready/empty 态入口禁用带原因（测试⑨）。

## 自检（原样命令 + 结果）
```
export PATH="$HOME/.nvm/versions/node/v26.13.1/bin:$PATH"
cd web && node_modules/.bin/vitest run src/modules/employees src/modules/people src/pages
  → Test Files 31 passed (31) / Tests 249 passed (249)   # 基线 238 全绿不回归 + 新增 11 全绿
node_modules/.bin/tsc -p tsconfig.app.json --noEmit
  → 0 errors
node_modules/.bin/vite build > /tmp/pe08-build.log 2>&1; grep -c "✓ built" /tmp/pe08-build.log
  → 1
node web/scripts/lint-fake-success.mjs   # 实际位置在 web/scripts/（仓根无 scripts/lint-fake-success.mjs）
  → violations=[]，ok=true（规划中=188/不会保存=1/未接入=22）
  补：对新增源文件 grep 禁词 已保存|已发送|已重试|已恢复|已处理|已创建|已删除 等 → 0 命中。
牙齿：employees.create-modal.test.tsx 的
  expect(rowIds(), "no optimistic row before the refetch resolves").not.toContain("emp_NEW9001")
  临时反转为 .toContain → 该用例红（AssertionError: expected ['emp_A001'] to include 'emp_NEW9001'），其余 10 绿 → 还原后 11/11 绿。
```

## 残留风险 / 未接线点（明示）
- 编辑抽屉保存 = 纯禁用预接，`onClick` 空操作；解锁需 T-PE-D 的 PATCH 写口 + BFF 写路由注册。
- 新建成功回执 id 拼写按域投影 `id`（测试 e1 实证）容错取 `employeeId` 别名；重读核对以 id 优先、提交名兜底。
- 域侧 `ownerUserId` 拒绝占位符（`pilot_owner_placeholder`，卡 @1677@），表单提示「真实责任人 id」，无候选人下拉（目录数据源接线不在本卡）。
- ?state= 预览壳下提交后的重读返回「未真实重读」（不假验）；实弹创建整链（真写 pilot 名册）仍待总控裁定，本次未打。
