// @vitest-environment node
// Pure readers for the two real routes: absent values stay absent (never 0),
// unknown status stays 待核实, and credentials are a state word, never a value.

import { describe, expect, it } from "vitest";

import {
  GAP,
  SERVERS_PATH,
  STATUS_LABEL,
  TOOLSETS_PATH,
  beijingMinute,
  isDenied,
  isMissingRoute,
  readServers,
  readToolsets,
  readFailure,
  type FailureInfo,
} from "./tools";

describe("routes", () => {
  it("uses the real same-origin Hermes dashboard routes", () => {
    expect(TOOLSETS_PATH).toBe("/agent-api/api/tools/toolsets");
    expect(SERVERS_PATH).toBe("/agent-api/api/mcp/servers");
    expect(GAP).toBe("GAP-04");
  });
});

describe("status mapping", () => {
  it("only 403 is denied; 404 is a missing route, not a permission state", () => {
    expect(isDenied(403)).toBe(true);
    expect(isDenied(404)).toBe(false);
    expect(isMissingRoute(404)).toBe(true);
    expect(isMissingRoute(403)).toBe(false);
  });

  it("unknown is 待核实, never a made-up state", () => {
    expect(STATUS_LABEL.enabled).toBe("启用");
    expect(STATUS_LABEL.disabled).toBe("停用");
    expect(STATUS_LABEL.unknown).toBe("待核实");
  });
});

describe("toolset reader", () => {
  it("maps name, status, credential and last-call gap", () => {
    const rows = readToolsets([
      { name: "web", label: "Web", enabled: true, configured: true, tools: ["web_search"] },
      { name: "kanban", label: "Kanban", enabled: false, configured: false, tools: ["kanban_create"] },
      { name: "mystery", label: "Mystery", tools: ["mystery_tool"] },
    ]);
    expect(rows?.map((row) => [row.name, row.status, row.credential])).toEqual([
      ["网页搜索", "enabled", "configured"],
      ["创建看板", "disabled", "missing"],
      ["mystery tool", "unknown", "unknown"],
    ]);
    expect(rows?.[0]?.lastUsed).toBeNull();
    expect(rows?.[0]?.lastUsedReason).toContain("没有提供最近调用时间");
    expect(rows?.[0]?.detail.join(" ")).toContain("web_search");
  });

  it("reads an upstream last-call timestamp as Beijing wall clock", () => {
    const rows = readToolsets([{ name: "web", tools: ["web_search"], last_used_at: "2026-11-19T01:20:00Z" }]);
    expect(rows?.[0]?.lastUsed).toBe("2026-11-19 09:20");
    expect(rows?.[0]?.lastUsedReason).toBeNull();
  });

  it("rejects a non-list answer rather than treating it as empty", () => {
    expect(readToolsets({ items: [] })).toBeNull();
    expect(readToolsets(null)).toBeNull();
    expect(readToolsets([])).toEqual([]);
  });
});

describe("MCP reader", () => {
  it("maps transport and enabled state, and never carries env values", () => {
    const rows = readServers({
      servers: [
        { name: "文档检索", transport: "http", enabled: true, env: { API_KEY: "secret" } },
        { name: "旧连接", transport: "stdio", enabled: false },
        { name: "未知连接" },
      ],
    });
    expect(rows?.map((row) => row.type)).toEqual(["MCP · HTTP 服务", "MCP · 本地进程", "MCP · 传输方式未知"]);
    expect(rows?.map((row) => row.status)).toEqual(["enabled", "disabled", "unknown"]);
    expect(JSON.stringify(rows)).not.toContain("secret");
    expect(rows?.[0]?.credential).toBe("configured");
    expect(rows?.[1]?.credential).toBe("unknown");
    expect(readServers({ servers: [{ name: "关闭凭据", configured: false }] })?.[0]?.credential).toBe("missing");
  });

  it("rejects a malformed answer instead of inventing an empty list", () => {
    expect(readServers({ status: "ok" })).toBeNull();
    expect(readServers([])).toBeNull();
  });
});

describe("time", () => {
  it("renders Beijing wall clock to the minute", () => {
    expect(beijingMinute("2026-11-19T01:20:00Z")).toBe("2026-11-19 09:20");
    expect(beijingMinute("yesterday")).toBeNull();
  });
});

describe("failure wording", () => {
  const info = (status: number): FailureInfo => ({ status, requestId: null, technical: null });
  it("keeps engineering codes out of the sentence", () => {
    expect(readFailure(new Error("x"), info(401)).sentence).toContain("登录");
    expect(readFailure(new Error("x"), info(500)).sentence).not.toMatch(/500|HTTP/);
    expect(readFailure(new Error("x"), info(0)).sentence).toContain("连不上");
  });
});
