# R166 — audit.filters 四例修红：修前读数 / 修后读数

- 车道：`lane/console-aud`（console-aud worktree）。写域：`web/src/modules/audit/**` + 本证据文件。
- 命令一律 `cd web && export PATH="/opt/homebrew/bin:$PATH"`，退出码不经管道取。
- 定性结论：**用例假设过时，不是产品回归。产品行为未变、仅修断言**（另新钉一枚控件形制用例；未删任何用例、无 skip/xfail）。
- 成因：wave-36 合入的 `feat(console): custom selects, button tiers and cjk letter-spacing` 把
  `aud01-filter-type` / `aud01-filter-operator` / `aud8-filter-resource` / `audH-page-size`
  从原生 `<select>` 换成 `src/shell/ConsoleSelect.tsx`。testid 现在落在 trigger **button** 上
  （`ConsoleSelect.tsx:150-162`：`<button role="combobox" … data-testid={testId} data-value={value}>`），
  而 R133 的 `valueOf()` 读的是 `element.value` —— button 的 `value` IDL 默认是空串，于是四条断言全部
  `expected '' to be …`。机器值从未丢失：它在 `data-value` 里，人看到的仍是中文标签。

## 修前读数（原文，单文件）

```
$ ./node_modules/.bin/vitest run src/modules/audit/audit.filters.test.tsx
 ❯ src/modules/audit/audit.filters.test.tsx (9 tests | 4 failed) 170ms
     × fills the controls with what the address says, in the control's own words 35ms
     × keeps every other parameter byte for byte and lands back on page 1 26ms
     × a limit that is not an offered size is not put on the wire, not rewritten, and says so 10ms
     × opening the record adds only detail=, and keeps window/from/to/type/actor/resource/limit/event 27ms
AssertionError: expected '' to be 'task.created'  at audit.filters.test.tsx:175:42
AssertionError: expected '' to be 'task.created'  at audit.filters.test.tsx:224:42
AssertionError: expected '' to be '50'           at audit.filters.test.tsx:273:39
AssertionError: expected '' to be '25'           at audit.filters.test.tsx:342:39
 Test Files  1 failed (1)
      Tests  4 failed | 5 passed (9)
```

定向全目录（修前）：`Test Files 1 failed | 30 passed (31)` / `Tests 4 failed | 511 passed (515)`。
全量（修前）：`Test Files 1 failed | 227 passed (228)` / `Tests 4 failed | 2750 passed (2754)`。

## 修后读数（原文，同命令、同用例）

```
$ ./node_modules/.bin/vitest run src/modules/audit/audit.filters.test.tsx
 Test Files  1 passed (1)
      Tests  10 passed (10)
   Duration  1.61s
```

- 定向：`./node_modules/.bin/vitest run src/modules/audit` → `Test Files 31 passed (31)` / `Tests 516 passed (516)`。
- 全量：`./node_modules/.bin/vitest run` → `Test Files 228 passed (228)` / `Tests 2755 passed (2755)`（全仓 4 枚红清零）。
- `tsc -b . --noEmit` → 退出 2、共 91 处、`src/modules/audit` 命中 **0**（与本波开始前同一地板，delta 0）。
- `eslint src/modules/audit` → 退出 0、`✖ 4 problems (0 errors, 4 warnings)`，4 条均为既有 `react-hooks/set-state-in-effect`。

## 逐条：哪条断言 / 原假设 / 产品当前真实形制

| 断言位置 | 原假设（R133 写法） | 产品当前真实形制（原文依据） | 修法 |
| --- | --- | --- | --- |
| :175 `valueOf("aud01-filter-type")` toBe `"task.created"` | 事件类型是原生 `<select>`，`.value` 就是机器值 | `ConsoleSelect.tsx:150-162` trigger 是 `<button role="combobox" aria-expanded={open} data-testid={testId} data-value={value}>`；显示文本 = `options.find(item => item.value === value).label`（「创建任务」）。button `.value` = `""` | 改读 `selectValue("aud01-filter-type")`（harness 即读 `data-value`） |
| :224 同上（切窗后再读） | 同上 | 同上；切窗只动地址与游标，控件值仍由 `value` prop 驱动 | 同上 |
| :273 `valueOf("audH-page-size")` toBe `"50"` | 每页条数是原生 `<select>` | `AuditEventsModulePage.tsx:732-736` `<ConsoleSelect id="audH-page-size" data-testid="audH-page-size" value={String(effective)} …>` | 改读 `selectValue("audH-page-size")` |
| :342 `valueOf("audH-page-size")` toBe `"25"` | 同上 | 同上（地址 `limit=25` 时 `effective=25`） | 同上 |
| :176 / :225 `…filter-operator`、:177 `…filter-resource`、:178 / :226 `…page-size` | 同上（这些行原先被上一行短路，未及执行） | 同一控件族：`AuditEventsModulePage.tsx:299` / `:325` / `:351` 全是 `ConsoleSelect` | 一并换 `selectValue`，断言强度不变 |

保持不动的读法：`valueOf("aud01-custom-from")` / `valueOf("aud01-custom-to")` —— 这两栏仍是真
`<input type="datetime-local">`，`.value` 是正确协议。`pairs()`（地址逐字对账）、`paramOf()`（线上参数）、
`pressed()`（时间窗按钮 `aria-pressed`）、`textOf()` 全部未受影响，也正是修前仍有 5 条通过的原因。

采用的手法不是新造的：仓内已有只给测试用的 `src/shell/selectHarness.ts`
（`selectValue` 读 `data-value`、`selectText` 读屏上标签），且另一车道的 `src/modules/runs/runs.filters.test.tsx:37`
`import { pickByValue, selectValue } from "@/shell/selectHarness";` 在同一次改动后已这样修绿。本波沿同一手法，不立第三套。

## 新增的一枚钉子（把形制写进用例，防止再被读错）

`describe("R166 - the shape the picker really has, since these guards read it")`：断言 trigger 是
`BUTTON`、`role="combobox"`、`data-value="task.created"`、`aria-expanded="false"`、`selectValue` 与
`selectText`（含「创建任务」）分别给出机器值与人话，并显式记录 `(node as HTMLSelectElement).value === ""`
——即当年那四条红的成因，被钉成用例而不只是写在注释里。

## 门禁与账目

- 改动仅两处文件：`web/src/modules/audit/audit.filters.test.tsx`（断言换读法 + 1 枚新用例 + 头注）与本证据文件。
- 产品码零改动；未碰 `App.tsx` / `shell` / `routes` / `registry` / `package·lock` / `web-scripts` / `ops`
  （`ConsoleSelect.tsx`、`selectHarness.ts` 与 `runs.filters.test.tsx` 只读引用）。
- 未删用例、未 skip/xfail；用例数 9 → 10。
- 活体腿本波未用：9122 `401 console.unauthenticated`、8092 `404 console.not_found`（既有记录，未重探）。
- 三档口径仍是结构断言（className/属性），未量像素。
