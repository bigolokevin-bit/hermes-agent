// @vitest-environment jsdom
/**
 * PE-03 — 员工详情五分区对齐契约。
 *
 * 钉住卡面条款：
 *  1) Tab 集 = 五个冻结分区（档案/任职/权限/身份链接/活动），testid
 *     emp-detail-zone-overview|assignment|access|identity|activity 逐个存在；
 *  2) 档案：当前版本读 /api/employee-versions?id=&limit=1（真数据行），
 *     最近流转读口 501 → 未接入腿（title 带 GAP 号），版本腿挂了不阻塞基本信息；
 *  3) 任职：/api/workstations?id=&limit=20 真数据行，整列皆缺裁该列，
 *     合法空态「该员工暂无绑定的工作站」；
 *  4) 权限：/api/effective-config?id= 投影 grants[]，屏上行数恒等于 payload
 *     grants 数；resolvedAt 数据时刻；expiresAt 缺失显示「—」；全页永不出现
 *     「永久」二字；409 employee.no_effective_version = 真实状态文案（非错误
 *     爆炸）；at= 回看标「未接入」；
 *  5) 身份链接 = PE-04 挂载点，整块「未接入」（非错误非空态）；
 *  6) ?zone= 旧值深链不死：config→权限，tasks/runs/evidence→活动（直投区块）；
 *  7) 每分区独立四态：loading→ready、失败态带原因+请求号，空态≠未接入两套文案。
 *
 * 四区块参数名与防串护栏由 employees.detail.sectionRequests.test.tsx 逐字钉死，
 * 本文件不重复其断言面（只确认合并进活动分区后区块仍可达）。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const fetchJSON = vi.fn();
vi.mock("@/lib/api", () => ({
  fetchJSON: (...args: unknown[]) => fetchJSON(...args),
}));

import EmployeeDetailPage from "@/pages/EmployeeDetailPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const EMP = "emp_86A81CE8FF6F42E187BCF2B540";
const OTHER = "emp_0166858D5621";
const DETAIL = { employeeId: EMP, name: "小鲤", lifecycleState: "active", createdAt: "2026-11-13T22:15:11.641Z" };

// 现网实测形制（docs/_artifacts/PE-03/curl-*.raw 取证一致）。
const VERSIONS = {
  items: [
    {
      id: "empv_037096D42F194AF6B38A3D8F62",
      employeeId: EMP,
      versionNo: 5,
      effectiveFrom: "2026-11-21T18:39:20.008Z",
      changeNote: "V1 换路收尾",
      createdBy: "1",
    },
  ],
};
const WORKSTATIONS = {
  items: [
    { id: "ws_7E2653", employeeId: EMP, bindingType: "group", channel: "feishu", externalRef: "oc_0adeac81", capabilities: ["reply", "stream"], status: "active" },
    { id: "ws_8D6580", employeeId: EMP, bindingType: "app", channel: "feishu", externalRef: "2139572cd5", capabilities: [], status: "active" },
    { id: "ws_dryrun", employeeId: EMP, bindingType: "dm", channel: "feishu", externalRef: "oc_dryrun", capabilities: ["reply"], status: "active" },
  ],
};
const EFFECTIVE = {
  employee: { id: EMP },
  version: { versionNo: 5, knowledgeScopes: ["product_assistant", "nist-100-1"] },
  grants: [
    {
      id: "gr_3A384C",
      employeeId: EMP,
      scopeType: "channel",
      resourceSelector: { types: ["chat"] },
      actions: ["send"],
      source: "role",
      expiresAt: "2026-12-31T00:00:00Z",
    },
    {
      id: "gr_3617B1",
      employeeId: EMP,
      scopeType: "business_api",
      resourceSelector: { type: "channel_event" },
      actions: ["execute"],
      source: "temporary",
    },
  ],
  resolvedAt: "2026-11-23T13:38:44.507Z",
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  fetchJSON.mockReset();
});

/** 按端点前缀路由真数据；未列出的端点给空信封（诚实空，不造假）。 */
function serve(map: Record<string, unknown>, failures: Record<string, Error> = {}): void {
  fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    for (const [needle, err] of Object.entries(failures)) {
      if (u.includes(needle)) throw err;
    }
    if (u.startsWith("/agent-api/api/employees/")) return DETAIL;
    for (const [needle, body] of Object.entries(map)) {
      if (u.includes(needle)) return body;
    }
    return { items: [] };
  });
}

async function renderPage(search = ""): Promise<void> {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[`/employees/${EMP}${search}`]}>
        <Routes>
          <Route path="/employees/:id" element={<EmployeeDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  await act(async () => {});
}

const tabByText = (label: string): HTMLElement | undefined =>
  Array.from(container.querySelectorAll('[role="tab"]')).find(
    (b) => (b.textContent ?? "").trim() === label,
  ) as HTMLElement | undefined;

async function clickTab(label: string): Promise<void> {
  const tab = tabByText(label);
  expect(tab, `tab ${label}`).toBeTruthy();
  await act(async () => {
    tab!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {});
}

const zone = (id: string): HTMLElement | null => container.querySelector(`[data-testid="emp-detail-zone-${id}"]`);
const fullText = (): string => container.textContent ?? "";

describe("PE-03 五分区 Tab 集", () => {
  it("五个冻结分区逐个可达且 testid 钉住", async () => {
    serve({});
    await renderPage();
    for (const label of ["档案", "任职", "权限", "身份链接", "活动"]) {
      expect(tabByText(label), `分区 Tab「${label}」`).toBeTruthy();
    }
    await clickTab("档案");
    expect(zone("overview")).toBeTruthy();
    await clickTab("任职");
    expect(zone("assignment")).toBeTruthy();
    await clickTab("权限");
    expect(zone("access")).toBeTruthy();
    await clickTab("身份链接");
    expect(zone("identity")).toBeTruthy();
    await clickTab("活动");
    expect(zone("activity")).toBeTruthy();
  });

  it("旧五 Tab 名退役：概览/聊天/任务/运行/审计不再是顶层分区", async () => {
    serve({});
    await renderPage();
    const topLabels = Array.from(container.querySelectorAll('[aria-controls^="zone-panel-"]')).map(
      (b) => (b.textContent ?? "").trim(),
    );
    expect(topLabels).toEqual(["档案", "任职", "权限", "身份链接", "活动"]);
  });
});

describe("PE-03 档案分区", () => {
  it("当前版本读 employee-versions（id+limit=1），真数据直出 versionNo/生效时间", async () => {
    serve({ "/api/employee-versions": VERSIONS });
    await renderPage();
    await clickTab("档案");
    const urls = fetchJSON.mock.calls.map((c) => String(c[0]));
    expect(urls).toContain(`/agent-api/api/employee-versions?id=${EMP}&limit=1`);
    expect(zone("overview")!.textContent).toContain("5");
    expect(zone("overview")!.textContent).toContain("V1 换路收尾");
  });

  it("最近流转读口 501 → 未接入腿（title 带 GAP 号），不阻塞其余字段", async () => {
    serve({ "/api/employee-versions": { items: [] } }, { "/api/employee-versions": new ApiError("boom", { status: 501, body: "", url: "/agent-api" }) });
    await renderPage();
    await clickTab("档案");
    const flux = container.querySelector("[data-testid='emp-detail-flux-not-wired']");
    expect(flux, "最近流转未接入腿").toBeTruthy();
    expect(flux!.textContent).toContain("未接入");
    expect(flux!.textContent).toContain("GAP");
    // 版本腿挂了只降级自己：基本信息仍在。
    expect(zone("overview")!.textContent).toContain("小鲤");
    expect(zone("overview")!.textContent).toContain("基本信息");
  });
});

describe("PE-03 任职分区", () => {
  it("workstations 真数据行：渠道/会话引用/绑定态直出，行数=payload 行数", async () => {
    serve({ "/api/workstations": WORKSTATIONS });
    await renderPage();
    await clickTab("任职");
    expect(fetchJSON.mock.calls.map((c) => String(c[0]))).toContain(`/agent-api/api/workstations?id=${EMP}&limit=20`);
    const rows = zone("assignment")!.querySelectorAll('[data-testid="emp-assignment-row"]');
    expect(rows.length, "屏上行数恒等于 payload 行数").toBe(3);
    expect(fullText()).toContain("feishu");
    expect(fullText()).toContain("oc_0adeac81");
    expect(fullText()).toContain("group");
  });

  it("capabilities 整列皆缺 ⇒ 裁该列；有则列", async () => {
    serve({ "/api/workstations": WORKSTATIONS });
    await renderPage();
    await clickTab("任职");
    expect(fullText()).toContain("reply");

    serve({ "/api/workstations": { items: [{ ...WORKSTATIONS.items[0], capabilities: undefined }] } });
    await act(async () => root.unmount());
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await renderPage();
    await clickTab("任职");
    expect(fullText()).not.toContain("能力：");
  });

  it("合法空态=「该员工暂无绑定的工作站」，与未接入两套文案", async () => {
    serve({ "/api/workstations": { items: [] } });
    await renderPage();
    await clickTab("任职");
    expect(fullText()).toContain("该员工暂无绑定的工作站");
    expect(fullText()).not.toContain("未接入");
  });

  it("失败态带原因+请求号；混进别人的行 ⇒ 护栏整块拒显", async () => {
    serve({}, { "/api/workstations": new ApiError("网关炸了", { status: 502, body: '{"request_id":"req-ws-1"}', url: "/agent-api" }) });
    await renderPage();
    await clickTab("任职");
    expect(zone("assignment")!.querySelector('[role="alert"]')).toBeTruthy();
    expect(fullText()).toContain("req-ws-1");

    fetchJSON.mockReset();
    serve({ "/api/workstations": { items: [{ ...WORKSTATIONS.items[0], employeeId: OTHER }] } });
    await act(async () => root.unmount());
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await renderPage();
    await clickTab("任职");
    expect(fullText()).toContain("返回数据不属于该员工");
    expect(fullText()).not.toContain("oc_0adeac81");
  });
});

describe("PE-03 权限分区", () => {
  it("effective-config 投影：行数=grants 数、scopeType/资源/动作/来源、数据时刻、expiresAt 缺失显示「—」", async () => {
    serve({ "/api/effective-config": EFFECTIVE });
    await renderPage();
    await clickTab("权限");
    expect(fetchJSON.mock.calls.map((c) => String(c[0]))).toContain(`/agent-api/api/effective-config?id=${EMP}`);
    const rows = zone("access")!.querySelectorAll('[data-testid="emp-access-grant-row"]');
    expect(rows.length, "屏上权限行数恒等于 payload grants 数").toBe(EFFECTIVE.grants.length);
    expect(fullText()).toContain("channel");
    expect(fullText()).toContain("send");
    expect(fullText()).toContain("role");
    expect(fullText()).toContain("2026-12-31");
    expect(fullText()).toContain("2026-11-23 21:38"); // resolvedAt 北京时间
    // 第二条授权无 expiresAt → 「—」
    expect(rows[1].textContent).toContain("—");
    // knowledgeScopes 若有则列
    expect(fullText()).toContain("product_assistant");
    // at= 回看未接入
    const at = container.querySelector("[data-testid='emp-access-at-not-wired']");
    expect(at, "at= 未接入腿").toBeTruthy();
    expect(at!.textContent).toContain("未接入");
  });

  it("全页永不出现「永久」二字", async () => {
    serve({ "/api/employee-versions": VERSIONS, "/api/workstations": WORKSTATIONS, "/api/effective-config": EFFECTIVE });
    await renderPage();
    for (const label of ["档案", "任职", "权限", "身份链接", "活动"]) {
      await clickTab(label);
      expect(fullText(), `分区「${label}」`).not.toContain("永久");
    }
  });

  it("409 employee.no_effective_version = 真实状态文案，非错误爆炸", async () => {
    serve({}, {
      "/api/effective-config": new ApiError("no effective version", {
        status: 409,
        body: JSON.stringify({ code: "employee.no_effective_version", message: "no effective version at 2020-01-01T00:00:00.000Z" }),
        url: "/agent-api",
      }),
    });
    await renderPage();
    await clickTab("权限");
    const noversion = container.querySelector("[data-testid='emp-access-no-effective-version']");
    expect(noversion, "尚无生效版本状态文案").toBeTruthy();
    expect(noversion!.textContent).toContain("尚无生效版本");
    // 不摆错误爆炸：该腿无 role=alert / 无重试告警语义。
    expect(zone("access")!.querySelector('[role="alert"]')).toBeNull();
  });

  it("其它 4xx/5xx 仍是失败态+原因+请求号", async () => {
    serve({}, { "/api/effective-config": new ApiError("boom", { status: 500, body: '{"request_id":"req-ec-9"}', url: "/agent-api" }) });
    await renderPage();
    await clickTab("权限");
    expect(zone("access")!.querySelector('[role="alert"]')).toBeTruthy();
    expect(fullText()).toContain("req-ec-9");
  });

  it("混进别人的授权 ⇒ 整块拒显（防串护栏，与 PE-02 同口径）", async () => {
    serve({ "/api/effective-config": { ...EFFECTIVE, grants: [{ ...EFFECTIVE.grants[0], employeeId: OTHER }] } });
    await renderPage();
    await clickTab("权限");
    expect(fullText()).toContain("返回授权不属于该员工");
    expect(zone("access")!.querySelectorAll('[data-testid="emp-access-grant-row"]').length, "串数据时整块不渲染").toBe(0);
    expect(fullText()).not.toContain("product_assistant");
  });
});

describe("PE-03 身份链接分区", () => {
  it("整块未接入（GAP/PE-04 编号入 title），非错误非空态", async () => {
    serve({});
    await renderPage();
    await clickTab("身份链接");
    const notWired = container.querySelector("[data-testid='emp-detail-identity-not-wired']");
    expect(notWired).toBeTruthy();
    expect(notWired!.textContent).toContain("未接入");
    expect(notWired!.textContent).toContain("PE-04");
    expect(zone("identity")!.querySelector('[role="alert"]')).toBeNull();
    expect(fullText()).not.toContain("暂无生效授权");
  });
});

describe("PE-03 活动分区", () => {
  it("四区块合并进活动分区后仍可达（参数名契约由 sectionRequests 钉死）", async () => {
    serve({ "/api/sessions": { items: [{ id: "sess_1", employeeId: EMP, title: "选题讨论" }] } });
    await renderPage();
    await clickTab("活动");
    for (const label of ["聊天", "任务", "运行", "审计"]) {
      expect(tabByText(label), `活动区块「${label}」`).toBeTruthy();
    }
    await clickTab("聊天");
    expect(fullText()).toContain("选题讨论");
  });
});

describe("PE-03 旧值深链兼容", () => {
  it("?zone=config → 权限分区直落", async () => {
    serve({ "/api/effective-config": EFFECTIVE });
    await renderPage("?zone=config");
    expect(tabByText("权限")!.getAttribute("aria-selected")).toBe("true");
    expect(zone("access")).toBeTruthy();
  });

  it("?zone=tasks|runs|evidence → 活动分区并直投对应区块", async () => {
    for (const [zoneQuery, block] of [["tasks", "任务"], ["runs", "运行"], ["evidence", "审计"]] as const) {
      fetchJSON.mockReset();
      await act(async () => root.unmount());
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
      serve({});
      await renderPage(`?zone=${zoneQuery}`);
      expect(tabByText("活动")!.getAttribute("aria-selected")).toBe("true");
      expect(tabByText(block)!.getAttribute("aria-selected"), `zone=${zoneQuery} → 区块${block}`).toBe("true");
    }
  });

  it("未知 zone 值不死：落默认分区且分区条完整", async () => {
    serve({});
    await renderPage("?zone=something-else");
    for (const label of ["档案", "任职", "权限", "身份链接", "活动"]) {
      expect(tabByText(label)).toBeTruthy();
    }
  });
});
