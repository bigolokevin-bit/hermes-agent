// @vitest-environment jsdom
/**
 * R303：审批复制播报与导出并发护栏（纯测试，零产品改动）。
 *
 * 先 git grep 查重，已覆盖只回证据（行号=当轮链上实读）：
 *  - 工单①「连续两次导出 blob 逐字相等」主体 = approvals.export.fail.isolation
 *    .test.tsx（R243）it② L192——但那是**错误条滞留站**；「无状态变化的健康站」
 *    双导出幂等从未成站锁过，且「导出计数不增」（apv7-export-count 文案）
 *    R243 未拉进对照。本文件 it①=健康站补齐该组合。
 *  - 工单③「重试成功换代后导出集合==屏上、重试恰 +1」= R243 it③ L211 +
 *    approvals.export.triple.test.tsx（R253）it③ L238 + approvals.paging.test.tsx
 *    （R139）失败面板 rid 腿；「导出失败」现场裁决 = 列表腿失败站（导出纯前端
 *    无自身抛错路径，R139/R235 裁决在案，禁为此改产品）。本文件 it③ 真增量 =
 *    「错误播报只一次」：apr5-inline-failure 节点数首现==1、重试滞留后仍==1
 *    （不堆叠），R243 只锁 truthy 未锁计数。
 *  - 工单②「导出与行复制交替」无任何先例：rowcopy.same（R265）it L259=同站
 *    复制↔CSV 逐格但无交替时序；pair2（R302）=抽屉开态先复制后导出单序；
 *    announce（R301）=播报节点不涉导出。本文件 it②=复制→导出→再复制交替，
 *    锁「导出不写剪贴板」+ 第二份复制文本与第一份及 CSV 对应行逐字三方一致。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Button: ({
    onClick,
    children,
    ...rest
  }: {
    onClick?: () => void;
    children?: ReactNode;
    [k: string]: unknown;
  }) => (
    <button type="button" onClick={onClick} {...(rest as Record<string, never>)}>
      {children}
    </button>
  ),
  Card: ({ children, ...rest }: { children?: ReactNode; [k: string]: unknown }) => (
    <div {...(rest as Record<string, never>)}>{children}</div>
  ),
  CardContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

import { ApiError } from "@/lib/api-error";
import ApprovalsHistoryModulePage from "./ApprovalsHistoryModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let roots: Root[] = [];
let mounted: HTMLDivElement[] = [];

const clearScreen = (): void => {
  for (const root of roots) {
    act(() => {
      root.unmount();
    });
  }
  roots = [];
  for (const el of mounted) el.remove();
  mounted = [];
};

afterEach(() => {
  clearScreen();
  api.fetchJSON.mockReset();
});

const waitFor = async (cond: () => boolean, label: string): Promise<void> => {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
};

async function render(entry = "/approvals?tab=history"): Promise<void> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  mounted.push(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <ApprovalsHistoryModulePage />
      </MemoryRouter>,
    );
  });
  await waitFor(() => !document.querySelector(".animate-pulse"), `${entry} settled`);
}

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const qa = (id: string): Element[] => Array.from(document.querySelectorAll(`[data-testid="${id}"]`));
const clicks = (): number => api.fetchJSON.mock.calls.length;
const rowIds = (): string[] =>
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap_"]'))
    .filter((el) => !String(el.getAttribute("data-testid")).includes("-details-"))
    .map((el) => String(el.getAttribute("data-testid")).replace("apr5-row-", ""));

const clickTestId = async (id: string): Promise<void> => {
  const el = q(id) as HTMLButtonElement | null;
  expect(el, id).toBeTruthy();
  await act(async () => {
    el!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
};

/** 简单 CSV 解析：本文件夹具标题不含逗号/引号（R243 同款口径）。 */
function parseCsv(text: string): string[][] {
  return text
    .replace(/^\\uFEFF/, "")
    .split("\r\n")
    .filter((line) => line !== "")
    .map((line) => line.split(","));
}

/** 拦一次导出：收 blob、锁导出不新增 fetch，返回全文与网格。 */
async function grabCsv(): Promise<{ text: string; grid: string[][] }> {
  const before = clicks();
  const blobs: Blob[] = [];
  const orig = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  const origClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = ((blob: Blob) => {
    blobs.push(blob);
    return "blob:copy-export-concurrency-303";
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
  HTMLAnchorElement.prototype.click = () => undefined;
  try {
    await clickTestId("apv7-export");
    await waitFor(() => blobs.length === 1, "export blob captured");
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

const written: string[] = [];
const stubClipboard = (): void => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (t: string) => {
        written.push(t);
        return Promise.resolve();
      },
    },
  });
};

async function copyRowById(id: string): Promise<string> {
  const index = rowIds().indexOf(id);
  expect(index, `row ${id} present`).toBeGreaterThanOrEqual(0);
  const btn = q(`apr-row-copy-${index}`) as HTMLButtonElement | null;
  expect(btn, `apr-row-copy-${index}`).toBeTruthy();
  const seen = written.length;
  const before = clicks();
  await act(async () => {
    btn!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await waitFor(() => written.length > seen, `clipboard write for ${id}`);
  expect(clicks(), "row copy never refetches").toBe(before);
  return written[written.length - 1]!;
}

const CA = {
  approvalId: "ap_cn1",
  title: "并发导出完整单",
  status: "approved",
  riskLevel: "high",
  decidedAt: "2026-11-19T02:00:00Z",
  createdAt: "2026-11-18T01:00:00Z",
  requestId: "req-cn-1111222233334444",
};
const CB = {
  approvalId: "ap_cn2",
  title: "并发导出待办单",
  status: "pending",
  riskLevel: "low",
  createdAt: "2026-11-19T01:00:00Z",
  requestId: "req-cn-2222333344445555",
};
const CC = {
  approvalId: "ap_cn3",
  title: "并发导出缺值单",
  status: "approved",
  createdAt: "2026-11-17T01:00:00Z",
};
const CD = {
  approvalId: "ap_cn4",
  title: "并发导出追加单",
  status: "pending",
  riskLevel: "medium",
  createdAt: "2026-11-16T01:00:00Z",
  requestId: "req-cn-4444555566667777",
};

const PAGE1 = { items: [CA, CB, CC], nextCursor: "cn-2" };
const PAGE2 = { items: [CD] };

/** 健康站：cursor 腿永不出场（①② 不点追加钮）。 */
const serveQuiet = (): void => {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) return {};
    return PAGE1;
  });
};

/** 失败站夹具：cursor 腿首击 500（rid=req-r303-page），重试即成功（R243 同型）。 */
function serveFailOnce(): void {
  let cursorTries = 0;
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) return {};
    if (u.includes("cursor=")) {
      cursorTries += 1;
      if (cursorTries === 1) {
        throw new ApiError("boom", {
          status: 500,
          body: JSON.stringify({ code: "runtime.unavailable" }),
          url: u,
          requestId: "req-r303-page",
        });
      }
      return PAGE2;
    }
    return PAGE1;
  });
}

describe("R303 approvals copy x export concurrency guards", () => {
  it("① quiet station: two back-to-back exports are byte-identical and no counter or request advances", async () => {
    serveQuiet();
    await render();
    await waitFor(() => rowIds().length === 3, "three rows settled");
    const exportCountBefore = q("apv7-export-count")?.textContent ?? "";
    const listCountBefore = q("apv5-count")?.textContent ?? "";
    expect(exportCountBefore, "导出计数文案与健康站同源").toContain("3");

    const first = await grabCsv();
    const callsBetween = clicks();
    const second = await grabCsv();

    expect(second.text, "两次导出逐字相等（无状态变化）").toBe(first.text);
    expect(clicks(), "两次导出间零新增请求").toBe(callsBetween);
    expect(q("apv7-export-count")?.textContent, "导出计数不增").toBe(exportCountBefore);
    expect(q("apv5-count")?.textContent, "列表计数不动").toBe(listCountBefore);
    expect(rowIds(), "行集不受导出影响").toEqual(["ap_cn1", "ap_cn2", "ap_cn3"]);
    expect(first.grid.slice(1).map((r) => r[0]), "CSV 行集==屏上").toEqual(rowIds());
  });

  it("② alternating exports with row copies: the export never writes the clipboard and copy text stays cell-for-cell with the CSV row", async () => {
    stubClipboard();
    serveQuiet();
    await render();
    await waitFor(() => rowIds().length === 3, "three rows settled");

    const copy1 = await copyRowById("ap_cn1");
    const writesAfterFirstCopy = written.length;
    const { grid } = await grabCsv();
    expect(written.length, "导出从不写剪贴板").toBe(writesAfterFirstCopy);

    const copy2 = await copyRowById("ap_cn1");
    expect(copy2, "交替导出后复制文本不变").toBe(copy1);

    const row = grid.slice(1).find((r) => r[0] === "ap_cn1")!;
    expect(row, "CSV 里找得到该行").toBeTruthy();
    const lines = copy2.split("\n");
    expect(lines.length, "六段结构").toBe(6);
    expect(lines[0]).toBe(`单号：${row[0]}`);
    expect(lines[1]).toBe(`标题：${row[1]}`);
    expect(lines[2]).toBe(`状态：${row[2]}`);
    expect(lines[3]).toBe(`风险：${row[3]}`);
    expect(lines[4]).toBe(`更新时间：${row[4]}`);
    expect(lines[5]).toBe(`短码：${String(row[6]).slice(-8)}`);

    // 交替再走一轮：另一行（缺值行）在第二次导出后仍逐字可用
    await grabCsv();
    const copy3 = await copyRowById("ap_cn3");
    const gapRow = grid.slice(1).find((r) => r[0] === "ap_cn3")!;
    const gapLines = copy3.split("\n");
    expect(gapLines[0]).toBe(`单号：${gapRow[0]}`);
    expect(gapLines[3], "缺 risk 行两侧同写人话").toBe(`风险：${gapRow[3]}`);
    expect(gapLines[5], "缺 rid 行 CSV 空字段 vs 复制短码「—」").toBe("短码：—");
    expect(gapRow[6], "CSV rid 列留空").toBe("");
    expect(written.length, "全程只有三次复制写入").toBe(3);
    for (const t of written) expect(t, "播报不泄内部枚举").not.toMatch(/undefined|null/);
  });

  it("③ failure announcement is a single node before and after the retry, and the post-retry export carries only the converged set", async () => {
    serveFailOnce();
    await render();
    await waitFor(() => rowIds().length === 3, "page one settled");
    await clickTestId("apv-page-more");
    await waitFor(() => !!q("apr5-inline-failure"), "page failure shown");
    expect(qa("apr5-inline-failure").length, "错误播报只一个节点").toBe(1);

    const fail = q("apr5-inline-failure") as Element;
    const retry = Array.from(fail.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("重试"),
    ) as HTMLButtonElement | null;
    expect(retry, "错误条内的重试入口").toBeTruthy();
    const before = clicks();
    await act(async () => {
      retry!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await waitFor(() => rowIds().length === 4, "retry appends the fourth row");
    expect(clicks(), "重试恰一条列表读").toBe(before + 1);
    // 滞留=已记录缺陷现状（R139/R243 在案，修复需另令）；增量=滞留期间仍只一个节点。
    expect(qa("apr5-inline-failure").length, "播报滞留但不堆叠，仍只一次").toBe(1);

    const { grid } = await grabCsv();
    expect(grid.slice(1).map((r) => r[0]), "blob 只含成功换代后的集合").toEqual(rowIds());
    expect(rowIds()).toEqual(["ap_cn1", "ap_cn2", "ap_cn3", "ap_cn4"]);
  });
});
