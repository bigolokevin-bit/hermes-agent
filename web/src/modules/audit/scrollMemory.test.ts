// @vitest-environment jsdom
/**
 * audM — 滚动位的存取与指纹。断言的是：键只含「读法」不含导航态（打开详情不该
 * 看起来像换了问题）、换问法就换键、存坏或存储不可用都只是「没有位置」，
 * 绝不假装记住了什么。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  applyScroll,
  clearScrollMark,
  readScrollMark,
  readScrollY,
  saveScrollMark,
  scrollFingerprint,
} from "./scrollMemory";

const paramsOf = (search: string): URLSearchParams => new URLSearchParams(search);

describe("audM - the scroll mark", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    window.sessionStorage.clear();
  });

  it("keys the mark by the question, not by the navigation state", () => {
    const list = paramsOf("window=24h&type=task.created&actor=employee-api");
    const opened = paramsOf("window=24h&type=task.created&actor=employee-api&detail=evt_1&preview=evt_1&event=evt_1&tech=evt_2");
    expect(scrollFingerprint(opened)).toBe(scrollFingerprint(list));
    // the page size and the cursor stack ARE the question
    expect(scrollFingerprint(paramsOf("limit=25"))).not.toBe(scrollFingerprint(paramsOf("limit=100")));
    expect(scrollFingerprint(paramsOf("cursor=a"))).not.toBe(scrollFingerprint(paramsOf("cursor=a&cursor=b")));
    expect(scrollFingerprint(paramsOf("cursor=a&cursor=b"))).toContain("cursor=a,b");
    // a custom pair is part of the fingerprint: the same label, different span
    expect(scrollFingerprint(paramsOf("window=custom&from=1&to=2"))).not.toBe(
      scrollFingerprint(paramsOf("window=custom&from=3&to=4")),
    );
    expect(scrollFingerprint(new URLSearchParams(""))).toBe("window=7d|from=|to=|type=|actor=|resource=|limit=|cursor=");
  });

  it("saves, reads back and spends a mark", () => {
    const key = scrollFingerprint(paramsOf("window=7d"));
    expect(readScrollMark(key)).toBeNull();
    saveScrollMark(key, { y: 480, rowKey: "evt_1" });
    expect(readScrollMark(key)).toEqual({ y: 480, rowKey: "evt_1" });
    clearScrollMark(key);
    expect(readScrollMark(key)).toBeNull();
  });

  it("another question never sees this question's place", () => {
    const before = scrollFingerprint(paramsOf("window=24h"));
    saveScrollMark(before, { y: 120, rowKey: "evt_1" });
    const after = scrollFingerprint(paramsOf("window=30d"));
    expect(readScrollMark(after)).toBeNull();
  });

  it("a broken or absent mark is no mark, and nothing is invented", () => {
    const key = scrollFingerprint(paramsOf("window=7d"));
    window.sessionStorage.setItem(`audm-scroll:${key}`, "{not json");
    expect(readScrollMark(key)).toBeNull();
    window.sessionStorage.setItem(`audm-scroll:${key}`, JSON.stringify({ y: -5, rowKey: "evt_1" }));
    expect(readScrollMark(key)).toBeNull();
    window.sessionStorage.setItem(`audm-scroll:${key}`, JSON.stringify({ y: "480" }));
    expect(readScrollMark(key)).toBeNull();
    // a row nobody named still has a place to go back to
    window.sessionStorage.setItem(`audm-scroll:${key}`, JSON.stringify({ y: 12, rowKey: null }));
    expect(readScrollMark(key)).toEqual({ y: 12, rowKey: null });
  });

  it("reads the window's position as the browser reports it", () => {
    Object.defineProperty(window, "scrollY", { configurable: true, writable: true, value: 260 });
    expect(readScrollY()).toBe(260);
    Object.defineProperty(window, "scrollY", { configurable: true, writable: true, value: 0 });
    expect(readScrollY()).toBe(0);
    Object.defineProperty(window, "scrollY", { configurable: true, writable: true, value: Number.NaN });
    expect(readScrollY()).toBe(0);
  });

  it("applies a position through the browser, and never a made-up one", () => {
    const calls: number[][] = [];
    const real = window.scrollTo;
    window.scrollTo = ((x: number, y: number) => {
      calls.push([x, y]);
    }) as typeof window.scrollTo;
    try {
      applyScroll(320);
      applyScroll(Number.NaN);
      expect(calls).toEqual([[0, 320]]);
    } finally {
      window.scrollTo = real;
    }
  });

  it("survives a context that refuses storage", () => {
    const real = window.sessionStorage;
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    try {
      const key = scrollFingerprint(paramsOf("window=7d"));
      expect(() => saveScrollMark(key, { y: 10, rowKey: "evt_1" })).not.toThrow();
      expect(readScrollMark(key)).toBeNull();
      expect(() => clearScrollMark(key)).not.toThrow();
    } finally {
      Object.defineProperty(window, "sessionStorage", { configurable: true, value: real });
    }
  });
});
