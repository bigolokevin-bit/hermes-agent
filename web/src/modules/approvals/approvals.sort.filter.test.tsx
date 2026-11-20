// @vitest-environment jsdom
/**
 * R186 — 审批排序×筛选组合护栏（纯测试，零产品改动）。
 *
 * 现场裁决（按 R71/R91/R98/R182 既有契约锁定，禁臆造第二套）：
 * - asort/adir 是**本地排序维**：进 URL、不进请求 query（列表读口白名单
 *   =(status,limit,cursor)，R44/R129 实测）。工单①措辞「请求带排序参」与
 *   现场契约相反——本文件按现状锁「请求带 status、不带 asort=/adir=/
 *   window=/cursor=」，差异在此点名。
 * - 非法 asort=__nope__ 不改写 URL、不抛错；approvalSortKeyOf 归 null →
 *   sortApprovalRows 不排 → 屏上保持服务端默认序（R91 的「该值未被识别」
 *   chip 已锁于 approvals.filterurl.test.tsx，此处只补组合面）。
 *
 * 已覆盖只回证据：R182 it②（排序后 CSV 首行==屏上首行+导出零请求）、
 * R71/R91（sort 钮矩阵与 chips）、R98（chips==生效参）、R129/R139
 * （window 摆设/游标重置）、R127/R162（apr-row-copy 契约）。
 * 本文件增量＝深链排序×筛选请求参组合、改排序三不变式、行序==复制钮序
 * ==CSV 行序三方对照、非法排序参整链现状。
 */
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

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

const api = vi.mocked(fetchJSON);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let roots: Root[] = [];
let mounted: HTMLDivElement[] = [];

function Probe() {
  const loc = useLocation();
  useEffect(() => {
    document.body.setAttribute("data-r186-search", loc.search);
  }, [loc.search]);
  return null;
}

function clearScreen(): void {
  for (const root of roots) {
    act(() => {
      root.unmount();
    });
  }
  roots = [];
  for (const el of mounted) el.remove();
  mounted = [];
  document.body.removeAttribute("data-r186-search");
}

afterEach(() => {
  clearScreen();
  api.mockReset();
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

async function renderInto(entry: string, node: ReactElement): Promise<void> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  mounted.push(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[entry]}>{node}</MemoryRouter>);
  });
  await waitFor(() => !document.querySelector(".animate-pulse"), `${entry} settled`);
}

const page = (entry: string) =>
  renderInto(
    entry,
    <>
      <ApprovalsHistoryModulePage />
      <Probe />
    </>,
  );

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const search = () => document.body.getAttribute("data-r186-search") ?? "";
const rowIds = (): string[] =>
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap_s"]')).map((el) =>
    String(el.getAttribute("data-testid")).replace("apr5-row-", ""),
  );
const rowTitle = (id: string): string =>
  document.querySelector(`[data-testid="apv-trunc-row-title-${id}"]`)?.textContent ?? "";
const urlsAll = (): string[] => api.mock.calls.map((c) => String(c[0]));
const listUrls = (): string[] => urlsAll().filter((u) => u.includes("/api/approvals"));

// 三条已批准行：title 中文字典序由 localeCompare zh 决定（断言用排序结果
// 自证，不硬编码顺序）。
const S1 = {
  approvalId: "ap_s1",
  title: "渠道发布",
  status: "approved",
  riskLevel: "high",
  decidedAt: "2026-11-19T02:00:00Z",
  requestId: "req-s1-1",
  approvers: [{ userId: "human:7", name: "郑涛" }],
};
const S2 = {
  approvalId: "ap_s2",
  title: "密钥轮换",
  status: "approved",
  riskLevel: "low",
  decidedAt: "2026-11-19T03:00:00Z",
  requestId: "req-s2-2",
  approvers: [{ userId: "human:9", name: "阿朝" }],
};
const S3 = {
  approvalId: "ap_s3",
  title: "预算复议",
  status: "approved",
  createdAt: "2026-11-18T01:00:00Z",
  // 无 risk/decided/requestId —— 复制/CSV 缺值主角。
};
const ROWS = [S1, S2, S3];

function serve(): void {
  api.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent((u.split("id=")[1] ?? "").split("&")[0]);
      const row = ROWS.find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    if (u.includes("/api/approvals")) return { items: ROWS };
    return {};
  });
}

async function grabCsvRows(): Promise<string[][]> {
  const captured: Blob[] = [];
  const orig = URL.createObjectURL;
  URL.createObjectURL = ((blob: Blob) => {
    captured.push(blob);
    return "blob:appr186";
  }) as typeof URL.createObjectURL;
  const clicks = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  try {
    const btn = q("apv7-export") as HTMLButtonElement | null;
    expect(btn, "export button").toBeTruthy();
    await act(async () => {
      btn!.click();
    });
  } finally {
    URL.createObjectURL = orig;
    clicks.mockRestore();
  }
  expect(captured).toHaveLength(1);
  const text = await captured[0].text();
  return text
    .split("\r\n")
    .filter((l) => l !== "")
    .map((l) => l.split(","));
}

const DEEP_SORT = "/approvals?tab=history&status=approved&asort=title&adir=asc";

describe("R186 sort × filter combinations", () => {
  it("① deep status+sort link: the request carries status only — sort is the local axis — and the screen is title-sorted", async () => {
    serve();
    await page(DEEP_SORT);
    await waitFor(() => rowIds().length === 3, "three rows");
    const last = listUrls()[listUrls().length - 1];
    expect(last).toContain("status=approved");
    // 现场裁决：asort/adir 不进请求（R71/R98 本地排序契约）。
    expect(last).not.toContain("asort=");
    expect(last).not.toContain("adir=");
    expect(last).not.toContain("window=");
    expect(last, "deep link starts at page one").not.toContain("cursor=");
    // 屏上 title 升序＝localeCompare zh 自证（不硬编码顺序）。
    const titles = rowIds().map((id) => rowTitle(id));
    expect([...titles].sort((a, b) => a.localeCompare(b, "zh"))).toEqual(titles);
  });

  it("② changing the sort reorders locally: no new request, count and row set unchanged", async () => {
    serve();
    await page(DEEP_SORT);
    await waitFor(() => rowIds().length === 3, "three rows");
    const callsBefore = api.mock.calls.length;
    const countBefore = q("apv5-count")?.textContent ?? "";
    const idsBefore = [...rowIds()].sort();
    const btn = q("apv-sort-risk") as HTMLButtonElement | null;
    expect(btn, "risk sort button").toBeTruthy();
    await act(async () => {
      btn!.click();
    });
    await waitFor(() => search().includes("asort=risk"), "sort param in URL");
    expect(api.mock.calls.length, "sorting never refetches").toBe(callsBefore);
    expect(q("apv5-count")?.textContent).toBe(countBefore);
    expect([...rowIds()].sort()).toEqual(idsBefore);
    // 改排序不清 status/q（差分写回，R90 契约的组合面复锁）。
    expect(search()).toContain("status=approved");
  });

  it("③ sorted order == apr-row-copy aria-label order == CSV data-row order, at the first row verbatim", async () => {
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
    serve();
    await page(DEEP_SORT);
    await waitFor(() => rowIds().length === 3, "three rows");
    const ids = rowIds();
    // 复制钮按行序同标号（R127 契约）：第 i 钮的 aria-label 含第 i 行标题。
    const firstLabel = (q(`apr-row-copy-0`) as HTMLButtonElement | null)?.getAttribute("aria-label") ?? "";
    expect(firstLabel).toContain(rowTitle(ids[0]));
    const callsBefore = api.mock.calls.length;
    await act(async () => {
      (q(`apr-row-copy-0`) as HTMLButtonElement).click();
    });
    await waitFor(() => written.length === 1, "copy fired");
    expect(written[0].split("\n")[0], "复制首段=首行单号").toBe(`单号：${ids[0]}`);
    const csv = await grabCsvRows();
    expect(csv.length - 1, "CSV 数据行数==屏上行数").toBe(ids.length);
    expect(csv[1][0], "CSV 首数据行==屏上首行单号").toBe(ids[0]);
    expect(api.mock.calls.length, "复制/导出零请求").toBe(callsBefore);
  });

  it("④ invalid asort/adir: URL kept verbatim, no throw, server order intact, page anchors present", async () => {
    serve();
    await page("/approvals?tab=history&status=approved&asort=__nope__&adir=up");
    await waitFor(() => rowIds().length === 3, "three rows rendered");
    expect(search(), "非法值不被改写吞掉").toBe(
      "?tab=history&status=approved&asort=__nope__&adir=up",
    );
    // approvalSortKeyOf(__nope__)=null → 不排序 → 保持服务端返回序。
    expect(rowIds()).toEqual(["ap_s1", "ap_s2", "ap_s3"]);
    expect(q("apr5-page-history"), "页级锚在").toBeTruthy();
    expect(q("apv5-count"), "计数位照常").toBeTruthy();
    // 未知 asort 的 chip 面「该值未被识别」已锁于 approvals.filterurl.test.tsx（R98），此处不重复。
  });
});
