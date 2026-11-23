// @vitest-environment jsdom
/**
 * R240 (tests only): status & risk human labels are one sentence on four faces.
 *
 * 查重（已覆盖只回证据，本文件不重写）：
 * - 默认站行×预览×抽屉×复制×CSV 成套逐字 = approvals.parity（R120）+
 *   approvals.panel.detail.parity（R230，含 apv5-count==表体==导出读数）；
 * - 未知 status=teleported / risk=purple 在 行徽标×预览×详情×CSV 四面同兜底
 *   句、原码不上屏 = approvals.labels（R123）；
 * - risk 逐档矩阵（预览×复制×CSV）= approvals.rowcopy.risk（R238，本波刚交）。
 * 本文件两块真缺口：
 * ①切换 ?status=approved（服务端维重取）之后，状态与风险在 行徽标×详情徽标×
 *   apr-row-copy「状态：/风险：」段×CSV 仍同源、apv5-count==表体（R230 只测过
 *   默认站，R182 只对比过 CSV==badge 两腿）；
 * ②未知枚举行（status=__nope__、risk=__nope__）进 apr-row-copy 文本的
 *   「状态：/风险：」段——R123 未测复制腿，兜底句禁第三套措辞。
 * 现场裁决：行卡无独立风险徽标位（R168 裁决），风险第四腿=预览 dd；
 * 禁裸 pending/approved/low/medium/high 上载体文本：状态 label 是人话词、
 * 枚举原词只允许出现在 data-record/单号/rid 这类标识位之外的对照由 notMatch
 * 全文级完成（中文标题夹具保证零误伤）。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));
vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Button: ({ children, ...rest }: { children?: React.ReactNode; [key: string]: unknown }) => (
    <button type="button" {...rest}>{children}</button>
  ),
  Card: ({ children, ...rest }: { children?: React.ReactNode; [key: string]: unknown }) => (
    <div {...rest}>{children}</div>
  ),
  CardContent: ({ children, ...rest }: { children?: React.ReactNode; [key: string]: unknown }) => (
    <div {...rest}>{children}</div>
  ),
}));

import ApprovalsHistoryModulePage from "@/modules/approvals/ApprovalsHistoryModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** 服务端按 status=approved 重取后的站体（ap_v3 是 pending，被筛掉）。 */
const APPROVED = [
  { approvalId: "ap_v1", title: "发布窗口一号", status: "approved", riskLevel: "high",
    approvers: [{ userId: "human:7", name: "郑涛" }], decidedAt: "2026-11-19T02:00:00Z",
    createdAt: "2026-11-18T01:00:00Z", requestId: "req-v-11112222" },
  { approvalId: "ap_v2", title: "发布窗口二号", status: "approved", riskLevel: "low",
    approvers: [{ userId: "human:8", name: "阿朝" }], decidedAt: "2026-11-19T03:00:00Z",
    createdAt: "2026-11-18T01:00:00Z", requestId: "req-v-22223333" },
];

/** 未知枚举站：status/risk 都不认识，只允许兜底句上屏。 */
const UNKNOWN = [
  { approvalId: "ap_v9", title: "未知枚举探针", status: "__nope__", riskLevel: "__nope__",
    approvers: [{ userId: "human:7", name: "郑涛" }],
    createdAt: "2026-11-18T01:00:00Z", requestId: "req-v-99998888" },
];

const roots: Root[] = [];
const mounted: HTMLElement[] = [];

function clearScreen() {
  while (roots.length) {
    const root = roots.pop();
    const node = mounted.pop();
    void act(() => {
      root?.unmount();
    });
    node?.remove();
  }
}

afterEach(() => {
  clearScreen();
  api.fetchJSON.mockReset();
});

async function waitFor(what: string, ready: () => boolean) {
  for (let i = 0; i < 600; i += 1) {
    let done = false;
    await act(async () => {
      done = ready();
    });
    if (done) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`waitFor: ${what} never became true`);
}

function render(entry: string) {
  const node = document.createElement("div");
  document.body.appendChild(node);
  mounted.push(node);
  const root = createRoot(node);
  roots.push(root);
  return act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <ApprovalsHistoryModulePage />
      </MemoryRouter>,
    );
  });
}

function q(id: string): Element | null {
  return document.querySelector(`[data-testid="${id}"]`);
}

function text(id: string): string {
  return q(id)?.textContent ?? "";
}

function rowIds(): string[] {
  return Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap_"]'))
    .map((n) => (n.getAttribute("data-testid") ?? "").replace("apr5-row-", ""))
    .filter((id) => !id.includes("-details-"));
}

function clicks(): number {
  return api.fetchJSON.mock.calls.length;
}

function listCalls(): number {
  return api.fetchJSON.mock.calls.filter((c) => String(c[0]).includes("/api/approvals")).length;
}

function detailCalls(id: string): number {
  return api.fetchJSON.mock.calls.filter(
    (c) => String(c[0]).includes("/api/approval?id=") && String(c[0]).includes(id),
  ).length;
}

function clickEl(el: Element | null | undefined, what: string) {
  expect(el, what).toBeTruthy();
  act(() => {
    el?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

async function openPreview(id: string) {
  const toggle = document.querySelector(`[data-testid^="apv9-toggle-"][data-record="${id}"]`);
  expect(toggle, `toggle for ${id}`).toBeTruthy();
  clickEl(toggle, `preview toggle ${id}`);
  await waitFor(`preview ${id}`, () => !!q(`apv9-preview-${id}`));
}

function pvDds(id: string): string[] {
  const card = q(`apv9-preview-${id}`);
  expect(card, `preview for ${id}`).toBeTruthy();
  return Array.from(card?.querySelectorAll("dd") ?? []).map((d) => d.textContent ?? "");
}

function rowBadge(id: string): string {
  const title = q(`apv-trunc-row-title-${id}`);
  const btn = title?.closest("button") ?? title;
  return btn?.parentElement?.lastElementChild?.textContent ?? "";
}

async function openDetail(id: string) {
  const before = listCalls();
  clickEl(q(`apr5-row-${id}`), `row card ${id}`);
  await waitFor(`drawer for ${id}`, () => !!q("apr5-detail"));
  expect(listCalls(), "opening the drawer refetches no list").toBe(before);
  expect(detailCalls(id), "the drawer asked its own read once").toBe(1);
}

function detailBadges(): string[] {
  const h2 = q("apr5-detail")?.querySelector("h2");
  expect(h2, "drawer title").toBeTruthy();
  const head = h2?.parentElement;
  return Array.from(head?.children ?? [])
    .slice(1)
    .map((c) => c.textContent ?? "");
}

function closeDetail() {
  clickEl(q("apd7-back"), "back to list");
}

function stubClipboard(written: string[]) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (t: string) => {
        written.push(t);
        return Promise.resolve();
      },
    },
  });
}

async function copyRow(index: number): Promise<string> {
  const before = clicks();
  const written: string[] = [];
  stubClipboard(written);
  clickEl(q(`apr-row-copy-${index}`), `copy rail ${index}`);
  await waitFor(`copy rail ${index} lands`, () => written.length === 1);
  expect(clicks(), "copying issues no request").toBe(before);
  return written[0];
}

function segOf(body: string, label: string): string {
  const line = body.split("\n").find((l) => l.startsWith(label)) ?? "";
  return line.slice(label.length);
}

async function grabCsvGrid(): Promise<string[][]> {
  const before = clicks();
  const blobs: Blob[] = [];
  const origCreate = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  const origClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = (blob: Blob) => {
    blobs.push(blob);
    return "blob:csv";
  };
  URL.revokeObjectURL = () => undefined;
  HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
    void this.download;
  };
  try {
    clickEl(q("apv7-export"), "export click");
    await waitFor("export lands a file", () => blobs.length === 1);
  } finally {
    URL.createObjectURL = origCreate;
    URL.revokeObjectURL = origRevoke;
    HTMLAnchorElement.prototype.click = origClick;
  }
  expect(clicks(), "exporting issues no request").toBe(before);
  const raw = (await blobs[0].text()).replace(/^\uFEFF/, "");
  return raw.split("\r\n").filter((l) => l !== "").map((l) => l.split(","));
}

describe("R240 status & risk labels stay one sentence across all four faces", () => {
  it("① after the ?status=approved refetch: row badge == drawer badge == rail copy == CSV for both dimensions, and apv5-count matches the body", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      if (url.includes("/api/approval?id=")) {
        const id = decodeURIComponent(url.split("id=")[1] ?? "");
        return APPROVED.find((r) => r.approvalId === id) ?? {};
      }
      if (url.includes("/api/approvals")) {
        return { items: url.includes("status=approved") ? APPROVED : [...APPROVED, UNKNOWN[0]] };
      }
      return {};
    });
    await render("/approvals?tab=history");
    await waitFor("rows land", () => rowIds().length > 0);
    const before = clicks();
    clickEl(q("apv5-filter-status-approved"), "approved shortcut");
    await waitFor("the approved station refetched", () => clicks() === before + 1);
    await waitFor("two approved rows", () => rowIds().length === 2);
    expect(text("apv5-count"), "count matches the body").toBe(String(rowIds().length));

    // R60 互斥=开详情收预览：预览腿的值先存变量再开抽屉。
    await openPreview("ap_v1");
    const pv = pvDds("ap_v1");
    const pvStatus = pv[0] ?? "";
    const pvRisk = pv[1] ?? "";
    const badge = rowBadge("ap_v1");

    await openDetail("ap_v1");
    const db = detailBadges();
    closeDetail();
    await waitFor("drawer closed", () => !q("apr5-detail"));

    const copy = await copyRow(0);
    const copyStatus = segOf(copy, "状态：");
    const copyRisk = segOf(copy, "风险：");

    const grid = await grabCsvGrid();
    const cells = grid.slice(1).find((c) => c[0] === "ap_v1") ?? [];

    // 状态四处逐字 + 非空 + 禁裸枚举原词。
    expect(badge, "row badge is a human sentence").not.toBe("");
    expect(pvStatus, "preview == row badge").toBe(badge);
    expect(copyStatus, "rail copy == row badge").toBe(badge);
    expect(cells[2], "CSV == row badge").toBe(badge);
    expect(db[0] ?? "", "drawer badge equals the same word or carries it").toBeTruthy();
    expect([badge, pvStatus, copyStatus, cells[2]].join("|")).not.toMatch(/\b(approved|pending)\b/);

    // 风险四处逐字（行卡无风险徽标位=预览腿代四，R168 裁决）。
    expect(pvRisk, "preview risk is the sentence").toBe("高风险");
    expect(copyRisk, "copy risk == preview risk").toBe(pvRisk);
    expect(cells[3], "CSV risk == preview risk").toBe(pvRisk);
    expect([pvRisk, copyRisk, cells[3]].join("|")).not.toMatch(/\b(high|low|medium|critical)\b/);

    // 第二行（low 档）双保险：同源不只在 high 上巧合。
    await openPreview("ap_v2");
    const pv2 = pvDds("ap_v2");
    expect(pv2[1] ?? "", "low station risk").toBe("低风险");
    const copy2 = await copyRow(1);
    expect(segOf(copy2, "风险："), "low copy").toBe(pv2[1]);
    const cells2 = grid.slice(1).find((c) => c[0] === "ap_v2") ?? [];
    expect(cells2[3], "low CSV").toBe(pv2[1]);

    // 开合抽屉+复制+导出全程列表腿只吃了那一次切换。
    expect(listCalls(), "the switch cost exactly one list read").toBe(2);
  });

  it("② an unknown enum row keeps one fallback sentence on four faces — including the rail copy segment R123 never tested", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      if (url.includes("/api/approval?id=")) return UNKNOWN[0];
      if (url.includes("/api/approvals")) return { items: UNKNOWN };
      return {};
    });
    await render("/approvals?tab=history");
    await waitFor("the probe row lands", () => rowIds().length === 1);

    await openPreview("ap_v9");
    const pv = pvDds("ap_v9");
    const badge = rowBadge("ap_v9");
    expect(badge, "row badge falls back, never shows the raw code").not.toContain("__nope__");
    expect(badge.length, "fallback sentence is non-empty").toBeGreaterThan(0);
    expect(pv[0] ?? "", "preview status == row badge").toBe(badge);

    await openDetail("ap_v9");
    const db = detailBadges();
    closeDetail();
    await waitFor("drawer closed", () => !q("apr5-detail"));

    const copy = await copyRow(0);
    expect(segOf(copy, "状态："), "copy status segment == the same fallback").toBe(badge);
    expect(db[0] ?? "", "drawer badge carries the same fallback word").toContain(badge);

    const grid = await grabCsvGrid();
    const cells = grid[1] ?? [];
    expect(cells[2], "CSV status == the same fallback").toBe(badge);

    // 风险维同一口径：四处都不漏原码、共用一句兜底。
    expect(badge, "row face leaks no raw code").not.toContain("__nope__");
    expect(copy, "copy face leaks no raw code").not.toContain("__nope__");
    const flat = grid.map((c) => c.join(",")).join("\n");
    expect(flat, "CSV face leaks no raw code").not.toContain("__nope__");
    const riskWord = pv[1] ?? "";
    expect(riskWord, "risk fallback is one sentence too").toBe(segOf(copy, "风险："));
    expect(cells[3], "CSV risk == risk fallback").toBe(riskWord);

    // 计数：这一站只有一条列表读+一条详情读。
    expect(listCalls(), "exactly one list read").toBe(1);
    expect(detailCalls("ap_v9"), "exactly one detail read").toBe(1);
  });

  it("③ drawer open/close and switching stations keep faces + counts in sync without extra reads", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      if (url.includes("/api/approval?id=")) {
        const id = decodeURIComponent(url.split("id=")[1] ?? "");
        return UNKNOWN.find((r) => r.approvalId === id) ?? {};
      }
      if (url.includes("/api/approvals")) return { items: UNKNOWN };
      return {};
    });
    await render("/approvals?tab=history");
    await waitFor("row lands", () => rowIds().length === 1);
    const base = clicks();

    // 开→关→再开：详情腿两次（每次打开各读一次），列表腿恒一次，关闭零请求。
    await openDetail("ap_v9");
    const word = detailBadges()[0] ?? "";
    expect(word.length, "drawer badge word").toBeGreaterThan(0);
    closeDetail();
    await waitFor("closed", () => !q("apr5-detail"));
    expect(listCalls(), "closing asks for nothing").toBe(1);
    // 第二次打开：helper 的 detailCalls===1 只适用首开，这里手动走点击。
    const beforeSecond = clicks();
    clickEl(q("apr5-row-ap_v9"), "row card again");
    await waitFor("drawer reopens", () => !!q("apr5-detail"));
    expect(clicks(), "reopen costs exactly one detail read").toBe(beforeSecond + 1);
    expect(detailCalls("ap_v9"), "second open reads again (no stale cache claim)").toBe(2);
    expect(listCalls(), "still exactly one list read through open+close+reopen").toBe(1);

    // apv5-count 与表体、行复制腿、CSV 腿在重开后仍同源。
    expect(text("apv5-count"), "count tracks the body").toBe(String(rowIds().length));
    await openPreview("ap_v9");
    const pv = pvDds("ap_v9");
    const copy = await copyRow(0);
    expect(segOf(copy, "状态："), "copy stays in sync after reopen").toBe(pv[0]);
    expect(pv[0], "preview == drawer word").toBe(word);
    expect(clicks(), "the whole open/close/reopen/preview/copy ride added no list read").toBe(base + 2);
  });
});
