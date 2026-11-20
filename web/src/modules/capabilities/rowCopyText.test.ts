import { describe, expect, it } from "vitest";
import { capRowCopyText, capShortCode } from "./rowCopyText";

describe("capShortCode", () => {
  it("folds missing, synthetic and non-ASCII identifiers to 「—」", () => {
    expect(capShortCode(null)).toBe("—");
    expect(capShortCode("")).toBe("—");
    expect(capShortCode("row-0")).toBe("—");
    expect(capShortCode("row_12")).toBe("—");
    expect(capShortCode("文档检索")).toBe("—");
  });

  it("keeps at most 8 upper-case alphanumerics of a real upstream id", () => {
    expect(capShortCode("sk_alpha42")).toBe("SKALPHA4");
    expect(capShortCode("web_search")).toBe("WEBSEARC");
    expect(capShortCode("s2")).toBe("S2");
  });
});

describe("capRowCopyText", () => {
  it("prints the five labelled segments in contract order", () => {
    expect(
      capRowCopyText({ name: "资料整理", type: "平台内置", status: "正常", calls: null, id: "sk_alpha42" }),
    ).toBe("名称：资料整理 · 类型：平台内置 · 状态：正常 · 调用次数：— · 短码：SKALPHA4");
  });

  it("shows a real 0 as `0`, never 「—」", () => {
    const line = capRowCopyText({ name: "a", type: "t", status: "s", calls: 0, id: "x1" });
    expect(line).toContain("调用次数：0 ·");
    expect(line).not.toContain("调用次数：—");
  });

  it("folds every missing value to 「—」 without inventing one", () => {
    expect(capRowCopyText({ name: "—", type: null, status: null, calls: null, id: null })).toBe(
      "名称：— · 类型：— · 状态：— · 调用次数：— · 短码：—",
    );
    expect(capRowCopyText({ name: "   ", type: null, status: null, calls: null, id: null })).toContain("名称：—");
  });

  it("carries no clock and no request artefact", () => {
    const line = capRowCopyText({ name: "a", type: null, status: null, calls: 3, id: "ab12" });
    expect(/\d{4}-\d{2}-\d{2}/.test(line)).toBe(false);
    expect(line).not.toContain("http");
  });
});
