// @vitest-environment jsdom
// audW — 「打开资源」 goes to a page that exists. Two faces (the inline preview
// `aud6-preview` and the record pane `aud3`) ask one table one question, so the
// href cannot be two different promises about the same resource; a resource type
// with no page in this console is SAID, not linked; an absent id is the module's
// one missing word. Nothing here is worth a request: a link is rendered off what
// is already on the screen, and clicking it fetches nothing.

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import {
  AUDIT_RESOURCE_LINK_LABEL,
  AUDIT_RESOURCE_NO_LINK_TEXT,
  RESOURCE_LINK_TYPES,
  resourceLinkOf,
} from "@/modules/audit/resourceLinks";
import { AUDJ_TIME_MISSING } from "@/modules/audit/timeActor";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The href only exists when the table decided there is a page; tests read it here. */
function hrefOf(resource: { type: string | null; id: string | null }): string | null {
  const link = resourceLinkOf(resource);
  return link.kind === "link" ? link.href : null;
}

describe("audW - one table, the hrefs it promises", () => {
  it("offers exactly the four resource types this console can open", () => {
    // The table is the single source: these keys, and nothing else, get a link.
    expect(RESOURCE_LINK_TYPES.slice().sort()).toEqual(
      ["approval", "knowledge", "knowledge_source", "run", "task"].sort(),
    );
  });

  it("names the landing page and the parameter the page itself reads", () => {
    expect(resourceLinkOf({ type: "approval", id: "ap_1122334455667788" })).toMatchObject({
      kind: "link",
      href: "/approvals?tab=history&status=all&id=ap_1122334455667788",
      label: AUDIT_RESOURCE_LINK_LABEL,
    });
    expect(hrefOf({ type: "run", id: "run_01M7VXG3" })).toBe("/runs?run=run_01M7VXG3");
    expect(hrefOf({ type: "task", id: "tsk_9F8E7D6C" })).toBe("/work?tab=board&task=tsk_9F8E7D6C");
  });

  it("knowledge needs no identifier, because its page takes none", () => {
    for (const type of ["knowledge", "knowledge_source"]) {
      expect(hrefOf({ type, id: "ks_112233" })).toBe("/knowledge");
    }
    // and still a link when the ledger sent no id at all
    expect(hrefOf({ type: "knowledge", id: null })).toBe("/knowledge");
  });

  it("encodes an id that would otherwise become someone else's query", () => {
    expect(hrefOf({ type: "task", id: "a b&c" })).toBe("/work?tab=board&task=a%20b%26c");
  });

  it("a type with no page says so, in words and in the reason", () => {
    for (const type of ["channel_event", "policy_decision", "employee", "webhook", null]) {
      const link = resourceLinkOf({ type, id: "x_1" });
      expect(link.kind).toBe("no-link");
      expect(link.title).toContain("没有对应页面");
    }
    expect(AUDIT_RESOURCE_NO_LINK_TEXT).toBe("该资源类型暂无页面");
  });

  it("a page that exists without an id is the module's one missing word", () => {
    const link = resourceLinkOf({ type: "approval", id: null });
    expect(link.kind).toBe("missing");
    // never a second spelling of absence — audV pinned this equality already
    expect(AUDJ_TIME_MISSING).toBe("该字段未返回");
    expect(link.title).toContain("审批");
  });
});

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

async function render(entry: string): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[entry]}>
        <AuditEventsModulePage />
      </MemoryRouter>,
    );
  });
}

beforeEach(() => {
  api.fetchJSON.mockReset();
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number => urls().filter((url) => /^\/agent-api\/api\/audit\?/.test(url)).length;
const detailReads = (): number => urls().filter((url) => url.startsWith("/agent-api/api/audit-detail")).length;

const ID = "evt_present_00000001";

/** The event, with the resource the ledger really sends: a typed, id-bearing object. */
const APPROVAL_EVENT = {
  eventId: ID,
  action: "task.created",
  occurredAt: "2026-11-19T01:20:00Z",
  recordedAt: "2026-11-19T01:20:01Z",
  outcome: "succeeded",
  actor: { type: "human", id: "user:2f3a4b5c6d7e8f90", displayName: "李思" },
  resource: { type: "approval", id: "ap_1122334455667788" },
  requestId: "req-20261119-0a7b3c",
};

function answer(body: unknown): void {
  api.fetchJSON.mockImplementation(async (url) =>
    String(url).startsWith("/agent-api/api/audit-detail") ? { audit: body } : { items: [body] },
  );
}

/** Both faces of one event, the way the page shows them. */
async function mountBoth(body: unknown): Promise<void> {
  answer(body);
  await render(`/audit?window=7d&preview=${ID}&detail=${ID}`);
  await waitFor(() => document.querySelector("[data-testid='aud02-detail']") !== null, "detail painted");
  await waitFor(
    () => document.querySelector(`[data-testid='aud6-preview-${ID}']`) !== null,
    "preview painted",
  );
}

const linksIn = (scope: string): Element[] =>
  Array.from(
    document.querySelectorAll(`[data-testid='${scope}'] [data-testid='aud-resource-link']`),
  );

describe("audW - the two faces, the same way out", () => {
  it("prints one href in the preview and in the record pane, from one table", async () => {
    await mountBoth(APPROVAL_EVENT);
    const preview = linksIn(`aud6-preview-${ID}`);
    const detail = linksIn("aud02-detail");
    expect(preview).toHaveLength(1);
    expect(detail).toHaveLength(1);
    expect(preview[0].getAttribute("href")).toBe(
      "/approvals?tab=history&status=all&id=ap_1122334455667788",
    );
    // the same string the pure table promises, and the same string on both faces
    expect(detail[0].getAttribute("href")).toBe(preview[0].getAttribute("href"));
    expect(detail[0].getAttribute("href")).toBe(
      hrefOf({ type: "approval", id: "ap_1122334455667788" }),
    );
    expect(preview[0].textContent).toBe(AUDIT_RESOURCE_LINK_LABEL);
  });

  it("is a real anchor: focusable, opens elsewhere, and asks for nothing", async () => {
    await mountBoth(APPROVAL_EVENT);
    const before = urls();
    const anchor = linksIn("aud02-detail")[0] as HTMLAnchorElement;
    expect(anchor.getAttribute("target")).toBe("_blank");
    expect(anchor.getAttribute("rel")).toContain("noopener");
    // A link whose only handler is a click is not a link: no onClick in the tree.
    expect(anchor.getAttribute("onclick")).toBeNull();
    await act(async () => {
      anchor.click();
    });
    // Navigating away is the browser's business; the page sent no request.
    expect(urls()).toEqual(before);
    expect(listReads()).toBe(1);
    expect(detailReads()).toBe(1);
  });

  it("a resource type with no page gets the honest sentence, in both faces, no anchor", async () => {
    await mountBoth({ ...APPROVAL_EVENT, resource: { type: "channel_event", id: "feishu:om_x1:msg" } });
    for (const scope of [`aud6-preview-${ID}`, "aud02-detail"]) {
      expect(linksIn(scope)).toHaveLength(0);
      const said = document.querySelector(`[data-testid='${scope}'] [data-testid='aud-resource-nolink']`);
      expect(said?.textContent).toBe(AUDIT_RESOURCE_NO_LINK_TEXT);
      expect(said?.getAttribute("title")).toContain("没有对应页面");
    }
    expect(urls()).toHaveLength(2);
  });

  it("an approval with no number says the missing word instead of linking to nothing", async () => {
    await mountBoth({ ...APPROVAL_EVENT, resource: { type: "approval" } });
    for (const scope of [`aud6-preview-${ID}`, "aud02-detail"]) {
      expect(linksIn(scope)).toHaveLength(0);
      const said = document.querySelector(
        `[data-testid='${scope}'] [data-testid='aud-resource-missing']`,
      );
      expect(said?.textContent).toBe(AUDJ_TIME_MISSING);
      expect(said?.getAttribute("title")).toContain("审批");
    }
    // and the object line itself still shows what the ledger did send
    expect(document.querySelector("[data-testid='audA-preview-resource']")?.textContent).toContain(
      "审批单",
    );
  });
});
