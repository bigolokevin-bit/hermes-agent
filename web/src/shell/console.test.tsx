// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps, ReactElement } from "react";

// Wave-2: T18 shipped the real detail module page, so the bridge existence
// probe (shell/bridge.ts DetailModulePage) resolves and serves the hidetab
// pane. The probe's lazy glob is mocked with a synchronous stub — the same
// probe-consumes-module-page contract is covered without importing the
// 890-line page's API surface into jsdom.
vi.mock("../modules/employee-detail/EmployeeDetailModulePage", () => ({
  default: () => <div data-testid="probe-detail-page" />,
}));

import {
  ConsoleEmployeeDetailPage,
  ConsoleModulePage,
  ConsoleNav,
} from "@/shell/console";
import { CONSOLE_MODULES } from "@/shell/routes";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function renderAt(element: ReactElement, entry: string) {
  act(() => {
    root.render(<MemoryRouter initialEntries={[entry]}>{element}</MemoryRouter>);
  });
}

// Wave-2: the detail probe lazy-loads the (mocked) module page — flush the
// Suspense microtask so the lazy component actually mounts before asserting.
async function renderAtAsync(element: ReactElement, entry: string) {
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[entry]}>{element}</MemoryRouter>);
  });
}

describe("ConsoleNav (two tiers, 8 modules)", () => {
  it("renders exactly 8 module anchors carrying data-mod, under 4 group sections", () => {
    renderAt(<ConsoleNav />, "/overview");
    const anchors = container.querySelectorAll("a[data-mod]");
    const mods = new Set(
      Array.from(anchors).map((a) => a.getAttribute("data-mod")),
    );
    expect(anchors.length).toBe(8);
    expect(mods.size).toBe(8);
    expect(
      container.querySelectorAll('[role="group"][aria-label]').length,
    ).toBe(4);
    // Default module links land on the canonical bare paths.
    expect(anchors[0]?.getAttribute("href")).toBe("/overview");
  });

  it("R29: the sidebar carries a Chinese audit anchor into /audit", () => {
    renderAt(<ConsoleNav />, "/overview");
    const audit = Array.from(container.querySelectorAll("a")).find(
      (a) => a.getAttribute("href") === "/audit",
    );
    expect(audit).toBeTruthy();
    expect(audit?.textContent).toBe("审计");
    // data-mod contract stays exactly the 8 IA modules
    expect(container.querySelectorAll("a[data-mod]").length).toBe(8);
  });
});

describe("ConsoleModulePage pane contract", () => {
  it("default tab: planned pane is honest (data-planned, 规划中, disabled, never blank)", () => {
    renderAt(<ConsoleModulePage module="overview" />, "/overview");
    const pane = container.querySelector(".pane");
    expect(pane?.getAttribute("data-tabname")).toBe("值班台");
    expect(pane?.getAttribute("data-tab")).toBe("duty");
    // R4 item 4: dataSource surfaces human copy; internal GAP ids stay in code comments.
    expect(pane?.getAttribute("data-src")).toContain("聚合接口建设中");
    expect(pane?.getAttribute("data-state")).toBe("empty");
    const planned = pane?.querySelector("[data-planned]");
    expect(planned).toBeTruthy();
    expect(planned?.getAttribute("aria-disabled")).toBe("true");
    expect(pane?.textContent).toContain("规划中");
    // Every console page paints all 8 module sections (data-mod ×2 with nav).
    expect(container.querySelectorAll("section[data-mod]").length).toBe(8);
    expect(
      container.querySelectorAll("section[data-mod='overview']:not([hidden])")
        .length,
    ).toBe(1);
  });

  it("?tab= lands on the requested pane; live node renders with data-state=ready", () => {
    renderAt(
      <ConsoleModulePage
        module="overview"
        live={{ usage: <div data-testid="analytics-stub" /> }}
      />,
      "/overview?tab=usage",
    );
    const pane = container.querySelector(".pane");
    expect(pane?.getAttribute("data-tabname")).toBe("用量与成本");
    expect(pane?.getAttribute("data-state")).toBe("ready");
    expect(pane?.querySelector('[data-testid="analytics-stub"]')).toBeTruthy();
    // Tab strip carries both visible tabs with data-tab.
    expect(container.querySelectorAll('[role="tab"][data-tab]').length).toBe(2);
  });

  it("TAB_ALIAS compat tabs resolve onto the canonical pane", () => {
    // R39 compat: system.security was removed (App mounts SecurityModulePage
    // directly on ?tab=security); retention still aliases to events.
    renderAt(<ConsoleModulePage module="system" />, "/system?tab=retention");
    expect(container.querySelector(".pane")?.getAttribute("data-tabname")).toBe(
      "审计事件",
    );
  });

  it("R32 item 2: /employees carries emp-l-page", () => {
    renderAt(<ConsoleModulePage module="employees" live={{ list: <div data-testid="live-list" /> }} />, "/employees");
    expect(container.querySelector('[data-testid="emp-l-page"]')).toBeTruthy();
  });

  it("R32 item 2: /employees?tab=matrix carries mtx5-page", () => {
    renderAt(
      <ConsoleModulePage module="employees" live={{ matrix: <div data-testid="live-matrix" /> }} />,
      "/employees?tab=matrix",
    );
    expect(container.querySelector('[data-testid="mtx5-page"]')).toBeTruthy();
  });

  it("R32 item 2: /approvals carries apr5-page", () => {
    renderAt(<ConsoleModulePage module="approvals" live={{ pending: <div data-testid="apr-live" /> }} />, "/approvals");
    expect(container.querySelector('[data-testid="apr5-page"]')).toBeTruthy();
  });

  // R5 item 2: /matrix must land on the real matrix page, never a planned
  // placeholder or /system. The live slot is the whole contract.
  it("R5-2 /employees?tab=matrix renders the live matrix module page", () => {
    renderAt(
      <ConsoleModulePage
        module="employees"
        live={{
          list: <div data-testid="live-list" />,
          matrix: <div data-testid="live-matrix" />,
        }}
      />,
      "/employees?tab=matrix",
    );
    const pane = container.querySelector(".pane");
    expect(pane?.getAttribute("data-tab")).toBe("matrix");
    expect(pane?.getAttribute("data-state")).toBe("ready");
    expect(pane?.querySelector('[data-testid="live-matrix"]')).toBeTruthy();
    expect(pane?.querySelector('[data-testid="live-list"]')).toBeFalsy();
    // The tab strip offers the canonical matrix href (and /matrix redirect
    // in App routes lands on exactly this URL).
    const matrixLink = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('[role="tab"] a, a[role="tab"]'),
    ).find((a) => a.getAttribute("href")?.includes("tab=matrix") || a.textContent?.includes("矩阵"));
    expect(matrixLink).toBeTruthy();
  });

  it("roView auditor: system defaults serves whole-pane 403 + request number", () => {
    renderAt(
      <ConsoleModulePage module="system" />,
      "/system?tab=defaults&roview=1",
    );
    const pane = container.querySelector(".pane");
    expect(pane?.getAttribute("data-state")).toBe("denied");
    expect(pane?.textContent).toContain("403");
    // R4 item 5: no fabricated req_ ids — honest no-trace copy instead.
    expect(pane?.textContent).toContain("本次请求未记录编号");
    expect(pane?.textContent).toContain("只读审计员视角");
  });

  it("?state= forces the four honest states over any pane", () => {
    for (const state of ["loading", "empty", "error", "denied"] as const) {
      renderAt(
        <ConsoleModulePage module="knowledge" />,
        `/knowledge?state=${state}`,
      );
      const pane = container.querySelector(".pane");
      expect(pane?.getAttribute("data-state")).toBe(state);
      expect(pane?.textContent).toContain("强制态");
      act(() => root.unmount());
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
    }
  });

  it("?state= keeps rid on screen with a copy control", () => {
    renderAt(
      <ConsoleModulePage module="employees" live={{ list: <div data-testid="live-list" /> }} />,
      "/employees?state=error&rid=abc12345",
    );
    const pane = container.querySelector(".pane");
    expect(pane?.getAttribute("data-state")).toBe("error");
    expect(pane?.textContent).toContain("请求编号");
    expect(pane?.textContent).toContain("abc12345");
    expect(pane?.querySelector("[data-testid='state-rid']")?.textContent).toBe("abc12345");
    expect(pane?.querySelector("[data-testid='state-rid-copy']")).not.toBeNull();
    expect(pane?.querySelector("[data-testid='state-rid-fallback']")).toBeNull();
    expect(pane?.querySelector("[data-testid='state-retry']")).not.toBeNull();
    expect(pane?.querySelector("[data-testid='state-back']")).not.toBeNull();
  });

  it("?state= tab switches preserve rid and state", () => {
    renderAt(<ConsoleModulePage module="knowledge" />, "/knowledge?state=error&rid=abc12345");
    const tab = container.querySelector("[role='tab']");
    expect(tab).not.toBeNull();
    expect(tab?.getAttribute("href")).toContain("state=error");
    expect(tab?.getAttribute("href")).toContain("rid=abc12345");
  });

  // T42 item 2: the forced-state legs must be reproducible on ALL eight
  // console tabs, and item 1's honest exits (retry + back, or back alone)
  // must be present in every forced pane.
  it("?state= is reproducible on all 8 console modules with honest exits", () => {
    for (const { module } of CONSOLE_MODULES) {
      renderAt(<ConsoleModulePage module={module} />, `/${module}?state=error`);
      const pane = container.querySelector(".pane");
      expect(pane?.getAttribute("data-state")).toBe("error");
      expect(pane?.querySelector("[data-testid='state-retry']")).not.toBeNull();
      expect(pane?.querySelector("[data-testid='state-back']")).not.toBeNull();
      // no fabricated trace ids in forced legs — honest no-trace copy instead
      expect(pane?.textContent).toContain("本次请求未记录编号");
      act(() => root.unmount());
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
    }
    // loading/empty legs carry the back exit but never a fake retry
    renderAt(<ConsoleModulePage module="overview" />, "/overview?state=loading");
    let pane = container.querySelector(".pane");
    expect(pane?.getAttribute("data-state")).toBe("loading");
    expect(pane?.querySelector("[data-testid='state-back']")).not.toBeNull();
    expect(pane?.querySelector("[data-testid='state-retry']")).toBeNull();
    act(() => root.unmount());
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    renderAt(<ConsoleModulePage module="work" />, "/work?state=denied");
    pane = container.querySelector(".pane");
    expect(pane?.getAttribute("data-state")).toBe("denied");
    expect(pane?.querySelector("[data-testid='state-retry']")).not.toBeNull();
  });
});

describe("ConsoleEmployeeDetailPage (hidden 23rd pane)", () => {
  const detailRoute = (
    props: ComponentProps<typeof ConsoleEmployeeDetailPage>,
  ) => (
    <Routes>
      <Route
        path="/employees/:employeeId"
        element={<ConsoleEmployeeDetailPage {...props} />}
      />
    </Routes>
  );

  it("bare detail: the probe's module page serves the hidetab pane (T18 landed; fallback shadowed)", async () => {
    await renderAtAsync(
      detailRoute({ fallback: <div data-testid="existing-detail" /> }),
      "/employees/emp_9f3a4b7c",
    );
    const pane = container.querySelector(".pane");
    expect(pane?.getAttribute("data-tabname")).toBe("详情");
    expect(pane?.getAttribute("data-hidetab")).toBe("1");
    expect(pane?.getAttribute("data-state")).toBe("ready");
    // Probe hit → module page wins over the legacy fallback (stage-2 brief 5
    // fallback stays for trees without the page, see console.tsx L464-475).
    expect(
      container.querySelector('[data-testid="probe-detail-page"]'),
    ).toBeTruthy();
    expect(container.querySelector('[data-testid="existing-detail"]')).toBeFalsy();
    expect(container.querySelectorAll('[role="tab"][data-zone]').length).toBe(5);
  });

  it("?zone=workbench: probe page owns the workbench surface (60/40 + chat host moved into T18's page in wave 2)", async () => {
    // The real App wrapper carries the host attribute; the stub uses a
    // testid so this shell/ file stays marker-free for the assert-ia scan.
    const renderChatHost = (employeeId: string) => (
      <div data-testid="chat-host-slot" data-profile={employeeId}>
        chat-host-stub
      </div>
    );
    await renderAtAsync(
      detailRoute({
        fallback: <div data-testid="existing-detail" />,
        renderChatHost,
      }),
      "/employees/emp_9f3a4b7c?zone=workbench",
    );
    // Probe resolves for every zone query (T18 header note), so the shell's
    // legacy EmployeeDetailWorkbench + App-injected chat-host slot are NOT
    // mounted here anymore; the module page carries the single
    // [data-chat-host] itself (T40 moved the marker into ChatModulePage;
    // assert-ia counts exactly one static host). The hidden-详情 pane and
    // zone strip are still shell-owned and must hold:
    expect(
      container.querySelector('[data-testid="probe-detail-page"]'),
    ).toBeTruthy();
    expect(container.querySelectorAll('[data-testid="chat-host-slot"]').length).toBe(0);
    const pane = container.querySelector(".pane");
    expect(pane?.getAttribute("data-tabname")).toBe("详情");
    expect(container.querySelectorAll('[role="tab"][data-zone]').length).toBe(5);
  });
});
