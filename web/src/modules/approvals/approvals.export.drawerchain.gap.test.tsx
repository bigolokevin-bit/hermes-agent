// @vitest-environment jsdom
/**
 * R308b — R306（approvals.export.drawer3.test.tsx，84a996ef）声明腿清单的未测
 * 分支补齐：单挂载三站**全环**（pending→approved→rejected→回到 pending），
 * 每站四值（blob 数据行==表体==apv5-count==行钮数）+ 钮位重算 + 逐序复制首段
 * 配对 + 回切 blob 逐字复现（纯测试，零产品改动）。
 *
 * 先例已覆盖=回证据（git grep 现查，本文件不写重复用例）：
 *  - drawer3 it①（R306）：三站**逐一 fresh-mount** 的四值集中站 + apr-row-copy-0
 *    首段（只钮位 0）+ 每站 blob 恰等本站行集；
 *  - drawer3 it②（R306）：单挂载**单向** p→a→r——blob 互斥（含 rejected 排他）+
 *    切换后列表请求不带 cursor= + 末站 copyRowByIndex(0) 首段；未查每站
 *    apv5-count/apv7-export-count/钮位连续性，未走回切腿；
 *  - approvals.export.statusmatrix.test.tsx it②（R256）：单挂载 p→a→p 两站回环
 *    blob 逐字相等 + 末站 apv5-count==rowIds；不数行钮族（apr-row-copy 全文件
 *    0 出现）、不经 rejected 站；
 *  - approvals.export.rowcopy.crossstate.test.tsx it①（R258）：三站逐行钮复制
 *    首段==CSV col0（但每站 clearScreen 重挂）；it② 三站轮转回首站=重挂链，
 *    锁复制文本/行序，不锁 blob/计数/钮位；
 *  - approvals.export.bounds.test.tsx it②③（R229）：每站三值（apv5-count/
 *    apv7-export-count/CSV）——但站间 fresh-mount；
 *  - 空站/「—」/强点零 Blob=bounds it①、empty.test it②、rowcopy.window.gap it③。
 * 本文件真增量（drawer3 头注释①②声明的腿形，单挂载全环上的未测分支）：
 *  ①2→1 **缩位站**（rejected）上 apr-row-copy-1 整枚出局——无残留钮位
 *    （drawer3 it② 到了 rejected 只点 copy-0，从未证明 copy-1 不在）；
 *  ②单挂载链上**每站**四值同帧（blob 行==表体==apv5-count==钮数）+
 *    apv7-export-count 逐字「共 N 行」——drawer3 it② 在链上未读任何计数；
 *  ③回切 leg 走满三站环（p→a→r→p）：回站 blob 与首站逐字相等 + 钮位重新
 *    起数 0..1 + 每站两行钮逐序配对（index 1 首段==CSV 第二数据行）——
 *    statusmatrix 的回环不经 rejected，crossstate 的三站环不带 blob/计数。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Button: ({ onClick, children, ...rest }: { onClick?: () => void; children?: React.ReactNode }) => (
    <button type="button" onClick={onClick} {...rest}>
      {children}
    </button>
  ),
  Card: ({ children, ...rest }: { children?: React.ReactNode }) => <div {...rest}>{children}</div>,
  CardContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

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
const clicks = (): number => api.fetchJSON.mock.calls.length;
const listCalls = (): number =>
  api.fetchJSON.mock.calls.filter((c) => String(c[0]).includes("/api/approvals?")).length;
const rowIds = (): string[] =>
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap_"]'))
    .filter((el) => !String(el.getAttribute("data-testid")).includes("-details-"))
    .map((el) => String(el.getAttribute("data-testid")).replace("apr5-row-", ""));
// 行钮族只数「按钮」且限 \d+ 位（apr-row-copy-status 是随行常挂的读数 span，
// 同 approvals.rowcopy.window.gap.test.tsx:120 与 approvals.empty.test.tsx:86 口径）。
const railIds = (): string[] =>
  Array.from(document.querySelectorAll("button[data-testid]"))
    .map((b) => String(b.getAttribute("data-testid")))
    .filter((t) => /^apr-row-copy-\d+$/.test(t))
    .sort((a, b) => Number(a.replace(/\D+/g, "")) - Number(b.replace(/\D+/g, "")));
const countNumber = (): number =>
  Number((q("apv5-count")?.textContent ?? "").replace(/[^0-9]/g, ""));

async function clickTestId(id: string): Promise<void> {
  const el = q(id);
  expect(el, id).toBeTruthy();
  await act(async () => {
    el!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

function parseCsv(text: string): string[][] {
  return text
    .replace(/^\uFEFF/, "")
    .split("\r\n")
    .filter((l) => l !== "")
    .map((l) => l.split(","));
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
    return "blob:export-drawerchain-308b";
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

/** 按屏上钮序号复制一行（锁钮位形态与零额外请求）。 */
async function copyRowByIndex(index: number): Promise<string> {
  const btn = q(`apr-row-copy-${index}`) as HTMLButtonElement | null;
  expect(btn, `apr-row-copy-${index}`).toBeTruthy();
  const seen = written.length;
  const before = clicks();
  await act(async () => {
    btn!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await waitFor(() => written.length > seen, `copy #${index} wrote clipboard`);
  expect(clicks(), "row copy never refetches").toBe(before);
  return written[written.length - 1] as string;
}

const mk = (id: string, title: string, status: string, extra: Record<string, string> = {}) => ({
  approvalId: id,
  title,
  status,
  riskLevel: "high",
  createdAt: "2026-11-16T01:00:00Z",
  requestId: `req-${id}-xy`,
  ...extra,
});
const DC_P1 = mk("ap_dc_p1", "全环待办甲", "pending");
const DC_P2 = mk("ap_dc_p2", "全环待办乙", "pending");
const DC_A1 = mk("ap_dc_a1", "全环已批甲", "approved", { decidedAt: "2026-11-17T01:00:00Z" });
const DC_A2 = mk("ap_dc_a2", "全环已批乙", "approved", { decidedAt: "2026-11-17T02:00:00Z" });
const DC_R1 = mk("ap_dc_r1", "全环已拒一", "rejected", { decidedAt: "2026-11-17T03:00:00Z" });

const serveChain = (): void => {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) return {};
    if (u.includes("status=pending")) return { items: [DC_P1, DC_P2] };
    if (u.includes("status=approved")) return { items: [DC_A1, DC_A2] };
    if (u.includes("status=rejected")) return { items: [DC_R1] };
    return { items: [DC_P1, DC_P2, DC_A1, DC_A2, DC_R1] };
  });
};

const csvIds = (grid: string[][]): string[] => grid.slice(1).map((r) => r[0]);
const expectedRails = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => `apr-row-copy-${i}`);

describe("R308b approvals export drawer-chain full-loop guards", () => {
  it("单挂载全环 p→a→r→p：每站四值同帧（blob==表体==apv5-count==钮数）+「共 N 行」逐字，缩位站 rejected 上 copy-1 整枚出局无残留位，回切 blob 与首站逐字相等且两行钮逐序配对，全程列表腿不带 cursor", async () => {
    stubClipboard();
    serveChain();
    await render("/approvals?tab=history&status=pending");
    const stations = [
      { value: "pending", ids: ["ap_dc_p1", "ap_dc_p2"] },
      { value: "approved", ids: ["ap_dc_a1", "ap_dc_a2"] },
      { value: "rejected", ids: ["ap_dc_r1"] },
      { value: "pending", ids: ["ap_dc_p1", "ap_dc_p2"] }, // 回切腿：经 rejected 的全环
    ];
    let firstText = "";
    for (const [stop, station] of stations.entries()) {
      if (stop > 0) {
        await clickTestId(`apv5-filter-status-${station.value}`);
        await waitFor(
          () => rowIds().join(",") === station.ids.join(","),
          `station ${stop}: ${station.value} rows`,
        );
      }
      const tag = `stop ${stop} (${station.value})`;
      expect(rowIds(), `${tag}: rows exactly the station`).toEqual(station.ids);
      // 四值同帧：blob 数据行 == 表体 == apv5-count == 行钮数。
      const { text, grid } = await grabCsv();
      expect(csvIds(grid), `${tag}: blob ids exactly station`).toEqual(station.ids);
      expect(grid.slice(1).length, `${tag}: csv rows == rowIds`).toBe(rowIds().length);
      expect(countNumber(), `${tag}: apv5-count == station size`).toBe(station.ids.length);
      expect(railIds(), `${tag}: rails exactly 0..n-1 — no slot residue across the size change`).toEqual(
        expectedRails(station.ids.length),
      );
      expect(
        q("apv7-export-count")?.textContent,
        `${tag}: export counter verbatim`,
      ).toBe(`共 ${station.ids.length} 行`);
      // 逐序配对：每枚钮位首段==CSV 同序数据行的单号（不止 0 号位）。
      for (const [i, id] of station.ids.entries()) {
        const head = await copyRowByIndex(i);
        expect(head.split("\n")[0], `${tag}: rail #${i} head pairs csv row ${i}`).toBe(`单号：${id}`);
      }
      if (stop === 0) firstText = text;
      if (stop === stations.length - 1) {
        // 全环回切：blob 与首站逐字相等（同名同序同行内容）。
        expect(text, "round-trip through rejected returns the byte-identical first blob").toBe(
          firstText,
        );
      }
      if (station.value === "rejected") {
        // 缩位站专项（drawer3 it② 到站后只点过 copy-0，从未证明 copy-1 不在场）。
        expect(
          q("apr-row-copy-1"),
          "the 2→1 shrink station drops the whole second rail slot",
        ).toBeNull();
        const body = document.body.textContent ?? "";
        for (const banned of ["ap_dc_p1", "ap_dc_p2", "ap_dc_a1", "ap_dc_a2"]) {
          expect(body, `other-station id ${banned} absent at rejected`).not.toContain(banned);
        }
      }
    }
    // 账本：一站一问，四腿列表请求，全部不带 cursor=。
    expect(listCalls(), "one list read per station including the return leg").toBe(4);
    for (const call of api.fetchJSON.mock.calls) {
      const url = String(call[0]);
      if (url.includes("/api/approvals?")) {
        expect(url, `no cursor: ${url}`).not.toMatch(/cursor=/);
      }
    }
  });
});
