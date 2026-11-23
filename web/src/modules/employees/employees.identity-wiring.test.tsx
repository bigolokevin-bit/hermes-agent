// @vitest-environment jsdom
/**
 * Q41a — 前端消费 identity-links/transitions 两读口接线契约。
 *
 * 板面判据：Q1 读口已在 main（GET 恒 501 族）；未接面 501 需诚实空态文案，
 * 禁造假 200。Q41c 正名（L6 R378 实测）：现网 served BFF 两读口实际 authed
 * 404 console.unknown_route（路由未注册）——该形态同落诚实未接入态，
 * 文案与 501/503「上游未接」区分成因；非 unknown_route 的 404 仍是错误态。
 * 本测钉死六条：
 *  1. 真请求先行：挂载即按精确 URL 各发一条 GET（接线证明）；
 *  2. 501 → 未接入态：文案逐字含服务端信封 code（identity.not_wired /
 *     employee_transitions.not_wired），不用 role=alert，不摆空列表；
 *  3. 200+真形 → 真行渲染（状态词表冻结：active/stale/revoked；流转 from→to）；
 *  4. 200 空列表 → 「暂无记录」空态（≠未接入，两套文案分开）；
 *  5. 防串数据护栏：行归属对不上 → 整块错误（PE-02/03 同句），不部分渲染；
 *  6. 非 501 失败（如 500）→ 错误态（含状态码与请求号），不伪装未接入。
 * 「未接入」≠「空态」≠「错误」三态互斥由本文件逐对验证。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const fetchJSON = vi.fn();
vi.mock("@/lib/api", () => ({
  fetchJSON: (...args: unknown[]) => fetchJSON(...args),
}));

import IdentityPane from "@/modules/employees/detail/IdentityPane";
import OverviewPane from "@/modules/employees/detail/OverviewPane";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const EMP = "emp_86A81CE8FF6F42E187BCF2B540";
const ENC = encodeURIComponent(EMP);
const DETAIL = { employeeId: EMP, name: "小鲤", lifecycleState: "active", createdAt: "2026-11-13T22:15:11.641Z" };

function notWiredErr(code: string, message: string): ApiError {
  return new ApiError(`501: ${code}`, {
    status: 501,
    body: JSON.stringify({ code, message }),
    url: "/agent-api",
  });
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  fetchJSON.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function mount(node: React.ReactNode): Promise<void> {
  await act(async () => {
    root.render(<MemoryRouter>{node}</MemoryRouter>);
  });
  await act(async () => {});
}

function routes(map: Record<string, unknown>, failures: Record<string, Error> = {}): void {
  fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    for (const [needle, err] of Object.entries(failures)) {
      if (u.includes(needle)) throw err;
    }
    for (const [needle, body] of Object.entries(map)) {
      if (u.includes(needle)) return body;
    }
    return { items: [] };
  });
}

describe("Q41a identity-links 读腿", () => {
  it("挂载即发精确 URL 的真实请求（接线证明，非静态占位）", async () => {
    routes({}, { "identity-links": notWiredErr("identity.not_wired", "域服务当前没有身份链接的 HTTP 读口（仅有创建/撤销），如实返回未接线，不造数") });
    await mount(<IdentityPane rawId={EMP} enc={ENC} />);
    const urls = fetchJSON.mock.calls.map((c) => String(c[0]));
    expect(urls).toContain(`/agent-api/api/identity-links?employeeId=${ENC}`);
  });

  it("501 → 未接入态含服务端 code 与请求号位，非 alert 非列表", async () => {
    routes({}, { "identity-links": notWiredErr("identity.not_wired", "域服务当前没有身份链接的 HTTP 读口（仅有创建/撤销），如实返回未接线，不造数") });
    await mount(<IdentityPane rawId={EMP} enc={ENC} />);
    const nw = container.querySelector("[data-testid='emp-detail-identity-not-wired']");
    expect(nw).toBeTruthy();
    expect(nw!.textContent).toContain("未接入");
    expect(nw!.textContent).toContain("identity.not_wired");
    expect(nw!.textContent).toContain("请求号");
    expect(container.querySelector("[data-testid='emp-detail-identity-rows']")).toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("200 真形 → 真行渲染，状态词表冻结（active/stale/revoked）", async () => {
    routes({
      "identity-links": {
        items: [
          { id: "il_1", employeeId: EMP, channel: "feishu", externalId: "ou_2139572cd5", status: "active", createdAt: "2026-11-20T02:00:00Z" },
          { id: "il_2", employeeId: EMP, channel: "wechat", externalId: "wx_x9", status: "stale", createdAt: "2026-10-01T02:00:00Z" },
          { id: "il_3", employeeId: EMP, channel: "telegram", externalId: "tg_7", status: "revoked", createdAt: "2026-09-01T02:00:00Z" },
        ],
      },
    });
    await mount(<IdentityPane rawId={EMP} enc={ENC} />);
    const rows = container.querySelector("[data-testid='emp-detail-identity-rows']");
    expect(rows).toBeTruthy();
    const text = rows!.textContent ?? "";
    expect(text).toContain("ou_2139572cd5");
    expect(text).toContain("生效中");
    expect(text).toContain("已过期（不自动删）");
    expect(text).toContain("已撤销");
    expect(container.querySelector("[data-testid='emp-detail-identity-not-wired']")).toBeNull();
  });

  it("200 空列表 → 「暂无记录」空态，不与未接入混淆", async () => {
    routes({ "identity-links": { items: [] } });
    await mount(<IdentityPane rawId={EMP} enc={ENC} />);
    expect(container.querySelector("[data-testid='emp-detail-identity-empty']")?.textContent).toContain("暂无身份链接记录");
    expect(container.querySelector("[data-testid='emp-detail-identity-not-wired']")).toBeNull();
  });

  it("防串数据护栏：别人的行整块转错误（PE-02/03 同句），不部分渲染", async () => {
    routes({
      "identity-links": { items: [{ id: "il_x", employeeId: "emp_OTHER", channel: "feishu", externalId: "ou_x", status: "active" }] },
    });
    await mount(<IdentityPane rawId={EMP} enc={ENC} />);
    const alert = container.querySelector('[role="alert"]');
    expect(alert).toBeTruthy();
    expect(alert!.textContent).toContain("返回数据不属于该员工，已停止显示以防串数据。");
    expect(container.querySelector("[data-testid='emp-detail-identity-rows']")).toBeNull();
  });

  it("500 → 错误态（状态码+请求号），不伪装未接入", async () => {
    routes({}, { "identity-links": new ApiError("500: boom", { status: 500, body: "Internal Server Error", url: "/agent-api" }) });
    await mount(<IdentityPane rawId={EMP} enc={ENC} />);
    expect(container.querySelector("[data-testid='emp-detail-identity-not-wired']")).toBeNull();
    const alert = container.querySelector('[role="alert"]');
    expect(alert).toBeTruthy();
    expect(alert!.textContent).toContain("500");
  });

  // ── Q41c：404 unknown_route（现网实测形态）并入诚实未接入 ──
  it("404 console.unknown_route → 未接入态（路由未注册文案），非错误态", async () => {
    routes({}, { "identity-links": new ApiError("404: not found", { status: 404, body: '{"code":"console.unknown_route","message":"unknown console API route"}', url: "/agent-api/api/identity-links" }) });
    await mount(<IdentityPane rawId={EMP} enc={ENC} />);
    const nw = container.querySelector("[data-testid='emp-detail-identity-not-wired']");
    expect(nw).toBeTruthy();
    expect(nw!.textContent).toContain("未接入");
    expect(nw!.textContent).toContain("console.unknown_route");
    expect(nw!.textContent).toContain("路由未实现");
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector("[data-testid='emp-detail-identity-rows']")).toBeNull();
  });

  it("404 其他 code（如 employee.not_found）→ 仍错误态，不并入未接入", async () => {
    routes({}, { "identity-links": new ApiError("404: nf", { status: 404, body: '{"code":"employee.not_found","message":"employee not found"}', url: "/agent-api" }) });
    await mount(<IdentityPane rawId={EMP} enc={ENC} />);
    expect(container.querySelector("[data-testid='emp-detail-identity-not-wired']")).toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeTruthy();
  });
});

describe("Q41a employee transitions 读腿（最近流转）", () => {
  it("挂载即按 /api/employees/<enc>/transitions 发真实请求", async () => {
    routes({}, { "/transitions": notWiredErr("employee_transitions.not_wired", "域服务当前没有员工生命周期流转的读口（仅有 POST /v1/employees/{id}/transitions 写口），如实返回未接线，不造数") });
    await mount(<OverviewPane detail={DETAIL} rawId={EMP} enc={ENC} />);
    const urls = fetchJSON.mock.calls.map((c) => String(c[0]));
    expect(urls).toContain(`/agent-api/api/employees/${ENC}/transitions`);
  });

  it("501 → flux 未接入含 code；档案基本信息不受阻塞", async () => {
    routes({}, { "/transitions": notWiredErr("employee_transitions.not_wired", "域服务当前没有员工生命周期流转的读口（仅有 POST /v1/employees/{id}/transitions 写口），如实返回未接线，不造数") });
    await mount(<OverviewPane detail={DETAIL} rawId={EMP} enc={ENC} />);
    const nw = container.querySelector("[data-testid='emp-detail-flux-not-wired']");
    expect(nw?.textContent).toContain("employee_transitions.not_wired");
    expect(container.textContent).toContain("小鲤");
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("Q41c：404 console.unknown_route → flux 未接入（路由未注册），非 alert", async () => {
    routes({}, { "/transitions": new ApiError("404: not found", { status: 404, body: '{"code":"console.unknown_route","message":"unknown console API route"}', url: "/agent-api/api/employees/x/transitions" }) });
    await mount(<OverviewPane detail={DETAIL} rawId={EMP} enc={ENC} />);
    const nw = container.querySelector("[data-testid='emp-detail-flux-not-wired']");
    expect(nw?.textContent).toContain("未接入");
    expect(nw?.textContent).toContain("console.unknown_route");
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("200 真形 → from→to 行渲染，取不到的字段显示「—」不编造", async () => {
    routes({
      "/transitions": {
        items: [
          { id: "tr_1", employeeId: EMP, from: "draft", to: "onboarding", occurredAt: "2026-11-14T10:00:00Z" },
        ],
      },
    });
    await mount(<OverviewPane detail={DETAIL} rawId={EMP} enc={ENC} />);
    const rows = container.querySelector("[data-testid='emp-detail-flux-rows']");
    expect(rows?.textContent).toContain("draft → onboarding");
    expect(rows?.textContent).toContain("—");
  });
});
