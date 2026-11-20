// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJsonStrict: vi.fn() }));
vi.mock("@/modules/models/fetchJson", () => ({
  fetchJsonStrict: (...args: unknown[]) => api.fetchJsonStrict(...args),
}));
const clipboard = vi.hoisted(() => ({ copyTextToClipboard: vi.fn() }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clipboard.copyTextToClipboard }));
vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

import { ApiError } from "@/lib/api-error";
import { ToolsPage } from "../tools/ToolsPage";
import { resetToolsTabState } from "../tools/useToolsData";
import { resetCapabilityCounts } from "./counts";
import { ROW_GAP } from "./rowLink";
import { stateAnchor } from "./stateAnchor";
import { resetTabView } from "./tabView";

const TOOLSETS = [
  { name: "web", label: "Web Search & Scraping", enabled: true, configured: true, platform_label: "CLI", tools: ["web_search", "web_extract"] },
  { name: "kanban", label: "Kanban", enabled: false, configured: false, platform_label: "CLI", tools: ["kanban_create"] },
  { name: "mystery", label: "Mystery", tools: ["mystery_tool"] },
];
const SERVERS = {
  servers: [
    { name: "文档检索", transport: "http", enabled: true, auth: "header", env: { API_KEY: "super-secret-value" } },
    { name: "旧连接", transport: "stdio", enabled: false },
  ],
};

function answer(url?: string): Promise<unknown> {
  // Vitest mock bookkeeping can invoke the implementation without an argument during
  // teardown; that is not a page request, so it must not be counted as a read.
  if (!url) return Promise.resolve({ servers: [] });
  if (url.startsWith("/agent-api/")) return Promise.reject(new ApiError("missing", { status: 404, body: "{}", url }));
  if (url.includes("/api/tools/toolsets")) return Promise.resolve(TOOLSETS);
  if (url.includes("/api/mcp/servers")) return Promise.resolve(SERVERS);
  return Promise.reject(new ApiError("unknown", { status: 404, body: "{}", url }));
}

let container: HTMLDivElement;
let root: Root | null = null;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  api.fetchJsonStrict.mockReset();
  clipboard.copyTextToClipboard.mockReset();
  clipboard.copyTextToClipboard.mockResolvedValue(true);
  resetCapabilityCounts();
  resetToolsTabState();
  resetTabView();
  window.history.replaceState({}, "", "/capabilities?tab=tools");
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
  container?.remove();
  vi.useRealTimers();
});

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="cap8-location">{loc.search}</span>;
}

/** Mount (or re-mount, after unmounting) the tools page at `entry`. */
async function render(entry: string): Promise<void> {
  await act(async () => root?.unmount());
  document.body.replaceChildren();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[entry]}>
        <LocationProbe />
        <ToolsPage />
      </MemoryRouter>,
    );
  });
  await act(async () => {});
}

async function waitFor(cond: () => boolean, label: string): Promise<void> {
  const deadline = Date.now() + 3000;
  while (!cond()) {
    if (Date.now() > deadline) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

/** Fresh mount with the read stub armed. */
async function mount(entry = "/capabilities?tab=tools"): Promise<void> {
  api.fetchJsonStrict.mockReset();
  api.fetchJsonStrict.mockImplementation(answer);
  await render(entry);
  await waitFor(() => !document.querySelector(".animate-pulse"), "tools settled");
}

const q = <T extends HTMLElement = HTMLElement>(testid: string): T | null =>
  document.querySelector<T>(`[data-testid='${testid}']`);
const rows = (): Element[] => [...document.querySelectorAll("[data-testid='tol5-row']")];
const toolNames = (): string[] =>
  rows().map((row) => row.querySelector("[data-testid='tl3-name']")?.textContent?.trim() ?? "");
const searchOf = (): string => q("cap8-location")?.textContent ?? "";
const paramsOf = (): Record<string, string> => Object.fromEntries(new URLSearchParams(searchOf()).entries());
/** Real page reads only: the spy is also invoked without arguments during teardown. */
const reads = (): string[] =>
  api.fetchJsonStrict.mock.calls.map((call) => String(call[0])).filter((url) => url !== "undefined");
const details = (): number => document.querySelectorAll("[data-testid='cap7-detail-tools']").length;

function entryWith(fields: Record<string, string>): string {
  return `/capabilities?${new URLSearchParams(fields).toString()}`;
}

describe("capabilities tools row deep link", () => {
  it("opens the linked row on mount and leaves every other filter param byte-identical", async () => {
    await mount();
    const all = toolNames();
    expect(all.length).toBeGreaterThan(1);
    const firstLoadReads = reads().length;

    const target = all[0];
    const needle = target.slice(0, 2);
    const fields = { tab: "tools", q: needle, row: `tools:${target}`, sort: "name", dir: "asc" };
    // Drop the tab cache so this mount is a genuine first load with params in the URL.
    resetToolsTabState();
    await mount(entryWith(fields));

    // The link is honoured on arrival: exactly one detail panel, on the linked row.
    expect(details()).toBe(1);
    expect(q("cap-row-expanded")).toBeTruthy();
    const linked = rows().find((row) => row.querySelector("[data-testid='tl3-name']")?.textContent?.trim() === target);
    expect(linked?.getAttribute("aria-current")).toBe("true");

    // The same URL also filters, and the filter and the link agree about the row set.
    const shown = toolNames();
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.every((name) => name.includes(needle))).toBe(true);
    expect(shown).toContain(target);

    // Nothing was rewritten or dropped: the five params read back exactly as pasted.
    expect(paramsOf()).toEqual(fields);
    expect(searchOf()).toBe("?" + new URLSearchParams(fields).toString());

    // Params cost no reads: the same URL shape reads the same endpoints as a bare mount.
    expect(reads().length).toBe(firstLoadReads);
  });

  it("says a missing link is missing, rewrites nothing, and keeps the capF anchor beside it", async () => {
    await mount();
    const loaded = toolNames().length;

    const needle = "zzz-none";
    const fields = { tab: "tools", q: needle, row: "tools:不存在的集" };
    const entry = entryWith(fields);
    await mount(entry);

    // Readable empty state, and the reason names the search word that hid it.
    const missing = q("cap-row-missing");
    expect(missing).toBeTruthy();
    expect(missing?.getAttribute("title")).toBe(ROW_GAP);
    expect(missing?.textContent).toContain("该条目不在当前列表里");
    expect(missing?.textContent).toContain("把这个条目隐藏了");
    // The way out drops the lookup and the filter, and nothing else.
    const href = q("cap-row-missing-clear")?.getAttribute("href") ?? "";
    expect(href.startsWith("#/capabilities?")).toBe(true);
    expect(href).not.toContain("row=");
    expect(href).not.toContain("q=");
    expect(href).toContain("tab=tools");

    // No silent URL rewrite: the address still reads exactly what was pasted.
    expect(searchOf()).toBe("?" + new URLSearchParams(fields).toString());
    expect(paramsOf()).toEqual(fields);

    // No invented row and no opened panel; the filter really emptied the table.
    expect(details()).toBe(0);
    expect(rows()).toHaveLength(0);
    expect(q("tl3-no-match")).toBeTruthy();

    // The state anchor is still there and still says the same sentence the helper produces.
    const anchor = q("capF-state-filter-empty");
    expect(anchor).toBeTruthy();
    expect(anchor?.className).toContain("capF-state-text");
    expect(anchor?.className).not.toContain("sr-only");
    const expected = stateAnchor({ kind: "filter-empty", subject: "工具与 MCP 清单", reason: needle, loaded });
    expect(anchor?.textContent?.trim()).toBe(`${expected.lead}${expected.detail}`);
    expect(anchor?.getAttribute("title")).toBe(expected.title);
  });

  it("switching the linked row changes only `row`, and there is no page param to reset", async () => {
    await mount();
    const all = toolNames();
    const needle = all[0].slice(0, 2);
    await mount(entryWith({ tab: "tools", q: needle, sort: "name", dir: "asc" }));

    const before = paramsOf();
    expect(before.row).toBeUndefined();
    const readCount = reads().length;

    const clickLink = async (index: number): Promise<void> => {
      const link = rows()[index].querySelector<HTMLAnchorElement>("[data-testid='cap-row-link']");
      expect(link).toBeTruthy();
      await act(async () => link!.click());
    };

    await clickLink(0);
    const first = paramsOf();
    expect(first.row).toBe(`tools:${toolNames()[0]}`);
    expect(details()).toBe(1);

    await clickLink(1);
    const second = paramsOf();
    expect(second.row).toBe(`tools:${toolNames()[1]}`);
    expect(details()).toBe(1);

    // Only `row` moved; q / sort / dir / tab are untouched, byte for byte.
    for (const after of [first, second]) {
      expect(Object.keys(after).sort()).toEqual(["dir", "q", "row", "sort", "tab"]);
      for (const key of ["tab", "q", "sort", "dir"]) {
        expect(after[key]).toBe(before[key]);
      }
    }

    // This generation has no paging param on this page, so 「页码归 1」 has nothing to reset.
    const pageLike = ["page", "pageNum", "pageNumber", "page_size", "cursor", "nextCursor", "offset", "limit"];
    for (const snapshot of [before, first, second]) {
      expect(Object.keys(snapshot).filter((key) => pageLike.includes(key))).toEqual([]);
    }

    // Linking is a URL write, not a read.
    expect(reads().length).toBe(readCount);
  });

  it("re-mounting the same URL restores the same link, filter and row count without reading again", async () => {
    await mount();
    const all = toolNames();
    const target = all[1];
    const entry = entryWith({ tab: "tools", q: target.slice(0, 2), row: `tools:${target}`, sort: "name", dir: "desc" });

    await mount(entry);
    const readCount = reads().length;
    const loc = searchOf();
    const shown = toolNames();
    expect(details()).toBe(1);

    // Same URL, fresh component tree: the tab cache restores the view with zero new reads.
    await render(entry);
    await waitFor(() => details() === 1, "restored detail");
    expect(searchOf()).toBe(loc);
    expect(toolNames()).toEqual(shown);
    expect(reads().length).toBe(readCount);

    // Closing the panel removes only `row`; the rest of the address stands.
    await act(async () => q<HTMLButtonElement>("cap-row-close")?.click());
    const after = paramsOf();
    expect(after.row).toBeUndefined();
    expect(after.q).toBe(new URLSearchParams(loc).get("q"));
    expect(after.sort).toBe("name");
    expect(after.dir).toBe("desc");
    expect(details()).toBe(0);
    expect(reads().length).toBe(readCount);
  });
});
