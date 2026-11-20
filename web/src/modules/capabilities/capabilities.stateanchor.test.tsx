// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJsonStrict: vi.fn() }));
vi.mock("@/modules/models/fetchJson", () => ({ fetchJsonStrict: (...args: unknown[]) => api.fetchJsonStrict(...args) }));
const clipboard = vi.hoisted(() => ({ copyTextToClipboard: vi.fn() }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clipboard.copyTextToClipboard }));
vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

import { SkillsPage, resetSkillsTabState } from "../skills/SkillsPage";
import { ToolsPage } from "../tools/ToolsPage";
import { resetToolsTabState } from "../tools/useToolsData";
import { resetCapabilityCounts } from "./counts";
import { resetTabView } from "./tabView";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root | null = null;

const AS_OF = "2026-11-19T06:00:00Z";
const SKILL_ITEMS = [
  { skillId: "s1", name: "资料整理", scope: "tenant-shared", status: "active", updatedAt: "2026-11-19T05:30:00Z" },
  { skillId: "s2", name: "日报生成", scope: "builtin", status: "active", updatedAt: "2026-11-19T04:00:00Z" },
];
const TOOLSETS = [
  { name: "web", label: "网页搜索", enabled: true, configured: true, platform_label: "CLI", tools: ["web_search"] },
  { name: "kanban", label: "看板", enabled: false, configured: false, platform_label: "CLI", tools: ["kanban_create"] },
];
const SERVERS = { servers: [{ name: "文档检索", transport: "http", enabled: true, auth: "header" }] };

const NO_MATCH = "不存在的词";
const SKILLS_ENTRY = "/capabilities?tab=skills";
const TOOLS_ENTRY = "/capabilities?tab=tools";

function skillImpl(payload: unknown) {
  return (url?: string) => {
    if (!url) return Promise.resolve(SERVERS);
    if (url.includes("/agent-api/api/skills")) return Promise.resolve(payload);
    return Promise.reject(new ApiError("unknown", { status: 404, body: "{}", url }));
  };
}
function skillRejects(status: number, message: string) {
  return (url?: string) => {
    if (!url) return Promise.resolve(SERVERS);
    return Promise.reject(new ApiError(message, { status, body: "{}", url }));
  };
}
function toolsImpl(url?: string): Promise<unknown> {
  if (!url) return Promise.resolve(SERVERS);
  if (url.startsWith("/agent-api/")) return Promise.reject(new ApiError("missing", { status: 404, body: "{}", url }));
  if (url.includes("/api/tools/toolsets")) return Promise.resolve(TOOLSETS);
  if (url.includes("/api/mcp/servers")) return Promise.resolve(SERVERS);
  return Promise.reject(new ApiError("unknown", { status: 404, body: "{}", url }));
}
function toolsRejects(status: number, message: string) {
  return (url?: string) => {
    if (!url) return Promise.resolve(SERVERS);
    return Promise.reject(new ApiError(message, { status, body: "{}", url }));
  };
}
const PENDING = () => new Promise<never>(() => {});

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="cap8-location">{loc.search}</span>;
}

async function render(entry: string, page: "skills" | "tools") {
  await act(async () => root?.unmount());
  document.body.replaceChildren();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[entry]}>
        <LocationProbe />
        {page === "tools" ? <ToolsPage /> : <SkillsPage />}
      </MemoryRouter>,
    );
  });
  await act(async () => {});
}

/** Fresh module caches so each state is reached by a real read, not a remembered one. */
async function showSkills(entry: string, impl: (url?: string) => unknown) {
  resetSkillsTabState();
  resetCapabilityCounts();
  api.fetchJsonStrict.mockReset();
  api.fetchJsonStrict.mockImplementation(impl);
  await render(entry, "skills");
}
async function showTools(entry: string, impl: (url?: string) => unknown) {
  resetToolsTabState();
  resetCapabilityCounts();
  api.fetchJsonStrict.mockReset();
  api.fetchJsonStrict.mockImplementation(impl);
  await render(entry, "tools");
}

const q = (testid: string) => container.querySelector<HTMLElement>(`[data-testid='${testid}']`);

type Reading = { testid: string; text: string; title: string };
function readAnchor(testid: string): Reading {
  const el = q(testid);
  if (!el) throw new Error(`state anchor ${testid} is not rendered`);
  // Visible means: not hidden by the sr-only utility, and styled as a state sentence.
  expect(`${testid} class ${el.className}`).toContain("capF-state-text");
  expect(`${testid} class ${el.className}`).not.toContain("sr-only");
  const text = el.textContent?.trim() ?? "";
  expect(`${testid} text is empty`).not.toBe("");
  const title = el.getAttribute("title") ?? "";
  expect(`${testid} title ${title}`).toContain("原因：");
  expect(`${testid} title ${title}`).toContain("去处：");
  // No second leaf repeats the sentence: the anchor is the only place it is said.
  const twins = [...container.querySelectorAll<HTMLElement>("*")].filter(
    (el2) => el2 !== el && el2.children.length === 0 && el2.textContent?.trim() === text,
  );
  const where = twins.map((t) => `${t.tagName.toLowerCase()}#${t.getAttribute("data-testid") ?? "-"}[${t.className}]`);
  expect(`${testid} duplicates ${where.join(" | ")}`).toBe(`${testid} duplicates `);
  return { testid, text, title };
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  api.fetchJsonStrict.mockReset();
  clipboard.copyTextToClipboard.mockReset();
  clipboard.copyTextToClipboard.mockResolvedValue(true);
  resetCapabilityCounts();
  resetSkillsTabState();
  resetToolsTabState();
  resetTabView();
  window.history.replaceState({}, "", SKILLS_ENTRY);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
  container.remove();
  vi.useRealTimers();
});

/** Chai has no `startsWith`; compare the prefix by length instead. */
function headOf(text: string, lead: string): string {
  return text.slice(0, lead.length);
}

describe("capF state anchors on skills", () => {
  it("gives every state its own visible sentence, with reason and destination in the title", async () => {
    await showSkills(SKILLS_ENTRY, PENDING);
    const loading = readAnchor("capF-state-loading");
    expect(loading.text).toBe("正在读取技能…");

    await showSkills(SKILLS_ENTRY, skillImpl({ asOf: AS_OF, items: [] }));
    const empty = readAnchor("capF-state-empty");
    expect(headOf(empty.text, "这个读口已接入，但目前没有条目。")).toBe("这个读口已接入，但目前没有条目。");
    expect(q("capF-state-empty-text")?.textContent).toBe(
      "读口已接入，本次返回 0 条；技能没有返回任何条目，这里不补样例行。",
    );

    await showSkills(`${SKILLS_ENTRY}&q=${encodeURIComponent(NO_MATCH)}`, skillImpl({ asOf: AS_OF, items: SKILL_ITEMS }));
    const filtered = readAnchor("capF-state-filter-empty");
    expect(filtered.text).toBe(`当前条件下没有匹配项。已加载的 2 项里没有名称包含「${NO_MATCH}」的条目。`);

    await showSkills(SKILLS_ENTRY, skillRejects(500, "上游网关没有回答"));
    const error = readAnchor("capF-state-error");
    // The upstream copy is redacted by the page's own messageFor(); assert the shape, not its wording.
    expect(error.text).toMatch(/^读取失败：技能列表暂时无法读取。原因：.+（可用下方重试）$/s);
    expect(error.title).toContain("去处：点下方重试");

    await showSkills(SKILLS_ENTRY, skillRejects(404, "这条读口没有接入"));
    const denied = readAnchor("capF-state-unavailable");
    expect(denied.text).toMatch(/^无权读取这条数据。技能读口未接入。原因：.+$/s);
    expect(denied.title).toContain("审批中心");

    const texts = [loading, empty, filtered, error, denied].map((reading) => reading.text);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("keeps the frozen cap4/cap5/cap6/capC/cap-page-scope surfaces out of the anchor sentence", async () => {
    await showSkills(`${SKILLS_ENTRY}&q=${encodeURIComponent(NO_MATCH)}`, skillImpl({ asOf: AS_OF, items: SKILL_ITEMS }));
    const filtered = readAnchor("capF-state-filter-empty");
    expect(q("cap-page-scope")?.textContent).toContain("表内全量渲染，共 0 项");
    expect(q("cap5-scope-note")?.textContent).toContain("仅在当前已加载 2 项内搜索");
    expect((q("cap6-export") as HTMLButtonElement).disabled).toBe(true);
    expect(q("cap6-export")?.getAttribute("title")).toBe("当前没有可导出的条目。");
    expect(q("cap-export-scope-note")?.textContent?.trim()).toBe("本次导出为表内全量，共 0 项");
    expect(filtered.text).not.toContain("0 项");
  });
});

describe("capF state anchors on tools", () => {
  it("gives every state its own visible sentence, including login and the filtered empty", async () => {
    await showTools(`${TOOLS_ENTRY}&state=loading`, PENDING);
    const loading = readAnchor("capF-state-loading");
    expect(loading.text).toBe("正在读取工具与 MCP 清单…");

    await showTools(`${TOOLS_ENTRY}&state=empty`, PENDING);
    const empty = readAnchor("capF-state-empty");
    expect(headOf(empty.text, "这个读口已接入，但目前没有条目。")).toBe("这个读口已接入，但目前没有条目。");
    expect(q("capF-state-empty-text")?.textContent).toBe(
      "读口已接入，本次返回 0 条；工具与 MCP 清单没有返回任何条目，这里不补样例行。",
    );

    await showTools(`${TOOLS_ENTRY}&state=error`, PENDING);
    const error = readAnchor("capF-state-error");
    expect(headOf(error.text, "读取失败：工具与 MCP 清单没能加载出来。原因：")).toBe("读取失败：工具与 MCP 清单没能加载出来。原因：");
    expect(error.text).toContain("（可用下方重试）");

    await showTools(`${TOOLS_ENTRY}&state=denied`, PENDING);
    const denied = readAnchor("capF-state-unavailable");
    expect(headOf(denied.text, "无权读取这条数据。工具读口未接入。原因：")).toBe("无权读取这条数据。工具读口未接入。原因：");
    expect(denied.title).toContain("审批中心");

    await showTools(TOOLS_ENTRY, toolsRejects(401, "会话失效"));
    const login = readAnchor("capF-state-login");
    expect(headOf(login.text, "需要重新登录。")).toBe("需要重新登录。");
    expect(login.title).toContain("去处：刷新页面重新登录");

    await showTools(`${TOOLS_ENTRY}&q=${encodeURIComponent(NO_MATCH)}`, toolsImpl);
    const filtered = readAnchor("capF-state-filter-empty");
    expect(filtered.text).toBe(`当前条件下没有匹配项。已加载的 3 项里没有名称包含「${NO_MATCH}」的条目。`);

    const readings = [loading, empty, error, denied, login, filtered];
    expect(new Set(readings.map((reading) => reading.text)).size).toBe(readings.length);
  });

  it("reads nothing extra while walking the states: the forced fixtures never fetch", async () => {
    for (const state of ["loading", "empty", "error", "denied"]) {
      await showTools(`${TOOLS_ENTRY}&state=${state}`, PENDING);
    }
    expect(api.fetchJsonStrict.mock.calls.length).toBe(0);
  });
});

describe("the anchor wording has exactly one source", () => {
  const skills = readFileSync(`${process.cwd()}/src/modules/skills/SkillsPage.tsx`, "utf8");
  const tools = readFileSync(`${process.cwd()}/src/modules/tools/ToolsPage.tsx`, "utf8");
  const css = readFileSync(`${process.cwd()}/src/modules/capabilities/counts.css`, "utf8");

  it("both pages import the helper and mount it, with no literal capF-state testid left behind", () => {
    for (const [name, source] of [
      ["skills", skills],
      ["tools", tools],
    ] as const) {
      expect(`${name} import ${source.includes('"../capabilities/stateAnchor"')}`).toBe(`${name} import true`);
      expect(source.match(/<CapStateAnchor/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
      expect(/data-testid=["'][^"']*capF-state/.test(source)).toBe(false);
      expect(/sr-only[^>]*capF-state-/.test(source)).toBe(false);
    }
  });

  it("the visible anchor style wraps anywhere so a long upstream sentence cannot widen the 375 column", () => {
    expect(css).toContain(".capF-state-text");
    expect(css).toContain(".capF-state-detail");
    expect(css).toMatch(/\.capF-state-text\s*\{[^}]*overflow-wrap:\s*anywhere/);
    expect(css).toMatch(/\.capF-state-detail\s*\{[^}]*overflow-wrap:\s*anywhere/);
  });
});
