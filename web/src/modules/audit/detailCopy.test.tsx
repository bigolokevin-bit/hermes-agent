// @vitest-environment jsdom
// R121 — 详情行复制：一句话，一个 helper，零请求。
// The copied line is the screen's own reading of the record: the time the page
// already formatted, the operator's name with a short code instead of the handle,
// the action in human words, the resource, and the correlation short code. An
// absent field is 「—」, a real 0 is 「0」, and nothing is asked of the service
// before, during or after the copy. With no event selected the control is still
// there, disabled, with the reason in its title.

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import AuditDetailModulePage from "@/modules/audit/AuditDetailModulePage";
import { auditDetailFrom } from "@/modules/audit/model";
import { DETAIL_COPY_ABSENT, auditCopyText, copyFieldValue } from "@/modules/audit/detailCopy";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ID = "evt_present_00000001";
const LINE = "2026-11-19 09:20:00 北京时间（UTC+8） · 李思 · 6d7e8f90 · 创建任务 · 审批单 · 55667788 · 33445566";

/** What the ledger answers for the one event this file is about. */
const RECORD = {
  eventId: ID,
  action: "task.created",
  occurredAt: "2026-11-19T01:20:00Z",
  recordedAt: "2026-11-19T01:20:01Z",
  outcome: "succeeded",
  actor: { type: "human", id: "user:2f3a4b5c6d7e8f90", displayName: "李思" },
  resource: { type: "approval", id: "ap_1122334455667788" },
  requestId: "req-20261119-0a7b3c",
  correlationId: "cor-00112233445566",
};

const asEvent = (over: Record<string, unknown> = {}) =>
  auditDetailFrom({ audit: { ...RECORD, ...over } })!;

describe("R121 - one helper, the words it promises", () => {
  it("joins the five fields in the ticket's order, off the model's own labels", () => {
    expect(auditCopyText(asEvent())).toBe(LINE);
  });

  it("absent fields are 「—」, and a real zero is a zero", () => {
    expect(DETAIL_COPY_ABSENT).toBe("—");
    expect(copyFieldValue(null)).toBe("—");
    expect(copyFieldValue(undefined)).toBe("—");
    expect(copyFieldValue("   ")).toBe("—");
    expect(copyFieldValue(0)).toBe("0");
    expect(copyFieldValue("0")).toBe("0");

    const bare = auditCopyText(asEvent({ resource: { type: "approval" }, correlationId: null }));
    // The model gives a type without an id the bare noun 「审批单」 — that is a real
    // answer, not an absence; only the missing correlation takes 「—」.
    expect(bare).toBe("2026-11-19 09:20:00 北京时间（UTC+8） · 李思 · 6d7e8f90 · 创建任务 · 审批单 · —");
  });

  it("a record with no time copies the missing word, never this machine's clock", () => {
    const line = auditCopyText(asEvent({ occurredAt: null, recordedAt: null }));
    expect(line.startsWith("该字段未返回 · ")).toBe(true);
    expect(line).not.toContain("北京时间（UTC+8） ·");
    expect(line).not.toMatch(new Date().getFullYear().toString() === "2026" ? /20\d\d/ : /9999/);
  });

  it("no internal handle ever reaches the copied words", () => {
    const line = auditCopyText(asEvent());
    for (const raw of ["user:2f3a4b5c6d7e8f90", "ap_1122334455667788", "cor-00112233445566"]) {
      expect(line).not.toContain(raw);
    }
    // and the short codes that replace them are the screen's own
    expect(line).toContain("6d7e8f90");
    expect(line).toContain("55667788");
    expect(line).toContain("33445566");
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

async function render(entry: string, page: "list" | "detail" = "list"): Promise<void> {
  await act(async () => {
    if (root) act(() => root?.unmount());
  });
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[entry]}>
        {page === "list" ? <AuditEventsModulePage /> : <AuditDetailModulePage />}
      </MemoryRouter>,
    );
  });
}

function stubClipboard(allow: boolean): { calls: string[] } {
  const clip = { calls: [] as string[] };
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (text: string) => {
        if (!allow) throw new Error("denied by the person's browser");
        clip.calls.push(text);
      },
    },
  });
  return clip;
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const button = (): HTMLButtonElement | null =>
  document.querySelector<HTMLButtonElement>("[data-testid='aud-detail-copy']");
const status = (): string | null =>
  document.querySelector("[data-testid='aud-detail-copy-status']")?.textContent ?? null;

beforeEach(() => {
  api.fetchJSON.mockReset();
  api.fetchJSON.mockImplementation(async (url) =>
    String(url).startsWith("/agent-api/api/audit-detail") ? { audit: RECORD } : { items: [RECORD] },
  );
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R121 - copying the record pane's line", () => {
  it("is a real button that announces the copy and hands over the helper's own words", async () => {
    await render(`/audit?window=7d&detail=${ID}`);
    await waitFor(() => button() !== null, "copy control painted");
    const control = button()!;
    expect(control.getAttribute("type")).toBe("button");
    expect(control.getAttribute("aria-label")).toBe("复制该事件");
    expect(control.disabled).toBe(false);

    const clip = stubClipboard(true);
    const before = urls();
    await act(async () => {
      control.focus();
      control.click();
    });
    await waitFor(() => status() === "已复制", "status announced");
    expect(clip.calls).toEqual([LINE]);
    // the same string the single helper promises for this record — no second builder
    expect(clip.calls[0]).toBe(auditCopyText(asEvent()));
    // and the page asked for nothing to produce it
    expect(urls()).toEqual(before);
    expect(document.querySelector("[data-testid='aud-detail-copy-status']")?.getAttribute("role")).toBe(
      "status",
    );
    // audC's 结论行 control is still there, untouched
    expect(document.querySelector("[data-testid='audC-copy']")).not.toBeNull();
  });

  it("when the clipboard refuses, the fallback holds exactly the same words", async () => {
    stubClipboard(false);
    await render(`/audit?window=7d&detail=${ID}`);
    await waitFor(() => button() !== null, "copy control painted");
    const before = urls();
    await act(async () => {
      button()!.click();
    });
    await waitFor(
      () => document.querySelector("[data-testid='aud-detail-copy-fallback']") !== null,
      "fallback painted",
    );
    expect(status()).toBe("剪贴板不可用，这一行可以直接选中复制");
    const box = document.querySelector("[data-testid='aud-detail-copy-fallback']") as HTMLTextAreaElement;
    expect(box.readOnly).toBe(true);
    expect(box.value).toBe(LINE);
    expect(box.value).toBe(auditCopyText(asEvent()));
    expect(urls()).toEqual(before);
  });

  it("with nothing selected the control is still there, disabled, and says why", async () => {
    const clip = stubClipboard(true);
    await render(`/audit-detail`, "detail");
    await waitFor(() => button() !== null, "disabled control painted");
    const control = button()!;
    expect(control.disabled).toBe(true);
    expect(control.getAttribute("title")).toContain("还没有选中一条审计事件");
    await act(async () => {
      control.click();
    });
    expect(urls()).toHaveLength(0);
    expect(clip.calls).toEqual([]);
    expect(status()).toBe("");
  });
});
