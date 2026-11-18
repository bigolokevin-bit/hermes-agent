// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps, ReactElement } from "react";

import {
  ConsoleEmployeeDetailPage,
  ConsoleModulePage,
  ConsoleNav,
} from "@/shell/console";

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
});

describe("ConsoleModulePage pane contract", () => {
  it("default tab: planned pane is honest (data-planned, 规划中, disabled, never blank)", () => {
    renderAt(<ConsoleModulePage module="overview" />, "/overview");
    const pane = container.querySelector(".pane");
    expect(pane?.getAttribute("data-tabname")).toBe("值班台");
    expect(pane?.getAttribute("data-tab")).toBe("duty");
    expect(pane?.getAttribute("data-src")).toContain("GAP-01");
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
    renderAt(<ConsoleModulePage module="system" />, "/system?tab=security");
    expect(container.querySelector(".pane")?.getAttribute("data-tabname")).toBe(
      "审计事件",
    );
  });

  it("roView auditor: system defaults serves whole-pane 403 + request number", () => {
    renderAt(
      <ConsoleModulePage module="system" />,
      "/system?tab=defaults&roview=1",
    );
    const pane = container.querySelector(".pane");
    expect(pane?.getAttribute("data-state")).toBe("denied");
    expect(pane?.textContent).toContain("403");
    expect(pane?.textContent).toMatch(/req_[0-9a-f]{8}/);
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

  it("bare detail keeps the fallback surface inside the hidetab pane", () => {
    renderAt(
      detailRoute({ fallback: <div data-testid="existing-detail" /> }),
      "/employees/emp_9f3a4b7c",
    );
    const pane = container.querySelector(".pane");
    expect(pane?.getAttribute("data-tabname")).toBe("详情");
    expect(pane?.getAttribute("data-hidetab")).toBe("1");
    expect(pane?.getAttribute("data-state")).toBe("ready");
    expect(pane?.querySelector('[data-testid="existing-detail"]')).toBeTruthy();
    expect(container.querySelectorAll('[role="tab"][data-zone]').length).toBe(5);
  });

  it("?zone=workbench renders the 60/40 workbench through the App chat-host slot (injected as-is, exactly once)", () => {
    // The real App wrapper carries the host attribute; the stub uses a
    // testid so this shell/ file stays marker-free for the assert-ia scan.
    const renderChatHost = (employeeId: string) => (
      <div data-testid="chat-host-slot" data-profile={employeeId}>
        chat-host-stub
      </div>
    );
    renderAt(
      detailRoute({
        fallback: <div data-testid="existing-detail" />,
        renderChatHost,
      }),
      "/employees/emp_9f3a4b7c?zone=workbench",
    );
    expect(container.querySelector('[data-testid="existing-detail"]')).toBeFalsy();
    const slots = container.querySelectorAll('[data-testid="chat-host-slot"]');
    expect(slots.length).toBe(1);
    expect(slots[0]?.getAttribute("data-profile")).toBe("emp_9f3a4b7c");
    // wbrail four groups, id/budget expanded by default.
    const toggles = container.querySelectorAll("button[aria-expanded]");
    expect(toggles.length).toBe(4);
    expect(
      Array.from(toggles).filter(
        (b) => b.getAttribute("aria-expanded") === "true",
      ).length,
    ).toBe(2);
  });
});
