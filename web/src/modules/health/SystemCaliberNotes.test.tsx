// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CALIBER_MISSING_POLICY, SystemCaliberNotes } from "./SystemCaliberNotes";

function render() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<SystemCaliberNotes />));
  return container;
}

describe("SystemCaliberNotes", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("stays collapsed by default and does not render the body", () => {
    const container = render();
    const toggle = container.querySelector<HTMLButtonElement>("[data-testid='sys-notes-toggle']")!;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe("sys-notes-body");
    expect(container.querySelector("[data-testid='sys-notes-body']")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("expands to six caliber rows with the exact missing-value policy and no request", () => {
    const container = render();
    const toggle = container.querySelector<HTMLButtonElement>("[data-testid='sys-notes-toggle']")!;
    act(() => toggle.click());
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector("[data-testid='sys-notes-body']")).toBeTruthy();
    const rows = [...container.querySelectorAll("li[data-testid^='sys-note-']")];
    expect(rows).toHaveLength(6);
    for (const key of ["health", "console", "runtime", "domain", "version-health", "version-pricing"]) {
      const row = container.querySelector(`[data-testid='sys-note-${key}']`)!;
      expect(row.textContent).toContain(CALIBER_MISSING_POLICY);
      expect(row.textContent).toContain("缺值显示—，不当 0");
      expect(row.textContent).toContain("采集时刻只取上游顶层 ISO，缺失显示—，不拿本机时间顶替");
    }
    expect(container.textContent).toContain("服务列表回答“服务健康状态”，读源矩阵回答“本页各读口是否可达”");
    expect(fetch).not.toHaveBeenCalled();
  });
});
