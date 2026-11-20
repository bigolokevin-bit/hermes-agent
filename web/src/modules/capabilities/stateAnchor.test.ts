import { describe, expect, it } from "vitest";

import { stateAnchor, type StateAnchorInput, type StateAnchorKind } from "./stateAnchor";

const INPUTS: Record<StateAnchorKind, StateAnchorInput> = {
  loading: { kind: "loading", subject: "技能" },
  empty: { kind: "empty", subject: "技能" },
  "filter-empty": { kind: "filter-empty", subject: "技能", reason: "周报", loaded: 4 },
  error: { kind: "error", subject: "技能", heading: "技能列表暂时无法读取", reason: "上游 502", requestId: "req-1" },
  denied: { kind: "denied", subject: "技能", heading: "技能读口未接入", reason: "无权查看", requestId: "req-2" },
  login: { kind: "login", subject: "工具与 MCP 清单", heading: "登录状态已经失效", reason: "会话不再被接受" },
};

const KINDS = Object.keys(INPUTS) as StateAnchorKind[];

describe("stateAnchor", () => {
  it("produces one non-empty sentence per kind and never repeats another kind's wording", () => {
    const texts = KINDS.map((kind) => {
      const anchor = stateAnchor(INPUTS[kind]);
      const text = `${anchor.lead}${anchor.detail}`;
      expect(text.trim().length).toBeGreaterThan(0);
      return text;
    });
    expect(new Set(texts).size).toBe(KINDS.length);
  });

  it("uses the ordered literals for the states that carry no upstream detail", () => {
    expect(stateAnchor(INPUTS.loading).lead).toBe("正在读取技能…");
    expect(stateAnchor(INPUTS.empty).lead).toBe("这个读口已接入，但目前没有条目。");
    expect(stateAnchor(INPUTS["filter-empty"]).lead).toBe("当前条件下没有匹配项。");
    expect(stateAnchor(INPUTS.denied).lead).toBe("无权读取这条数据。");
    expect(stateAnchor(INPUTS.error).lead).toBe("读取失败：");
  });

  it("carries the reason and the destination in every title", () => {
    for (const kind of KINDS) {
      const title = stateAnchor(INPUTS[kind]).title;
      expect(`${kind} => ${title}`).toContain("原因：");
      expect(`${kind} => ${title}`).toContain("去处：");
    }
  });

  it("keeps the request id in the title and says 未提供 when upstream omitted it", () => {
    expect(stateAnchor(INPUTS.error).title).toContain("请求编号：req-1。");
    expect(stateAnchor({ kind: "error", subject: "技能", heading: "读取失败", reason: "上游 502" }).title).toContain(
      "请求编号：未提供。",
    );
  });

  it("marks only the truly-empty read with the copy testid the page contract freezes", () => {
    expect(stateAnchor(INPUTS.empty).detailTestid).toBe("capF-state-empty-text");
    for (const kind of KINDS) {
      if (kind === "empty") continue;
      expect(stateAnchor(INPUTS[kind]).detailTestid).toBeNull();
    }
  });

  it("never invents a count: an unknown loaded size reads as 当前列表里, not 已加载的 0 项", () => {
    const known = stateAnchor(INPUTS["filter-empty"]);
    expect(known.detail).toBe("已加载的 4 项里没有名称包含「周报」的条目。");
    const unknown = stateAnchor({ kind: "filter-empty", subject: "技能" });
    expect(unknown.detail).toBe("当前列表里没有匹配的条目。");
    expect(unknown.detail).not.toContain("0");
  });

  it("strips one trailing punctuation from an upstream reason so 「。。」 never reaches the screen", () => {
    const upstream = "这条腿是用 ?state=denied 复现的，服务此刻没有回答过。";
    for (const kind of ["error", "denied", "login"] as const) {
      const anchor = stateAnchor({ kind, subject: "工具与 MCP 清单", heading: "工具读口未接入", reason: upstream });
      const all = anchor.lead + anchor.detail + anchor.title;
      expect(all).not.toContain("。。");
      expect(anchor.detail).toContain("原因：这条腿是用 ?state=denied 复现的，服务此刻没有回答过");
    }
    // A search word keeps its own characters: the strip only applies to reason slots.
    expect(stateAnchor({ kind: "filter-empty", subject: "技能", reason: "尾部带句号。" }).detail).toContain("「尾部带句号。」");
  });

  it("reads the clock nowhere: the text is built only from the fields handed in", () => {
    const anchor = stateAnchor({ kind: "empty", subject: "工具与 MCP 清单" });
    expect(anchor.lead + anchor.detail + anchor.title).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(anchor.title).toContain("去处：在原生侧登记后点下方重新读取。");
  });
});
