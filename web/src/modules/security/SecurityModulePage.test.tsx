// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));
vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { outlined?: boolean }) => {
    const { outlined, ...rest } = props; void outlined; return <button {...rest}>{children}</button>;
  },
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));
import SecurityModulePage from "./SecurityModulePage";

let root: Root | null = null;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => { api.fetchJSON.mockReset(); });
afterEach(async () => { await act(async () => root?.unmount()); root = null; document.body.replaceChildren(); });

async function render(entry = "/system?tab=security") {
  document.body.replaceChildren();
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => { root?.render(<MemoryRouter initialEntries={[entry]}><SecurityModulePage /></MemoryRouter>); });
  for (let i = 0; i < 5; i += 1) await act(async () => {});
}
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`);

const config = {
  security: {
    session: {
      sessionMinutes: 30,
      maxConcurrentSessions: 1,
      twoFactor: true,
      asOf: "2026-11-20T01:20:00Z",
    },
    secrets: { modelKeyConfigured: true, channelKeyConfigured: false },
  },
};

const audit = {
  events: [{
    eventId: "ev_0123456789abcdef0123456789abcdef",
    action: "grant.created",
    occurredAt: "2026-11-19T03:15:00Z",
    resource: { type: "grant", id: "gr_1234567890ABCDEF" },
    correlationId: "req-12345678",
  }],
};

function answer() {
  api.fetchJSON.mockImplementation((url: string) => {
    if (url.includes("/api/config")) return Promise.resolve(config);
    if (url.includes("action=grant.created")) return Promise.resolve(audit);
    return Promise.resolve({ events: [] });
  });
}

describe("SecurityModulePage", () => {
  it("renders session and secret states, source/asOf and real high-risk rows", async () => {
    answer();
    await render();
    expect(q("sec5-page")).toBeTruthy();
    expect(document.querySelectorAll('[data-testid="sec5-page"]')).toHaveLength(1);
    expect(q("sec5-state-session")?.textContent).toBe("已配置");
    expect(q("sec5-state-concurrent")?.textContent).toBe("已配置");
    expect(q("sec5-state-twoFactor")?.textContent).toBe("已配置");
    expect(q("sec5-state-channelKey")?.textContent).toBe("未配置");
    expect(q("sec5-state-auditKey")?.textContent).toBe("未知");
    expect(document.body.textContent).toContain("数据截至 2026-11-20 09:20");
    expect(document.body.textContent).toContain("新建授权");
    expect(document.body.textContent).toContain("grant · 90ABCDEF");
    expect(q("sec5-risk-row")).toBeTruthy();
    expect(q("sec5-risk-request-id")?.textContent).toContain("req-1234");
    expect(q("sec5-risk-request-id")?.textContent).not.toContain("req-12345678");
    expect(q("sec5-risk-request-id")?.getAttribute("title")).toBe("req-12345678");
    for (const id of ["session", "mfa", "rotate"]) {
      const button = q(`sec5-planned-${id}`) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      expect(button.getAttribute("aria-disabled")).toBe("true");
      expect(button.getAttribute("data-planned")).toBe("true");
      expect(button.getAttribute("title")).toBeTruthy();
    }
  });

  it("uses the same neutral 未接入 body for 403 and 404 and never leaks a path", async () => {
    for (const status of [403, 404]) {
      api.fetchJSON.mockImplementation((url: string) => Promise.reject(new ApiError("hidden", { status, body: "{}", url })));
      await render();
      expect(q("sec5-gap")?.textContent).toContain("安全配置未接入");
      expect(q("sec5-gap")?.getAttribute("title")).toBe("GAP-SEC5-01");
      expect(q("sec5-risk-gap")).toBeTruthy();
      expect(document.body.textContent).not.toContain("GAP-");
      expect(document.body.textContent).not.toContain("/api/");
      await act(async () => root?.unmount()); root = null;
    }
  });

  it("shows a human error, copyable request id and retry on 500", async () => {
    api.fetchJSON.mockImplementation((url: string) => Promise.reject(new ApiError("boom", { status: 500, body: "{}", url, requestId: "req-sec-5" })));
    await render();
    expect(q("sec5-error")?.textContent).toContain("req-sec-");
    expect(q("sec5-request-id")?.getAttribute("title")).toBe("req-sec-5");
    expect(q("sec5-error")?.querySelector('[data-testid="sec5-request-id"]')).toBeTruthy();
    expect(q("sec5-error")?.textContent).toContain("重试");
    expect(document.body.textContent).not.toContain("HTTP");
  });

  it("renders forced loading without fetching", async () => {
    window.history.replaceState({}, "", "/system?tab=security&state=loading");
    await render("/system?tab=security&state=loading");
    expect(q("sec5-loading")).toBeTruthy();
    expect(api.fetchJSON).not.toHaveBeenCalled();
    window.history.replaceState({}, "", "/");
  });
});
