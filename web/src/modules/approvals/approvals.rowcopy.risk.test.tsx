// @vitest-environment jsdom
/**
 * R238 (tests only): the risk label is the same human sentence on every face.
 *
 * 现场裁决：工单点名的「行徽标」在现网行卡头部只渲状态徽标（views.tsx 行卡
 * header 实测= toggle + 标题钮 + <Badge status>），风险人话没有行卡展示位
 * （R168「行卡无位」裁决至今有效）。工单①的三载体按现场映射为：
 * 预览风险位 dd（apv9-preview-*）× apr-row-copy-* 文本「风险：」段 × 导出
 * CSV risk 列；另抽一行开详情用详情风险徽标（detailBadges[1]）佐证。
 *
 * 已覆盖只回证据（不写重复用例）：
 * - high 档四处成套（行 badge 公式/预览 dd/详情 badge/复制段/CSV cells[3]）
 *   = approvals.panel.detail.parity.test.tsx（R230）+ approvals.columns.lock
 *   （R219 it② cells[3]==预览风险 dd）；
 * - 缺 risk 行：CSV cells[3]==「未标注风险」（R219 it① 纯函数 + R231 页面站
 *   复制段「风险：未标注风险」）=工单②按现状已是回证据（risk 列缺值写人话
 *   句、非空字段——与 updated_at/rid 缺=空字段不同口径，R107 契约）；
 * - 复制/导出前后 fetchJSON 不变 + apv5-count==表体==导出读数
 *   = approvals.export.order（R231）/export.filter（R182）/export.bounds（R229）。
 * 本文件缺口站 = 逐档矩阵：low/medium/high/critical 四档各自在 预览 × 复制 ×
 * CSV 三载体逐字相等且等于现场真词（低风险/中等风险/高风险/严重风险），原始
 * 枚举码（low/medium/high/critical）不进任何载体文本。
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

const ROWS = [
  { approvalId: "ap_rc1", title: "预算档位一号", status: "approved", riskLevel: "low",
    approvers: [{ userId: "human:7", name: "郑涛" }], decidedAt: "2026-11-19T02:00:00Z",
    createdAt: "2026-11-18T01:00:00Z", requestId: "req-rc-11112222" },
  { approvalId: "ap_rc2", title: "预算档位二号", status: "approved", riskLevel: "medium",
    approvers: [{ userId: "human:7", name: "郑涛" }], decidedAt: "2026-11-19T02:10:00Z",
    createdAt: "2026-11-18T01:00:00Z", requestId: "req-rc-22223333" },
  { approvalId: "ap_rc3", title: "预算档位三号", status: "approved", riskLevel: "high",
    approvers: [{ userId: "human:8", name: "阿朝" }], decidedAt: "2026-11-19T02:20:00Z",
    createdAt: "2026-11-18T01:00:00Z", requestId: "req-rc-33334444" },
  { approvalId: "ap_rc4", title: "预算档位四号", status: "approved", riskLevel: "critical",
    approvers: [{ userId: "human:8", name: "阿朝" }], decidedAt: "2026-11-19T02:30:00Z",
    createdAt: "2026-11-18T01:00:00Z", requestId: "req-rc-44445555" },
];

// 现场真词（RISK_LABEL，medium=「中等风险」教训在案，禁凭记忆硬写错词）。
const EXPECTED = ["低风险", "中等风险", "高风险", "严重风险"];

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
  document.body.removeAttribute("data-r238r-search");
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

function render(entry = "/approvals?tab=history") {
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

function riskSegs(): string[] {
  return Array.from(document.querySelectorAll("button")).filter((b) => /^apr-row-copy-\d+$/.test(b.getAttribute("data-testid") ?? "")).length === ROWS.length
    ? EXPECTED.slice()
    : [];
}

async function openPreview(id: string) {
  const toggle = document.querySelector(
    `[data-testid^="apv9-toggle-"][data-record="${id}"]`,
  );
  expect(toggle, `toggle for ${id}`).toBeTruthy();
  await act(async () => {
    toggle?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await waitFor(`preview ${id}`, () => !!q(`apv9-preview-${id}`));
}

function pvRisk(id: string): string {
  const card = q(`apv9-preview-${id}`);
  expect(card, `preview for ${id}`).toBeTruthy();
  const dds = Array.from(card?.querySelectorAll("dd") ?? []);
  // 预览 dd 顺序 = 状态, 风险, 更新时间, 审批人…（R52-obs 现场形制）
  return dds[1]?.textContent ?? "";
}

function clickEl(el: Element | null | undefined, what: string) {
  expect(el, what).toBeTruthy();
  act(() => {
    el?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

function stubClipboard(written: string[], reject = false) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (t: string) => {
        written.push(t);
        return reject ? Promise.reject(new Error("denied")) : Promise.resolve();
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

function copyRiskOf(text: string): string {
  const line = text.split("\n").find((l) => l.startsWith("风险：")) ?? "";
  return line.slice("风险：".length);
}

async function grabCsvGrid(): Promise<string[][]> {
  const before = clicks();
  const blobs: Blob[] = [];
  const downloads: string[] = [];
  const origCreate = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  const origClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = (blob: Blob) => {
    blobs.push(blob);
    return "blob:csv";
  };
  URL.revokeObjectURL = () => undefined;
  HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
    downloads.push(this.download);
  };
  try {
    const btn = q("apv7-export");
    expect(btn, "export button").toBeTruthy();
    expect((btn as HTMLButtonElement).disabled, "export enabled").toBe(false);
    clickEl(btn, "export click");
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

describe("R238 risk label is one human sentence on every face", () => {
  it("①③ low/medium/high/critical read identically on preview, rail copy and CSV, raw enum codes never ride the text, and counts agree", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      if (url.includes("/api/approval?id=")) {
        const id = decodeURIComponent(url.split("id=")[1] ?? "");
        return ROWS.find((r) => r.approvalId === id) ?? {};
      }
      if (url.includes("/api/approvals")) return { items: ROWS };
      return {};
    });
    await render();
    await waitFor("four rows", () => rowIds().length === 4);
    expect(rowIds()).toEqual(["ap_rc1", "ap_rc2", "ap_rc3", "ap_rc4"]);

    const preview: string[] = [];
    const copied: string[] = [];
    for (let i = 0; i < ROWS.length; i += 1) {
      const id = ROWS[i].approvalId;
      await openPreview(id);
      preview.push(pvRisk(id));
      copied.push(copyRiskOf(await copyRow(i)));
    }
    // 三载体逐字相等 + 等于现场真词（禁臆造词表，真词即本用例唯一期望）。
    expect(preview).toEqual(EXPECTED);
    expect(copied).toEqual(EXPECTED);
    expect(copied, "preview == rail copy").toEqual(preview);

    const grid = await grabCsvGrid();
    expect(grid[0]).toEqual(["id", "title", "status", "risk", "updated_at", "correlation", "rid"]);
    const csv = grid.slice(1).map((cells) => cells[3]);
    expect(csv, "CSV risk == the same sentence").toEqual(EXPECTED);
    expect(grid.slice(1).length, "③ CSV data rows == table body").toBe(rowIds().length);
    expect(text("apv5-count"), "③ apv5-count agrees").toBe(String(rowIds().length));
    // 原始枚举码不进任何载体文本（中文标题+人话句的站里，只可能从 risk 列漏码）。
    const flat = grid.map((cells) => cells.join(",")).join("\n");
    expect(flat, "no raw enum codes in CSV").not.toMatch(/\b(low|medium|high|critical)\b/);
    const copyAll = copied.join("\n");
    expect(copyAll, "no raw enum codes in copy segments").not.toMatch(/\b(low|medium|high|critical)\b/);
  });

  it("② the detail badge reads the same risk sentence (high station), and closing asks for nothing extra", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      if (url.includes("/api/approval?id=")) {
        const id = decodeURIComponent(url.split("id=")[1] ?? "");
        return ROWS.find((r) => r.approvalId === id) ?? {};
      }
      if (url.includes("/api/approvals")) return { items: ROWS };
      return {};
    });
    await render();
    await waitFor("four rows", () => rowIds().length === 4);
    // R60 互斥=开详情收预览：先读预览值，再开抽屉对照。
    await openPreview("ap_rc3");
    const pv = pvRisk("ap_rc3");
    expect(pv, "preview risk word").toBe("高风险");
    const before = clicks();
    const row = q("apr5-row-ap_rc3");
    await act(async () => {
      row?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await waitFor("drawer opens", () => !!q("apr5-detail"));
    const detailCalls = api.fetchJSON.mock.calls.filter((c) => String(c[0]).includes("/api/approval?id=ap_rc3")).length;
    expect(detailCalls, "one detail read for the opened record").toBe(1);
    const h2 = q("apr5-detail")?.querySelector("h2");
    const badges = Array.from(h2?.parentElement?.children ?? []).slice(1);
    const riskBadge = badges.map((b) => b.textContent ?? "");
    expect(riskBadge, "detail badges carry 高风险").toContain("高风险");
    expect(riskBadge.join("|"), "detail badge == preview sentence").toContain(pv);
    const copyText = await copyRow(2);
    expect(copyRiskOf(copyText), "rail copy == detail badge").toBe(pv);
    // 关闭详情只删 id，不再要东西。
    clickEl(q("apd7-back"), "back to list");
    await waitFor("drawer closes", () => !q("apr5-detail"));
    const listCallsNow = api.fetchJSON.mock.calls.filter((c) => String(c[0]).includes("/api/approvals")).length;
    expect(listCallsNow, "closing refetches nothing").toBe(1);
    // 从 before 起只多一条=开详情的 id 读；关闭只删地址参数，复制零请求。
    expect(clicks(), "only the detail read rides after before").toBe(before + 1);
    void riskSegs;
  });
});
