// @vitest-environment jsdom
// Regression guard for the single top-level asOf presentation used by the
// version surface (ver5), system health (sys3/sys6/sys8) and capability row
// detail (cap7). This file adds tests only; product behaviour is unchanged.
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ui = vi.hoisted(() => ({
  Badge: ({ children }: { children: React.ReactNode }) =>
    createElement("span", null, children),
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
    createElement("button", props, children),
  Card: ({ children }: { children: React.ReactNode }) =>
    createElement("div", null, children),
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
    createElement("div", props, children),
}));
vi.mock("@nous-research/ui", () => ui);

const api = vi.hoisted(() => ({ fetchJSON: vi.fn(), fetchJsonStrict: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: (...args: unknown[]) => api.fetchJSON(...args) }));
vi.mock("../models/fetchJson", () => ({ fetchJsonStrict: (...args: unknown[]) => api.fetchJsonStrict(...args) }));

import { CapabilityRowDetail } from "../capabilities/rowDetail";
import { HealthPage } from "./HealthPage";
import { resetSourceMatrix, topLevelIsoAsOf } from "./sourceReads";
import { SystemHealthSurface } from "./SystemHealthSurface";
import {
  ASOF_KEYS,
  ASOF_MISSING_TITLE,
  readSystemHealth,
  readTopAsOf,
} from "./systemHealth";
import { readHealth } from "../version/versionHealth";
import { VersionHealthSurface } from "../version/VersionHealthSurface";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FUTURE = "2031-03-04T00:00:00Z";
const FUTURE_BJT = "2031-03-04 08:00";
const SOURCE = "bff-read-time";

let root: Root | null = null;
let container: HTMLDivElement;

function html(): HTMLElement {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  return container;
}

async function render(node: React.ReactNode): Promise<HTMLElement> {
  await act(async () => {
    root?.unmount();
  });
  document.body.replaceChildren();
  const host = html();
  await act(async () => {
    root?.render(node);
  });
  return host;
}

async function waitFor(cond: () => boolean, label = "condition"): Promise<void> {
  const started = Date.now();
  while (!cond()) {
    if (Date.now() - started > 2500) throw new Error(`waitFor: ${label}`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

const q = (id: string) => container.querySelector<HTMLElement>(`[data-testid='${id}']`);

function healthPayload(value: unknown = FUTURE, source: string | null = SOURCE) {
  return {
    ok: true,
    asOf: value,
    ...(source ? { asOfSource: source } : {}),
    sources: [
      { id: "console", name: "控制台服务(BFF)", state: "ok", version: "4.2.1" },
    ],
  };
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  api.fetchJsonStrict.mockReset();
  resetSourceMatrix();
  window.history.replaceState({}, "", "/system?tab=health");
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
  window.history.replaceState({}, "", "/");
  vi.useRealTimers();
});

describe("asOf presentation guard", () => {
  it("maps all six top-level aliases to the same Beijing minute and title across surfaces", () => {
    for (const key of ASOF_KEYS) {
      const payload = { [key]: FUTURE, asOfSource: SOURCE, sources: [] };
      const stamp = readTopAsOf(payload);
      const health = readHealth(payload);
      const system = readSystemHealth(payload);
      const matrix = topLevelIsoAsOf(payload);

      expect(stamp.shown, key).toBe(FUTURE_BJT);
      expect(stamp.raw, key).toBe(FUTURE);
      expect(stamp.title, key).toBe(`UTC 原文：${FUTURE} · 北京时间：${FUTURE_BJT} · 来源：${SOURCE}`);
      expect(health?.asOf, key).toBe(stamp.shown);
      expect(health?.asOfTitle, key).toBe(stamp.title);
      expect(system?.asOf, key).toBe(stamp.shown);
      expect(system?.asOfTitle, key).toBe(stamp.title);
      expect(matrix.asOf, key).toBe(stamp.shown);
      expect(matrix.asOfTitle, key).toBe(stamp.title);
      expect(matrix.asOfReason, key).toBeNull();
    }
  });

  it("turns empty, impossible and timezone-less values into a dash with the exact missing title, never a clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2031-06-06T00:00:00Z"));

    for (const payload of [
      {},
      { asOf: "" },
      { asOf: "2026-13-40" },
      { asOf: "2026-03-04" },
    ]) {
      const stamp = readTopAsOf(payload);
      const health = readHealth(payload);
      const system = readSystemHealth({ ...payload, sources: [] });
      const matrix = topLevelIsoAsOf(payload);

      expect(stamp.shown).toBeNull();
      expect(stamp.raw).toBeNull();
      expect(stamp.reason).toBe(ASOF_MISSING_TITLE);
      expect(stamp.title).toBe(ASOF_MISSING_TITLE);
      expect(stamp.title).not.toContain("2031");
      expect(health?.asOf).toBeNull();
      expect(health?.asOfReason).toBe(ASOF_MISSING_TITLE);
      expect(system?.asOf).toBeNull();
      expect(system?.asOfTitle).toBe(ASOF_MISSING_TITLE);
      expect(matrix.asOf).toBeNull();
      expect(matrix.asOfTitle).toBe(ASOF_MISSING_TITLE);
    }
  });

  it("shows a future source time as the real value and does not substitute the injected local clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2031-06-06T00:00:00Z"));

    const payload = { asOf: FUTURE, asOfSource: SOURCE, sources: [{ id: "console", name: "控制台服务", state: "ok" }] };
    const stamp = readTopAsOf(payload);
    const health = readHealth(payload);
    const system = readSystemHealth(payload);

    expect(stamp.shown).toBe(FUTURE_BJT);
    expect(stamp.title).toContain(FUTURE);
    expect(stamp.title).not.toContain("2031-06-06");
    expect(health?.asOf).toBe(FUTURE_BJT);
    expect(system?.asOf).toBe(FUTURE_BJT);
    expect(system?.rows[0].checkedAt).toBe(FUTURE_BJT);
  });

  it("renders ver5, sys3, sys6/sys8 and cap7 from the same helper and keeps asOfSource in the title only", async () => {
    vi.useRealTimers();
    const payload = healthPayload();

    // ver5: health rows win, so the version endpoint is not called.
    api.fetchJsonStrict.mockResolvedValue(payload);
    await render(createElement(VersionHealthSurface));
    await waitFor(() => Boolean(q("ver5-health-asof")), "ver5 asOf");
    const ver5 = q("ver5-health-asof")!;
    expect(ver5.textContent).toContain(FUTURE_BJT);
    expect(ver5.getAttribute("title")).toContain(`UTC 原文：${FUTURE}`);
    expect(ver5.getAttribute("title")).toContain(`来源：${SOURCE}`);
    expect(document.body.textContent).not.toContain(SOURCE);
    expect(api.fetchJsonStrict).toHaveBeenCalledTimes(1);

    // sys3: the same payload and helper.
    api.fetchJSON.mockResolvedValue(payload);
    await render(createElement(SystemHealthSurface));
    await waitFor(() => Boolean(q("sys3-asof")), "sys3 asOf");
    const sys3 = q("sys3-asof")!;
    expect(sys3.textContent).toBe(FUTURE_BJT);
    expect(sys3.getAttribute("title")).toContain(FUTURE);
    expect(document.body.textContent).not.toContain(SOURCE);
    expect(api.fetchJSON).toHaveBeenCalledTimes(1);

    // sys6/sys8: HealthPage's health row and the matrix health row share it.
    resetSourceMatrix();
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation((url: string) =>
      url === "/agent-api/api/health"
        ? Promise.resolve(payload)
        : Promise.resolve({ ok: true, asOf: FUTURE, sources: [] }),
    );
    await render(createElement(HealthPage));
    await waitFor(() => Boolean(q("sys8-asof-health")), "sys8 asOf");
    const sys8 = q("sys8-asof-health")!;
    const sys6 = q("sys6-asof-health")!;
    expect(sys8.textContent).toBe(FUTURE_BJT);
    expect(sys8.getAttribute("title")).toContain(`UTC 原文：${FUTURE}`);
    expect(sys6.getAttribute("title")).toContain(`UTC 原文：${FUTURE}`);
    expect(document.body.textContent).not.toContain(SOURCE);
    expect(api.fetchJSON).toHaveBeenCalledTimes(4);

    // cap7: the pure row-detail carrier shows the same value and title.
    const stamp = readTopAsOf(payload);
    await render(
      createElement(CapabilityRowDetail, {
        name: "资料整理",
        type: "平台内置",
        enabled: "正常",
        updatedAt: null,
        endpoint: "/agent-api/api/skills",
        asOf: stamp.shown,
        asOfReason: "",
        asOfTitle: stamp.title,
        testid: "cap7-detail-asof-guard",
      }),
    );
    const cap7 = q("cap7-detail-asof")!;
    expect(cap7.textContent).toBe(FUTURE_BJT);
    expect(cap7.getAttribute("title")).toContain(`UTC 原文：${FUTURE}`);
    expect(cap7.getAttribute("title")).toContain(`来源：${SOURCE}`);
    expect(document.body.textContent).not.toContain(SOURCE);
  });

  it("keeps the missing dash visible in the cap7 carrier without leaking the source", async () => {
    const stamp = readTopAsOf({});
    await render(
      createElement(CapabilityRowDetail, {
        name: "资料整理",
        type: "平台内置",
        enabled: "正常",
        updatedAt: null,
        endpoint: "/agent-api/api/skills",
        asOf: stamp.shown,
        asOfReason: "",
        asOfTitle: stamp.title,
        testid: "cap7-detail-asof-guard",
      }),
    );
    const cap7 = q("cap7-detail-asof")!;
    expect(cap7.textContent).toBe("—");
    expect(cap7.getAttribute("title")).toBe(ASOF_MISSING_TITLE);
    expect(document.body.textContent).not.toContain(SOURCE);
  });
});