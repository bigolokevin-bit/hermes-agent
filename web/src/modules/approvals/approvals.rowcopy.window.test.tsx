// @vitest-environment jsdom
/**
 * R236 — 审批行复制与屏上在跨窗口切片下的一致性（纯测试，零产品改动）。
 *
 * 现场裁决（按现状记录，禁臆造行为）：
 * - `window` 参现状=摆设（R129/R139/R233 契约）：不进请求、不改写 URL、
 *   控件恒 disabled。工单②「切到 window=30d 后行集换代」与现场冲突：
 *   请求带参不变 ⇒ 行集不变；本文件按「换代不可能」现状锁——
 *   「切换」以改地址重挂（分享/手改 URL）形态执行，行集与序号仍连续。
 * - 已覆盖只回证据，不重写：
 *   裸 ?window=30d 站三计数（apv5-count==表体==/^apr-row-copy-\d+$/ 数）+
 *   请求无 window=/status= = approvals.history.window（R233 it①）；
 *   非法 window 不改写不进请求+空态无裸 0 = R233 it③/R129 it③；
 *   跨 ?status= 站六段复制逐字不变 = approvals.rowcopy.stability（R234 it①）；
 *   排序切换钮与行不串 = R234 证据（R162 it L245）；
 *   空集导出 disabled+title+零请求零 Blob = approvals.empty it② + export.bounds it①。
 * - 本文件补的缺口：
 *   ①同一行复制「更新时间」段与屏上相对时间载体（apv-time-row-* 的 title
 *     绝对到分）同源不打架，且 window 参词（window/7d/窗口）绝不进复制文本；
 *   ②7d→30d 两站行集一致、复制序号从 0 连续、计数与可复制行数一致；
 *   ③空窗口站（status=approved 且服务端空集合）不渲复制钮、导出
 *     disabled+title、强点零请求（R229 dispatchEvent+双锁形态复用于窗口站）。
 */
import { act } from "react";
import { useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@/lib/api", () => ({ fetchJSON: vi.fn() }));

vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    onClick,
    ...rest
  }: {
    children?: ReactNode;
    onClick?: () => void;
    [k: string]: unknown;
  }) => (
    <button type="button" onClick={onClick} {...(rest as Record<string, never>)}>
      {children}
    </button>
  ),
  Card: ({ children, ...rest }: { children?: ReactNode; [k: string]: unknown }) => (
    <div {...(rest as Record<string, never>)}>{children}</div>
  ),
  CardContent: ({ children, className }: { children?: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

import { fetchJSON } from "@/lib/api";
import ApprovalsHistoryModulePage from "@/modules/approvals/ApprovalsHistoryModulePage";

const mock = vi.mocked(fetchJSON);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Probe() {
  const location = useLocation();
  useEffect(() => {
    document.body.setAttribute("data-r236-search", location.search);
  }, [location.search]);
  return null;
}

let root: Root | null = null;

async function render(entry: string) {
  await act(async () => {
    root?.unmount();
  });
  document.body.replaceChildren();
  const host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[entry]}>
        <ApprovalsHistoryModulePage />
        <Probe />
      </MemoryRouter>,
    );
  });
  await waitFor("the board settled");
}

async function waitFor(what: string) {
  for (let i = 0; i < 3000; i += 5) {
    if (!document.querySelector(".animate-pulse")) return;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
  }
  throw new Error(`waitFor: ${what} never settled`);
}

const q = (id: string) => document.querySelector(`[data-testid="${id}"]`);
const lastSearch = () => document.body.getAttribute("data-r236-search") ?? "";
const rowIds = () =>
  [...document.querySelectorAll('[data-testid^="apr5-row-ap_"]')].map((el) =>
    (el.getAttribute("data-testid") ?? "").replace("apr5-row-", ""),
  );
const railIds = () =>
  [...document.querySelectorAll("button[data-testid]")]
    .map((b) => b.getAttribute("data-testid") ?? "")
    .filter((t) => /^apr-row-copy-\d+$/.test(t));
const listUrls = () =>
  mock.mock.calls
    .map((c) => String(c[0]))
    .filter((u) => u.includes("/api/approvals"));

const WK1 = {
  approvalId: "ap_wk1",
  title: "季度预算一号",
  status: "approved",
  riskLevel: "high",
  requestedBy: "human:7",
  approvers: [{ userId: "human:7", name: "郑涛" }],
  reasonText: "按计划执行",
  createdAt: "2026-11-18T01:00:00Z",
  decidedAt: "2026-11-19T02:00:00Z",
  requestId: "req-wk-11112222",
};
const WK2 = {
  approvalId: "ap_wk2",
  title: "密钥轮换二号",
  status: "approved",
  riskLevel: "low",
  requestedBy: "human:8",
  approvers: [{ userId: "human:8", name: "阿朝" }],
  createdAt: "2026-11-18T03:00:00Z",
  decidedAt: "2026-11-19T03:00:00Z",
  requestId: "req-wk-33334444",
};

function serveTwoRows() {
  mock.mockImplementation((url: string) => {
    if (url.includes("/api/approval?id=")) return Promise.resolve({});
    if (url.includes("status=approved")) return Promise.resolve({ items: [WK1, WK2] });
    return Promise.resolve({ items: [] });
  });
}

function serveEmptyApproved() {
  mock.mockImplementation(() => Promise.resolve({ items: [] }));
}

async function copyRow(index: number): Promise<string> {
  const written: string[] = [];
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (t: string) => {
        written.push(t);
        return Promise.resolve();
      },
    },
  });
  const btn = q(`apr-row-copy-${index}`);
  expect(btn, `copy button ${index} exists`).toBeTruthy();
  const callsBefore = mock.mock.calls.length;
  await act(async () => {
    btn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  expect(written.length, "one write landed").toBe(1);
  expect(mock.mock.calls.length, "copying fetches nothing").toBe(callsBefore);
  return written[0];
}

/** 「绝对 2026-11-19 10:00:00（北京时间） · ISO …」→ 「2026-11-19 10:00」。 */
const absMinute = (title: string | null) => (title ?? "").slice(3, 19);

describe("R236 row-copy × window slice guards (approvals.rowcopy.window)", () => {
  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    root = null;
    document.body.replaceChildren();
    mock.mockReset();
  });

  it("① the copied 更新时间 segment is the same instant the row shows, and no window word rides the text", async () => {
    serveTwoRows();
    await render("/approvals?tab=history&status=approved&window=7d");
    expect(rowIds(), "rows landed").toEqual(["ap_wk1", "ap_wk2"]);

    const text = await copyRow(0);
    const lines = text.split("\n");
    expect(lines).toHaveLength(6);

    const timeCell = q("apv-time-row-ap_wk1");
    expect(timeCell, "row time carrier exists").toBeTruthy();
    const shown = absMinute(timeCell!.getAttribute("title"));
    expect(shown, "row shows the decided minute in BJT").toBe("2026-11-19 10:00");
    expect(lines[4], "copy rides the very same minute").toBe(`更新时间：${shown}`);

    // window 参词绝不进复制文本（摆设参数不外溢）。
    expect(text.toLowerCase(), "no window key in copy").not.toContain("window");
    expect(text, "no slice words in copy").not.toMatch(/7d|30d|窗口/);
    expect(text, "no engine words").not.toMatch(/undefined|null|NaN/);
  });

  it("② the 30d station cannot swap the rows: same set, rail indices stay contiguous, counts agree", async () => {
    serveTwoRows();
    await render("/approvals?tab=history&status=approved&window=7d");
    expect(railIds(), "rail at 7d").toEqual(["apr-row-copy-0", "apr-row-copy-1"]);

    await render("/approvals?tab=history&status=approved&window=30d");
    // 现场裁决：window 不进请求 ⇒ 服务端看到的问题一字不差，行集换代不可能。
    for (const u of listUrls()) {
      expect(u, "window never rides the request").not.toContain("window=");
    }
    expect(rowIds(), "the rows survive the switch untouched").toEqual([
      "ap_wk1",
      "ap_wk2",
    ]);
    expect(lastSearch(), "the URL keeps the requested slice").toBe(
      "?tab=history&status=approved&window=30d",
    );
    expect(railIds(), "rail restarts at zero, contiguous").toEqual([
      "apr-row-copy-0",
      "apr-row-copy-1",
    ]);
    const count = q("apv5-count");
    expect(count, "count rides along").toBeTruthy();
    expect(count!.textContent, "count == rows == rail").toBe(
      String(rowIds().length),
    );
    expect(rowIds().length).toBe(railIds().length);

    const second = await copyRow(1);
    expect(second.split("\n")[0], "rail 1 copies row 1").toBe("单号：ap_wk2");
  });

  it("③ an empty slice shows no copy rail, and the export stays inert", async () => {
    serveEmptyApproved();
    await render("/approvals?tab=history&status=approved&window=7d");
    expect(railIds(), "no copy buttons on an empty set").toEqual([]);
    expect(rowIds(), "no rows").toEqual([]);

    const exportBtn = q("apv7-export");
    expect(exportBtn, "export control present").toBeTruthy();
    expect((exportBtn as HTMLButtonElement).disabled, "export is disabled").toBe(
      true,
    );
    expect(exportBtn!.getAttribute("title"), "with a stated reason").not.toBeNull();
    expect(
      (exportBtn!.getAttribute("title") ?? "").length,
      "reason is non-empty",
    ).toBeGreaterThan(0);

    const callsBefore = mock.mock.calls.length;
    await act(async () => {
      exportBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(mock.mock.calls.length, "forcing it asks for nothing").toBe(callsBefore);
  });
});
