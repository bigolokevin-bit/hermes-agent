// @vitest-environment jsdom
/**
 * audE — 事件固定链接的构造：当前页 origin + `/audit?event=<eventId>`。
 * 参数名以本模块实测现名为准（`?event=` 是列表页真正读取的深链键，见
 * AuditEventsModulePage.tsx）；没有标识就没有链接，不编造。
 */
import { describe, expect, it } from "vitest";

import { AUDIT_PATH, DEEP_LINK_PARAM, eventPermalink, permalinkFromEvent } from "./permalink";

describe("audE - the permalink builder", () => {
  it("is the origin plus the spelling the list page really reads", () => {
    expect(eventPermalink("evt_7c1f2a3b4d5e6f70", "https://console.example.test")).toBe(
      "https://console.example.test/audit?event=evt_7c1f2a3b4d5e6f70",
    );
    expect(AUDIT_PATH).toBe("/audit");
    expect(DEEP_LINK_PARAM).toBe("event");
  });

  it("carries only the event, so the link is about the record and not about my screen", () => {
    const link = new URL(eventPermalink("evt_1", "https://x.test"));
    expect(link.pathname).toBe("/audit");
    expect([...link.searchParams.keys()]).toEqual(["event"]);
    expect(link.searchParams.get("event")).toBe("evt_1");
  });

  it("quotes an identifier that needs it and keeps it decodable", () => {
    const link = eventPermalink("ev weird/one&two", "https://x.test");
    expect(link).toBe("https://x.test/audit?event=ev%20weird%2Fone%26two");
    expect(new URL(link).searchParams.get("event")).toBe("ev weird/one&two");
  });

  it("refuses to build a link for a record with no identifier", () => {
    expect(permalinkFromEvent(null)).toBeNull();
    expect(permalinkFromEvent(undefined)).toBeNull();
    expect(permalinkFromEvent("   ")).toBeNull();
  });

  it("falls back to the page's own origin when none is handed in", () => {
    expect(eventPermalink("evt_1").startsWith(window.location.origin + AUDIT_PATH + "?event=")).toBe(true);
  });
});
