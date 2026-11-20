/**
 * audQ — 动作可用性单点。断言的是矩阵本身（四态×各入口的 enabled），
 * 「同一失败不得一处 disabled 一处可点」这条不变式，以及措辞的归属：
 * 屏上话术仍在这些字符串里，但只有这一处产生它们；title 不带路径与状态码。
 */
import { describe, expect, it } from "vitest";

import { auditGatesOf, copyLinkGate, gateMirror } from "./auditGates";

const base = { customInvalid: false, rows: 0, question: true };

describe("audQ - one gate table for every entry", () => {
  it("loading: exports, fold and fixed link are off, retry is on", () => {
    const gates = auditGatesOf({ ...base, phase: "loading" });
    expect(gates.exportCsv.enabled).toBe(false);
    expect(gates.exportFiltered.enabled).toBe(false);
    expect(gates.toggle.enabled).toBe(false);
    expect(gates.copyLink.enabled).toBe(false);
    expect(gates.retry.enabled).toBe(true);
    expect(gates.exportCsv.title).toContain("当前筛选没有可导出的记录");
    expect(gates.toggle.title).toContain("正在读取这一页");
    expect(gates.copyLink.title).toContain("这一页还在读");
    expect(gates.retry.title).toContain("这是你按的，不是页面自己重发");
  });

  it("an empty answer is not an unavailable one: the question is still copyable", () => {
    const gates = auditGatesOf({ ...base, phase: "empty" });
    expect(gates.copyFilter.enabled).toBe(true);
    expect(gates.copyFilter.title).toContain("该条件下无事件");
    expect(gates.exportCsv.enabled).toBe(false);
    expect(gates.toggle.enabled).toBe(false);
    expect(gates.copyLink.enabled).toBe(false);
    // 真空的说法与「读口没接入」不是一句话
    expect(gates.exportCsv.title).toContain("当前筛选没有可导出的记录");
    expect(gates.copyLink.title).toContain("这一页没有记录");
  });

  it("error and denied treat every row-facing entry the same way", () => {
    const error = auditGatesOf({ ...base, phase: "error" });
    const denied = auditGatesOf({ ...base, phase: "denied" });
    for (const gates of [error, denied]) {
      const rowFacing = [
        gates.exportCsv.enabled,
        gates.exportFiltered.enabled,
        gates.toggle.enabled,
        gates.copyLink.enabled,
      ];
      expect(new Set(rowFacing).size).toBe(1);
      expect(rowFacing[0]).toBe(false);
      expect(gates.retry.enabled).toBe(true);
    }
    expect(error.toggle.title).toContain("这一页没能读到");
    expect(denied.toggle.title).toContain("审计事件暂不可读");
    expect(denied.retry.title).toContain("筛选、页码与地址都还在原处");
  });

  it("the only exception is stated, not smuggled: the summary quotes the address", () => {
    const gates = auditGatesOf({ ...base, phase: "denied" });
    expect(gates.copyFilter.enabled).toBe(true);
    expect(gates.copyFilter.title).toContain("不再向服务发一次请求");
    // and with no question on the address, even that is off, with the sentence
    // the card already promised
    const quiet = auditGatesOf({ phase: "ready", customInvalid: false, rows: 3, question: false });
    expect(quiet.copyFilter.enabled).toBe(false);
    expect(quiet.copyFilter.title).toContain("当前没有筛选条件可复制");
    expect(quiet.copyFilter.title).toContain("控件常驻");
    expect(quiet.copyFilterRule).toContain("这个控件常驻");
  });

  it("a ready page with rows turns the row-facing entries on together", () => {
    const gates = auditGatesOf({ phase: "ready", customInvalid: false, rows: 12, question: true });
    expect(gates.exportCsv.enabled).toBe(true);
    expect(gates.exportFiltered.enabled).toBe(true);
    expect(gates.toggle.enabled).toBe(true);
    expect(gates.copyLink.enabled).toBe(true);
    expect(gates.exportCsv.title).toBe("导出当前筛选结果为 CSV（北京时间）");
    expect(gates.exportFiltered.title).toBe("导出当前筛选为 CSV（北京时间）");
  });

  it("an unfinished custom range is its own honest reason", () => {
    const gates = auditGatesOf({ phase: "loading", customInvalid: true, rows: 0, question: false });
    expect(gates.exportCsv.title).toContain("自定义时间窗不完整");
    expect(gates.copyFilter.title).toContain("（自定义区间还没应用）");
  });

  it("the fixed link follows the record it points at", () => {
    expect(copyLinkGate("idle", true).enabled).toBe(true);
    expect(copyLinkGate("ready", true).enabled).toBe(true);
    expect(copyLinkGate("ready", false).title).toBe("该行没有可用的固定标识");
    expect(copyLinkGate("loading", true).enabled).toBe(false);
    expect(copyLinkGate("error", true).title).toContain("先重试");
    expect(copyLinkGate("denied", true).title).toContain("这一条现在读不到");
  });

  it("the mirror is a whole matrix in one element", () => {
    const mirror = gateMirror(auditGatesOf({ ...base, phase: "error" }));
    expect(mirror["data-aud-gates-phase"]).toBe("error");
    expect(mirror["data-aud-gates-export"]).toBe("off");
    expect(mirror["data-aud-gates-export-filtered"]).toBe("off");
    expect(mirror["data-aud-gates-toggle"]).toBe("off");
    expect(mirror["data-aud-gates-copy-link"]).toBe("off");
    expect(mirror["data-aud-gates-copy-filter"]).toBe("on");
    expect(mirror["data-aud-gates-retry"]).toBe("on");
  });

  it("no title reaches the screen carrying a path or a status code", () => {
    const phases = ["loading", "ready", "empty", "error", "denied"] as const;
    for (const phase of phases) {
      for (const question of [true, false]) {
        const gates = auditGatesOf({ phase, customInvalid: false, rows: phase === "ready" ? 3 : 0, question });
        const titles = [
          gates.exportCsv.title,
          gates.exportFiltered.title,
          gates.copyFilter.title,
          gates.copyLink.title,
          gates.toggle.title,
          gates.retry.title,
          gates.copyFilterRule,
        ];
        for (const title of titles) {
          expect(title).not.toMatch(/\/agent-api|console\.|audit-events|aud01|aud5|audE|audG/);
          expect(title).not.toMatch(/\b40[0-9]\b|\b500\b/);
        }
      }
    }
  });
});
