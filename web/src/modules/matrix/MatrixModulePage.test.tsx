// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const fetchJSON = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ fetchJSON }));

// @nous-research/ui ships .webp assets that break the node/jsdom vitest run.
vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    ...rest
  }: {
    children?: ReactNode;
    [key: string]: unknown;
  }) => (
    <button type="button" {...(rest as Record<string, unknown>)}>
      {children}
    </button>
  ),
  Card: ({
    children,
    ...rest
  }: {
    children?: ReactNode;
    [key: string]: unknown;
  }) => (
    <div {...(rest as Record<string, unknown>)}>{children}</div>
  ),
  CardContent: ({
    children,
    ...rest
  }: {
    children?: ReactNode;
    [key: string]: unknown;
  }) => (
    <div {...(rest as Record<string, unknown>)}>{children}</div>
  ),
}));

import { MatrixModulePage } from "./MatrixModulePage";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.resetAllMocks();
});

async function renderPage() {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/matrix"]}>
        <MatrixModulePage />
      </MemoryRouter>,
    );
  });
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function missing(requestId: string | null): ApiError {
  return new ApiError("这块数据还没接入（后台尚未提供该数据源）。", {
    status: 404,
    body: '{"detail":"Not Found"}',
    url: "/agent-api/api/v1/matrix/employees",
    ...(requestId ? { requestId } : {}),
  });
}

function expired(requestId: string): ApiError {
  return new ApiError(
    "需要登录：这个页面的登录状态已经失效。重新登录后就能继续查看。",
    {
      status: 401,
      body: '{"error":"unauthenticated"}',
      url: "/agent-api/api/v1/matrix/employees",
      requestId,
    },
  );
}

describe("MatrixModulePage (R7.1 item 2 — live endpoint, no fixture fallback)", () => {
  it("fetches the live matrix endpoint", async () => {
    fetchJSON.mockResolvedValue({ employees: [], capabilities: [] });
    await renderPage();
    expect(fetchJSON).toHaveBeenCalledWith("/agent-api/api/v1/matrix/employees");
  });

  it("a 404 stays an honest not-connected state: no fixture table, request id shown", async () => {
    fetchJSON.mockRejectedValue(missing("req-77"));
    await renderPage();
    const text = container.textContent ?? "";
    expect(container.querySelector('[data-testid="matrix-denied"]')).not.toBeNull();
    expect(text).toContain("请求编号：req-77");
    expect(text).not.toContain("示例数据");
    expect(text).not.toContain("还没接上，这张表");
    expect(container.querySelector("[data-fixture='1']")).toBeNull();
    expect(container.querySelector('[data-testid="matrix-fixture-note"]')).toBeNull();
    expect(container.querySelector('[data-testid="matrix-summary"]')).toBeNull();
  });

  it("an anonymous 401 renders the login-required state with retry and exit", async () => {
    fetchJSON.mockRejectedValue(expired("req-401"));
    await renderPage();
    const text = container.textContent ?? "";
    expect(container.querySelector('[data-testid="matrix-error"]')).not.toBeNull();
    expect(text).toContain("需要登录");
    expect(text).not.toContain("unauthenticated");
    expect(text).toContain("请求编号：req-401");
    expect(container.querySelector('[data-testid="matrix-error-retry"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="auth-reload-exit"]')).not.toBeNull();
    expect(container.querySelector("[data-fixture='1']")).toBeNull();
  });
});
