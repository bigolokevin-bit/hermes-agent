# `/duty` 重定向参数保真：现查证据与阻塞点（2026-11-20）

## 结论

**本单不做产品改动。** `/duty` 的重定向定义在 `web/src/App.tsx`（禁改面），它用静态字符串 `to`，会丢掉整个查询串；且落点 `/overview` 只读 `range` 一个参数。要修必须由 L0/集成车道改 `App.tsx`，本车道只交证据与建议，不伪造“已保真”。

## 1. 重定向的现查形制

```bash
git grep -n "duty" -- web/src/App.tsx web/src/shell
```

命中（去掉 shell 内与本单无关的 fixtures/console 行）：

```
web/src/App.tsx:97:  const DutyConsolePage = lazy(() => import("@/modules/duty/DutyPage"));
web/src/App.tsx:1187: live={{ duty: <DutyConsolePage />, usage: <UsageConsolePage /> }}
web/src/App.tsx:1319-1326: R32 item 3 注释：七条裸路径不再静默落到 /overview …
web/src/App.tsx:1327: <Route path="/duty" element={<Navigate to="/overview" replace />} />
```

即：`to` 是**静态字符串**（无 `search`），`replace: true`；`/tasks` 同样是静态串（`to="/work?tab=board"`）。这是既有风格，也是丢参数的根因。

## 2. 实测：查询串确实被丢掉

用一次性 jsdom 探针（`MemoryRouter` + 与 App 相同的 `Navigate` 形制），入口 `/duty?window=7d&view=employee`：

```
expect(landed).toBe("/overview?")   // 通过
```

落点为 `/overview`，`search` 为空——`window`、`view` 全部消失。探针跑完即删，**未把“丢参”写成测试锁死**（那会把缺陷固化成契约）。

## 3. 即便保留，落点也不认这些名字

- `web/src/modules/duty/dutyRange.ts:30`：`DUTY_RANGE_PARAM = "range"`，默认 `14d`（`DEFAULT_DUTY_RANGE`）。
- `DutyPage` 只从 `?range=` 取时间范围；`window` / `view` / `groupBy` / `q` 在 `/overview` 上没有任何读取点。

所以“只修 Navigate”不够：`/duty?window=7d` 修完会变成 `/overview?window=7d`，页面仍是默认 14 天。

## 4. 建议的两步改法（需 L0 授权，均在本车道写域之外）

1. **保留来源查询串**（`web/src/App.tsx`，需 `useLocation`）：

   ```tsx
   <Route path="/duty" element={<DutyRedirect />} />
   // function DutyRedirect() {
   //   const location = useLocation();
   //   return <Navigate to={{ pathname: "/overview", search: location.search }} replace />;
   // }
   ```

   若不想新增组件，也可让 `/duty` 的入口链接直接发 `/overview?range=…`，绕开重定向。

2. **参数归一**（二选一，`modules/duty` 写域内可做）：
   - 来源侧直接改用 `range`（`24h|7d|14d|30d`），或
   - `/overview` 侧把 `window` 映射成 `range`（`7d` 同名；`24h/30d` 同名；缺失才回落默认）。

   不建议做 `view/groupBy/q` 的假映射：`/overview` 没有对应概念，硬塞只会造出“看起来生效”的假象。

## 5. 验收建议（给改后那单）

- jsdom：入口 `/duty?window=7d` 落点 `search` 保留；若做归一，则屏上时间范围按钮 `duty-range-7d` 为 `aria-pressed=true`。
- `duty-*` 与 `ov6-*` 全部保留；零额外请求。
- 三档：1440 / 1280 / 375 无横向溢出。

## 6. 本单边界

- 未改 `App.tsx` / `shell` / `registry` / 任何产品代码；只新增本文档。
- 未新增路由、未动 `PATH_ALIASES`、未动 redirects 计数。
- 未测：真实浏览器里粘贴 `/duty?window=7d` 的落点（需先有上述授权改动）。
## 2026-11-20 已授权修复（一行级改动）

L0 放开了 `web/src/App.tsx` 中 `/duty` 这一条 Route。实施如下：

- 新增 `web/src/modules/duty/dutyRedirect.tsx`：`dutyRedirectTarget(search)` 只做 `window|range → range`，
  `14d → 30d`（与 dutyRange 读 30 天再裁 14 天一致）；`view/groupBy/q` 不映射（`/overview` 没有对应读取点，
  伪造会把页面没读过的值写进地址）。`DutyRedirect` 组件取 `useLocation().search` 后 `<Navigate replace>`。
- `App.tsx` 仅两行：新增一条 import，`<Route path="/duty" element={<DutyRedirect />} />`。其余 Route、
  `shell/routes.ts`、registry 未动；`/overview` 的读取逻辑未动。

验收读数（jsdom，`dutyRedirect.test.tsx`）：

| 入口 | 落点 |
|---|---|
| `/duty?range=7d` | `/overview?range=7d` |
| `/duty?window=7d` | `/overview?range=7d` |
| `/duty?window=14d` | `/overview?range=30d` |
| `/duty` | `/overview` |

`?view=employee&groupBy=model&q=x&window=zz` → `/overview`（不认识的参数一律不带过去）。

门禁：`assert-ia` html / `--source=react` 均 exit 0，计数 51/22/1/8 不变（routes 运行时自检未触碰，
redirects 仍 24/24）；duty 6 files / 106 passed；全量 162 files / 2239 passed；tsc 本域 0；eslint exit 0。

未测：真实浏览器从旧书签进入后的落点（jsdom 已覆盖同一 `Navigate` 行为）。
