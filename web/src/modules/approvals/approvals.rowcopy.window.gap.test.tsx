// @vitest-environment jsdom
/**
 * R300 — 审批行复制 × 时间窗边界一致性护栏（纯测试，零产品改动）。
 *
 * 文件命名裁决：工单点名 approvals.rowcopy.window.test.tsx 已被链上 R236 版
 * 占用（wave 在链，磁盘终裁），按 R296 先例另起无冲突名 .gap.test.tsx。
 *
 * 现场裁决（按现状锁，禁改产品）：
 * - window 参现状=摆设（R129/R139/R233 契约）：不进请求、不改写 URL 携带的
 *   值本身、控件恒 disabled。工单①「请求不带 window=」与现状一致，直接锁。
 * - 工单③「刷新均 inert」与现场冲突：gates.ts empty 相 retry=enabled
 *   （「真实空集也值得刷新确认」）。按现状锁：刷新钮可用、点一次恰 +1 条
 *   列表请求且不带 window=、仍零 Blob；导出钮才是不 inert 侧（disabled+
 *   title+强点零 Blob）。禁为此改产品。
 * - 已覆盖只回证据，本文件不重写：
 *   默认站复制六段↔CSV 逐格与翻页配对 = approvals.export.rowcopy.same
 *   （R265 it①②）+ approvals.rowcopy.pairs（R297 it①②，含 riskView 单点、
 *   window=__nope__ 站「每请求无 window=+URL 逐字+三值」——R297 版在盘文件
 *   rowcopy.pairs 已锁请求腿）；裸 window 站三计数 = history.window
 *   （R233 it①）；跨 status 站六段逐字不变 = rowcopy.stability（R234 it①）；
 *   导出切站换代零残留 = export.multistatus it②；空站导出 inert+「不是缺数」
 *   = export.summary.parity it③（R269 L284）+ export.bounds it①（R235）。
 * - 本文件真缺口（工单×现场交集）：
 *   ①window=__nope__ 伪参站把「apr-row-copy-<i> 全文 ↔ CSV 对应行」升为
 *     逐行逐格同帧（R297 锁了请求与三值，行级逐格配对未在该站锁过）；
 *   ②「窗口站做过复制+导出操作后」再切 ?status= 站：新站钮↔行配对不乱、
 *     旧窗行零残留（R234 只锁复制文本不变，未锁操作后切站的 blob 侧配对）；
 *   ③status=pending&window=__nope__ 组合空站：三钮形态集中站（复制 0 个 +
 *     导出 disabled+title+强点零 + 刷新按现状可用腿）。
 */
import { act, useEffect } from "react";
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
import ApprovalsHistoryModulePage from "./ApprovalsHistoryModulePage";
import { riskView, statusView } from "./model";

const mock = vi.mocked(fetchJSON);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Probe() {
  const location = useLocation();
  useEffect(() => {
    document.body.setAttribute("data-r300-search", location.search);
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
  await waitFor(`${entry} settled`);
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

const sleep = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 5));
  });
};

const q = (id: string) => document.querySelector(`[data-testid="${id}"]`);
const lastSearch = () => document.body.getAttribute("data-r300-search") ?? "";
const rowIds = () =>
  [...document.querySelectorAll('[data-testid^="apr5-row-ap_"]')]
    .filter((el) => !(el.getAttribute("data-testid") ?? "").includes("-details-"))
    .map((el) => (el.getAttribute("data-testid") ?? "").replace("apr5-row-", ""));
const railIds = () =>
  [...document.querySelectorAll("button[data-testid]")]
    .map((b) => b.getAttribute("data-testid") ?? "")
    .filter((t) => /^apr-row-copy-\d+$/.test(t))
    .sort((a, b) => Number(a.replace(/\D+/g, "")) - Number(b.replace(/\D+/g, "")));
const listUrls = () =>
  mock.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/api/approvals?"));
const clicks = () => mock.mock.calls.length;

function clickTestId(id: string) {
  const el = q(id);
  expect(el, `testid present: ${id}`).toBeTruthy();
  el!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\r" && src[i + 1] === "\n") {
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
      i += 1;
    } else if (ch === "\n") {
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c !== ""));
}

async function grabCsv(): Promise<{ text: string; grid: string[][] }> {
  const before = clicks();
  const blobs: Blob[] = [];
  const orig = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  const origClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = ((blob: Blob) => {
    blobs.push(blob);
    return "blob:r300-window-gap";
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
  HTMLAnchorElement.prototype.click = () => undefined;
  try {
    clickTestId("apv7-export");
    await sleep();
  } finally {
    URL.createObjectURL = orig;
    URL.revokeObjectURL = origRevoke;
    HTMLAnchorElement.prototype.click = origClick;
  }
  expect(blobs.length, "one blob per export").toBe(1);
  expect(clicks(), "export never refetches").toBe(before);
  const text = await blobs[0].text();
  return { text, grid: parseCsv(text) };
}

async function copyRail(index: number): Promise<string> {
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
  const before = clicks();
  clickTestId(`apr-row-copy-${index}`);
  await sleep();
  expect(written.length, `rail ${index} writes once`).toBe(1);
  expect(clicks(), "copying fetches nothing").toBe(before);
  return written[0];
}

const WD0 = {
  approvalId: "ap_wd0",
  title: "窗口待办零号",
  status: "pending",
  riskLevel: "medium",
  createdAt: "2026-11-18T04:00:00Z",
  requestId: "req-wd-55556666",
};
const WD1 = {
  approvalId: "ap_wd1",
  title: "窗口边界一号",
  status: "approved",
  riskLevel: "high",
  createdAt: "2026-11-17T01:00:00Z",
  decidedAt: "2026-11-19T02:00:00Z",
  requestId: "req-wd-11112222",
};
const WD2 = {
  approvalId: "ap_wd2",
  title: "窗口边界二号",
  status: "approved",
  riskLevel: "low",
  createdAt: "2026-11-17T03:00:00Z",
  decidedAt: "2026-11-19T05:00:00Z",
  requestId: "req-wd-33334444",
};

function serveRows(emptyPending: boolean) {
  mock.mockImplementation((url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent((u.split("id=")[1] ?? "").split("&")[0]);
      const row = [WD0, WD1, WD2].find((r) => r.approvalId === id);
      return Promise.resolve(row ? { ...row } : {});
    }
    if (u.includes("status=pending")) {
      return Promise.resolve({ items: emptyPending ? [] : [WD0] });
    }
    return Promise.resolve({ items: [WD1, WD2] });
  });
}

describe("R300 row-copy x window-boundary guards (gap-only)", () => {
  afterEach(() => {
    root?.unmount();
    root = null;
    document.body.replaceChildren();
    mock.mockReset();
  });

  it("① at the window=__nope__ fake-param station every rail copies its own CSV row cell-for-cell, and no request ever carries window=", async () => {
    serveRows(false);
    await render("/approvals?tab=history&window=__nope__");
    expect(rowIds()).toEqual(["ap_wd1", "ap_wd2"]);
    expect(railIds()).toEqual(["apr-row-copy-0", "apr-row-copy-1"]);
    expect(lastSearch(), "URL keeps the pseudo param as-is").toContain("window=__nope__");
    const { grid } = await grabCsv();
    expect(grid[0].join(",")).toBe("id,title,status,risk,updated_at,correlation,rid");
    expect(grid.slice(1).length, "csv rows == table body").toBe(rowIds().length);
    for (let i = 0; i < rowIds().length; i += 1) {
      const lines = (await copyRail(i)).split("\n");
      const full = grid[i + 1];
      expect(full[0], "csv row is the rail's own row").toBe(rowIds()[i]);
      expect(lines.length, `rail ${i} keeps six segments`).toBe(6);
      expect(lines[0]).toBe(`单号：${full[0]}`);
      expect(lines[1]).toBe(`标题：${full[1]}`);
      // 人话单点：状态/风险两侧都从 model 派生，禁硬编码词面
      expect(lines[2]).toBe(`状态：${full[2]}`);
      expect(full[2], `csv status col is the human label (row ${i})`).toBe(
        statusView("approved").label,
      );
      expect(lines[3]).toBe(`风险：${full[3]}`);
      expect(full[3]).toBe(riskView(i === 0 ? "high" : "low").label);
      expect(lines[4]).toBe(`更新时间：${full[4]}`);
      expect(lines[5]).toBe(`短码：${full[6].slice(-8)}`);
    }
    // 复制与导出的载体都不泄 window 词
    expect(lastSearch()).toBeTruthy();
    for (const u of listUrls()) {
      expect(u, "list leg never carries window=").not.toMatch(/window=/);
    }
    expect(q("apv5-count")?.textContent).toBe(String(rowIds().length));
  });

  it("② after copying and exporting at the window station, switching ?status= re-pairs rails to the new rows with zero stale residue", async () => {
    serveRows(false);
    await render("/approvals?tab=history&window=__nope__");
    const oldCopy = await copyRail(0);
    expect(oldCopy).toContain("ap_wd1");
    const oldBlob = (await grabCsv()).text;
    expect(oldBlob).toContain("ap_wd1");
    // 快捷钮切 status=pending：服务端维必重取（R244 契约）
    const before = listUrls().length;
    clickTestId("apv5-filter-status-pending");
    await waitFor("status switch landed");
    await sleep();
    expect(listUrls().length, `one new list leg after switch ${before}`).toBe(before + 1);
    expect(rowIds(), "the pending station shows its own set").toEqual(["ap_wd0"]);
    expect(railIds()).toEqual(["apr-row-copy-0"]);
    const { grid, text } = await grabCsv();
    expect(grid.slice(1).map((r) => r[0])).toEqual(["ap_wd0"]);
    expect(text, "csv has zero rows from the old station").not.toMatch(/ap_wd1|ap_wd2/);
    const newCopy = await copyRail(0);
    expect(newCopy.split("\n")[0]).toBe("单号：ap_wd0");
    expect(newCopy).toContain(`状态：${statusView("pending").label}`);
    expect(newCopy).toContain(`风险：${riskView("medium").label}`);
    expect(newCopy, "fresh copy carries no old row").not.toMatch(/ap_wd1|ap_wd2/);
    for (const u of listUrls()) {
      expect(u, "switched requests still carry no window=").not.toMatch(/window=/);
    }
  });

  it("③ the combined empty station (status=pending & window=__nope__): no rails, export inert with its reason, refresh stays usable per current gates", async () => {
    serveRows(true);
    await render("/approvals?tab=history&status=pending&window=__nope__");
    expect(rowIds(), "empty set renders no rows").toEqual([]);
    expect(railIds(), "empty set renders no copy rails").toEqual([]);
    const exp = q("apv7-export") as HTMLButtonElement | null;
    expect(exp, "export button present").toBeTruthy();
    expect(exp!.disabled, "export is disabled at the empty station").toBe(true);
    expect(exp!.getAttribute("title"), "disabled export states its reason").toContain("不能导出");
    // 强点导出：零 Blob 零请求
    const before = clicks();
    const blobs: number[] = [];
    const orig = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    const origClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = ((b: Blob) => {
      blobs.push(1);
      void b;
      return "blob:r300-forced";
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
    HTMLAnchorElement.prototype.click = () => undefined;
    try {
      clickTestId("apv7-export");
      await sleep();
    } finally {
      URL.createObjectURL = orig;
      URL.revokeObjectURL = origRevoke;
      HTMLAnchorElement.prototype.click = origClick;
    }
    expect(blobs.length, "forced click on inert export makes zero blobs").toBe(0);
    expect(clicks(), "forced export click makes zero requests").toBe(before);
    // 现场裁决腿：empty 相刷新=enabled（gates.ts「真实空集也值得刷新确认」），
    // 与工单「inert」表述冲突时按现状锁：点一次恰 +1 条列表腿、不带 window=。
    const reload = q("apv-gates-refresh") as HTMLButtonElement | null;
    expect(reload, "refresh button present").toBeTruthy();
    expect(reload!.disabled, "refresh stays usable at the true-empty station").toBe(false);
    const listBefore = listUrls().length;
    clickTestId("apv-gates-refresh");
    await waitFor("refresh round settled");
    await sleep();
    expect(listUrls().length, "refresh costs exactly one list leg").toBe(listBefore + 1);
    const last = listUrls()[listUrls().length - 1];
    expect(last, "refresh leg carries status").toContain("status=pending");
    expect(last, "refresh leg carries no window=").not.toMatch(/window=/);
    expect(blobs.length, "refresh never produces a blob").toBe(0);
    expect(railIds(), "still no rails after refresh").toEqual([]);
  });
});
