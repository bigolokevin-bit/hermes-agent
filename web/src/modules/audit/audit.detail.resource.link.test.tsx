// @vitest-environment jsdom
// R271 — the resource way out is reachable on all three faces, from one table.
//
// 查重结论 (git grep first, per ticket). `resourceLinks.test.tsx` is the unit +
// face owner and its lines are cited, never rewritten:
//   - 「prints one href in the preview and in the record pane」 :163
//   - 「is a real anchor: focusable, opens elsewhere, and asks for nothing」 :180
//   - 「a resource type with no page gets the honest sentence, in both faces」 :197
//   - 「an approval with no number says the missing word」 :208
//   - 「links the row to the resource with the very href…」 :230 (column joins the
//     href line; rel is only ⊇ there: `toContain("noopener")`)
//   - 「says 类型人话 · 短码 and keeps the machine id off the row」 :246 — so
//     audit.deeplink.test.tsx is NOT a text owner (its ap_1122334455667788 bytes
//     at :70/:81/:130 are the resource FILTER address, not the column face).
//   - 「a resource with no number is the absent-field word…」 :258, 「a type with
//     no page here stays plain text…」 :269, 「painting the column costs
//     nothing…」 :281
// Net-new pinned only here:
//   ① the full TITLE contract on all three faces at once: title bytes equal the
//      table's title verbatim and carry 「到<落点>」 + the COMPLETE 「编号 <id>」 —
//      :246 only checked 审批历史 inside the column title, and the exact shipped
//      rel bytes ("noreferrer noopener", states.tsx:64/:112), never ⊇;
//   ② the cost ledger around all three resource faces with the drawer OPENED
//      through its cell trigger and the preview folded through aud6-toggle:
//      clicking a resource anchor asks for nothing, opening the drawer costs
//      exactly one 问 and nothing else (裁决 below);
//   ③ knowledge (needsId===false): a FALSE-premise probe-reveal — the派工单 said
//      the faces would say 「该资源类型暂无页面」; the code on disk ships a REAL
//      anchor to the bare /knowledge landing (resourceLinkOf only branches on
//      needsId for the id, not for the kind). The faces now join the href line
//      with the landing-but-no-entry-address shape: href=/knowledge, title says
//      这类资源 and never promises a 编号 (假定登记 resourceLinks.ts:81-87; table
//      owner resourceLinks.test.tsx:52; the face-level :197 station only ever
//      tested the channel_event no-page word). And the fully resourceless row
//      stays honest on the same three faces: the cell says the absent-field word
//      (absence wins over the type sentence, states.tsx:122-125), the drawer and
//      preview say the type sentence;
//   ④ the destinations are a CLOSED set read off RESOURCE_LINK_TYPES — 禁臆造.
// Harness lineage: audit.empty.test.tsx (skeleton wait, click recipe) and
// audit.export.missing.pairs.test.tsx (openRecord via the cell-type button;
// the row-card root itself is not the trigger — aud01-cell-<id>-type is).
// Standing line: the server-side live legs were unprobed this session
// (:9122 read口 401, :8092 404 per resourceLinks.ts:21-31) — pinned here only
// as far as the routing bytes on disk reach.
//
// 工单② 裁决 (per ticket allowance 「或按现场行为断言并写裁决」): a resource
// anchor is target=_blank navigation — the SPA asks for NOTHING when it is
// clicked (jsdom's refused navigation is console noise, not a failure, AGENTS.md
// web gate). The drawer, on site, opens with exactly one detail 问
// (audit-detail?id=…) and zero list re-asks — the R243③-era reality, whose
// ledger owner is audit.filter.paging.export.test.tsx:370; this file re-checks
// that cost only around the resource faces and the preview fold.

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "./AuditEventsModulePage";
import { AUDIT_RESOURCE_LINK_LABEL, AUDIT_RESOURCE_NO_LINK_TEXT, RESOURCE_LINK_TYPES, resourceLinkOf } from "./resourceLinks";
import { AUDJ_TIME_MISSING } from "./timeActor";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ACTOR = "user:2f3a4b5c6d7e8f90";
const APPROVAL = "ap_1122334455667788";
const APPROVAL_HREF = "/approvals?tab=history&status=all&id=ap_1122334455667788";
const APPROVAL_WORDS = "审批单 · 55667788";
const REL_SHIPPED = "noreferrer noopener";
const KNOWLEDGE = "kn_1029384756655443";

const ROW_APPROVAL = "evt_r271_appr_00000001";
const ROW_KNOWLEDGE = "evt_r271_know_00000001";
const ROW_PLAIN = "evt_r271_plain_00000001";
const BASE = "/audit?window=custom&from=2026-11-05T02:00:00Z&to=2026-11-19T02:00:00Z&limit=25";

function rowOf(eventId: string, occurredAt: string, resource: Record<string, unknown>): Record<string, unknown> {
  return {
    eventId,
    action: "task.created",
    occurredAt,
    recordedAt: occurredAt,
    outcome: "succeeded",
    actor: { type: "human", id: ACTOR, displayName: "李思" },
    resource,
    requestId: `req-${eventId}`,
  };
}

const ITEMS = [
  rowOf(ROW_APPROVAL, "2026-11-19T01:20:00Z", { type: "approval", id: APPROVAL }),
  rowOf(ROW_KNOWLEDGE, "2026-11-19T01:21:00Z", { type: "knowledge", id: KNOWLEDGE }),
  rowOf(ROW_PLAIN, "2026-11-19T01:22:00Z", {}),
];

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
      </MemoryRouter>,
    );
  });
  await waitFor(() => document.querySelector(".animate-pulse") === null, "skeleton gone");
}

function node(testId: string): Element | null {
  return document.querySelector(`[data-testid='${testId}']`);
}

// The one resource anchor a face scope holds. Scoped selectors are the whole
// point: all three faces can mount at once, so a document-wide query would
// prove nothing about which face promised which destination.
function linksIn(scope: string): Element[] {
  return Array.from(document.querySelectorAll(`[data-testid='${scope}'] [data-testid='aud-resource-link']`));
}

function saidIn(scope: string, kind: string): Element | null {
  return document.querySelector(`[data-testid='${scope}'] [data-testid='${kind}']`);
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number => urls().filter((url) => url.startsWith("/agent-api/api/audit?")).length;
const detailReads = (): number => urls().filter((url) => url.startsWith("/agent-api/api/audit-detail")).length;

async function clickTestId(testId: string): Promise<void> {
  const target = node(testId);
  expect(target, testId).not.toBeNull();
  await act(async () => {
    (target as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

async function openRecord(eventId: string): Promise<void> {
  await clickTestId(`aud01-cell-${eventId}-type`);
  await waitFor(() => node("aud02-detail") !== null, "the detail pane opened");
}

async function closeRecord(): Promise<void> {
  await clickTestId("aud8-back-to-list");
  await waitFor(() => node("aud02-detail") === null, "the detail pane closed");
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      const id = new URL(target, "http://console.test").searchParams.get("id");
      return { audit: ITEMS.find((item) => item.eventId === id) ?? null };
    }
    return { items: ITEMS, nextCursor: null };
  });
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R271 - the resource way out, reachable on every face", () => {
  it("prints the same href with the COMPLETE id in every title, across column, preview and drawer", async () => {
    // the green sibling mountBoth recipe (resourceLinks.test.tsx:151): the
    // deep links fold the preview and open the drawer while the list stands.
    await render(`${BASE}&preview=${ROW_APPROVAL}&detail=${ROW_APPROVAL}`);
    await waitFor(() => node("aud02-detail") !== null, "the drawer painted");
    await waitFor(() => node(`aud6-preview-${ROW_APPROVAL}`) !== null, "the preview painted");

    const table = resourceLinkOf({ type: "approval", id: APPROVAL });
    expect(table.kind).toBe("link");
    const listed = linksIn(`aud01-cell-${ROW_APPROVAL}-resource`);
    const previewed = linksIn(`aud6-preview-${ROW_APPROVAL}`);
    const drawer = linksIn("aud02-detail");
    expect(listed).toHaveLength(1);
    expect(previewed).toHaveLength(1);
    expect(drawer).toHaveLength(1);

    // 工单① prefix = the live reachable route, byte for byte, on every face.
    for (const anchor of [listed[0], previewed[0], drawer[0]]) {
      expect(anchor.getAttribute("href"), "the route the approvals page itself reads")
        .toBe(APPROVAL_HREF);
      expect(anchor.getAttribute("href")).toBe((table as { href: string }).href);
      expect(anchor.getAttribute("target")).toBe("_blank");
      // exact shipped bytes (states.tsx:64/:112), not the ⊇ form :242 used
      expect(anchor.getAttribute("rel")).toBe(REL_SHIPPED);
      expect(anchor.getAttribute("onclick")).toBeNull();
      // 工单① title = the table's own title verbatim, carrying the FULL id.
      expect(anchor.getAttribute("title")).toBe(table.title);
      expect(anchor.getAttribute("title")).toContain("到审批历史");
      expect(anchor.getAttribute("title")).toContain(`编号 ${APPROVAL}`);
    }
    // roles: the column speaks 人话+短码, the preview and drawer speak the label.
    expect(listed[0].textContent).toBe(APPROVAL_WORDS);
    expect(previewed[0].textContent).toBe(AUDIT_RESOURCE_LINK_LABEL);
    expect(drawer[0].textContent).toBe(AUDIT_RESOURCE_LINK_LABEL);
    // the full handle rides in attributes only — never in a face's words
    expect(node(`aud01-cell-${ROW_APPROVAL}-resource`)?.textContent).not.toContain(APPROVAL);
    expect(linksIn(`aud6-preview-${ROW_APPROVAL}`)[0].textContent).not.toContain(APPROVAL);
  });

  it("asks for nothing around the three faces: the anchor is the browser's, the drawer is one 问", async () => {
    await render(BASE);
    expect(listReads()).toBe(1);
    expect(detailReads()).toBe(0);

    // clicking the column anchor: navigation is the browser's business, so the
    // ledger must not move at all (裁决 above; the page itself sends nothing).
    const beforeOpen = urls();
    const listed = linksIn(`aud01-cell-${ROW_APPROVAL}-resource`)[0] as HTMLElement;
    await act(async () => {
      listed.click();
    });
    expect(urls()).toEqual(beforeOpen);

    // opening the drawer = exactly one detail 问, zero list re-asks (R243③
    // reality, ledger owner audit.filter.paging.export.test.tsx:370).
    await openRecord(ROW_APPROVAL);
    expect(detailReads(), "the drawer asked for its record exactly once").toBe(1);
    expect(listReads(), "opening the drawer never re-asked the list").toBe(1);
    const detailUrl = urls().find((url) => url.startsWith("/agent-api/api/audit-detail")) ?? "";
    expect(detailUrl).toContain(`id=${ROW_APPROVAL}`);

    // the drawer's own anchor, clicked, also asks for nothing
    const opened = urls();
    const drawer = linksIn("aud02-detail")[0] as HTMLElement;
    await act(async () => {
      drawer.click();
    });
    expect(urls()).toEqual(opened);

    // folding the preview is not a fourth reading (states/preview design), and
    // it joins the very same destination line
    await clickTestId(`aud6-toggle-${ROW_APPROVAL}`);
    await waitFor(() => node(`aud6-preview-${ROW_APPROVAL}`) !== null, "the preview folded open");
    expect(urls(), "the preview cost nothing").toEqual(opened);
    expect(linksIn(`aud6-preview-${ROW_APPROVAL}`)[0].getAttribute("href")).toBe(APPROVAL_HREF);

    await closeRecord();
    expect(urls(), "closing cost nothing either").toEqual(opened);
  });

  it("keeps knowledge pointed at the bare landing and the resourceless row honest: the words in their places", async () => {
    // station 1, no deep link: the two negative-ish COLUMNS are painted together.
    await render(BASE);
    // knowledge really does link — to the page, not to an entry (needsId===false).
    const knowledgeLinks = linksIn(`aud01-cell-${ROW_KNOWLEDGE}-resource`);
    expect(knowledgeLinks, "the knowledge column joins the closed table with a bare landing").toHaveLength(1);
    expect(knowledgeLinks[0].getAttribute("href")).toBe("/knowledge");
    expect(knowledgeLinks[0].textContent).toMatch(/^对象 · \w{8}$/); // 对象: knowledge has no RESOURCE_NOUN entry
    expect(knowledgeLinks[0].getAttribute("title")).toContain("到知识库看这类资源");
    expect(knowledgeLinks[0].getAttribute("title")).not.toContain("编号"); // no entry address to name
    expect(node(`aud01-cell-${ROW_KNOWLEDGE}-resource`)?.textContent).not.toContain(KNOWLEDGE); // masked, never the bare handle
    expect(saidIn(`aud01-cell-${ROW_KNOWLEDGE}-resource`, "aud-resource-nolink")).toBeNull();
    // and the truly resourceless row is the module's one absent-field word…
    expect(linksIn(`aud01-cell-${ROW_PLAIN}-resource`)).toHaveLength(0);
    const plainCell = saidIn(`aud01-cell-${ROW_PLAIN}-resource`, "aud-resource-missing");
    expect(plainCell, "a row with nothing to point at is the absent-field word, not the type sentence").not.toBeNull();
    expect(plainCell?.textContent).toBe(AUDJ_TIME_MISSING);
    expect(saidIn(`aud01-cell-${ROW_PLAIN}-resource`, "aud-resource-nolink")).toBeNull();

    // station 2, the knowledge row's drawer + preview (deep-link mount): the
    // anchor line is one on all three faces, /knowledge byte for byte.
    await render(`${BASE}&preview=${ROW_KNOWLEDGE}&detail=${ROW_KNOWLEDGE}`);
    await waitFor(() => node("aud02-detail") !== null, "the knowledge drawer painted");
    await waitFor(() => node(`aud6-preview-${ROW_KNOWLEDGE}`) !== null, "the knowledge preview painted");
    const knowledgeTable = resourceLinkOf({ type: "knowledge", id: KNOWLEDGE });
    // 假定登记 (resourceLinks.ts:81-87, table owner :52): 本环境没有可定位单条
    // 知识的地址参数，所以不带 id — the landing exists, the entry address does
    // not, so the faces link to the page and the title says 这类资源 without
    // ever promising a 编号 the route cannot honour.
    expect(knowledgeTable.kind).toBe("link");
    for (const scope of [
      `aud01-cell-${ROW_KNOWLEDGE}-resource`,
      `aud6-preview-${ROW_KNOWLEDGE}`,
      "aud02-detail",
    ]) {
      const anchors = linksIn(scope);
      expect(anchors, `the ${scope} face carries the one knowledge destination`).toHaveLength(1);
      expect(anchors[0].getAttribute("href")).toBe((knowledgeTable as { href: string }).href);
      expect(anchors[0].getAttribute("title")).toBe(knowledgeTable.title);
      expect(saidIn(scope, "aud-resource-nolink")).toBeNull();
    }
    expect(linksIn(`aud6-preview-${ROW_KNOWLEDGE}`)[0].textContent).toBe(AUDIT_RESOURCE_LINK_LABEL);
    expect(linksIn("aud02-detail")[0].textContent).toBe(AUDIT_RESOURCE_LINK_LABEL);
    // no-number can never fire for knowledge by construction (needsId===false)
    expect(resourceLinkOf({ type: "knowledge", id: null }).kind, "the no-id leg stays a link too").toBe("link");

    // station 3, the resourceless row's drawer + preview.
    await render(`${BASE}&preview=${ROW_PLAIN}&detail=${ROW_PLAIN}`);
    await waitFor(() => node("aud02-detail") !== null, "the plain drawer painted");
    await waitFor(() => node(`aud6-preview-${ROW_PLAIN}`) !== null, "the plain preview painted");
    for (const scope of [
      `aud01-cell-${ROW_PLAIN}-resource`,
      `aud6-preview-${ROW_PLAIN}`,
      "aud02-detail",
    ]) {
      expect(linksIn(scope), `the ${scope} face links nothing that has no id`).toHaveLength(0);
    }
    for (const scope of [`aud6-preview-${ROW_PLAIN}`, "aud02-detail"]) {
      const said = saidIn(scope, "aud-resource-nolink");
      expect(said, `the ${scope} face still says a word about the resource`).not.toBeNull();
      expect(said?.textContent).toBe(AUDIT_RESOURCE_NO_LINK_TEXT);
      expect(said?.getAttribute("data-testid")).not.toBe("aud-resource-link");
    }
    // 工单③ hygiene: no face ever speaks undefined/null on the resource line.
    for (const scope of [
      `aud01-cell-${ROW_PLAIN}-resource`,
      `aud6-preview-${ROW_PLAIN}`,
      "aud02-detail",
    ]) {
      const box = node(scope);
      const text = `${box?.textContent ?? ""}`;
      expect(text, `the ${scope} face never says undefined`).not.toContain("undefined");
      expect(text, `the ${scope} face never says null`).not.toContain("null");
    }
  });

  it("points only inside the closed set of proven routes — 禁臆造 destinations", () => {
    const proven = ["/approvals?tab=history", "/employees/", "/runs?run=", "/work?tab=board", "/knowledge"];
    const landed: string[] = [];
    for (const type of RESOURCE_LINK_TYPES) {
      const link = resourceLinkOf({ type, id: "id_probe_000000000001" });
      expect(link.kind, `every table type lands on a page`).toBe("link");
      if (link.kind !== "link") continue;
      landed.push(link.href);
      expect(proven.some((route) => link.href.startsWith(route)), `the ${type} href is a proven route`)
        .toBe(true);
      expect(link.href).not.toContain("undefined");
      expect(link.href).not.toContain("null");
      const carriesId = link.href !== "/knowledge"; // 落点不带条目参数 ⇒ 不承诺编号
      expect(link.title.includes("编号 id_probe_000000000001")).toBe(carriesId);
    }
    // all six table keys land: approval / run / task / employee carry the id,
    // knowledge and knowledge_source share the bare /knowledge landing
    expect(landed).toHaveLength(RESOURCE_LINK_TYPES.length);
  });
});
