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

import { MATRIX_FIXTURE, employeeLabel, readMatrixPayload } from "./matrix";

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
    url: "/agent-api/api/matrix",
    ...(requestId ? { requestId } : {}),
  });
}

function forbidden(requestId: string): ApiError {
  return new ApiError("forbidden", {
    status: 403,
    body: '{"detail":"permission denied"}',
    url: "/agent-api/api/matrix",
    requestId,
  });
}

function expired(requestId: string): ApiError {
  return new ApiError(
    "需要登录：这个页面的登录状态已经失效。重新登录后就能继续查看。",
    {
      status: 401,
      body: '{"error":"unauthenticated"}',
      url: "/agent-api/api/matrix",
      requestId,
    },
  );
}

// The heading used to read 「live endpoint, no fixture fallback」. P0 n3 reopened
// that fallback for 404／连不上 only, so the honest title of this block is what it
// now checks: live answers stay unlabelled, and a sample answer must say so.
describe("MatrixModulePage (R7.1 item 2, restated by P0 n3 — live is live, sample is labelled)", () => {
  it("fetches the live matrix endpoint", async () => {
    fetchJSON.mockResolvedValue({ employees: [], capabilities: [] });
    await renderPage();
    expect(fetchJSON).toHaveBeenCalledWith("/agent-api/api/matrix");
  });

  // 2026-11-24 结构性 P0：模块内不许再有第二排 tab。视角切换是普通 <nav> 链接，
  // 当前视角用 aria-current 标；整页 tablist 数必须为 0（唯一一排归外壳）。
  it("视角切换是普通链接：页内 0 个 tablist，当前项 aria-current", async () => {
    fetchJSON.mockResolvedValue({ employees: [], capabilities: [] });
    await renderPage();
    expect(container.querySelectorAll('[role="tablist"]')).toHaveLength(0);
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(0);
    const people = container.querySelector('[data-testid="mtx5-view-people"]');
    expect(people?.tagName).toBe("A");
    expect(people?.getAttribute("aria-current")).toBe("page");
    expect(people?.getAttribute("href")).not.toContain("view=");
    const resource = container.querySelector('[data-testid="mtx5-view-resource"]');
    expect(resource?.tagName).toBe("A");
    expect(resource?.getAttribute("aria-current")).toBeNull();
    expect(resource?.getAttribute("href")).toContain("view=resource");
  });

  // 复述，不删除：这条腿钉的是 R7.1 item 2「404 不许出样例表」。P0 n3 按
  // PRD §12 把这扇门反过来接上（404／连不上 = 接口未接入 → 样例门），所以
  // 原断言里「不许有样例」的一半改成「样例必须被明确标成样例」：根节点
  // data-fixture、示例数据角标、说明条、失败原因与那一次读取的请求编号都要在
  // 面上；「不许用样例冒充真数据」这一半仍然成立，见下面 (a)(b) 两条。
  it("a 404 opens the fixture door: the table is reviewable and unmistakably sample data", async () => {
    fetchJSON.mockRejectedValue(missing("req-77"));
    await renderPage();
    const text = container.textContent ?? "";
    expect(container.querySelector('[data-testid="mtx5-denied"]')).toBeNull();
    expect(
      container.querySelector('[data-testid="mtx5-module"]')?.getAttribute("data-fixture"),
    ).toBe("1");
    expect(text).toContain("示例数据");
    expect(container.querySelector('[data-testid="mtx5-fixture-note"]')).not.toBeNull();
    expect(text).toContain("真实矩阵接口还没接上");
    // 主任务（组织级覆盖缺口）在当前构建里可达：汇总与表体都渲出来了。
    expect(container.querySelector('[data-testid="mtx5-summary"]')).not.toBeNull();
    expect(text).toContain("接口未接入");
    expect(text).toContain("请求编号：req-77");
  });

  it("设计车道 ①: an anonymous 401 falls back to the generic error state — no per-page expiry card", async () => {
    fetchJSON.mockRejectedValue(expired("req-401"));
    await renderPage();
    const text = container.textContent ?? "";
    expect(container.querySelector('[data-testid="mtx5-error"]')).not.toBeNull();
    // 「会话已过期」只由全站 SessionExpiredBanner 说一次：这张卡不再重复它，
    // 也不带自己的重新登录出口。
    expect(text).not.toContain("需要登录");
    expect(text).not.toContain("登录状态已失效");
    expect(text).toContain("这份矩阵没能读出来");
    expect(text).not.toContain("unauthenticated");
    expect(text).toContain("请求编号：req-401");
    expect(container.querySelector('[data-testid="mtx5-error-retry"]')).not.toBeNull();
    expect(text).toContain("重试");
    expect(container.querySelector('[data-testid="auth-reload-exit"]')).toBeNull();
    expect(container.querySelector("[data-fixture='1']")).toBeNull();
  });

  it("copies the request id with a click and reports the result (R9 item 1)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    fetchJSON.mockRejectedValue(expired("req-copy-9"));
    await renderPage();
    const btn = container.querySelector<HTMLButtonElement>(
      '[data-testid="req-copy"]',
    );
    if (!btn) throw new Error("req-copy button is missing");
    expect(btn.textContent).toContain("复制");
    await act(async () => {
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(writeText).toHaveBeenCalledWith("req-copy-9");
    const state = container.querySelector('[data-testid="req-copy-state"]');
    expect(state?.textContent).toContain("已复制");
  });

  it("says so when copying fails (R9 item 1)", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    fetchJSON.mockRejectedValue(missing("req-fail-1"));
    await renderPage();
    const btn = container.querySelector<HTMLButtonElement>(
      '[data-testid="req-copy"]',
    );
    if (!btn) throw new Error("req-copy button is missing");
    await act(async () => {
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.textContent).toContain("复制失败，请手动选择");
  });
});

describe("MatrixModulePage (P0 n3 — PRD §12 fixture door: sample data is reviewable and always labelled)", () => {
  // 三条换真门判据，逐条可在代码/测试里核对（代码侧见
  // MatrixModulePage.tsx 的 404/0 分支注释）：
  //  (a) 200 且解析成功 = 真数据：readMatrixPayload 一律盖
  //      origin:'matrix'，角标／说明条／data-fixture 自动消失；
  //  (b) 403 权限类绝不落样例；
  //  (c) 角标只有 payload.origin 一个来源，摘角标只能走真门
  //      （DONE.md:49「删掉 fixture 兜底分支即可」）。
  const fixtureCells = MATRIX_FIXTURE.employees.flatMap((employee) => employee.cells);
  const tally = {
    granted: fixtureCells.filter((cell) => cell.state === "granted").length,
    denied: fixtureCells.filter((cell) => cell.state === "denied").length,
    unknown: fixtureCells.filter((cell) => cell.state === "unknown").length,
  };

  it("(a) a live 200 leaves no badge, no note and no fixture attribute", async () => {
    fetchJSON.mockResolvedValue({
      capabilities: [{ capabilityId: "cap.run.inspect", label: "查看运行" }],
      employees: [
        { employeeId: "emp_aaaabbbbcccc", name: "小鲤", cells: { "cap.run.inspect": true } },
      ],
    });
    await renderPage();
    const text = container.textContent ?? "";
    expect(text).not.toContain("示例数据");
    expect(container.querySelector("[data-fixture='1']")).toBeNull();
    expect(container.querySelector('[data-testid="mtx5-fixture-note"]')).toBeNull();
    expect(container.querySelector('[data-testid="mtx5-fixture-reason"]')).toBeNull();
    expect(container.querySelector('[data-testid="mtx5-summary"]')).not.toBeNull();
    // 判据 (a) 的根据本身：解析成功就是真代次，不由 UI 猜。
    expect(readMatrixPayload({ employees: [], capabilities: [] }).origin).toBe("matrix");
  });

  it("(b) a 403 is a permission state: no fixture table, and the copy says permission only", async () => {
    fetchJSON.mockRejectedValue(forbidden("req-403"));
    await renderPage();
    const text = container.textContent ?? "";
    expect(container.querySelector('[data-testid="mtx5-denied"]')).not.toBeNull();
    expect(text).toContain("你的账号还没有查看这份矩阵的权限");
    expect(text).not.toContain("这页不存在");
    expect(text).not.toContain("示例数据");
    expect(container.querySelector("[data-fixture='1']")).toBeNull();
    expect(container.querySelector('[data-testid="mtx5-fixture-note"]')).toBeNull();
    expect(container.querySelector('[data-testid="mtx5-summary"]')).toBeNull();
    expect(text).toContain("请求编号：req-403");
  });

  it("an unreachable endpoint opens the same door, names the reason and invents no request id", async () => {
    fetchJSON.mockRejectedValue(new Error("ECONNREFUSED"));
    await renderPage();
    const text = container.textContent ?? "";
    expect(
      container.querySelector('[data-testid="mtx5-module"]')?.getAttribute("data-fixture"),
    ).toBe("1");
    expect(text).toContain("示例数据");
    expect(text).toContain("网络或网关没有应答");
    expect(container.querySelector('[data-testid="req-copy-fallback"]')).not.toBeNull();
    expect(text).toContain("未记录编号");
  });

  it("the fixture door really is the main task: every sample employee by every capability", async () => {
    fetchJSON.mockRejectedValue(missing("req-77"));
    await renderPage();
    expect(
      container.querySelectorAll('[data-testid^="mtx5-row-emp_fixture"]'),
    ).toHaveLength(MATRIX_FIXTURE.employees.length);
    expect(container.querySelectorAll('[data-testid^="mtx5-cell-emp_fixture"]')).toHaveLength(
      MATRIX_FIXTURE.employees.length * MATRIX_FIXTURE.capabilities.length,
    );
    const text = container.textContent ?? "";
    expect(text).toContain(
      `已授权 ${tally.granted} / 未授权 ${tally.denied} / 待核实 ${tally.unknown}`,
    );
    // 样例的采集时刻是 null：读取时间不编。
    expect(text).toContain("读取于 —");
    // 「待核实」仍然按 GAP 呈现，不猜授权。
    expect(
      container.querySelector('[data-gap="1"]'),
    ).not.toBeNull();
  });
});

// P0 n3 收口：换真门的三条判据必须可点验，不该靠读文案推断。根节点因此
// 带三个由 payload/phase 派生的标记（data-door / data-state /
// data-badge-source），每一条都在下面单独一次挂载里读，互不串状态。
describe("MatrixModulePage (P0 n3 — the three real-gate criteria are readable off the root node)", () => {
  async function renderAt(entry: string): Promise<void> {
    // A fresh root per read: re-rendering the same root reconciles instead of
    // mounting, so the load effect would not re-run and the marks read stale.
    await act(async () => {
      root.unmount();
    });
    container.replaceChildren();
    root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[entry]}>
          <MatrixModulePage />
        </MemoryRouter>,
      );
    });
    for (let step = 0; step < 8; step += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  }

  function marks(): Record<string, string | null> {
    const node = container.querySelector('[data-testid="mtx5-module"]');
    return {
      fixture: node?.getAttribute("data-fixture") ?? null,
      door: node?.getAttribute("data-door") ?? null,
      state: node?.getAttribute("data-state") ?? null,
      badgeSource: node?.getAttribute("data-badge-source") ?? null,
    };
  }

  it("判据一：读端点没接上才进样例门，标记直接点名那条路", async () => {
    fetchJSON.mockRejectedValue(missing("req-77"));
    await renderAt("/matrix");
    expect(MATRIX_FIXTURE.origin).toBe("fixture");
    expect(marks()).toEqual({
      fixture: "1",
      door: "fixture-preview",
      state: "ready",
      badgeSource: "payload.origin",
    });
    // 门里真的摆了表，不是因为什么也没渲才没角标。
    expect(
      container.querySelectorAll('[data-testid^="mtx5-row-emp_fixture"]'),
    ).toHaveLength(MATRIX_FIXTURE.employees.length);
    expect(container.textContent).toContain("示例数据");
  });

  it("判据一另一半：真数据到达时同一组标记自己翻回去，不带样例痕迹", async () => {
    fetchJSON.mockImplementation((url: unknown) =>
      String(url).endsWith("/api/matrix")
        ? Promise.resolve({
            employees: [{ employeeId: "emp_live0000aaaa", name: "小鲤" }],
            capabilities: [{ capabilityId: "cap_live0000bbbb", label: "查看运行" }],
          })
        : Promise.resolve({ items: [] }),
    );
    await renderAt("/matrix");
    expect(marks()).toEqual({
      fixture: null,
      door: "live",
      state: "ready",
      badgeSource: null,
    });
    expect(container.querySelector('[data-testid="mtx5-row-emp_live0000aaaa"]')).not.toBeNull();
    expect(container.textContent).not.toContain("示例数据");
    expect(readMatrixPayload({ employees: [], capabilities: [] }).origin).toBe("matrix");
  });

  it("判据二：角标只有一个来源，403 权限态绝不借这扇门", async () => {
    fetchJSON.mockRejectedValue(forbidden("req-403"));
    await renderAt("/matrix");
    expect(marks()).toEqual({
      fixture: null,
      door: "no-payload",
      state: "denied",
      badgeSource: null,
    });
    expect(container.querySelector('[data-testid="mtx5-denied"]')).not.toBeNull();
    expect(container.textContent).not.toContain("示例数据");
    // 连不上（status 0）与 404 同形：同一扇门、同一组标记，不另立口径。
    fetchJSON.mockReset();
    fetchJSON.mockRejectedValue(new Error("ECONNREFUSED"));
    await renderAt("/matrix");
    expect(marks().door).toBe("fixture-preview");
    expect(marks().badgeSource).toBe("payload.origin");
    expect(container.textContent).toContain("网络或网关没有应答");
  });

  it("判据三：四态各有句柄与面，无后端也能逐态复核", async () => {
    const handles = [
      { state: "loading", face: "mtx5-loading" },
      { state: "empty", face: "mtx5-empty" },
      { state: "error", face: "mtx5-error" },
      { state: "denied", face: "mtx5-denied" },
    ] as const;
    for (const handle of handles) {
      fetchJSON.mockReset();
      fetchJSON.mockResolvedValue({ employees: [], capabilities: [] });
      await renderAt("/matrix?state=" + handle.state);
      expect(marks().state).toBe(handle.state);
      expect(container.querySelector('[data-testid="' + handle.face + '"]')).not.toBeNull();
      // 预览句柄只摆出那一态，不冒充样例门。
      expect(marks().door).toBe("no-payload");
      expect(marks().badgeSource).toBeNull();
    }
  });
});

describe("MatrixModulePage (R272 — the 375 layout pins the identity column inside the scroll shell)", () => {
  it("freezes the header and every row's first cell so sideways scroll keeps a row readable", async () => {
    fetchJSON.mockRejectedValue(missing("req-77"));
    await renderPage();

    const shell = container.querySelector('[data-testid="mtx5-scroll"]');
    expect(shell).not.toBeNull();

    // The header row is the second sticky axis; its own identity cell is where the
    // two axes cross, so it must carry the pin too.
    const head = container.querySelector('[data-testid="mtx5-head"]');
    expect(head).not.toBeNull();
    expect(head?.classList.contains("mtx5-head")).toBe(true);
    expect(head?.firstElementChild?.classList.contains("mtx5-pin")).toBe(true);

    const rows = [...container.querySelectorAll('[data-testid^="mtx5-row-"]')];
    expect(rows.length).toBe(MATRIX_FIXTURE.employees.length);
    for (const row of rows) {
      // The pin only means something inside the shell: outside it, the cell would
      // stick to the page and the page would be the thing that scrolls.
      expect(shell?.contains(row)).toBe(true);
      expect(row.firstElementChild?.classList.contains("mtx5-pin")).toBe(true);
    }
  });
});

describe("MatrixModulePage (R273 — the row owner is the exit, the cells stay read-only)", () => {
  async function renderAt(entry: string): Promise<void> {
    // A fresh root per read: re-rendering the same root reconciles instead of
    // mounting, so the load effect would not re-run.
    await act(async () => {
      root.unmount();
    });
    container.replaceChildren();
    root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[entry]}>
          <MatrixModulePage />
        </MemoryRouter>,
      );
    });
    for (let step = 0; step < 8; step += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  }

  function rows(): Element[] {
    return [...container.querySelectorAll('[data-testid^="mtx5-row-"]')];
  }

  it("links every row to the employee that row is about", async () => {
    fetchJSON.mockRejectedValue(missing("req-77"));
    await renderAt("/matrix");
    expect(rows()).toHaveLength(MATRIX_FIXTURE.employees.length);
    // The link carries its own testid namespace: a `mtx5-row-` prefix here would
    // have been counted as a second row by the selector above.
    for (const employee of MATRIX_FIXTURE.employees) {
      const owner = container.querySelector(`[data-testid="mtx5-owner-${employee.employeeId}"]`);
      expect(owner).not.toBeNull();
      expect((owner as HTMLElement).tagName).toBe("A");
      expect(owner?.getAttribute("href")).toBe(`/employees/${encodeURIComponent(employee.employeeId)}`);
      expect((owner?.textContent ?? "").trim()).toBe(employeeLabel(employee));
    }
  });

  it("points the resource view at the capability page without inventing a row locator", async () => {
    fetchJSON.mockRejectedValue(missing("req-77"));
    await renderAt("/matrix?view=resource");
    const owners = [...container.querySelectorAll('[data-testid^="mtx5-owner-"]')];
    expect(owners.length).toBeGreaterThan(0);
    for (const owner of owners) {
      expect(owner.getAttribute("href")).toBe("/capabilities");
      expect(owner.getAttribute("href") ?? "").not.toContain("row=");
    }
  });

  it("keeps the cells read-only: no link and no button inside a cell", async () => {
    fetchJSON.mockRejectedValue(missing("req-77"));
    await renderAt("/matrix");
    const cells = [...container.querySelectorAll('[data-testid^="mtx5-cell-"]')];
    expect(cells).toHaveLength(MATRIX_FIXTURE.employees.length * MATRIX_FIXTURE.capabilities.length);
    for (const cell of cells) {
      expect(cell.querySelector("a")).toBeNull();
      expect(cell.querySelector("button")).toBeNull();
    }
    // the sample door still says what it is, with the new links inside it
    expect(container.querySelector('[data-testid="mtx5-module"]')?.getAttribute("data-fixture")).toBe("1");
  });
});
