// @vitest-environment jsdom
/**
 * R308b — 审批列表的换代护栏：过期/乱序响应不得覆盖新数据；刷新换代后
 * 行集、apv5-count、apr-row-copy-<i> 钮位重算一致（纯测试，零产品改动）。
 *
 * 护栏在产品哪一层（实读 useApprovalsData.ts:95-180）：useApprovalsList 每次
 * run() 领一张票 `ticket=++seq.current`，响应落地前先查 `ticket!==seq.current`
 * 即弃（:106 成功腿 / :124 失败腿）；reload()（:164-170）先清行置 loading 再
 * 领新票——这是列表面唯一的乱序防护点。status 切换走 run（不清行、不置
 * loading），reload 走清行+run；两票并存时旧票响应必弃。
 *
 * 先例已覆盖=回证据（git grep 现查，本文件不写重复用例）：
 *  - 空站/边界/切换后的静态三值与「—」非假 0：approvals.export.bounds.test.tsx
 *    it①②③（R229，fresh-mount 站间）；approvals.crosssurface.test.tsx it「empty
 *    answer disables export…」「ready view keeps the three numbers identical」。
 *  - 切站零残留（重挂站型）：approvals.rowcopy.window.gap.test.tsx it②（R300）、
 *    approvals.export.drawer3.test.tsx it②（R306 单挂载单向 p→a→r：blob 互斥+
 *    无 cursor，未查 apv5-count/钮位）。
 *  - 游标换代：approvals.chips.cursor.test.tsx it①（R238，chip 移除换代）、
 *    ApprovalsHistoryModulePage.test.tsx L1848「a status switch resets the list
 *    and never carries the stale cursor」（都是「新一代恰一问」腿，两问同时在
 *    飞、旧答晚到的丢弃腿全库 0 锁：grep 挂起/在飞/release 模式仅
 *    ApprovalsPendingModulePage.test.tsx:195（骨架腿）与 :469（决策在飞腿））。
 *  - 追加页失败保行：approvals.paging.test.tsx（R139）——本文件只测整页腿。
 * 本文件真增量：
 *  ①乱序丢弃：初载（pending）在飞时点切站（approved），新答先到屏；随后旧票
 *    晚到——行集/计数/钮位逐字不动、DOM innerHTML 全等（旧答连一次重渲染都不
 *    许有）、旧代 id/名在屏上与导出 blob 双零出现、账本不多一问。
 *  ②刷新换代双票：切站仍在飞（现场裁决：status 切换不清行不置 loading，屏上
 *    暂留旧站行=run 语义按现状锁），此间点 apv-gates-refresh 领第三票；在飞帧
 *    loading 全闸（行 0/计数无/导出关/钮位无/刷新禁用）；乱序的票 2 晚到被弃
 *    （屏仍 loading），票 3 到后行集/计数/钮位按新一代重算，前两代 id 双零残留。
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

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

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
const countNumber = (): number =>
  Number((q("apv5-count")?.textContent ?? "").replace(/[^0-9]/g, ""));
const phaseOf = (): string | null => q("apv-state")?.getAttribute("data-phase") ?? null;

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

/** 拦一次导出：收 blob、锁导出不新增 fetch，返回网格与 createObjectURL 计次。 */
async function grabCsv(label: string): Promise<{ grid: string[][]; urlCalls: number }> {
  const before = api.fetchJSON.mock.calls.length;
  const blobs: Blob[] = [];
  let urlCalls = 0;
  const orig = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  const origClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = ((blob: Blob) => {
    blobs.push(blob);
    urlCalls += 1;
    return `blob:stale-reload-308b`;
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
  HTMLAnchorElement.prototype.click = () => undefined;
  try {
    await clickTestId("apv7-export");
    await waitFor(() => blobs.length === 1, `${label}: export blob captured`);
  } finally {
    URL.createObjectURL = orig;
    URL.revokeObjectURL = origRevoke;
    HTMLAnchorElement.prototype.click = origClick;
  }
  expect(blobs.length, `${label}: one blob per export`).toBe(1);
  expect(api.fetchJSON.mock.calls.length, `${label}: export never refetches`).toBe(before);
  return { grid: parseCsv(await blobs[0].text()), urlCalls };
}

const mk = (id: string, title: string, status: string, extra: Record<string, string> = {}) => ({
  approvalId: id,
  title,
  status,
  riskLevel: "high",
  createdAt: "2026-11-18T01:00:00Z",
  requestId: `req-${id}-xx`,
  ...extra,
});

// ①夹具：旧代 pending（晚到必须被弃）vs 新代 approved（先到上屏）。
const STALE_P1 = mk("ap_sr_s1", "旧代待办甲", "pending");
const STALE_P2 = mk("ap_sr_s2", "旧代待办乙", "pending");
const STALE_P3 = mk("ap_sr_s3", "旧代待办丙", "pending");
const FRESH_A1 = mk("ap_sr_a1", "新代已批甲", "approved", { decidedAt: "2026-11-19T01:00:00Z" });
const FRESH_A2 = mk("ap_sr_a2", "新代已批乙", "approved", { decidedAt: "2026-11-19T02:00:00Z" });

// ②夹具：PD=首代到屏；AO=切站在飞被刷新作废的第二代；AN=第三代（reload 的正答）。
const PD1 = mk("ap_sw_p1", "换代前待办一", "pending");
const PD2 = mk("ap_sw_p2", "换代前待办二", "pending");
const PD3 = mk("ap_sw_p3", "换代前待办三", "pending");
const AO1 = mk("ap_sw_o1", "作废代已批一", "approved", { decidedAt: "2026-11-19T03:00:00Z" });
const AN1 = mk("ap_sw_n1", "新一代已批一", "approved", { decidedAt: "2026-11-19T04:00:00Z" });
const AN2 = mk("ap_sw_n2", "新一代已批二", "approved", { decidedAt: "2026-11-19T05:00:00Z" });

describe("R308b approvals stale reload guards", () => {
  it("①乱序丢弃：初载在飞时切站、新答先到屏；旧票晚到不覆盖行集/计数/钮位，DOM 逐帧全等，旧代 id 屏上与 blob 双零出现，账本不多一问", async () => {
    let releaseStale: ((v: unknown) => void) | null = null;
    api.fetchJSON.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/approval?id=")) return {};
      if (u.includes("status=pending")) {
        return new Promise((resolve) => {
          releaseStale = resolve;
        });
      }
      if (u.includes("status=approved")) return { items: [FRESH_A1, FRESH_A2] };
      return { items: [] };
    });
    await mountPage("/approvals?tab=history&status=pending");
    // 初载在飞：loading 帧（骨架在场、无行）。
    expect(phaseOf(), "initial frame is loading").toBe("loading");
    expect(rowIds(), "no rows while the first ticket is outstanding").toEqual([]);
    // 在飞期间点切站快捷钮（apv5-filter 组不随相禁用=现状）→ 领第二票。
    await clickTestId("apv5-filter-status-approved");
    await waitFor(() => rowIds().join(",") === "ap_sr_a1,ap_sr_a2", "approved set painted");
    expect(countNumber(), "count follows the fresh station").toBe(2);
    expect(railIds(), "rails renumbered for the fresh set").toEqual([
      "apr-row-copy-0",
      "apr-row-copy-1",
    ]);
    await act(async () => {
      await sleep(25); // 让 RelativeTime 的 mount 效效应全部落地再取快照
    });
    const domSettled = document.body.innerHTML;
    const ledger = api.fetchJSON.mock.calls.length;
    // 旧票晚到：ticket!==seq → 必须整体作废，连一次重渲染都不许有。
    await act(async () => {
      releaseStale!({ items: [STALE_P1, STALE_P2, STALE_P3] });
      await sleep(25);
    });
    expect(rowIds(), "late stale answer must not touch the row set").toEqual([
      "ap_sr_a1",
      "ap_sr_a2",
    ]);
    expect(countNumber(), "late stale answer must not touch apv5-count").toBe(2);
    expect(railIds(), "late stale answer must not renumber rails").toEqual([
      "apr-row-copy-0",
      "apr-row-copy-1",
    ]);
    expect(document.body.innerHTML, "discarded answer causes zero re-render").toBe(domSettled);
    expect(api.fetchJSON.mock.calls.length, "discarding costs no extra request").toBe(ledger);
    const body = document.body.textContent ?? "";
    for (const banned of ["ap_sr_s1", "ap_sr_s2", "ap_sr_s3", "旧代待办"]) {
      expect(body, `stale ${banned} never reaches the screen`).not.toContain(banned);
    }
    // 导出同源：blob 恰等新代行集，旧代一个字不进。
    const { grid } = await grabCsv("stale-guard station");
    expect(grid.slice(1).map((r) => r[0])).toEqual(["ap_sr_a1", "ap_sr_a2"]);
    const text = grid.map((r) => r.join(",")).join("\n");
    expect(text).not.toContain("ap_sr_s");
    expect(text).not.toContain("旧代待办");
    // 游标卫生：两问列表腿都不带 cursor=。
    for (const u of listUrls()) {
      expect(u, `no cursor: ${u}`).not.toMatch(/cursor=/);
    }
    expect(listUrls().length, "two list legs total: the held one and the fresh one").toBe(2);
  });

  it("②刷新换代双票：切站在飞（屏暂留旧站行=run 现状）时点刷新作废票 2；在飞帧全闸；票 2 晚到被弃、票 3 到后行集/计数/钮位按新一代重算，前两代零残留", async () => {
    let approvedCalls = 0;
    let releaseSwitch: ((v: unknown) => void) | null = null;
    let releaseReload: ((v: unknown) => void) | null = null;
    api.fetchJSON.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/approval?id=")) return {};
      if (u.includes("status=pending")) return { items: [PD1, PD2, PD3] };
      if (u.includes("status=approved")) {
        approvedCalls += 1;
        if (approvedCalls === 1) {
          return new Promise((resolve) => {
            releaseSwitch = resolve;
          });
        }
        return new Promise((resolve) => {
          releaseReload = resolve;
        });
      }
      return { items: [] };
    });
    await mountPage("/approvals?tab=history&status=pending");
    await waitFor(() => !document.querySelector(".animate-pulse"), "pending settled");
    expect(rowIds()).toEqual(["ap_sw_p1", "ap_sw_p2", "ap_sw_p3"]);
    expect(countNumber()).toBe(3);
    expect(railIds()).toEqual(["apr-row-copy-0", "apr-row-copy-1", "apr-row-copy-2"]);
    // 切站 → 票 2 在飞；现场裁决：run 不清行不置 loading，屏暂留旧站行（按现状锁）。
    await clickTestId("apv5-filter-status-approved");
    await waitFor(() => listUrls().length === 2, "switch request issued");
    expect(phaseOf(), "a station switch does not fake a loading frame (run semantics, as-is)").toBe(
      "ready",
    );
    expect(rowIds(), "old station rows stay visible until the new answer lands").toEqual([
      "ap_sw_p1",
      "ap_sw_p2",
      "ap_sw_p3",
    ]);
    // 此间点刷新 → reload 清行置 loading 并领票 3，票 2 作废。
    await clickTestId("apv-gates-refresh");
    await waitFor(() => phaseOf() === "loading", "reload frame is loading");
    expect(rowIds(), "reload clears rows before the new answer").toEqual([]);
    expect(q("apv5-count"), "no count node mid-flight (never a fake 0)").toBeNull();
    expect(q("apv7-export-count")?.textContent, "export counter reads 「—」 mid-flight").toBe("—");
    const exp = q("apv7-export") as HTMLButtonElement;
    expect(exp.disabled, "export gated mid-flight").toBe(true);
    expect(exp.getAttribute("title"), "gate title names the in-flight reason").toContain(
      "正在读取列表",
    );
    expect(railIds(), "no rails mid-flight").toEqual([]);
    expect(
      (q("apv-gates-refresh") as HTMLButtonElement).disabled,
      "refresh disabled while this round reads (gates loading-retry)",
    ).toBe(true);
    // 票 2（作废代）晚到：整体丢弃，屏仍停在 loading 帧。
    await act(async () => {
      releaseSwitch!({ items: [AO1] });
      await sleep(25);
    });
    expect(phaseOf(), "discarded ticket 2 keeps the loading frame untouched").toBe("loading");
    expect(rowIds(), "discarded ticket 2 paints nothing").toEqual([]);
    expect(document.body.textContent ?? "").not.toContain("ap_sw_o1");
    expect(document.body.textContent ?? "").not.toContain("作废代已批");
    // 票 3 正答：行集/计数/钮位按新一代重算，前两代 id 双零残留。
    await act(async () => {
      releaseReload!({ items: [AN1, AN2] });
    });
    await waitFor(() => rowIds().join(",") === "ap_sw_n1,ap_sw_n2", "generation 3 painted");
    expect(countNumber(), "count recomputed for the new generation").toBe(2);
    expect(railIds(), "rails renumbered from 0, contiguous, no slot from the 3-row past").toEqual([
      "apr-row-copy-0",
      "apr-row-copy-1",
    ]);
    const body = document.body.textContent ?? "";
    for (const banned of ["ap_sw_p1", "ap_sw_p2", "ap_sw_p3", "换代前待办"]) {
      expect(body, `generation 1 ids leave the screen after reload: ${banned}`).not.toContain(banned);
    }
    const { grid } = await grabCsv("generation 3");
    expect(grid.slice(1).map((r) => r[0]), "blob equals exactly the new generation").toEqual([
      "ap_sw_n1",
      "ap_sw_n2",
    ]);
    expect(api.fetchJSON.mock.calls.length, "three list legs total, the discarded one costs nothing extra").toBe(3);
    for (const u of listUrls()) {
      expect(u, `no cursor: ${u}`).not.toMatch(/cursor=/);
    }
    expect(listUrls().at(-1), "reload re-asks the current station").toContain("status=approved");
  });
});
