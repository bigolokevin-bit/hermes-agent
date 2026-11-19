# apr5 — 审批历史 8 态筛选（lane/console-appr，base c4c6e750）

## 8 态权威名单（PRD v4.1 §4 / WBS T17 / model.ts STATUS_FILTERS line196-205）

| 值 | 中文 |
|---|---|
| pending | 待处理 |
| approved | 已通过 |
| rejected | 已拒绝 |
| revise_requested | 要求修改 |
| expired | 已过期 |
| cancelled | 已撤回 |
| consumed | 已执行 |
| superseded | 已被新单替代 |

未知值 → 「状态未识别」+原值保留在详情，不猜测、不假 0。筛选=「全部」不发 status；每态真传 `/agent-api/api/approvals?status=<值>&limit=50`（BFF 参数，非前端假过滤）。

## 本单改动

1. `apr4-*` → `apr5-*` testid 全家族改名（denied/row-/retry/request-id/error/copy-request-id/loading/comment/request-id-missing/page-pending/page-history/list/forced-note/filter-/empty-history 等）。
2. ApprovalsHistoryModulePage：筛选下拉（`apr5-filter-status`）URL 驱动——`?tab=history&status=<值>` 可分享、刷新/回退保态；条数行「已显示 N 条「<状态>」记录」。
3. 请求编号沿用 RequestIdCopy（`apr5-copy-request-id`），文案「复制」→「已复制」/「复制失败，请手动选择」。
4. 新用例⑥「八状态筛选逐个真传参，可分享可刷新」：循环 8 值断言 mock fetch URL 含 `status=<值>` + 深链 selected 保态；⑦「未知状态行不猜测」断言「状态未识别」。

## 定向 vitest（原始 stdout，exit 0）

```
Test Files  3 passed (3)
      Tests  48 passed (48)
   Start at  15:24:00
   Duration  1.21s
```

（改名、筛选区、用例⑥⑦全部落地后复跑，原始 stdout 如上，exit 0。）

## 屏幕读数（9123 静态预览 = vite build --outDir dist-appr + python3 -m http.server；只读验证，不碰 9122 served 代次）

- 同源 SPA pushState `/approvals?tab=history&status=consumed`：location.search 保持 `?tab=history&status=consumed` ✓（URL 保态/可分享坐实）。
- 切 `status=superseded`：location.search 保持 ✓。
- 375×812 同源 iframe `/approvals`：scrollWidth=375 ✓（1440 主布局无横溢改动）。
- **如实注明**：optCount/rows 预览读数为 0——9123 静态预览无 BFF，列表数据腿不可用（错误态而非假 0）；每态参数与条数证据以上面 vitest ⑥⑦（mock 网络断言 URL 含 status=<值>）为准。截图同受此限制未附。

## 残留核查

`grep -rn "apr4" web/src/modules/approvals/` → 1 处命中 = states.tsx line35 **注释**「（GAP-04：审批引擎尚未提供该接口）」，非上屏文本、非 testid，保留。

## 提交

- 单 commit `feat(console): approvals eight-state filters (apr5)`，写域仅 `web/src/modules/approvals/**` + `docs/_artifacts/appr/**`；App.tsx/shell/其他 modules/package/lock/web/scripts 未动；未跑 install；未 amend/force/--no-verify。
