// @vitest-environment jsdom
/**
 * R123 — 审批 status/risk 文案三处同源护栏（纯测试，零产品改动）。
 *
 * 覆盖侦察（git grep 现查）：逐字同源矩阵与缺值同句已由
 *   approvals.parity.test.tsx（R120 ①②④案）与 approvals.copy.test.tsx
 *   （R99 常量锁）覆盖；list 面未知状态含「状态未识别」由
 *   ApprovalsHistoryModulePage.test.tsx L257-266 覆盖。
 * 本文件只补真缺口：未知枚举的原始码（teleported / purple）在
 *   行 / 详情 / CSV 三个面上都不上屏（只落 statusView/riskView 单点兜底词），
 *   以及这三步的零额外请求计数锁。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
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

let roots: Root[] = [];
let mounted: HTMLDivElement[] = [];

afterEach(() => {
  for (const root of roots) {
    act(() => {
      root.unmount();
    });
  }
  roots = [];
  for (const el of mounted) el.remove();
  mounted = [];
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

async function render(entry: string): Promise<void> {
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
const urlsAll: string[] = [];
const listCalls = () => urlsAll.filter((u) => u.includes("/api/approvals")).length;
const detailCalls = () => urlsAll.filter((u) => u.includes("/api/approval?id=")).length;

const HOUR = 3_600_000;
const isoAgo = (ms: number) => new Date(Date.now() - ms).toISOString();

/** 未知 status + 未知 risk 的同一条记录（列表与详情共用同一 body）。 */
const L1 = {
  approvalId: "ap_l123",
  title: "未知枚举护栏",
  status: "teleported",
  riskLevel: "purple",
  approvers: [{ userId: "human:7", name: "郑涛" }],
  requestId: "req-l123",
  createdAt: isoAgo(3 * HOUR),
  decidedAt: isoAgo(1 * HOUR),
};

function serve() {
  urlsAll.length = 0;
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    urlsAll.push(u);
    if (u.includes("/api/approval?id=")) return { ...L1 };
    if (u.includes("/api/approvals")) return { items: [L1] };
    return {};
  });
}

const openPreview = async (id: string) => {
  const btn = document.querySelector(`[data-testid^="apv9-toggle-"][data-record="${id}"]`) as HTMLButtonElement | null;
  expect(btn, `toggle of ${id}`).toBeTruthy();
  await act(async () => {
    btn!.click();
  });
  await waitFor(() => !!q(`apv9-preview-${id}`), `preview of ${id}`);
};

const openDetail = async (id: string) => {
  const card = document.querySelector(`[data-testid="apr5-row-${id}"]`) as HTMLElement | null;
  expect(card, `row ${id}`).toBeTruthy();
  await act(async () => {
    card!.click();
  });
  await waitFor(() => !!q("apr5-detail"), `detail of ${id}`);
};

const rowBadge = (id: string) => {
  const title = q(`apv-trunc-row-title-${id}`);
  const header = title?.closest("button")?.parentElement;
  return (header?.lastElementChild?.textContent ?? "").trim();
};

const detailBadges = () => {
  const head = q("apv-trunc-detail-title")?.parentElement;
  const kids = head ? Array.from(head.children).slice(1) : [];
  return kids.map((el) => (el.textContent ?? "").trim());
};

const previewDds = (id: string) =>
  Array.from(q(`apv9-preview-${id}`)?.querySelectorAll("dd") ?? []).map((el) => el.textContent ?? "");

describe("R123 unknown enums keep raw codes off row / detail / CSV", () => {
  it("every surface reads the single-point fallback labels, never teleported/purple", async () => {
    serve();
    await render("/approvals?tab=history");
    // 行面：状态徽标=兜底词；原始码不上屏（risk 行卡无位，按现状）。
    expect(rowBadge(L1.approvalId)).toBe("状态未识别");
    const cardText = q(`apr5-row-${L1.approvalId}`)?.textContent ?? "";
    expect(cardText).not.toContain("teleported");
    expect(cardText).not.toContain("purple");

    // 预览面：状态与风险都落单点兜底词。
    await openPreview(L1.approvalId);
    const [pvStatus, pvRisk] = previewDds(L1.approvalId);
    expect(pvStatus).toBe("状态未识别");
    expect(pvRisk).toBe("未标注风险");

    // 详情面：两枚徽标同词，且详情正文不出现原始码。
    await openDetail(L1.approvalId);
    expect(detailBadges()[0], "detail status == row/preview").toBe("状态未识别");
    expect(detailBadges()[1], "detail risk == preview risk").toBe("未标注风险");
    const detailText = q("apr5-detail")?.textContent ?? "";
    expect(detailText).not.toContain("teleported");
    expect(detailText).not.toContain("purple");
  });

  it("the CSV row writes the same fallback labels, not the raw enum codes", async () => {
    serve();
    await render("/approvals?tab=history");
    const downloads: string[] = [];
    const clicks = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloads.push(this.download);
      });
    const captured: Blob[] = [];
    const orig = URL.createObjectURL;
    URL.createObjectURL = ((blob: Blob) => {
      captured.push(blob);
      return "blob:appr123";
    }) as typeof URL.createObjectURL;
    try {
      const btn = q("apv7-export") as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
      await act(async () => {
        btn.click();
      });
    } finally {
      URL.createObjectURL = orig;
      clicks.mockRestore();
    }
    expect(captured).toHaveLength(1);
    const text = await captured[0].text();
    const lines = text.split("\r\n").filter((l) => l !== "");
    expect(lines[0]).toBe("id,title,status,risk,updated_at,correlation,rid");
    const cells = lines[1].split(",");
    expect(cells[0]).toBe("ap_l123");
    expect(cells[2], "csv status uses the single-point fallback label").toBe("状态未识别");
    expect(cells[3], "csv risk uses the single-point fallback label").toBe("未标注风险");
    expect(text).not.toContain("teleported");
    expect(text).not.toContain("purple");
  });

  it("none of these steps issues extra requests (list leg fixed, detail leg exactly once)", async () => {
    serve();
    await render("/approvals?tab=history");
    const n0 = listCalls();
    await openPreview(L1.approvalId);
    expect(listCalls(), "preview never refetches").toBe(n0);
    await openDetail(L1.approvalId);
    expect(listCalls(), "opening the detail keeps the list leg").toBe(n0);
    expect(detailCalls(), "detail read port exactly once").toBe(1);
    const orig = URL.createObjectURL;
    URL.createObjectURL = (() => "blob:noop") as typeof URL.createObjectURL;
    const clicks = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    try {
      await act(async () => {
        (q("apv7-export") as HTMLButtonElement).click();
      });
    } finally {
      URL.createObjectURL = orig;
      clicks.mockRestore();
    }
    expect(listCalls(), "export is pure front-end").toBe(n0);
    expect(detailCalls(), "export reads no new detail").toBe(1);
  });
});
