// @vitest-environment jsdom
/**
 * R168 — 审批决策字段跨面同源护栏（纯测试，零产品改动）。
 *
 * 现场裁决（禁臆造，先 git grep 后落锚）：
 * - 决策时间的四处链完整可锁：行 apv-time-row-* title 绝对句 == 预览
 *   apv-time-preview-* == 抽屉 apd5-field-decided-at == CSV updated_at 列
 *   （row.clock=beijing(DECIDED) 与 detail.decided 同键序同助手，R65 同源）。
 * - 决策人：列表行卡没有审批人展示位（R127 六段契约也无该段）、CSV 七列
 *   （R107）无决策人列 —— 能锁的三处=预览审批人 dd / apd11 复制「审批人：」
 *   段 / 抽屉 apd6-step-node 的 who，逐字=「郑涛」。
 * - 备注（决策意见）：行 apr-row-copy 六段与 CSV 均无该列（现状注记）；
 *   两处载体=抽屉 apd6-step-node DOM 的「意见：…」与 apd8-copy 链路文本，
 *   逐字同源。
 * - 缺 decidedAt/decidedBy 时各载体各按现场句（三种形态各归各，互不冒充）：
 *   行/预览的 RelativeTime 与 apd11 复制段=「该字段未返回」（R76/R99 单点），
 *   行 apr-row-copy 六段的更新时间与抽屉 apd5-field-decided-at=「—」，
 *   CSV=空字段（R107 禁把缺值句写进数据）——本单锁它们不互相冒充、
 *   也不出现 undefined/null。
 * 已覆盖只回证据：R120（详情腿恰 1+列表腿不重取+三时间载体）、R99/R123
 * （缺值句 stateCopy 单点）、R127/R162（apr-row-copy 六段契约）、R139（游标）。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
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

const mock = vi.mocked(fetchJSON);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DECIDED_ISO = "2026-11-19T02:00:00Z"; // 北京 2026-11-19 10:00

let roots: Root[] = [];
let mounted: HTMLDivElement[] = [];

function clearScreen(): void {
  for (const root of roots) {
    act(() => {
      root.unmount();
    });
  }
  roots = [];
  for (const el of mounted) el.remove();
  mounted = [];
}

afterEach(() => {
  clearScreen();
  mock.mockReset();
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

const render = (entry = "/approvals?tab=history") =>
  renderInto(entry, <ApprovalsHistoryModulePage />);

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const urlsAll = (): string[] => mock.mock.calls.map((c) => String(c[0]));
const listUrls = () => urlsAll().filter((u) => u.includes("/api/approvals"));
const detailUrls = (id: string) => urlsAll().filter((u) => u.includes(`/api/approval?id=`) && u.includes(encodeURIComponent(id)));

/** 「绝对 YYYY-MM-DD HH:mm:ss（北京时间） · ISO …」里取到分钟。 */
const absMinute = (title: string | null | undefined) => (title ?? "").slice(3, 19);

const D1 = {
  approvalId: "ap_d1",
  title: "第三季度预算",
  status: "approved",
  riskLevel: "medium",
  approvers: [{ userId: "human:7", name: "郑涛" }],
  decisions: [
    { approver: "human:7", name: "郑涛", verdict: "approve", at: DECIDED_ISO, comment: "同意，按计划轮转" },
  ],
  decidedAt: DECIDED_ISO,
  createdAt: "2026-11-18T01:00:00Z",
  reason: "常规预算调整",
  requestId: "req-d1-1",
};
const D2 = {
  approvalId: "ap_d2",
  title: "密钥轮换二期",
  status: "rejected",
  approvers: [{ userId: "human:8" }],
  decisions: [],
  createdAt: "2026-11-18T03:00:00Z",
  // 故意无 decidedAt/closedAt/updatedAt、无 requestId、无 riskLevel。
};

function serve(rows: unknown[]) {
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent((u.split("id=")[1] ?? "").split("&")[0]);
      const row = (rows as { approvalId?: string }[]).find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    if (u.includes("status=approved")) return { items: id_filter(rows, (r) => (r as { status?: string }).status === "approved") };
    if (u.includes("status=rejected")) return { items: id_filter(rows, (r) => (r as { status?: string }).status === "rejected") };
    if (u.includes("/api/approvals")) return { items: rows };
    return {};
  });
}

const id_filter = (rows: unknown[], pred: (r: unknown) => boolean) => rows.filter(pred);

const openPreview = async (id: string) => {
  const btn = document.querySelector(
    `[data-testid^="apv9-toggle-"][data-record="${id}"]`,
  ) as HTMLButtonElement | null;
  expect(btn, `toggle of ${id}`).toBeTruthy();
  await act(async () => {
    btn!.click();
  });
  await waitFor(() => !!q(`apv9-preview-${id}`), `preview of ${id}`);
};

const openDetail = async (id: string) => {
  const card = q(`apr5-row-${id}`) as HTMLElement | null;
  expect(card, `row ${id}`).toBeTruthy();
  await act(async () => {
    card!.click();
  });
  await waitFor(() => !!q("apr5-detail"), `detail of ${id}`);
};

const stubClipboard = (written: string[], reject = false) => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (t: string) => {
        written.push(t);
        return reject ? Promise.reject(new Error("denied")) : Promise.resolve();
      },
    },
  });
};

/** 拦一次导出，返回 CSV 的非空行（BOM 由 text() 剥除）。 */
async function grabCsvLines(): Promise<string[]> {
  const captured: Blob[] = [];
  const clicks = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  const orig = URL.createObjectURL;
  URL.createObjectURL = ((blob: Blob) => {
    captured.push(blob);
    return "blob:r168";
  }) as typeof URL.createObjectURL;
  try {
    const btn = q("apv7-export") as HTMLButtonElement | null;
    expect(btn, "export button").toBeTruthy();
    expect(btn!.disabled, "export enabled with rows").toBe(false);
    await act(async () => {
      btn!.click();
    });
  } finally {
    URL.createObjectURL = orig;
    clicks.mockRestore();
  }
  expect(captured).toHaveLength(1);
  const text = await captured[0].text();
  return text.split("\r\n").filter((l) => l !== "");
}

describe("R168 ① decided minute chains through row / preview / drawer / CSV", () => {
  it("one timestamp, four carriers, zero extra requests", async () => {
    serve([D1, D2]);
    await render();

    // 行载体：相对时间的 title 绝对句。
    const rowTime = absMinute(q("apv-time-row-ap_d1")?.getAttribute("title"));
    expect(rowTime, "row carrier non-empty").toBe("2026-11-19 10:00");

    // 预览载体（R60 互斥：先读预览文本，再开抽屉）。
    await openPreview("ap_d1");
    const pvTime = absMinute(q("apv-time-preview-ap_d1")?.getAttribute("title"));
    const pvApprovers =
      q("apv-trunc-preview-approvers-ap_d1")?.textContent ??
      (Array.from(q("apv9-preview-ap_d1")?.querySelectorAll("dd") ?? [])[2]?.textContent ?? "");
    expect(pvTime, "preview == row").toBe(rowTime);
    expect(pvApprovers, "预览审批人=显示名").toContain("郑涛");

    // apd11 行复制文本（预览展开态常驻钮）。
    const written: string[] = [];
    stubClipboard(written);
    const callsBeforeCopy = mock.mock.calls.length;
    const copyBtn = q("apd11-copy") as HTMLButtonElement | null;
    expect(copyBtn, "apd11 copy button").toBeTruthy();
    expect(copyBtn!.disabled, "enabled with a previewed row").toBe(false);
    await act(async () => {
      copyBtn!.click();
    });
    await waitFor(() => written.length === 1, "apd11 text");
    expect(mock.mock.calls.length, "copy triggers no request").toBe(callsBeforeCopy);
    const seg = (head: string) =>
      written[0]
        .split("\n")
        .find((l) => l.startsWith(head)) ?? "";
    expect(seg("更新时间：").slice("更新时间：".length).slice(3, 19), "apd11 == row").toBe(rowTime);
    expect(seg("审批人："), "apd11 审批人段").toContain("郑涛");

    // 抽屉载体。
    await openDetail("ap_d1");
    const drawer = q("apd5-field-decided-at")?.querySelector("dd")?.textContent ?? "";
    expect(drawer, "抽屉决定时间 == row").toBe(rowTime);
    const node = q("apd6-step-node-0")?.textContent ?? "";
    expect(node, "节点 who").toContain("郑涛");
    expect(node, "节点备注").toContain("意见：同意，按计划轮转");

    // 链路文本复制与节点同字。
    const trailWritten: string[] = [];
    stubClipboard(trailWritten);
    const beforeTrail = mock.mock.calls.length;
    const trailBtn = q("apd8-copy") as HTMLButtonElement | null;
    expect(trailBtn, "trail copy button").toBeTruthy();
    await act(async () => {
      trailBtn!.click();
    });
    await waitFor(() => trailWritten.length === 1, "trail text");
    expect(mock.mock.calls.length, "trail copy triggers no request").toBe(beforeTrail);
    expect(trailWritten[0], "链路节点行=同一 who/verdict/备注").toContain("郑涛 · 通过");
    expect(trailWritten[0]).toContain("意见：同意，按计划轮转");

    // CSV 载体。
    const lines = await grabCsvLines();
    expect(lines[0]).toBe("id,title,status,risk,updated_at,correlation,rid");
    const row = lines.find((l) => l.startsWith("ap_d1"));
    expect(row, "ap_d1 in csv").toBeTruthy();
    const cells = row!.split(",");
    expect(cells[4], "CSV updated_at == row").toBe(rowTime);
    // 现状注记：CSV 七列契约（R107）没有决策人/备注列。
    expect(lines[0]).not.toContain("decided_by");
    expect(lines[0]).not.toContain("note");
  });
});

describe("R168 ② missing decided fields keep each carrier's own gap form", () => {
  it("screen 该字段未返回, six-segment copy 「—」, CSV empty — never undefined/null, never crossed", async () => {
    serve([D1, D2]);
    await render();

    const rowTime = q("apv-time-row-ap_d2")?.textContent ?? "";
    expect(rowTime, "行时间缺值=RelativeTime 屏上句（R76 单点）").toBe("该字段未返回");

    await openPreview("ap_d2");
    const written: string[] = [];
    stubClipboard(written);
    const copyBtn = q("apd11-copy") as HTMLButtonElement | null;
    expect(copyBtn, "apd11 button").toBeTruthy();
    await act(async () => {
      copyBtn!.click();
    });
    await waitFor(() => written.length === 1, "apd11 text");
    const seg = (head: string) =>
      written[0]
        .split("\n")
        .find((l) => l.startsWith(head)) ?? "";
    expect(seg("更新时间："), "复制段=stateCopy 缺值句")
      .toBe("更新时间：该字段未返回");
    expect(seg("审批人："), "无姓名的审批人仍是人员词")
      .toContain("人员");
    expect(written[0], "不混装 undefined/null").not.toMatch(/undefined|null/);
    // R127 六段契约：行复制的更新时间段缺值=「—」（与屏上同形）。
    const rowCopy = q("apr-row-copy-1") as HTMLButtonElement | null;
    expect(rowCopy, "row copy button for ap_d2").toBeTruthy();
    await act(async () => {
      rowCopy!.click();
    });
    await waitFor(() => written.length === 2, "row copy text");
    expect(written[1]).toContain("更新时间：—");
    expect(written[1], "无 rid 时短码段=—").toContain("短码：—");

    await openDetail("ap_d2");
    expect(q("apd5-field-decided-at")?.querySelector("dd")?.textContent, "抽屉缺决定=—").toBe("—");
    expect(q("apd6-step-nodes-none"), "无已决节点=诚实空段").toBeTruthy();

    const lines = await grabCsvLines();
    const row = lines.find((l) => l.startsWith("ap_d2"));
    expect(row, "ap_d2 in csv").toBeTruthy();
    const cells = row!.split(",");
    expect(cells[4], "CSV 缺值=空字段（R107：禁把缺值句写进数据）").toBe("");
    expect(cells[6], "无 requestId=空字段").toBe("");
  });
});

describe("R168 ③ opening the drawer refetches nothing on the list leg", () => {
  it("one dedicated detail read, list leg untouched (R120 evidence, re-locked for the decision surface)", async () => {
    serve([D1, D2]);
    await render();
    const listsBefore = listUrls().length;
    await openDetail("ap_d1");
    expect(listUrls().length, "list leg never refetches").toBe(listsBefore);
    expect(detailUrls("ap_d1").length, "one detail read").toBe(1);
    await openDetail("ap_d2");
    expect(listUrls().length, "switching rows still no list refetch").toBe(listsBefore);
    expect(detailUrls("ap_d2").length).toBe(1);
  });
});

describe("R168 ④ after ?status= switches the same-source chain keeps holding", () => {
  it("approved view: row==drawer==CSV minute; count==rows==export count", async () => {
    serve([D1, D2]);
    await render("/approvals?tab=history&status=approved");
    await waitFor(() => !!q("apr5-row-ap_d1"), "approved row only");
    expect(q("apr5-row-ap_d2"), "rejected row filtered out server-side").toBeNull();

    const rowTime = absMinute(q("apv-time-row-ap_d1")?.getAttribute("title"));
    expect(rowTime).toBe("2026-11-19 10:00");
    await openDetail("ap_d1");
    expect(q("apd5-field-decided-at")?.querySelector("dd")?.textContent).toBe(rowTime);
    const lines = await grabCsvLines();
    expect(lines.find((l) => l.startsWith("ap_d1"))!.split(",")[4]).toBe(rowTime);

    const rowCount = document.querySelectorAll('[data-testid^="apr5-row-ap_d"]').length;
    expect(q("apv5-count")?.textContent).toBe(String(rowCount));
    expect(q("apv7-export-count")?.textContent).toBe(`共 ${rowCount} 行`);
    // 现状注记：CSV 数据行数=屏上行数（同一 visibleRows，R54 契约）。
    expect(lines.length - 1, "csv data rows == on-screen rows").toBe(rowCount);
  });
});
