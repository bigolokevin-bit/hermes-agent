// @vitest-environment jsdom
// audV — 三面（列表行、行内预览 `aud6-preview`、事件详情 `aud3`）时间与请求编号的
// parity 护栏。断言的是屏幕上的话：同一事件的同一秒在三处逐字相同、title 里的
// ISO8601 UTC 原文三处相同；缺失的时间与缺失的请求编号说同一个「该字段未返回」；
// 复制入口产出的结论行含同一 rid 与同一时间串；三处的状态用词都取自四态句族本身
// （不是各面重打一遍）；三面渲染不多发一次请求。纯测试波，不改任何产品行为。

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { NO_REQUEST_ID } from "@/modules/audit/states";
import { AUDJ_TIME_MISSING } from "@/modules/audit/timeActor";
import { DENIED_BODY_SENTENCE, STATE_LABEL, stateSentenceFor } from "@/modules/audit/stateCopy";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

async function render(entry: string, page: ReactNode): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<MemoryRouter initialEntries={[entry]}>{page}</MemoryRouter>);
  });
}

// One page at a time, one call log at a time: every case mounts its own tree.
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

const textOf = (testId: string): string | null =>
  document.querySelector(`[data-testid='${testId}']`)?.textContent ?? null;
/**
 * The number itself, not the 复制 button hanging next to it: what a person
 * reads is the span, and the span is what must be identical on three faces.
 */
const valueOf = (testId: string): string | null =>
  document.querySelector(`[data-testid='${testId}'] > span`)?.textContent ?? null;
const valueTitle = (testId: string): string | null =>
  document.querySelector(`[data-testid='${testId}'] > span`)?.getAttribute("title") ?? null;
const attrOf = (testId: string, name: string): string | null =>
  document.querySelector(`[data-testid='${testId}']`)?.getAttribute(name) ?? null;
const inScope = (scope: string, testId: string): string | null =>
  document.querySelector(`[data-testid='${scope}'] [data-testid='${testId}']`)?.textContent ?? null;

const ID = "evt_present_00000001";
const SECONDS = "2026-11-19 09:20:00";
const RAW_UTC = "2026-11-19T01:20:00Z";
const RID = "req-20261119-0a7b3c";

/** The one event, as the ledger answers it; the record read answers the same body. */
const COMPLETE = {
  eventId: ID,
  action: "task.created",
  occurredAt: RAW_UTC,
  recordedAt: "2026-11-19T01:20:01Z",
  outcome: "succeeded",
  actor: { type: "human", id: "user:2f3a4b5c6d7e8f90", displayName: "李思" },
  resource: { type: "approval", id: "ap_1122334455667788" },
  requestId: RID,
};

/**
 * The three surfaces of one event at once: the list row, its inline preview and
 * the record pane. Same mount as audJ, so the guards below stand next to the
 * reading it already pins rather than beside a second fiction.
 */
async function mountThree(body: unknown, extra = ""): Promise<void> {
  api.fetchJSON.mockReset();
  api.fetchJSON.mockImplementation(async (url) =>
    String(url).startsWith("/agent-api/api/audit-detail") ? { audit: body } : { items: [body] },
  );
  await render(`/audit?window=7d&preview=${ID}&detail=${ID}${extra}`, <AuditEventsModulePage />);
  await waitFor(() => document.querySelector(`[data-testid='aud02-detail']`) !== null, "detail painted");
  await waitFor(() => document.querySelector(`[data-testid='aud6-preview-${ID}']`) !== null, "preview painted");
}

const TIME_MARKS = [`audJ-time-list-${ID}`, "audJ-time-preview", "audJ-time-detail"];
const RID_VALUES = [`aud01-cell-${ID}-request-value`, "audA-preview-rid", "aud02-detail-request-value"];

describe("audV - the same instant on three surfaces", () => {
  it("prints one Beijing second, to the second, in all three, from one title", async () => {
    await mountThree(COMPLETE);
    const values = TIME_MARKS.map((mark) => attrOf(mark, "data-audj-value"));
    expect(values).toEqual([SECONDS, SECONDS, SECONDS]);
    expect(values[0]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    // The three titles are ONE string, not three similar ones: the raw instant
    // the service sent, spelled identically wherever it is quoted.
    const titles = TIME_MARKS.map((mark) => attrOf(mark, "data-audj-title"));
    expect(new Set(titles).size).toBe(1);
    expect(titles[0]).toContain(RAW_UTC);
  });

  it("a record with no time says the module's one missing word in all three", async () => {
    await mountThree({ ...COMPLETE, occurredAt: undefined, recordedAt: undefined });
    const values = TIME_MARKS.map((mark) => attrOf(mark, "data-audj-value"));
    expect(values).toEqual([AUDJ_TIME_MISSING, AUDJ_TIME_MISSING, AUDJ_TIME_MISSING]);
    const titles = TIME_MARKS.map((mark) => attrOf(mark, "data-audj-title"));
    expect(new Set(titles).size).toBe(1);
    expect(titles[0]).toContain("不拿浏览器时间顶替");
  });
});

describe("audV - one request id, one missing word, one copied line", () => {
  it("shows the same request number on all three faces, byte for byte", async () => {
    await mountThree(COMPLETE);
    const shown = RID_VALUES.map((testId) => valueOf(testId));
    expect(shown).toEqual([RID, RID, RID]);
    // and the full value each one promises to copy is one string too
    expect(new Set(RID_VALUES.map((testId) => valueTitle(testId))).size).toBe(1);
  });

  it("an absent request number reads the same word as an absent time", async () => {
    await mountThree({ ...COMPLETE, requestId: undefined });
    const absent = RID_VALUES.map((testId) => textOf(`${testId}-absent`));
    expect(absent).toEqual([NO_REQUEST_ID, NO_REQUEST_ID, NO_REQUEST_ID]);
    // One word for one kind of absent field — the reason this wave exists.
    expect(NO_REQUEST_ID).toBe(AUDJ_TIME_MISSING);
    expect(inScope(`aud6-preview-${ID}-rid`, `${RID_VALUES[1]}-absent`)).toBe(NO_REQUEST_ID);
  });

  it("the copied conclusion line carries this same id and this same second", async () => {
    const clip: { calls: string[] } = { calls: [] };
    // jsdom only hands a navigator.clipboard to a secure context, so the test
    // says so; both legs then go through the real production path.
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (text: string) => void clip.calls.push(text) },
    });
    await mountThree(COMPLETE);
    for (const scope of [`aud6-preview-${ID}`, "aud02-detail"]) {
      const button = document.querySelector(`[data-testid='${scope}'] [data-testid='audC-copy']`);
      await act(async () => {
        (button as HTMLButtonElement | null)?.click();
      });
    }
    expect(clip.calls).toHaveLength(2);
    for (const line of clip.calls) {
      expect(line).toContain(SECONDS);
      expect(line).toContain(RID);
    }
    expect(clip.calls[0]).toBe(clip.calls[1]);
    expect(inScope(`aud6-preview-${ID}`, "audC-copy-status")).toBe("已复制");
  });
});

describe("audV - the four-state vocabulary is one source, not three", () => {
  /** Every face that paints a state must paint a word the句族 exports. */
  const labelsPainted = (): string[] =>
    Array.from(document.querySelectorAll("[data-testid^='audF-state-']"))
      .map((node) => node.getAttribute("data-audf-label") ?? "")
      .filter((label) => label !== "");

  it("a refused record read says the exported 被拒 label on both legs, with one body", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async (url) => {
      if (String(url).startsWith("/agent-api/api/audit-detail")) {
        throw new ApiError("closed", {
          status: 403,
          body: '{"code":"console.forbidden"}',
          url: String(url),
          requestId: "rid-audV",
        });
      }
      return { items: [COMPLETE] };
    });
    await render(`/audit?window=7d&preview=${ID}&detail=${ID}`, <AuditEventsModulePage />);
    await waitFor(() => document.querySelector("[data-testid='audF-state-detail-denied']") !== null, "detail denied");
    const painted = labelsPainted();
    expect(painted.length).toBeGreaterThanOrEqual(2);
    for (const label of painted) expect(label).toBe(STATE_LABEL.denied);
    expect(inScope(`aud6-preview-${ID}`, "audF-preview-denied-sentence")).toBe(
      inScope("aud02-detail", "aud02-detail-denied-sentence"),
    );
    const scope = document.querySelector(`[data-testid='aud6-preview-${ID}']`)?.textContent ?? "";
    expect(scope).toContain(DENIED_BODY_SENTENCE);
  });

  it("one failure answers with one sentence wherever the same event is opened", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async (url) => {
      if (String(url).startsWith("/agent-api/api/audit-detail")) {
        throw new ApiError("down", {
          status: 503,
          body: '{"code":"console.unavailable","message":"服务现在没有回答。"}',
          url: String(url),
          requestId: "rid-audV",
        });
      }
      return { items: [COMPLETE] };
    });
    await render(`/audit?window=7d&preview=${ID}&detail=${ID}`, <AuditEventsModulePage />);
    await waitFor(() => document.querySelector("[data-testid='audF-state-detail-error']") !== null, "detail failed");
    const sentences = Array.from(document.querySelectorAll("[data-testid$='-sentence']")).map(
      (node) => node.textContent ?? "",
    );
    expect(sentences.length).toBeGreaterThanOrEqual(2);
    expect(new Set(sentences.filter((line) => line !== "")).size).toBe(1);
    // The headline each face paints is the exported one — nobody re-types 四态
    // words per surface — and it is read together with the one failure sentence.
    for (const label of labelsPainted()) expect(label).toBe(STATE_LABEL.error);
    for (const line of sentences.filter((text) => text !== "")) {
      expect(line).toBe(stateSentenceFor("error", line));
    }
  });
});

describe("audV - reading three surfaces costs what reading one costs", () => {
  it("opening, closing and copying the three faces asks for nothing more", async () => {
    await mountThree(COMPLETE);
    const before = urls();
    expect(listReads()).toBe(1);
    expect(detailReads()).toBe(1);
    const toggle = document.querySelector<HTMLButtonElement>(`[data-testid='aud6-toggle-${ID}']`);
    for (let pass = 0; pass < 2; pass += 1) {
      await act(async () => {
        toggle?.click();
      });
    }
    for (const scope of [`aud6-preview-${ID}`, "aud02-detail"]) {
      const button = document.querySelector(`[data-testid='${scope}'] [data-testid='audC-copy']`);
      await act(async () => {
        (button as HTMLButtonElement | null)?.click();
      });
    }
    expect(urls()).toEqual(before);
    expect(listReads()).toBe(1);
    expect(detailReads()).toBe(1);
  });

  it("the preview's 打开详情 goes to the address the record lives on, and that address costs one record read", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async (url) =>
      String(url).startsWith("/agent-api/api/audit-detail") ? { audit: COMPLETE } : { items: [COMPLETE] },
    );
    await render(`/audit?window=7d&preview=${ID}`, <AuditEventsModulePage />);
    await waitFor(() => document.querySelector(`[data-testid='aud6-preview-${ID}']`) !== null, "preview painted");
    expect(listReads()).toBe(1);
    expect(detailReads()).toBe(0);
    const open = document.querySelector<HTMLAnchorElement>(`[data-testid='aud6-preview-${ID}-open']`);
    expect(open?.getAttribute("href") ?? "").toContain(`detail=${encodeURIComponent(ID)}`);
    // A plain <a> under a MemoryRouter does not navigate in jsdom, so the same
    // address is opened the way the test harness opens any address: mounted on.
    await mountThree(COMPLETE);
    expect(listReads()).toBe(1);
    expect(detailReads()).toBe(1);
    expect(valueOf("aud02-detail-request-value")).toBe(RID);
  });
});
