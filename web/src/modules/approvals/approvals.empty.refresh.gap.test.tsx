// @vitest-environment jsdom
/**
 * R308b — 审批刷新的空答护栏：刷新得到 0 行时行集清零、计数不给假 0、
 * 导出闸死且强点分文不花、预览无残留；再从空态刷回有数据时全量重算
 * （纯测试，零产品改动）。
 *
 * 护栏在产品哪一层（实读）：useApprovalsData.ts:110——非追加腿 rows.length===0
 * && unreadable===0 → phase="empty"；reload()（:164-170）先清行再问。empty 相
 * 的闸单点= gates.ts:98-107（export disabled+「读口返回的是真实空集」句；retry
 * 反而 enabled=「真实空集也值得刷新确认」）；apv5-count 只在 ready 相渲染
 * （ApprovalsHistoryModulePage.tsx:403-407）→ 空态没有计数位可读，非假 0；
 * apv7-export-count 的「—」位=QueueCsvExport.tsx:126（blocked=phase!=="ready"）。
 * 预览残留：RowDetailCopy 的行源=visibleRows.find(key===previewKey)?? null
 * （页面 :473）——行集换代后预览按派生自动出局，previewKey 残留不泄漏数据。
 *
 * 先例已覆盖=回证据（git grep 现查，本文件不写重复用例）：
 *  - 直载空站全套形制：approvals.export.bounds.test.tsx it①（R229：pending 0 行
 *    disabled+强点零 Blob 零请求+读数「—」非假 0）；approvals.empty.test.tsx
 *    it①②④⑤（R211：空态导出零 createObjectURL、行钮族不在场、错误/空锚互斥、
 *    清筛选恰一问+apv5-count 同源）；approvals.rowcopy.window.gap.test.tsx it③
 *    （R300：railIds()==[]+「不能导出」+刷新恰 +1 不带 window= 现场裁决）；
 *    ApprovalsHistoryModulePage.test.tsx「empty with a filter offers the clear
 *    exit…」门句族。
 *  - 以上全是**直载即到空站**（fresh mount）或 chip 清除回满站；「ready 站
 *    点刷新→得 0 行」的**过渡帧**与「empty 站再刷新→得行」的**恢复帧**
 *    （钮位 0..n-1 从 0 连续重算、apv-page 条复位、导出钮解禁）全库 0 锁。
 *  - 「先展开预览再换代」=approvals.copy.export.concurrency.test.tsx（R245）只测
 *    追加/失败收敛，apd11 预览随**刷新换代**出局的腿 0 锁（pair2/crossstate 均
 *    切站型不刷新型）。
 * 本文件真增量：
 *  ①ready→刷新→empty 过渡：行清零、apv5-count 整位缺席、导出读数「—」、
 *    导出 disabled+真实空集逐字句、强点零 Blob 零 createObjectURL 零请求、
 *    apv-page 条/行钮族/已展开的行内预览全部出局、apd11-copy 回 disabled+
 *    「先展开一行审批再复制」、apv-live 播「该条件下无审批」、刷新腿不带
 *    cursor= 且仍问当前站；
 *  ②empty→刷新→ready 恢复：行集/计数/导出读数/钮位四值按新一代重算，
 *    钮位从 0 连续无残留位（2→3 增位）、空锚与「—」位退场、apv-page 条复位、
 *    导出解禁且 blob 恰等新行集、全程列表腿零 cursor。
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

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const waitFor = async (cond: () => boolean, label: string): Promise<void> => {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await sleep(5);
    });
  }
};

async function mountPage(entry: string): Promise<void> {
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
}

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const listUrls = (): string[] =>
  api.fetchJSON.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/api/approvals?"));
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
const phaseOf = (): string | null => q("apv-state")?.getAttribute("data-phase") ?? null;

async function clickTestId(id: string): Promise<void> {
  const el = q(id);
  expect(el, id).toBeTruthy();
  await act(async () => {
    el!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

/** 强点导出的全零陷阱：拦 Blob 构造、createObjectURL、a.click 与请求账本。 */
async function forcedExportTrap(): Promise<{ blobs: Blob[]; urlCalls: number }> {
  const blobs: Blob[] = [];
  let urlCalls = 0;
  const OrigBlob = window.Blob;
  class RecordingBlob extends OrigBlob {
    constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
      super(parts, options);
      blobs.push(this);
    }
  }
  const desc = Object.getOwnPropertyDescriptor(window, "Blob");
  const origCreate = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  const origClick = HTMLAnchorElement.prototype.click;
  Object.defineProperty(window, "Blob", { configurable: true, writable: true, value: RecordingBlob });
  URL.createObjectURL = ((blob: Blob) => {
    urlCalls += 1;
    void blob;
    return "blob:empty-refresh-308b";
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
  HTMLAnchorElement.prototype.click = () => undefined;
  const before = api.fetchJSON.mock.calls.length;
  try {
    await clickTestId("apv7-export");
    await sleep(20);
  } finally {
    if (desc) Object.defineProperty(window, "Blob", desc);
    URL.createObjectURL = origCreate;
    URL.revokeObjectURL = origRevoke;
    HTMLAnchorElement.prototype.click = origClick;
  }
  expect(api.fetchJSON.mock.calls.length, "forced export click fires no request").toBe(before);
  return { blobs, urlCalls };
}

/** 正常导出拦截：恰一 Blob，返回 id 列。 */
async function grabCsvIds(label: string): Promise<string[]> {
  const blobs: Blob[] = [];
  const origCreate = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  const origClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = ((blob: Blob) => {
    blobs.push(blob);
    return "blob:empty-refresh-308b";
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
  HTMLAnchorElement.prototype.click = () => undefined;
  try {
    await clickTestId("apv7-export");
    await waitFor(() => blobs.length === 1, `${label}: export blob captured`);
  } finally {
    URL.createObjectURL = origCreate;
    URL.revokeObjectURL = origRevoke;
    HTMLAnchorElement.prototype.click = origClick;
  }
  const text = await blobs[0].text();
  return text
    .replace(/^\uFEFF/, "")
    .split("\r\n")
    .filter((l) => l !== "")
    .slice(1)
    .map((l) => l.split(",")[0]);
}

const mk = (id: string, title: string) => ({
  approvalId: id,
  title,
  status: "approved",
  riskLevel: "high",
  createdAt: "2026-11-17T01:00:00Z",
  decidedAt: "2026-11-18T01:00:00Z",
  requestId: `req-${id}-xx`,
});
const ER1 = mk("ap_er1", "空刷新前甲");
const ER2 = mk("ap_er2", "空刷新前乙");
const ER3 = mk("ap_er3", "空刷新后丙");

describe("R308b approvals empty refresh guards", () => {
  it("①ready→刷新→empty 过渡：行清零、apv5-count 缺席非假 0、导出读数「—」+disabled+真实空集句、强点零 Blob 零 createObjectURL 零请求、行钮/apv-page 条/已展开预览全出局、刷新腿不带 cursor", async () => {
    let approvedCalls = 0;
    api.fetchJSON.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/approval?id=")) return {};
      if (u.includes("status=approved")) {
        approvedCalls += 1;
        if (approvedCalls === 1) return { items: [ER1, ER2] };
        return { items: [] };
      }
      return { items: [] };
    });
    await mountPage("/approvals?tab=history&status=approved");
    await waitFor(() => rowIds().length === 2, "ready station painted");
    // 先展开第一行的行内预览（apv9 就地展开=现状零请求），给残留腿一个证人。
    const requestsBeforeToggle = api.fetchJSON.mock.calls.length;
    await clickTestId("apv9-toggle-0");
    expect(q("apv9-preview-ap_er1"), "preview expanded in place").toBeTruthy();
    expect(
      api.fetchJSON.mock.calls.length,
      "in-place preview costs no request (as-is)",
    ).toBe(requestsBeforeToggle);
    expect((q("apd11-copy") as HTMLButtonElement).disabled, "preview copy armed while expanded").toBe(
      false,
    );

    // 刷新得 0 行 → empty 相。
    const readsBefore = listUrls().length;
    await clickTestId("apv-gates-refresh");
    await waitFor(() => phaseOf() === "empty", "refresh answer lands as empty");
    expect(listUrls().length, "refresh costs exactly one list leg").toBe(readsBefore + 1);
    const refreshLeg = listUrls().at(-1) ?? "";
    expect(refreshLeg, "refresh re-asks the same station").toContain("status=approved");
    expect(refreshLeg, "refresh leg carries no cursor").not.toMatch(/cursor=/);
    // 行集清零 + 空锚在场。
    expect(rowIds(), "rows cleared").toEqual([]);
    expect(q("apr5-empty-history"), "history empty panel painted").toBeTruthy();
    expect(q("apv-state-empty"), "empty card body painted").toBeTruthy();
    // 计数口径：apv5-count 整位缺席（不渲染假 0）；导出读数「—」。
    expect(q("apv5-count"), "no count node in empty phase (never a fake 0)").toBeNull();
    expect(q("apv7-export-count")?.textContent, "export counter reads 「—」").toBe("—");
    // 导出闸死：disabled + 真实空集逐字句（gates.ts:100 单点）。
    const exp = q("apv7-export") as HTMLButtonElement;
    expect(exp.disabled, "export disabled at the empty station").toBe(true);
    const title = exp.getAttribute("title") ?? "";
    expect(title).toContain("不能导出");
    expect(title).toContain("读口返回的是真实空集");
    // 强点分文不花：零 Blob 零 createObjectURL 零请求。
    const { blobs, urlCalls } = await forcedExportTrap();
    expect(blobs.length, "forced click builds zero Blob").toBe(0);
    expect(urlCalls, "forced click builds zero object URL").toBe(0);
    // ready-only 控件全出局：分页条、行钮族、已展开预览、状态条计数句。
    expect(q("apv-page"), "page bar is ready-only and exits").toBeNull();
    expect(q("apv-page-count"), "page count exits with the bar").toBeNull();
    expect(railIds(), "row-copy rail family leaves no button behind").toEqual([]);
    expect(
      document.querySelectorAll('[data-testid^="apv9-preview-"]').length,
      "the expanded preview leaves with its row (derived from visibleRows)",
    ).toBe(0);
    const previewCopy = q("apd11-copy") as HTMLButtonElement;
    expect(previewCopy.disabled, "preview copy falls back to gated once no row is expanded").toBe(
      true,
    );
    expect(previewCopy.getAttribute("title")).toBe("先展开一行审批再复制");
    expect(document.body.textContent ?? "").not.toContain("ap_er1");
    expect(document.body.textContent ?? "").not.toContain("空刷新前甲");
    // 播报单点与刷新可用位（empty 相 retry=enabled 现状）。
    expect(q("apv-live")?.textContent, "live region says the empty sentence").toBe("该条件下无审批");
    expect(
      (q("apv-gates-refresh") as HTMLButtonElement).disabled,
      "refresh stays usable at the true-empty station (gates.ts retry go)",
    ).toBe(false);
  });

  it("②empty→刷新→ready 恢复：行集/计数/导出读数/钮位四值按新一代重算，钮位从 0 连续无残留位，空锚与「—」退场，导出解禁且 blob 恰等新行集", async () => {
    let approvedCalls = 0;
    api.fetchJSON.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/approval?id=")) return {};
      if (u.includes("status=approved")) {
        approvedCalls += 1;
        if (approvedCalls === 1) return { items: [ER1, ER2] };
        if (approvedCalls === 2) return { items: [] };
        return { items: [ER1, ER2, ER3] };
      }
      return { items: [] };
    });
    await mountPage("/approvals?tab=history&status=approved");
    await waitFor(() => rowIds().length === 2, "ready station painted");
    expect(railIds(), "rails 0..1 before the empty round").toEqual([
      "apr-row-copy-0",
      "apr-row-copy-1",
    ]);
    await clickTestId("apv-gates-refresh");
    await waitFor(() => phaseOf() === "empty", "empty station reached via refresh");
    expect(q("apv5-count"), "count node absent at the empty station").toBeNull();
    // 再刷新得 3 行：恢复帧四值重算。
    await clickTestId("apv-gates-refresh");
    await waitFor(() => rowIds().join(",") === "ap_er1,ap_er2,ap_er3", "recovered set painted");
    expect(phaseOf()).toBe("ready");
    expect(q("apr5-empty-history"), "empty panel exits on recovery").toBeNull();
    expect(q("apv-state-empty"), "empty card exits on recovery").toBeNull();
    expect(
      Number((q("apv5-count")?.textContent ?? "").replace(/[^0-9]/g, "")),
      "apv5-count recomputed for the new body",
    ).toBe(3);
    expect(q("apv7-export-count")?.textContent, "export counter leaves 「—」 for the real count").toBe(
      "共 3 行",
    );
    expect(
      railIds(),
      "rails renumbered 0..2 from 0 — contiguous, no residue of the 2-row past nor a gap",
    ).toEqual(["apr-row-copy-0", "apr-row-copy-1", "apr-row-copy-2"]);
    const exp = q("apv7-export") as HTMLButtonElement;
    expect(exp.disabled, "export re-enabled once rows are back").toBe(false);
    expect(exp.getAttribute("title") ?? "", "enabled title counts the shown rows").toContain(
      "导出当前已显示的 3 行",
    );
    expect(await grabCsvIds("recovered station"), "blob equals exactly the recovered set").toEqual([
      "ap_er1",
      "ap_er2",
      "ap_er3",
    ]);
    expect(q("apv-page"), "page bar returns with the ready phase").toBeTruthy();
    expect(listUrls().length, "three list legs total: mount + empty answer + recovery").toBe(3);
    for (const u of listUrls()) {
      expect(u, `no cursor anywhere: ${u}`).not.toMatch(/cursor=/);
    }
    expect(q("apv-live")?.textContent, "live region re-announces the recovered size").toBe(
      "已加载 3 条",
    );
  });
});
