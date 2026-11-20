/**
 * audJ — 时间与操作者的呈现契约。断言的是：绝对北京时间到秒、原值进 title、
 * 缺失说「该字段未返回」且绝不拿当前时间顶替、操作者人话名优先、缺名用短码且
 * 完整标识只在 title、任何情况下裸句柄不进可见文本。
 */
import { describe, expect, it } from "vitest";

import {
  AUDJ_ACTOR_MISSING_TITLE,
  AUDJ_TIME_MISSING,
  AUDJ_TIME_MISSING_TITLE,
  auditActorView,
  auditTimeView,
} from "./timeActor";

describe("audJ - one presentation for WHEN and WHO", () => {
  it("speaks an absolute Beijing instant to the second, with the raw value in the title", () => {
    const view = auditTimeView("2026-11-19T01:20:00Z");
    expect(view.text).toBe("2026-11-19 09:20:00");
    expect(view.title).toContain("2026-11-19T01:20:00Z");
    expect(view.title).toContain("UTC");
    expect(view.title).toContain("北京时间（UTC+8）");
    // never a relative phrase
    expect(view.text).not.toMatch(/分钟前|小时前|昨天|今天|刚刚/);
  });

  it("derives seconds from epoch values too, and says which reading is in force", () => {
    const seconds = auditTimeView("1763515200");
    expect(seconds.text).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    const millis = auditTimeView("1763515200000");
    expect(millis.text).toBe(seconds.text);
    expect(millis.text).toMatch(/^20\d{2}-/);
    const freeText = auditTimeView("yesterday evening", "2026-11-19 09:20");
    expect(freeText.text).toBe("2026-11-19 09:20");
    // a value that is not an instant is quoted as what it is, never renamed UTC
    expect(freeText.title).toContain("不是一个可换算的瞬间");
    expect(freeText.title).toContain("yesterday evening");
    expect(freeText.title).not.toContain("UTC）");
  });

  it("a time the service did not send says so, and never fills in a clock", () => {
    expect(auditTimeView(null).text).toBe(AUDJ_TIME_MISSING);
    expect(auditTimeView(null).title).toBe(AUDJ_TIME_MISSING_TITLE);
    expect(auditTimeView("").text).toBe(AUDJ_TIME_MISSING);
    expect(auditTimeView("not a date").text).toBe(AUDJ_TIME_MISSING);
    // the missing word is the same one every surface prints
    expect(auditTimeView(null).text).toBe(auditTimeView(undefined, null).text);
  });

  it("keeps the minute reading when only a minute reading exists", () => {
    expect(auditTimeView(null, "2026-11-19 09:20").text).toBe("2026-11-19 09:20");
    expect(auditTimeView(null, "  ").text).toBe(AUDJ_TIME_MISSING);
  });

  it("shows an operator as a person, with the full identifier only in the title", () => {
    const named = auditActorView({ label: "李思 · 6d7e8f90", raw: "user:2f3a4b5c6d7e8f90" });
    expect(named.text).toBe("李思 · 6d7e8f90");
    expect(named.title).toContain("user:2f3a4b5c6d7e8f90");
    expect(named.text).not.toMatch(/^user:|^human:|^employee:|^emp_/);

    const codeOnly = auditActorView({ label: "员工 · 5b4a3f21", raw: "employee:9f8e7d6c5b4a3f21" });
    expect(codeOnly.text).toBe("员工 · 5b4a3f21");
    expect(codeOnly.title).toContain("employee:9f8e7d6c5b4a3f21");
  });

  it("an operator nobody attributed says so, and never prints a bare handle", () => {
    const none = auditActorView({ label: "未指派", raw: null });
    expect(none.text).toBe("未指派");
    expect(none.title).toBe(AUDJ_ACTOR_MISSING_TITLE);
    // a label that came back blank is not an excuse for a handle on screen
    const blank = auditActorView({ label: "", raw: "human:1" });
    expect(blank.text).toBe("未指派");
    expect(blank.text).not.toContain("human:");
    expect(blank.title).toContain("human:1");
  });
});
