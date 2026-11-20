// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  captureTabView,
  findScrollHost,
  focusTabButton,
  noteTabMount,
  readTabView,
  rememberTabView,
  resetTabView,
  restoreTabView,
} from "./tabView";

function size(element: HTMLElement, clientHeight: number, scrollHeight: number): void {
  Object.defineProperty(element, "clientHeight", { configurable: true, value: clientHeight });
  Object.defineProperty(element, "scrollHeight", { configurable: true, value: scrollHeight });
}

function rect(element: HTMLElement, top: number, bottom: number): void {
  element.getBoundingClientRect = () => ({
    x: 0,
    y: top,
    top,
    bottom,
    left: 0,
    right: 200,
    width: 200,
    height: bottom - top,
    toJSON: () => ({}),
  });
}

describe("capability tab view memory", () => {
  beforeEach(() => {
    resetTabView();
    document.body.replaceChildren();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("only reports a real tab switch, not the first mount or the same tab", () => {
    expect(noteTabMount("skills")).toBe(false);
    expect(noteTabMount("skills")).toBe(false);
    expect(noteTabMount("tools")).toBe(true);
    expect(noteTabMount("tools")).toBe(false);
    expect(noteTabMount("skills")).toBe(true);
    rememberTabView("skills", { top: 12, firstRow: "row-1" });
    expect(readTabView("skills")).toEqual({ top: 12, firstRow: "row-1" });
    resetTabView();
    expect(readTabView("skills")).toBeNull();
  });

  it("finds the pane scroller, captures the first visible row and restores its top", () => {
    const host = document.createElement("div");
    host.style.overflowY = "auto";
    size(host, 100, 400);
    rect(host, 0, 100);
    const root = document.createElement("div");
    const first = document.createElement("div");
    first.dataset.testid = "row-1";
    rect(first, 10, 30);
    const second = document.createElement("div");
    second.dataset.testid = "row-2";
    rect(second, 210, 230);
    root.append(first, second);
    host.append(root);
    document.body.append(host);
    host.scrollTop = 120;

    expect(findScrollHost(root)).toBe(host);
    expect(captureTabView("tools", root, "[data-testid^='row-']")).toEqual({
      top: 120,
      firstRow: "row-1",
    });

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    rememberTabView("tools", { top: 42, firstRow: "row-2" });
    host.scrollTop = 0;
    expect(restoreTabView("tools", root)).toEqual({ top: 42, firstRow: "row-2" });
    expect(host.scrollTop).toBe(42);
  });

  it("focuses the tab button without scrolling", () => {
    const button = document.createElement("button");
    button.setAttribute("role", "tab");
    button.dataset.tab = "skills";
    document.body.append(button);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    focusTabButton("skills");
    expect(document.activeElement).toBe(button);
  });

  it("ships a pane scroll host rule for the capabilities module", () => {
    const css = readFileSync(`${process.cwd()}/src/modules/capabilities/counts.css`, "utf8");
    expect(css).toContain(".capH-scroll");
    expect(css).toContain(".pane:has(> .capH-scroll)");
    expect(css).toContain("overflow-y: auto");
  });
});