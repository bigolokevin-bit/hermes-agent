// @vitest-environment jsdom
// R170 — the shape the audit filters really have, now that wave-36 replaced the
// native select controls.
//
// Why this file exists: R166 found guards reading `element.value` off a control
// whose test id now sits on ConsoleSelect's trigger BUTTON. A button's `value`
// is always the empty string, so those assertions were passing while testing
// nothing at all — or failing with `expected '' to be 'task.created'`. No type
// annotation can catch that; only a guard that names the shape can. Three
// claims, in the order a person meets them: what the control IS, that its value
// is the same string the address and the request carry, and that it stays that
// way when the question changes.
//
// Nothing here asks the service for more than a page of rows, and nothing here
// touches the shell: the harness in `@/shell/selectHarness` is the sanctioned way
// to read and drive these controls, and the runs lane already uses it.

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { optionTexts, selectExpanded, selectText, selectValue } from "@/shell/selectHarness";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ACTOR = "user:2f3a4b5c6d7e8f90";
const RESOURCE = "ap_1122334455667788";
const ACTION = "task.created";
const LIMIT = "25";

/** The four filter addresses a reader drives the audit list through. */
const CONTROLS = {
  type: "aud01-filter-type",
  operator: "aud01-filter-operator",
  resource: "aud8-filter-resource",
  size: "audH-page-size",
} as const;

// A stated interval, not a quick window: a quick window computes its bounds from
// the clock at ask time, so only a written pair is byte-replayable.
const SEVEN =
  `?window=custom&from=2026-11-05T02:00:00Z&to=2026-11-07T02:00:00Z` +
  `&type=${ACTION}&actor=${encodeURIComponent(ACTOR)}&resource=${RESOURCE}&limit=${LIMIT}`;

let root: Root | null = null;

async function waitFor(cond: () => boolean, label = "condition"): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

/** Where the page put the address, so the value can be compared pair for pair. */
function LocationProbe(): ReactNode {
  const location = useLocation();
  return <span data-testid="probe-location">{`${location.pathname}${location.search}`}</span>;
}

async function render(entry: string): Promise<void> {
  await act(async () => {
    if (root) act(() => root?.unmount());
  });
  root = null;
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[entry]}>
        <AuditEventsModulePage />
        <LocationProbe />
      </MemoryRouter>,
    );
  });
  await waitFor(() => !document.querySelector(".animate-pulse"), "skeleton gone");
}

const node = (testId: string): Element | null =>
  document.querySelector(`[data-testid='${testId}']`);

async function click(testId: string): Promise<void> {
  await act(async () => {
    (node(testId) as HTMLElement | null)?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number => urls().filter((url) => url.startsWith("/agent-api/api/audit?")).length;
const lastListRead = (): string =>
  [...urls()].reverse().find((url) => url.startsWith("/agent-api/api/audit?")) ?? "";
const paramOf = (url: string, key: string): string | null =>
  new URL(url, "http://console.test").searchParams.get(key);
const address = (): string => node("probe-location")?.textContent ?? "";

interface PageBody {
  items: Record<string, unknown>[];
  nextCursor?: string | null;
}

function rowOf(index: string): Record<string, unknown> {
  return {
    eventId: `evt_cs_${index}`,
    action: ACTION,
    occurredAt: "2026-11-06T03:00:00Z",
    outcome: "succeeded",
    actor: { type: "human", id: ACTOR, displayName: "李思" },
    resource: { type: "approval", id: RESOURCE },
    requestId: `req-cs-${index}`,
  };
}

const PAGE1: PageBody = { items: [rowOf("p1"), rowOf("p2")], nextCursor: "cur_page2" };
const PAGE2: PageBody = { items: [rowOf("p3")], nextCursor: null };

function answerPaged(): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) return { audit: PAGE1.items[0] };
    return paramOf(target, "cursor") === "cur_page2" ? PAGE2 : PAGE1;
  });
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  answerPaged();
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R170 - what the filter controls are now made of", () => {
  it("puts every filter test id on a focusable combobox, and on no native select control", async () => {
    await render(`/audit${SEVEN}`);
    // No native select is left to read: a guard that asks for `.value` on these
    // ids is asking a button for something only a form field has.
    expect(document.querySelectorAll("select")).toHaveLength(0);
    for (const testId of Object.values(CONTROLS)) {
      const control = node(testId);
      expect(control, testId).not.toBeNull();
      expect(control?.tagName, `${testId} is not a button`).toBe("BUTTON");
      expect(control?.getAttribute("role"), `${testId} lost its combobox role`).toBe("combobox");
      expect(control instanceof HTMLButtonElement, `${testId} is not a real button`).toBe(true);
      // Tab reaches it, because a filter a keyboard person cannot reach is not a filter.
      expect((control as HTMLButtonElement).tabIndex).toBeGreaterThanOrEqual(0);
    }
  });

  it("opens from the keyboard, because a closed picker tells nobody what it holds", async () => {
    await render(`/audit${SEVEN}`);
    const trigger = node(CONTROLS.type);
    expect(trigger?.getAttribute("aria-haspopup")).toBe("listbox");
    expect(selectExpanded(CONTROLS.type)).toBe(false);
    // The trigger answers ArrowDown/ArrowUp itself (ConsoleSelect.tsx:172-175).
    // Enter and Space are deliberately NOT handled there: they activate the
    // button, and the button's own onClick opens the panel — a path jsdom does
    // not synthesize, so the click is dispatched here as the browser would send
    // it after Enter.
    await act(async () => {
      trigger?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }),
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(selectExpanded(CONTROLS.type), "ArrowDown did not open the picker").toBe(true);
    expect(optionTexts().length).toBeGreaterThan(0);

    await act(async () => {
      trigger?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(selectExpanded(CONTROLS.type), "the button's own activation did not close it").toBe(false);

    await act(async () => {
      trigger?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(selectExpanded(CONTROLS.type)).toBe(true);
    await act(async () => {
      trigger?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(selectExpanded(CONTROLS.type), "Escape left the panel over the next thing").toBe(false);
  });
});

describe("R170 - the value the control holds is the value that travels", () => {
  it("reads byte-equal to the address and to the request, for all four answers", async () => {
    await render(`/audit${SEVEN}`);
    expect(
      {
        action: selectValue(CONTROLS.type),
        actorId: selectValue(CONTROLS.operator),
        resourceId: selectValue(CONTROLS.resource),
        limit: selectValue(CONTROLS.size),
      },
      "the pickers disagree with the address",
    ).toEqual({ action: ACTION, actorId: ACTOR, resourceId: RESOURCE, limit: LIMIT });

    const read = lastListRead();
    expect(paramOf(read, "action")).toBe(selectValue(CONTROLS.type));
    expect(paramOf(read, "actorId")).toBe(selectValue(CONTROLS.operator));
    expect(paramOf(read, "resourceId")).toBe(selectValue(CONTROLS.resource));
    expect(paramOf(read, "limit")).toBe(selectValue(CONTROLS.size));
    // and the address itself carries the same four answers, pair for pair
    expect(address()).toContain(`type=${ACTION}`);
    expect(address()).toContain(`actor=${encodeURIComponent(ACTOR)}`);
    expect(address()).toContain(`resource=${RESOURCE}`);
    expect(address()).toContain(`limit=${LIMIT}`);
    // the face shows a person's words, not the machine value
    expect(selectText(CONTROLS.type)).toContain("创建任务");
  });
});

describe("R170 - the values survive the questions", () => {
  it("keeps all four controls and all four request params after a new window and a new page", async () => {
    await render(`/audit${SEVEN}`);
    const before = {
      type: selectValue(CONTROLS.type),
      operator: selectValue(CONTROLS.operator),
      resource: selectValue(CONTROLS.resource),
      size: selectValue(CONTROLS.size),
    };
    expect(listReads()).toBe(1);

    await click("aud01-filter-window-30d");
    await waitFor(() => listReads() === 2, "the new window was asked for");
    const afterWindow = lastListRead();
    expect(paramOf(afterWindow, "action")).toBe(before.type);
    expect(paramOf(afterWindow, "actorId")).toBe(before.operator);
    expect(paramOf(afterWindow, "resourceId")).toBe(before.resource);
    expect(paramOf(afterWindow, "limit")).toBe(before.size);
    expect(
      {
        type: selectValue(CONTROLS.type),
        operator: selectValue(CONTROLS.operator),
        resource: selectValue(CONTROLS.resource),
        size: selectValue(CONTROLS.size),
      },
      "changing the window moved an answer nobody touched",
    ).toEqual(before);

    await click("aud01-load-more");
    await waitFor(() => listReads() === 3, "page two was asked for");
    const afterPage = lastListRead();
    expect(paramOf(afterPage, "cursor")).toBe("cur_page2");
    expect(paramOf(afterPage, "action")).toBe(before.type);
    expect(paramOf(afterPage, "actorId")).toBe(before.operator);
    expect(paramOf(afterPage, "resourceId")).toBe(before.resource);
    expect(paramOf(afterPage, "limit")).toBe(before.size);
    expect(selectValue(CONTROLS.type)).toBe(before.type);
    expect(selectValue(CONTROLS.operator)).toBe(before.operator);
    expect(selectValue(CONTROLS.resource)).toBe(before.resource);
    expect(selectValue(CONTROLS.size)).toBe(before.size);
  });
});
