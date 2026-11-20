import { describe, expect, it } from "vitest";
import { isConsoleShellPath, resolvePageTitle } from "./resolve-page-title";
import type { Translations } from "@/i18n/types";

// Minimal translations stub — only the fields resolvePageTitle touches.
// Nav values are intentionally non-English: proves the resolver consumes t
// instead of returning hard-coded English (design lane ③).
const t = {
  app: {
    webUi: "Web UI",
    nav: {
      analytics: "分析",
      chat: "对话",
      config: "配置",
      cron: "定时任务",
      documentation: "文档",
      keys: "密钥",
      logs: "日志",
      models: "模型",
      profiles: "多Agent配置",
      plugins: "插件管理",
      sessions: "会话",
      skills: "技能",
      files: "文件",
      mcp: "MCP",
      channels: "渠道",
      webhooks: "Webhook",
      pairing: "配对",
      system: "系统",
      runs: "运行",
      tasks: "任务",
      collaboration: "协作",
    },
  },
} as unknown as Translations;

describe("resolvePageTitle", () => {
  it("uses i18n nav keys for translated routes", () => {
    expect(resolvePageTitle("/sessions", t, [])).toBe("会话");
    expect(resolvePageTitle("/env", t, [])).toBe("密钥");
  });

  it("resolves former English-literal routes through t", () => {
    expect(resolvePageTitle("/files", t, [])).toBe("文件");
    expect(resolvePageTitle("/pairing", t, [])).toBe("配对");
    expect(resolvePageTitle("/system", t, [])).toBe("系统");
  });

  it("falls back to the historical English literal when t lacks the key", () => {
    const partial = {
      app: { webUi: "Web UI", nav: {} },
    } as unknown as Translations;
    expect(resolvePageTitle("/mcp", partial, [])).toBe("MCP");
    expect(resolvePageTitle("/channels", partial, [])).toBe("Channels");
  });

  it("maps registered non-console residuals to Chinese, not capitalize", () => {
    expect(resolvePageTitle("/metrics", t, [])).toBe("运行分析");
    expect(resolvePageTitle("/audit", t, [])).toBe("审计事件");
    expect(resolvePageTitle("/calendar", t, [])).toBe("日历");
  });

  it("prefers plugin tab labels", () => {
    expect(
      resolvePageTitle("/kanban", t, [{ path: "/kanban", label: "Kanban" }]),
    ).toBe("Kanban");
  });

  it("falls back to capitalized path segment for unknown routes", () => {
    expect(resolvePageTitle("/whatever", t, [])).toBe("Whatever");
  });

  it("treats root as sessions and trailing slashes as equivalent", () => {
    expect(resolvePageTitle("/", t, [])).toBe("会话");
    expect(resolvePageTitle("/mcp/", t, [])).toBe("MCP");
  });
});

describe("isConsoleShellPath (design lane ③ breadcrumb takeover)", () => {
  it("is true for the 8 console module roots and their detail/view forms", () => {
    for (const path of [
      "/overview",
      "/employees",
      "/work",
      "/approvals",
      "/identity",
      "/knowledge",
      "/capabilities",
      "/system",
      "/employees/emp_001",
      "/employees/emp_001/config",
    ]) {
      expect(isConsoleShellPath(path)).toBe(true);
    }
  });

  it("is false for native and redirect-only surfaces that keep the bar title", () => {
    // compat-module rows stay native under App's authority (sessions) or
    // render standalone module pages whose title bar shows Chinese via t
    // (metrics/audit are covered by RESIDUAL_ZH, not the shell takeover).
    for (const path of [
      "/sessions",
      "/metrics",
      "/audit",
      "/cron",
      "/models",
      "/channels",
      "/files",
      "/chat",
      "/whatever",
      "/",
    ]) {
      expect(isConsoleShellPath(path)).toBe(false);
    }
  });
});
