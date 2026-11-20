// @vitest-environment jsdom
// Row/copy/export parity guards for /capabilities (wave-29). These tests add
// no behaviour: they pin the three faces — list row, expanded detail
// (`cap7-detail-*`), list copy (`capC-copy`) and export (`cap6-export` +
// `cap-page-scope` + `cap-export-scope-note`) — onto the same values, the
// same order and the same N, and they pin that the collection timestamp never
// falls back to the browser clock.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchJsonStrict = vi.fn();
vi.mock("@/modules/models/fetchJson", () => ({ fetchJsonStrict: (...args: unknown[]) => fetchJsonStrict(...args) }));
const clipboard = vi.hoisted(() => ({ copyTextToClipboard: vi.fn() }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clipboard.copyTextToClipboard }));
vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));
import { SkillsPage, resetSkillsTabState } from "../skills/SkillsPage";
import { resetCapabilityCounts } from "./counts";
import { resetTabView } from "./tabView";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  fetchJsonStrict.mockReset();
  resetCapabilityCounts();
  resetSkillsTabState();
  resetTabView();
  clipboard.copyTextToClipboard.mockReset();
  clipboard.copyTextToClipboard.mockResolvedValue(true);
  window.history.replaceState({}, "", "/capabilities?tab=skills");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

async function render() {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[window.location.pathname + window.location.search]}>
        <SkillsPage />
      </MemoryRouter>,
    );
  });
  await act(async () => {});
}

const q = (testid: string) => container.querySelector<HTMLElement>(`[data-testid='${testid}']`);
const cellValue = (tr: Element, index: number) =>
  tr.querySelectorAll(".skl4-cell")[index]?.firstElementChild?.textContent?.trim() ?? null;
const rowValues = (tr: Element) => [0, 1, 2, 3].map((i) => cellValue(tr, i));

async function expandRow(id: string) {
  const tr = q(`skl4-row-${id}`)!;
  await act(async () => {
    tr.querySelector<HTMLButtonElement>("[data-testid='cap7-detail-toggle']")!.click();
  });
  return tr;
}

async function copiedListText(): Promise<string> {
  let captured = "";
  clipboard.copyTextToClipboard.mockImplementation(async (text: string) => {
    captured = text;
    return true;
  });
  await act(async () => {
    q("capC-copy")!.click();
  });
  return captured;
}

async function exportedCsv(): Promise<string> {
  const blobs: Blob[] = [];
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const originalClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = ((blob: Blob) => {
    blobs.push(blob);
    return "blob:parity";
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = () => undefined;
  HTMLAnchorElement.prototype.click = function click() {
    /* capture only */
  };
  try {
    await act(async () => {
      q("cap6-export")!.click();
    });
  } finally {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    HTMLAnchorElement.prototype.click = originalClick;
  }
  expect(blobs[0]).toBeTruthy();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^\uFEFF/, ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blobs[0]!);
  });
}

/** Row 2 exercises every honest-missing branch: no name, unmapped status,
 * unparseable update time. */
const fixture = {
  asOf: "2026-11-19T06:00:00Z",
  items: [
    { skillId: "s1", name: "资料整理", scope: "tenant-shared", status: "active", updatedAt: "2026-11-19T05:30:00Z" },
    { skillId: "s2", scope: "tenant-shared", status: "mystery", updatedAt: "not-a-date" },
  ],
};

describe("capability row parity: list row vs expanded detail", () => {
  it("every detail field equals the list row verbatim, for a full row and an all-missing row", async () => {
    fetchJsonStrict.mockResolvedValue(fixture);
    await render();
    for (const id of ["s1", "s2"]) {
      const tr = await expandRow(id);
      const [name, source, status, updated] = rowValues(tr);
      expect(q("cap7-detail-name")?.textContent?.trim()).toBe(name);
      expect(q("cap7-detail-type")?.textContent?.trim()).toBe(source);
      expect(q("cap7-detail-enabled")?.textContent?.trim()).toBe(status);
      expect(q("cap7-detail-updated")?.textContent?.trim()).toBe(updated);
      expect(q("cap7-detail-endpoint")?.textContent?.trim()).toBe("/agent-api/api/skills");
      expect(q("cap7-detail-asof")?.textContent?.trim()).toBe("2026-11-19 14:00");
    }
  });

  it("an unmapped status reads 待核实 in both faces and both carry the raw value as their title", async () => {
    fetchJsonStrict.mockResolvedValue(fixture);
    await render();
    const tr = await expandRow("s2");
    const statusCell = tr.querySelectorAll(".skl4-cell")[2].firstElementChild!;
    expect(statusCell.textContent).toBe("待核实");
    expect(statusCell.getAttribute("title")).toBe("mystery");
    const detail = q("cap7-detail-enabled")!;
    expect(detail.textContent).toBe("待核实");
    expect(detail.getAttribute("title")).toContain("mystery");
  });

  it("missing values stay 「—」 in the detail and never borrow the browser clock for the timestamp", async () => {
    fetchJsonStrict.mockResolvedValue(fixture);
    await render();
    await expandRow("s2");
    expect(q("cap7-detail-name")?.textContent?.trim()).toBe("—");
    expect(q("cap7-detail-updated")?.textContent?.trim()).toBe("—");
    expect(q("cap7-detail-asof")?.getAttribute("title")).toContain("UTC 原文：2026-11-19T06:00:00Z");
    expect(q("cap7-detail-asof")?.getAttribute("title")).toContain("北京时间：2026-11-19 14:00");
  });
});

describe("capability copy parity: capC-copy vs the list rows", () => {
  it("copies the same values in the same order as the table body, missing as — and never a 0", async () => {
    fetchJsonStrict.mockResolvedValue(fixture);
    await render();
    const order = [...container.querySelectorAll("[data-testid^='skl4-row-']")];
    const lines = (await copiedListText()).split("\n");
    expect(lines[0]).toBe("name,type,enabled,updated_at");
    expect(lines.length - 1).toBe(order.length);
    order.forEach((tr, index) => {
      expect(lines[index + 1]).toBe(rowValues(tr).join(","));
    });
    expect(lines.some((line) => /(^|,),0(,|$)/.test(line))).toBe(false);
    expect(lines[2]).toBe("—,类型：团队共享,待核实,—");
  });

  it("an empty result disables the copy and the button title is the same sentence as cap-gates-copy", async () => {
    fetchJsonStrict.mockResolvedValue({ asOf: "2026-11-19T06:00:00Z", items: [] });
    await render();
    const button = q("capC-copy") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    const gateTitle = q("cap-gates-copy")?.getAttribute("title") ?? null;
    expect(button.getAttribute("title")).toBe(gateTitle);
    expect(gateTitle).toBe("当前没有可导出的条目。");
    clipboard.copyTextToClipboard.mockClear();
    await act(async () => {
      button.click();
    });
    expect(clipboard.copyTextToClipboard).not.toHaveBeenCalled();
  });
});

describe("count and scope parity: cap-page-scope vs table body vs export", () => {
  it("the scope N, the rendered rows and the exported data rows are the same number, note excluded", async () => {
    fetchJsonStrict.mockResolvedValue(fixture);
    await render();
    const scopeText = q("cap-page-scope")?.textContent ?? "";
    const n = Number(scopeText.match(/共 (\d+) 项/)?.[1]);
    const rowCount = container.querySelectorAll("[data-testid^='skl4-row-']").length;
    const csv = await exportedCsv();
    const lines = csv.trim().split("\r\n");
    const dataLines = lines.filter((line) => !line.startsWith("#")).length - 1;
    expect(n).toBe(2);
    expect(rowCount).toBe(n);
    expect(dataLines).toBe(n);
    expect(q("cap-export-scope-note")?.getAttribute("data-shown")).toBe(String(n));
    expect(lines[lines.length - 1]).toBe(`#${q("cap-export-scope-note")?.textContent?.trim()}`);
    expect(scopeText).toContain("表内全量渲染");
  });

  it("a paginated read口 says 已加载 in the note, keeps the export at the loaded N and never claims 全量", async () => {
    fetchJsonStrict.mockResolvedValue({ ...fixture, total: 57, nextCursor: "cur_2" });
    await render();
    const scopeText = q("cap-page-scope")?.textContent ?? "";
    expect(scopeText).toContain("本页按读口单页上限显示 2 项");
    const note = q("cap-export-scope-note")?.textContent?.trim();
    expect(note).toBe("本次导出为当前已加载 2 项，读口回传总数 57 项，不是全量");
    const csv = await exportedCsv();
    const lines = csv.trim().split("\r\n");
    expect(lines[lines.length - 1]).toBe(`#${note}`);
    expect(lines.filter((line) => !line.startsWith("#")).length - 1).toBe(
      container.querySelectorAll("[data-testid^='skl4-row-']").length,
    );
    expect(container.textContent).not.toContain("表内全量渲染");
  });
});

describe("collection timestamp: aliases only, browser clock never", () => {
  it("reads a top-level generated_at under a frozen 2031 clock and shows only the upstream BJT minute", async () => {
    vi.useFakeTimers({ now: new Date("2031-03-01T00:00:00Z"), toFake: ["Date"] });
    fetchJsonStrict.mockResolvedValue({ generated_at: "2026-11-19T06:00:00Z", items: [fixture.items[0]] });
    await render();
    await expandRow("s1");
    expect(q("cap7-detail-asof")?.textContent).toBe("2026-11-19 14:00");
    expect(q("cap7-detail-asof")?.getAttribute("title") ?? "").not.toContain("2031");
    expect(q("skl4-source")?.textContent ?? "").not.toContain("2031");
    expect(q("cap-page-scope")?.textContent ?? "").not.toContain("2031");
    let rowCopy = "";
    clipboard.copyTextToClipboard.mockImplementation(async (text: string) => {
      rowCopy = text;
      return true;
    });
    await act(async () => {
      q("cap-row-copy")!.click();
    });
    expect(rowCopy).toContain("采集时刻：2026-11-19 14:00");
    expect(rowCopy).not.toContain("2031");
    expect(await copiedListText()).not.toContain("2031");
  });

  it.each([
    ["no alias at all", {}],
    ["an invalid alias", { asOf: "not-a-timestamp" }],
    ["a non-ISO collectedAt", { collectedAt: "昨天下午" }],
  ])("missing or illegal source time (%s) prints — with the no-local-clock title", async (_label, payload) => {
    vi.useFakeTimers({ now: new Date("2031-03-01T00:00:00Z"), toFake: ["Date"] });
    fetchJsonStrict.mockResolvedValue({ ...payload, items: [fixture.items[0]] });
    await render();
    await expandRow("s1");
    const asof = q("cap7-detail-asof")!;
    expect(asof.textContent).toBe("—");
    expect(asof.getAttribute("title")).toContain("不用本机时间顶替");
    expect(asof.getAttribute("title") ?? "").not.toContain("2031");
    expect(q("skl4-source")?.textContent ?? "").toContain("—（未提供读取时刻）");
    let rowCopy = "";
    clipboard.copyTextToClipboard.mockImplementation(async (text: string) => {
      rowCopy = text;
      return true;
    });
    await act(async () => {
      q("cap-row-copy")!.click();
    });
    expect(rowCopy).toContain("采集时刻：—");
    expect(rowCopy).not.toContain("2031");
  });
});
