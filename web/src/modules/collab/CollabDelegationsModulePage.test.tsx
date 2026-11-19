// @vitest-environment jsdom
// COLLAB list page. The assertions are about what a person can check with
// their eyes: the real route is the one asked, rows only ever come from an
// answer, 401 reads as 需要登录 (never as a failure or a zero), 403 and 404
// draw one identical body with nothing above it, and a `?state=` repro asks
// for nothing at all.

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import { CollabDelegationsModulePage } from "./CollabDelegationsModulePage";

/** Reads the router's own location, so a URL claim is measured, not assumed. */
function LocationProbe(): ReactNode {
  const location = useLocation();
  return <span data-testid="probe-location">{`${location.pathname}${location.search}`}</span>;
}

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

async function waitFor(cond: () => boolean, label = "condition"): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

async function render(entry: string, page: ReactNode = <CollabDelegationsModulePage />): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<MemoryRouter initialEntries={[entry]}>{page}</MemoryRouter>);
  });
}

const text = (): string => document.body.textContent ?? "";
const html = (): string => document.body.innerHTML;
const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const rowNodes = (): number => document.querySelectorAll("[data-testid^='col5-row-'][data-status]").length;

const DELEG_A = {
  delegationId: "dl_01ABC234DEF567",
  requestId: "req_11112222",
  fromEmployeeId: "emp_9f3a4b7c",
  fromEmployeeName: "陈可",
  toEmployeeId: "emp_5e6d7c8b",
  toEmployeeName: "李牧",
  taskId: "tk_99887766",
  status: "accepted",
  action: "handoff",
  effectiveFrom: "2026-11-01T00:00:00Z",
  scope: "整理本周巡检记录并点名缺项",
  audience: "运维组",
  expiresAt: "2999-01-01T00:00:00Z",
  source: "console",
  createdAt: "2026-11-19T02:00:00Z",
};
const DELEG_B = {
  delegationId: "dl_02ZZZ999YYY888",
  fromEmployeeId: "emp_aaaabbbb",
  status: "requested",
};

const okList = (items: unknown[]) => async (url: string) => {
  if (url.includes("/api/delegations")) return { items };
  return { items: [] };
};

beforeEach(() => {
  api.fetchJSON.mockReset();
});
afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
});

describe("the read asks the real route", () => {
  it("mounts asking /agent-api/api/delegations with the /api/ segment kept", async () => {
    api.fetchJSON.mockImplementation(okList([DELEG_A]));
    await render("/collab");
    await waitFor(() => rowNodes() === 1, "one row");
    expect(urls()[0]).toBe("/agent-api/api/delegations?limit=50");
  });

  it("asks exactly one route — there is no fallback chain to hide behind", async () => {
    api.fetchJSON.mockImplementation(okList([DELEG_A, DELEG_B]));
    await render("/collab");
    await waitFor(() => rowNodes() === 2, "two rows");
    expect(urls()).toHaveLength(1);
  });

  it("re-reads when 重新读取 is pressed, and the count line follows the answer", async () => {
    api.fetchJSON.mockImplementation(okList([DELEG_A]));
    await render("/collab");
    await waitFor(() => rowNodes() === 1, "one row");
    await act(async () => {
      document.querySelector("[data-testid='col5-refresh']")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await waitFor(() => urls().length === 2, "a second ask");
    expect(text()).toContain("本页 1 条");
  });
});

describe("what a row is allowed to say", () => {
  it("names both sides as 「姓名 · 8 位短码」 and keeps the handles in the title", async () => {
    api.fetchJSON.mockImplementation(okList([DELEG_A]));
    await render("/collab");
    await waitFor(() => rowNodes() === 1, "one row");
    expect(html()).toContain("陈可 · 9F3A4B7C");
    expect(html()).toContain("李牧 · 5E6D7C8B");
    const from = document.querySelector("[data-testid='col5-row-0-from']");
    expect(from?.getAttribute("title")).toBe("陈可 · emp_9f3a4b7c");
    // The delegation itself is quotable, but its full id never reaches the
    // surface text: it rides in the title of the short code.
    const code = document.querySelector("[data-testid='col5-row-0-code']");
    expect(code?.textContent).toBe("委托 · 34DEF567");
    expect(code?.getAttribute("title")).toBe("dl_01ABC234DEF567");
  });

  it("never lets a bare emp_ or human: handle onto the surface", async () => {
    api.fetchJSON.mockImplementation(okList([DELEG_B]));
    await render("/collab");
    await waitFor(() => rowNodes() === 1, "one row");
    expect(text()).not.toMatch(/emp_|human:|dl_/);
    expect(text()).toContain("委托员工 · AAAABBBB");
  });

  it("says 未指派 for a delegation nobody received", async () => {
    api.fetchJSON.mockImplementation(okList([DELEG_B]));
    await render("/collab");
    await waitFor(() => rowNodes() === 1, "one row");
    expect(document.querySelector("[data-testid='col5-row-0-to']")?.textContent).toBe("未指派");
  });

  it("puts the status in Chinese and the raw token only in the badge title", async () => {
    api.fetchJSON.mockImplementation(okList([DELEG_A]));
    await render("/collab");
    await waitFor(() => rowNodes() === 1, "one row");
    expect(document.querySelector("[data-testid='col5-row-0-status']")?.textContent).toBe("已接受");
    expect(text()).not.toContain("accepted");
  });

  it("renders 生效与到期 as Beijing wall clock to the minute", async () => {
    api.fetchJSON.mockImplementation(okList([DELEG_A]));
    await render("/collab");
    await waitFor(() => rowNodes() === 1, "one row");
    const effective = document.querySelector("[data-testid='col5-row-0-effective']")?.textContent ?? "";
    expect(effective).toBe("起 2026-11-01 08:00");
    const expiry = document.querySelector("[data-testid='col5-row-0-expiry']")?.textContent ?? "";
    expect(expiry).toContain("至 2999-01-01 08:00");
    expect(text()).not.toContain("2999-01-01T00:00:00Z");
  });

  it("renders 动作 in words and keeps the raw token in the title", async () => {
    api.fetchJSON.mockImplementation(okList([DELEG_A]));
    await render("/collab");
    await waitFor(() => rowNodes() === 1, "one row");
    const cell = document.querySelector("[data-testid='col5-row-0-action']");
    expect(cell?.textContent).toBe("交接");
    expect(cell?.getAttribute("title")).toBe("handoff");
    expect(text()).not.toContain("handoff");
  });

  it("says 未记录 when the answer carried no action or expiry", async () => {
    api.fetchJSON.mockImplementation(okList([DELEG_B]));
    await render("/collab");
    await waitFor(() => rowNodes() === 1, "one row");
    expect(document.querySelector("[data-testid='col5-row-0-action']")?.textContent).toBe("未记录");
    expect(document.querySelector("[data-testid='col5-row-0-effective']")?.textContent).toBe("—");
    expect(document.querySelector("[data-testid='col5-row-0-expiry']")?.textContent).toBe("—");
  });

  it("marks an expiry that has passed instead of leaving a bare stamp", async () => {
    api.fetchJSON.mockImplementation(okList([{ ...DELEG_A, expiresAt: "2020-01-01T00:00:00Z" }]));
    await render("/collab");
    await waitFor(() => rowNodes() === 1, "one row");
    expect(document.querySelector("[data-testid='col5-row-0-validity-note']")?.textContent).toBe("已到期");
  });

  it("leaves 来源 to words and keeps the raw token in the title", async () => {
    api.fetchJSON.mockImplementation(okList([{ ...DELEG_A, source: "scheduler" }]));
    await render("/collab");
    await waitFor(() => rowNodes() === 1, "one row");
    const cell = document.querySelector("[data-testid='col5-row-0-source']");
    expect(cell?.textContent).toBe("定时任务发起");
    expect(cell?.getAttribute("title")).toBe("scheduler");
  });

  it("shows the scope sentence with the audience it names", async () => {
    api.fetchJSON.mockImplementation(okList([DELEG_A]));
    await render("/collab");
    await waitFor(() => rowNodes() === 1, "one row");
    expect(document.querySelector("[data-testid='col5-row-0-scope']")?.textContent).toContain(
      "整理本周巡检记录并点名缺项（对 运维组）",
    );
  });

  it("renders a missing scope as a gap with a reason, never as empty text", async () => {
    api.fetchJSON.mockImplementation(okList([DELEG_B]));
    await render("/collab");
    await waitFor(() => rowNodes() === 1, "one row");
    const cell = document.querySelector("[data-testid='col5-row-0-scope']");
    expect(cell?.textContent).toBe("—");
    expect(cell?.getAttribute("title")).toContain("没有");
  });

  it("keeps the technical strings out of the DOM until 技术详情 is opened", async () => {
    api.fetchJSON.mockImplementation(okList([DELEG_A]));
    await render("/collab");
    await waitFor(() => rowNodes() === 1, "one row");
    expect(html()).not.toContain("delegation dl_01ABC234DEF567");
    await act(async () => {
      document.querySelector("[data-testid='col5-row-0-tech'] button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(html()).toContain("delegation dl_01ABC234DEF567");
    expect(html()).toContain("status accepted");
  });

  it("does not paint a row whose answer carried no delegation id", async () => {
    api.fetchJSON.mockImplementation(okList([DELEG_A, { status: "accepted" }]));
    await render("/collab");
    await waitFor(() => rowNodes() === 1, "one readable row");
    expect(text()).toContain("另有 1 条");
    expect(document.querySelector("[data-testid='col5-unreadable']")?.textContent).toContain("没有把它们画成委托");
  });
});

describe("the four states and the login leg", () => {
  it("shows a skeleton while the ask is in flight, not a list of zero", async () => {
    let release: (v: { items: unknown[] }) => void = () => {};
    api.fetchJSON.mockImplementation(() => new Promise((resolve) => (release = resolve)));
    await render("/collab");
    await waitFor(() => document.querySelector("[data-testid='col5-loading']") !== null, "skeleton");
    expect(rowNodes()).toBe(0);
    expect(text()).not.toMatch(/本页 0 条/);
    release({ items: [] });
    await waitFor(() => document.querySelector("[data-testid='col5-empty']") !== null, "settled");
  });

  it("401 renders 需要登录 — not an error panel, not rows, not a zero", async () => {
    api.fetchJSON.mockRejectedValue(
      new ApiError("x", { status: 401, body: "{}", url: "/x", requestId: "2e37996b21be4016882d8da3ad3ba5ea" }),
    );
    await render("/collab");
    await waitFor(() => document.querySelector("[data-testid='col5-login']") !== null, "login leg");
    expect(rowNodes()).toBe(0);
    expect(document.querySelector("[data-testid='col5-error']")).toBeNull();
    expect(document.querySelector('[role="alert"]')).toBeNull();
    expect(text()).toContain("需要登录");
    expect(document.querySelector("[data-testid='col5-login-request-id']")?.textContent).toContain("2e37996b21be4016882d8da3ad3ba5ea");
  });

  it("403 and 404 draw one byte-for-byte identical body with no row above it", async () => {
    api.fetchJSON.mockRejectedValue(new ApiError("x", { status: 403, body: "{}", url: "/x", requestId: "same-rid" }));
    await render("/collab");
    await waitFor(() => document.querySelector("[data-testid='col5-denied']") !== null, "denied 403");
    const forbidden = document.querySelector("[data-testid='col5-denied']")?.outerHTML ?? "";
    expect(rowNodes()).toBe(0);
    expect(document.querySelector("[data-testid='col5-table']")).toBeNull();

    api.fetchJSON.mockRejectedValue(new ApiError("x", { status: 404, body: "{}", url: "/x", requestId: "same-rid" }));
    await render("/collab");
    await waitFor(() => document.querySelector("[data-testid='col5-denied']") !== null, "denied 404");
    expect(document.querySelector("[data-testid='col5-denied']")?.outerHTML).toBe(forbidden);
  });

  it("the denied body never repeats the route, the code, or the field names", async () => {
    api.fetchJSON.mockRejectedValue(
      new ApiError("x", { status: 404, body: '{"code":"console.not_found"}', url: "/agent-api/api/delegations", requestId: "9e59c5edcbad4264817ec78dd58dcc1" }),
    );
    await render("/collab");
    await waitFor(() => document.querySelector("[data-testid='col5-denied']") !== null, "denied");
    const panel = document.querySelector("[data-testid='col5-denied']")?.textContent ?? "";
    expect(panel).not.toMatch(/delegations|agent-api|40[34]|not_found|console\./);
  });

  it("empty states the reason and where such a request is made", async () => {
    api.fetchJSON.mockImplementation(okList([]));
    await render("/collab");
    await waitFor(() => document.querySelector("[data-testid='col5-empty']") !== null, "empty");
    expect(text()).toContain("读取成功");
    expect(text()).toContain("任务详情");
    expect(document.querySelector("[data-testid='col5-counts']")?.textContent).toContain("本页 0 条");
  });

  it("error gives human words, a copyable 请求编号 and a working 重试", async () => {
    api.fetchJSON.mockRejectedValue(new ApiError("x", { status: 503, body: "{}", url: "/x", requestId: "4a3f8e1d2c7b4a90be15f3d6c8a29107" }));
    await render("/collab");
    await waitFor(() => document.querySelector("[data-testid='col5-error']") !== null, "error");
    expect(text()).toContain("暂时没有响应");
    expect(text()).not.toMatch(/503|HTTP/);
    api.fetchJSON.mockImplementation(okList([DELEG_A]));
    await act(async () => {
      document.querySelector("[data-testid='col5-error-retry']")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await waitFor(() => rowNodes() === 1, "recovered after retry");
  });

  it("says 未提供 when the failure carried no request id, with the reason in the title", async () => {
    api.fetchJSON.mockRejectedValue(new ApiError("x", { status: 500, body: "{}", url: "/x" }));
    await render("/collab");
    await waitFor(() => document.querySelector("[data-testid='col5-error-request-id-value-absent']") !== null, "absent id");
    expect(text()).toContain("未提供");
    expect(html()).not.toContain("undefined");
  });
});

describe("the ?state= repro legs ask for nothing", () => {
  const thrower = (): never => {
    throw new Error("a repro leg must not reach the network");
  };

  beforeEach(() => {
    api.fetchJSON.mockImplementation(thrower);
  });

  it.each(["loading", "empty", "error", "denied"])("draws %s from the URL alone", async (state) => {
    await render(`/collab?state=${state}`);
    await waitFor(() => document.querySelector(`[data-testid='col5-${state}']`) !== null, state);
    expect(api.fetchJSON.mock.calls).toHaveLength(0);
    expect(document.querySelector("[data-testid='col5-page']")?.getAttribute("data-fixture")).toBe(state);
    expect(document.querySelector("[data-testid='col5-forced-note']")?.textContent).toContain(`?state=${state}`);
    expect(document.querySelector("[data-testid='col5-forced-note']")?.textContent).toContain("GAP-10");
    expect(document.querySelector(`[data-testid='col5-${state}']`)?.getAttribute("data-fixture")).toBe(state);
  });

  it("disables the control that would ask", async () => {
    await render("/collab?state=error");
    await waitFor(() => document.querySelector("[data-testid='col5-error']") !== null, "error repro");
    const refresh = document.querySelector("[data-testid='col5-refresh']") as HTMLButtonElement | null;
    expect(refresh?.disabled).toBe(true);
    const retry = document.querySelector("[data-testid='col5-error-retry']") as HTMLButtonElement | null;
    expect(retry?.disabled).toBe(true);
  });

  it("paints no rows on any repro leg", async () => {
    for (const state of ["loading", "empty", "error", "denied"]) {
      await render(`/collab?state=${state}`);
      await waitFor(() => document.querySelector(`[data-testid='col5-${state}']`) !== null, state);
      expect(rowNodes()).toBe(0);
      expect(document.querySelector("[data-testid='col5-table']")).toBeNull();
    }
  });

  it("treats ?state=ready as a real read, not a repro", async () => {
    api.fetchJSON.mockImplementation(okList([DELEG_A]));
    await render("/collab?state=ready");
    await waitFor(() => rowNodes() === 1, "real read");
    expect(api.fetchJSON.mock.calls.length).toBeGreaterThan(0);
    expect(document.querySelector("[data-testid='col5-page']")?.hasAttribute("data-fixture")).toBe(false);
  });
});

describe("zero engineering language on a real read", () => {
  it("shows no field name, code, ISO instant, undefined or NaN", async () => {
    api.fetchJSON.mockImplementation(okList([DELEG_A, DELEG_B]));
    await render("/collab");
    await waitFor(() => rowNodes() === 2, "two rows");
    const onScreen = text();
    expect(onScreen).not.toMatch(/undefined|NaN|null/);
    expect(onScreen).not.toMatch(/\b(40[0-9]|50[0-9])\b/);
    expect(onScreen).not.toMatch(/delegationId|expiresAt|fromEmployeeId|toEmployeeId|createdAt/);
    expect(onScreen).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:/);
  });

  it("the layout carries the wrap discipline instead of fixed widths", async () => {
    api.fetchJSON.mockImplementation(okList([DELEG_A]));
    await render("/collab");
    await waitFor(() => rowNodes() === 1, "one row");
    const page = document.querySelector("[data-testid='col5-page']");
    expect(page?.getAttribute("class")).toContain("min-w-0");
    expect(html()).not.toMatch(/width:\s*\d+px/);
    const row = document.querySelector("[data-testid='col5-row-0']");
    expect(row?.getAttribute("class")).toContain("minmax(0,1fr)");
  });
});

describe("read-only: no control that cannot do anything", () => {
  it("every button on a ready screen is a re-read, a copy, or a disclosure", async () => {
    api.fetchJSON.mockImplementation(okList([DELEG_A]));
    await render("/collab");
    await waitFor(() => rowNodes() === 1, "one row");
    const buttons = Array.from(document.querySelectorAll("button"));
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      const owner = button.closest("[data-testid]")?.getAttribute("data-testid") ?? "";
      const label = `${owner}|${button.textContent ?? ""}`;
      const known =
        /col5-refresh|col5-row-0-tech|col5-page-tech|col5-view-list|col5-view-chain/.test(label) ||
        button.getAttribute("aria-label")?.startsWith("复制") === true;
      expect({ label, known }).toEqual({ label, known: true });
    }
  });

  it("never renders a write affordance, and says where the write lives", async () => {
    api.fetchJSON.mockImplementation(okList([DELEG_A]));
    await render("/collab");
    await waitFor(() => rowNodes() === 1, "one row");
    const writeWords = ["接受", "拒绝", "交接给", "完成委托", "发起派单"];
    for (const word of writeWords) {
      const clickable = Array.from(document.querySelectorAll("button, a")).filter((node) =>
        (node.textContent ?? "").includes(word),
      );
      expect(clickable).toHaveLength(0);
    }
    expect(document.querySelector("[data-testid='col5-write-note']")?.textContent).toContain("任务详情");
    expect(document.querySelector("[data-testid='col5-foot']")?.textContent).toContain("本页不代为操作");
  });
});

describe("the six columns and the language on every leg", () => {
  it("names the six columns in the order the task cards them", async () => {
    api.fetchJSON.mockImplementation(okList([DELEG_A]));
    await render("/collab");
    await waitFor(() => rowNodes() === 1, "one row");
    const header = Array.from(
      document.querySelectorAll("[data-testid='col5-table'] .sm\\:grid > span"),
    ).map((node) => node.textContent);
    expect(header).toEqual(["委托方", "受托方", "范围", "动作", "状态", "生效 / 到期", "来源"]);
  });

  it.each([
    ["ready", () => api.fetchJSON.mockImplementation(okList([DELEG_A, DELEG_B])), ""],
    [
      "error",
      () => api.fetchJSON.mockRejectedValue(new ApiError("x", { status: 500, body: "{}", url: "/x" })),
      "",
    ],
    [
      "denied",
      () =>
        api.fetchJSON.mockRejectedValue(
          new ApiError("x", { status: 404, body: '{"code":"console.not_found"}', url: "/x" }),
        ),
      "",
    ],
    [
      "login",
      () => api.fetchJSON.mockRejectedValue(new ApiError("x", { status: 401, body: "{}", url: "/x" })),
      "",
    ],
  ])("the %s leg carries no engineering language", async (_leg, setup) => {
    setup();
    await render("/collab");
    if (_leg === "ready") {
      await waitFor(() => rowNodes() === 2, "rows");
    } else {
      await waitFor(
        () =>
          document.querySelector(
            `[data-testid='col5-${_leg === "login" ? "login" : _leg}'],[data-testid='col5-login']`,
          ) !== null,
        _leg,
      );
    }
    const onScreen = text();
    expect(onScreen).not.toMatch(/emp_|human:|dl_0|undefined|NaN/);
    expect(onScreen).not.toMatch(/\b(400|401|403|404|429|500|502|503)\b/);
    expect(onScreen).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:/);
    expect(onScreen).not.toMatch(/delegationId|expiresAt|fromEmployeeId|toEmployeeId|createdAt|scopeText/);
    expect(onScreen).not.toMatch(/agent-api|\/api\/delegations/);
  });
});

describe("the read stamp on screen", () => {
  it("prints the service's own asOf in Beijing minutes", async () => {
    api.fetchJSON.mockImplementation(async (url: string) =>
      url.includes("/api/delegations") ? { items: [], asOf: "2026-11-19T06:48:38.660Z" } : { items: [] },
    );
    await render("/collab");
    await waitFor(() => document.querySelector("[data-testid='col5-empty']") !== null, "empty");
    const stamp = document.querySelector("[data-testid='col5-asof']");
    expect(stamp?.textContent).toBe("读取于 11-19 14:48");
    expect(stamp?.getAttribute("title")).toContain("服务在回答里给出");
  });

  it("says the time is unknown when the answer carries none", async () => {
    api.fetchJSON.mockImplementation(okList([]));
    await render("/collab");
    await waitFor(() => document.querySelector("[data-testid='col5-empty']") !== null, "empty");
    const stamp = document.querySelector("[data-testid='col5-asof']");
    expect(stamp?.textContent).toBe("读取于 —");
    expect(stamp?.getAttribute("title")).toContain("没有带读取时刻");
  });
});

describe("the delegation chain view", () => {
  it("keeps the view in the URL and switches without another read", async () => {
    api.fetchJSON.mockImplementation(okList([DELEG_A]));
    await render(
      "/collab",
      <>
        <CollabDelegationsModulePage />
        <LocationProbe />
      </>,
    );
    await waitFor(() => rowNodes() === 1, "one row");
    const asks = urls().length;
    await act(async () => {
      document.querySelector("[data-testid='col5-view-chain']")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await waitFor(() => document.querySelector("[data-testid='col5-chain']") !== null, "chain painted");
    expect(document.querySelector("[data-testid='probe-location']")?.textContent).toContain("view=chain");
    expect(document.querySelector("[data-testid='col5-page']")?.getAttribute("data-view")).toBe("chain");
    expect(document.querySelector("[data-testid='col5-table']")).toBeNull();
    expect(urls().length).toBe(asks);
  });

  it("opens on the chain when the link says ?view=chain", async () => {
    api.fetchJSON.mockImplementation(okList([DELEG_A]));
    await render("/collab?view=chain");
    await waitFor(() => document.querySelector("[data-testid='col5-chain']") !== null, "chain painted");
    expect(document.querySelector("[data-testid='col5-chain-group-0']")).not.toBeNull();
    expect(document.querySelector("[data-testid='col5-table']")).toBeNull();
  });

  it("groups by delegator and says 链未接入 with a reason instead of a depth", async () => {
    api.fetchJSON.mockImplementation(okList([DELEG_A, { ...DELEG_A, delegationId: "dl_9", toEmployeeId: "emp_ccccdddd", toEmployeeName: "周泠" }]));
    await render("/collab?view=chain");
    await waitFor(() => document.querySelectorAll("[data-testid^='col5-chain-group-']").length === 1, "one group");
    const group = document.querySelector("[data-testid='col5-chain-group-0']");
    expect(group?.textContent).toContain("委托方 · 陈可 · 9F3A4B7C");
    expect(group?.textContent).toContain("本页 2 条");
    const nodes = document.querySelectorAll("[data-testid^='col5-chain-node-']");
    expect(nodes.length).toBeGreaterThanOrEqual(2);
    const gap = document.querySelector("[data-testid='col5-chain-gap']");
    expect(gap?.textContent).toContain("链未接入");
    expect(gap?.textContent).toContain("没有给出每条委托的上一手编号");
    expect(gap?.getAttribute("title")).toContain("DELEGATION v1.0");
    expect(text()).not.toMatch(/第 0 层|0 层|层级：0|深度：0/);
  });

  it("paints nothing and keeps the empty truth when there are no delegations", async () => {
    api.fetchJSON.mockImplementation(okList([]));
    await render("/collab?view=chain");
    await waitFor(() => document.querySelector("[data-testid='col5-empty']") !== null, "empty");
    expect(document.querySelector("[data-testid='col5-chain']")).toBeNull();
    expect(document.querySelector("[data-testid='col5-counts']")?.textContent).toContain("本页 0 条");
  });

  it("renders no write affordance on either view", async () => {
    api.fetchJSON.mockImplementation(okList([DELEG_A]));
    await render("/collab?view=chain");
    await waitFor(() => document.querySelector("[data-testid='col5-chain']") !== null, "chain painted");
    for (const word of ["撤销", "新建", "发起委托", "接受", "拒绝", "交接给", "完成委托"]) {
      const clickable = Array.from(document.querySelectorAll("button, a")).filter((node) =>
        (node.textContent ?? "").includes(word),
      );
      expect(clickable).toHaveLength(0);
    }
    expect(document.querySelector("[data-testid='col5-write-note']")?.textContent).toContain("只读");
  });
});

describe("each delegation opens its own human detail", () => {
  it("keeps the fold closed until asked, then shows scope, words and both Beijing instants", async () => {
    api.fetchJSON.mockImplementation(okList([DELEG_A]));
    await render("/collab");
    await waitFor(() => rowNodes() === 1, "one row");
    const more = document.querySelector("[data-testid='col5-row-0-more']");
    expect(more).not.toBeNull();
    expect(more?.hasAttribute("open")).toBe(false);
    // The block belongs to the row it was opened for, and it repeats no machine token.
    const val = (field: string): string | null =>
      document.querySelector(`[data-testid='col5-row-0-detail-${field}'] dd`)?.textContent ?? null;
    const title = (field: string): string | null =>
      document.querySelector(`[data-testid='col5-row-0-detail-${field}']`)?.getAttribute("title") ?? null;
    expect(val("scope")).toContain("整理本周巡检记录并点名缺项");
    expect(val("action")).toBe("交接");
    expect(title("action")).toBe("handoff");
    expect(val("status")).toBe("已接受");
    expect(val("effective")).toBe("起 2026-11-01 08:00");
    expect(val("expiry")).toContain("至 2999-01-01 08:00");
    expect(val("code")).toBe("34DEF567");
    expect(title("code")).toBe(DELEG_A.delegationId);
  });

  it("keeps a missing field as — with its reason, never as a zero or a guess", async () => {
    api.fetchJSON.mockImplementation(okList([DELEG_B]));
    await render("/collab");
    await waitFor(() => rowNodes() === 1, "one row");
    for (const field of ["scope", "effective", "expiry"] as const) {
      const cell = document.querySelector(`[data-testid='col5-row-0-detail-${field}']`);
      expect(cell?.querySelector("dd")?.textContent).toBe("—");
      expect((cell?.getAttribute("title") ?? "").length).toBeGreaterThan(0);
    }
  });
});
