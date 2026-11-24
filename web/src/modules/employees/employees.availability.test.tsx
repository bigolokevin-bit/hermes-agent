// @vitest-environment jsdom
/**
 * 第四轮并排验收 C 的护栏：三态口径、说明带/三段条、技能芯片、脏字符串清理，
 * 以及「更多」面板（表内不再常驻勾选/chevron/铅笔）。
 *
 * 三态是唯一派生：可上岗=在岗且 V1/V2/V6 全过；受限=在岗但至少一门未过或未知；
 * 停用=生命周期不是在岗。页头四个数、说明带图例、表内 pill 只吃同一张视图表。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

vi.mock("@/lib/api", () => ({ fetchJSON: vi.fn() }));

vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    onClick,
    ...rest
  }: {
    children?: ReactNode;
    onClick?: () => void;
    [k: string]: unknown;
  }) => (
    <button type="button" onClick={onClick} {...(rest as Record<string, never>)}>
      {children}
    </button>
  ),
  Card: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

import { fetchJSON } from "@/lib/api";
import EmployeesModulePage, { displayName, roleLine } from "@/modules/employees/EmployeesModulePage";

const mock = vi.mocked(fetchJSON);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const OK_ID = "emp_AAAA1111BBBB2222";
const LIMITED_ID = "emp_BBBB2222CCCC3333";
const STOPPED_ID = "emp_CCCC3333DDDD4444";

const employees = {
  items: [
    { employeeId: OK_ID, name: "小鲤", title: "内容编辑", lifecycleState: "active", updatedAt: "2026-11-17T05:52:48.030Z", department: "内容中心" },
    { employeeId: LIMITED_ID, name: "阿朝", title: "增长", lifecycleState: "active", updatedAt: "2026-11-18T05:52:48.030Z", department: "增长组" },
    { employeeId: STOPPED_ID, name: "草稿 1794894768", title: "草稿 1794894768（dev 库，可清理）", lifecycleState: "draft", updatedAt: "2026-11-19T01:00:00Z", department: null },
  ],
};

const matrix = {
  items: [
    { employeeId: OK_ID, skillRefs: ["skill:检索", "skill:写作", "skill:图像", "skill:集成"], skillCount: 4 },
    { employeeId: LIMITED_ID, skillRefs: [], skillCount: 0 },
    { employeeId: STOPPED_ID, skillRefs: [], skillCount: 0 },
  ],
};

function serve(): void {
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/employees?")) return employees;
    if (u.endsWith("/api/matrix")) return matrix;
    if (u.includes("/api/runs?")) return { items: [] };
    if (u.includes("/api/employee-stats")) return { total: 3, byLifecycle: { active: 2, draft: 1 } };
    if (u.includes("/api/health/sources")) return { sources: [{ state: "ok" }], asOf: "2026-11-24T06:20:18Z" };
    if (u.includes("/api/auth/me")) return { org_id: "t_seakoi_pilot" };
    if (u.includes(`/api/workstations?id=${OK_ID}`)) return { items: [{ bindingType: "group", status: "active" }] };
    if (u.includes(`/api/workstations?id=${LIMITED_ID}`)) return { items: [{ bindingType: "dm", status: "active" }] };
    if (u.includes("/api/workstations")) return { items: [{ bindingType: "dm", status: "active" }] };
    if (u.includes("/api/effective-config")) return { version: { knowledgeScopes: ["kb"] }, grants: [{ expiresAt: null }] };
    if (u.includes("/api/approvals?status=all"))
      return {
        items: [
          {
            status: "approved",
            expiresAt: null,
            action: "message.send",
            approvers: [{ id: "1" }],
            binding: { subjectType: "employee", subjectId: OK_ID },
          },
        ],
      };
    if (u.includes("/api/knowledge/citations")) return { count: 2, asOf: "2026-11-24T06:20:18Z" };
    return {};
  });
}

let root: Root | null = null;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
  mock.mockReset();
});

async function render(node: ReactElement = <EmployeesModulePage />, entry = "/employees"): Promise<void> {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<MemoryRouter initialEntries={[entry]}>{node}</MemoryRouter>);
  });
  await act(async () => {});
}

const q = (id: string) => document.querySelector(`[data-testid="${id}"]`);
const text = (id: string) => q(id)?.textContent?.replace(/\s+/g, " ").trim() ?? "";

async function waitFor(cond: () => boolean, label: string): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await Promise.resolve();
    });
  }
}

const pill = (id: string) => text(`emp-life-${id}`);

describe("第四轮 · 可上岗三态只此一处派生", () => {
  it("draft→停用、三门全过→可上岗、缺一门→受限（title 点名）", async () => {
    serve();
    await render();
    await waitFor(() => pill(LIMITED_ID) !== "—" && pill(OK_ID) !== "—", "gates settled");

    expect(pill(STOPPED_ID)).toBe("停用");
    expect(pill(OK_ID)).toBe("可上岗");
    expect(pill(LIMITED_ID)).toBe("受限");
    expect(q(`emp-life-${LIMITED_ID}`)?.querySelector("span[title]")?.getAttribute("title")).toContain("V1 群@未过");
  });

  it("页头四个数、说明带图例与表内 pill 同源", async () => {
    serve();
    await render();
    await waitFor(() => pill(OK_ID) !== "—", "gates settled");

    expect(text("emp-page-summary")).toContain("3 名");
    expect(text("emp-page-summary")).toContain("1 可上岗");
    expect(text("emp-page-summary")).toContain("1 受限");
    expect(text("emp-page-summary")).toContain("1 停用");
    const legend = text("emp-band-legend");
    expect(legend).toContain("1 可上岗");
    expect(legend).toContain("1 受限");
    expect(legend).toContain("1 停用");
    // 三段条存在且只画非零段（三段都非零时 = 3 个 i）。
    const bar = document.querySelector(".emp-seg3");
    expect(bar).toBeTruthy();
    expect(bar?.querySelectorAll("i").length).toBe(3);
    expect(text("emp-band-note")).toContain("可上岗=在岗且");
  });

  it("生命周期字段没回的行整格「—」，不拿未知冒充受限", async () => {
    mock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/employees?"))
        return { items: [{ ...employees.items[1], lifecycleState: undefined }, employees.items[2]] };
      if (u.endsWith("/api/matrix")) return matrix;
      return {};
    });
    await render();
    await waitFor(() => !!q("employees-table"), "list settled");
    expect(pill(LIMITED_ID)).toBe("—");
    expect(text("emp-page-summary")).toContain("— 可上岗");
    // 停用行不需要门读数，照常可判。
    expect(pill(STOPPED_ID)).toBe("停用");
  });
});

describe("第四轮 · 清上屏脏字符串", () => {
  it("姓名结尾 8 位以上连续数字只在显示层剥掉，title 保留原文", () => {
    const row = { employeeId: STOPPED_ID, name: "草稿 1794894768" };
    expect(displayName(row)).toBe("草稿");
    expect(row.name).toBe("草稿 1794894768");
    expect(displayName({ employeeId: STOPPED_ID, name: "1794894768" })).toBe("—");
  });

  it("岗位段丢掉运维括注与姓名重复，只留真岗位", () => {
    expect(roleLine("草稿 1794894768（dev 库，可清理）", "草稿 1794894768")).toBe("");
    expect(roleLine("产品助理（数字员工 · Pilot）", "AgentOS 产品助理")).toBe("产品助理");
    expect(roleLine("产品助理（Pilot）", "AgentOS 产品助理")).toBe("产品助理");
    expect(roleLine("内容编辑", "小鲤")).toBe("内容编辑");
    expect(roleLine(undefined, "小鲤")).toBe("");
  });
});

describe("第四轮 · 技能芯片与「更多」面板", () => {
  it("有引用就出最多 3 枚 chip + N，0 个就写 — 并带「未挂载技能」", async () => {
    serve();
    await render();
    await waitFor(() => !!q(`emp-skills-${OK_ID}`), "rows");

    const cells = q(`emp-skills-${OK_ID}`) as HTMLElement;
    expect(cells.querySelectorAll(".emp-chip").length).toBe(3);
    expect(cells.textContent).toContain("+1");
    expect(cells.querySelector(".emp-chip")?.textContent).toBe("检索");

    const empty = q(`emp-skills-${LIMITED_ID}`) as HTMLElement;
    expect(empty.textContent?.trim()).toBe("—");
    expect(empty.getAttribute("title")).toContain("该员工未挂载技能");
  });

  it("表内没有勾选/chevron/铅笔；这些控件只在「更多」面板里，面板默认不出现", async () => {
    serve();
    await render();
    await waitFor(() => !!q("employees-table"), "table");

    const table = q("employees-table") as HTMLElement;
    expect(table.querySelector('[data-testid^="emp-row-select-"]')).toBeNull();
    expect(table.querySelector('[data-testid^="emp-row-preview-toggle-"]')).toBeNull();
    expect(table.querySelector('[data-testid^="emp-row-edit-"]')).toBeNull();

    const panel = q("emp-more-panel");
    expect(panel?.hasAttribute("hidden")).toBe(true);

    await act(async () => {
      (q("emp-more-trigger") as HTMLButtonElement).click();
    });
    expect(q("emp-more-panel")?.hasAttribute("hidden")).toBe(false);
    expect(q(`emp-row-select-${OK_ID}`)).toBeTruthy();
    expect(q(`emp-row-edit-${OK_ID}`)).toBeTruthy();
    expect(q("emp-list-copy")).toBeTruthy();
    expect(q("emp-list-export")).toBeTruthy();
    expect(q("employees-refresh")).toBeTruthy();
  });

  it("卡头微标签用真租户（org_id）而不是写死骨架串", async () => {
    serve();
    await render();
    await waitFor(() => !!q("emp-tenant-tag"), "tenant tag");
    expect(text("emp-tenant-tag")).toBe("SEAKOI · PILOT");
  });
});