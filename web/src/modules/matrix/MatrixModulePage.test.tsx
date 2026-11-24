// @vitest-environment jsdom
/**
 * 「能力与权限」矩阵页的读口与版面契约（新契约：2016 行逻辑接线后的第一版）。
 *
 * 骨架基线：console-v4-skeleton.html 2315–2385 的三张卡。
 * 本文件只钉三件事：
 *   ① 一屏三卡 + 骨架列名 / 无读口的列整列不渲染；
 *   ② 每条读口四态各自成立：missing 写缺读口、empty 写真零、ready 出真值；
 *   ③ 硬规则：模块内零 tablist、零 data-fixture、h2 标题、工程语言不上屏。
 * 旧 fixture 实现（MATRIX_FIXTURE / employeeLabel / payload.origin / mtx5-fixture-*）
 * 的断言随样例门一并撤除——这一版面上不存在示例数据。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const fetchJSON = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ fetchJSON }));

import { MatrixModulePage } from "./MatrixModulePage";

let container: HTMLDivElement;
let root: Root;

const URLS = {
  matrix: "/agent-api/api/matrix",
  skills: "/agent-api/api/skills",
  tools: "/agent-api/api/tools",
  mcp: "/agent-api/api/mcp/servers",
  employees: "/agent-api/api/employees",
  spaces: "/agent-api/api/knowledge/spaces",
} as const;

const AS_OF = "2026-11-24T08:30:00.000Z";

function person(overrides: Record<string, unknown>) {
  return {
    employeeId: "emp_AAAABBBBCCCCDDDD",
    name: "小鲤",
    title: "运营",
    lifecycleState: "active",
    currentVersionId: "empv_1",
    effectiveFrom: "2026-11-20T02:00:00.000Z",
    skillRefs: [],
    skillCount: 0,
    ...overrides,
  };
}

const PEOPLE = [
  person({
    employeeId: "emp_AAAABBBBCCCCDDDD",
    name: "小鲤",
    skillRefs: [
      { skillId: "skill:检索" },
      { skillId: "skill:写稿" },
      { skillId: "skill:审稿" },
      { skillId: "skill:排期" },
      { skillId: "skill:复盘" },
    ],
    skillCount: 5,
  }),
  person({ employeeId: "emp_1111222233334444", name: "小满", lifecycleState: "draft", skillCount: 0 }),
  person({ employeeId: "emp_5555666677778888", name: "阿吉", lifecycleState: "active", skillCount: 0 }),
];

const SKILLS = [
  { id: "skill:检索", name: "检索" },
  { id: "skill:写稿", name: "写稿" },
];

const SPACES = {
  spaces: [
    { space_id: "1", name: "产品知识库", document_count: 12, last_sync_at: "2026-11-20T06:00:00Z" },
  ],
  asOf: AS_OF,
};

function notWired(code: string): ApiError {
  return new ApiError("该读口尚未接入", {
    status: 404,
    body: JSON.stringify({ code }),
    url: "/agent-api/api/x",
  });
}

function upstreamDown(): ApiError {
  return new ApiError("上游不可达", {
    status: 502,
    body: JSON.stringify({ code: "console.upstream_unavailable" }),
    url: "/agent-api/api/tools",
  });
}

function respond(map: Record<string, unknown>) {
  fetchJSON.mockImplementation((url: string) => {
    if (url in map) {
      const value = map[url];
      return value instanceof ApiError ? Promise.reject(value) : Promise.resolve(value);
    }
    return Promise.resolve({ items: [] });
  });
}

async function flush() {
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function renderPage(entry = "/employees?tab=matrix") {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <MatrixModulePage />
      </MemoryRouter>,
    );
  });
  await flush();
}

function text() {
  return container.textContent ?? "";
}

function q(selector: string) {
  return container.querySelector(selector) as HTMLElement | null;
}

function qa(selector: string) {
  return Array.from(container.querySelectorAll(selector)) as HTMLElement[];
}

function matrixWith(people: unknown[] = PEOPLE) {
  return { items: people, asOf: AS_OF };
}

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

describe("读口接线", () => {
  it("一次挂载读六条腿，地址与读口表一致", async () => {
    respond({
      [URLS.matrix]: matrixWith(),
      [URLS.skills]: { items: SKILLS, asOf: AS_OF },
      [URLS.spaces]: SPACES,
    });
    await renderPage();
    const called = fetchJSON.mock.calls.map((call) => call[0]).sort();
    expect(called).toEqual(
      [URLS.matrix, URLS.skills, URLS.tools, URLS.mcp, URLS.employees, URLS.spaces].sort(),
    );
  });
});

describe("硬规则", () => {
  it("模块标题是 h2，全页没有第二个 h1", async () => {
    respond({ [URLS.matrix]: matrixWith(), [URLS.spaces]: SPACES });
    await renderPage();
    expect(qa("h2").map((node) => node.textContent)).toContain("能力与权限");
    expect(qa("h1")).toHaveLength(0);
  });

  it("模块内零 role=tablist（资源类型分段是 role=group）", async () => {
    respond({ [URLS.matrix]: matrixWith(), [URLS.spaces]: SPACES });
    await renderPage();
    expect(qa('[role="tablist"]')).toHaveLength(0);
    expect(q('[role="group"][aria-label="资源类型"]')).not.toBeNull();
  });

  it("面上没有 data-fixture，也没有工程语言字符串", async () => {
    respond({
      [URLS.matrix]: matrixWith(),
      [URLS.skills]: { items: SKILLS, asOf: AS_OF },
      [URLS.tools]: upstreamDown(),
      [URLS.mcp]: notWired("mcp.read_not_wired"),
      [URLS.spaces]: SPACES,
    });
    await renderPage();
    expect(container.querySelector("[data-fixture]")).toBeNull();
    const visible = text();
    expect(visible).not.toContain("console.");
    expect(visible).not.toContain("gateway_health");
    expect(visible).not.toContain("/agent-api/");
    expect(visible).not.toContain("/api/");
  });

  it("破折号 ≤ 6（无读口的列整列不渲染，不靠满列「—」凑版面）", async () => {
    respond({ [URLS.matrix]: matrixWith(), [URLS.spaces]: SPACES, [URLS.skills]: { items: SKILLS } });
    await renderPage();
    const dashes = (text().match(/—/g) ?? []).length;
    expect(dashes).toBeLessThanOrEqual(6);
  });
});

describe("卡一 · 按员工覆盖", () => {
  beforeEach(() => {
    respond({
      [URLS.matrix]: matrixWith(),
      [URLS.skills]: { items: SKILLS, asOf: AS_OF },
      [URLS.tools]: upstreamDown(),
      [URLS.mcp]: notWired("mcp.read_not_wired"),
      [URLS.spaces]: SPACES,
    });
  });

  it("行＝员工：30px 头像 + 姓名 + 等宽工号短码，原始 id 不上屏", async () => {
    await renderPage();
    const row = q('[data-testid="mtx-row-emp_AAAABBBBCCCCDDDD"]');
    expect(row).not.toBeNull();
    const avatar = row!.querySelector(".mtx-ava") as HTMLElement;
    expect(avatar.textContent).toBe("小鲤");
    expect(row!.textContent).toContain("AAAABBBB");
    expect(text()).not.toContain("emp_AAAABBBB");
  });

  it("技能列出 chip：最多 3 枚 + 「+N」", async () => {
    await renderPage();
    const row = q('[data-testid="mtx-row-emp_AAAABBBBCCCCDDDD"]');
    const chips = row!.querySelectorAll(".emp-chip");
    expect(chips).toHaveLength(3);
    expect(row!.querySelector(".mtx-more")?.textContent).toBe("+2");
  });

  it("工具与接口 / 知识范围 / 四道门 / 缺口：员工级没有回传 ⇒ 整列不渲染", async () => {
    await renderPage();
    expect(q('[data-testid="mtx-col-skills"]')).not.toBeNull();
    expect(q('[data-testid="mtx-col-tools"]')).toBeNull();
    expect(q('[data-testid="mtx-col-kb"]')).toBeNull();
    expect(q('[data-testid="mtx-col-gates"]')).toBeNull();
    expect(q('[data-testid="mtx-col-gap"]')).toBeNull();
    expect(text()).not.toContain("四道门");
    expect(text()).not.toContain("缺口（未挂必挂技能）");
  });

  it("技能引用是真零时写「0 项」，不是「—」", async () => {
    await renderPage();
    const row = q('[data-testid="mtx-row-emp_1111222233334444"]');
    expect(row!.textContent).toContain("0 项");
    expect(row!.textContent).not.toContain("—");
  });

  it("状态筛选是真参数：在岗只留 active，停用只留 draft", async () => {
    await renderPage();
    const select = q('[data-testid="mtx-status"]') as HTMLSelectElement;

    await act(async () => {
      select.value = "ok";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(qa('[data-testid^="mtx-row-emp_"]')).toHaveLength(2);

    await act(async () => {
      select.value = "mut";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const rows = qa('[data-testid^="mtx-row-emp_"]');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.getAttribute("data-testid")).toBe("mtx-row-emp_1111222233334444");
  });

  it("筛选空态给一句原因，并给「清除筛选」出口", async () => {
    respond({ [URLS.matrix]: matrixWith(), [URLS.spaces]: SPACES });
    await renderPage();
    const select = q('[data-testid="mtx-status"]') as HTMLSelectElement;
    await act(async () => {
      select.value = "mut";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    // 三个人里只有 1 个 draft，先筛到有行，再输入一个不存在的关键字。
    const search = q('[data-testid="mtx-search"]') as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(search, "不存在的员工");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(text()).toContain("该筛选下没有员工");
    expect(q('[data-testid="mtx-clear-filters"]')).not.toBeNull();
  });

  it("「只看有缺口」不可用：控件禁用并在 title 里说明缺基线读口", async () => {
    await renderPage();
    const gap = q('[data-testid="mtx-gap-only"]') as HTMLInputElement;
    expect(gap.disabled).toBe(true);
    expect(gap.closest("label")?.getAttribute("title")).toContain("岗位基线");
  });
});

describe("卡二 · 按资源覆盖", () => {
  it("行＝技能，列＝员工：命中画 ●，未命中留空，挂载人数据实", async () => {
    respond({
      [URLS.matrix]: matrixWith([
        person({ employeeId: "emp_AAAA0000AAAA0000", name: "小鲤", skillRefs: [{ skillId: "skill:检索" }], skillCount: 1 }),
        person({ employeeId: "emp_BBBB0000BBBB0000", name: "小满", lifecycleState: "draft", skillRefs: [], skillCount: 0 }),
      ]),
      [URLS.skills]: { items: [{ id: "skill:检索", name: "检索" }], asOf: AS_OF },
      [URLS.spaces]: SPACES,
    });
    await renderPage();

    const row = q('[data-testid="mtx-resrow-skill:检索"]');
    expect(row).not.toBeNull();
    const marks = row!.querySelectorAll(".mtx-mark");
    expect(marks).toHaveLength(1);
    expect(marks[0]!.textContent).toBe("●");
    expect(row!.querySelectorAll(".mtx-mark-empty")).toHaveLength(1);
    expect(row!.querySelector('[data-testid="mtx-resrow-skill:检索"]')).toBeNull();
    expect(row!.textContent).toContain("1");
    expect(row!.textContent).toContain("单点");
    // 读口没回版本 ⇒ 「已挂版本」整列不渲染，而不是满列「—」。
    expect(q('[data-testid="mtx-reshead-version"]')).toBeNull();
  });

  it("读口回空集＝真零：行列保留，写明「真零」而不是摆示例行", async () => {
    respond({
      [URLS.matrix]: matrixWith([
        person({ employeeId: "emp_AAAA0000AAAA0000", name: "小鲤", skillRefs: [], skillCount: 0 }),
      ]),
      [URLS.skills]: { items: [], asOf: AS_OF },
      [URLS.spaces]: SPACES,
    });
    await renderPage();
    const table = q('[data-testid="mtx-resource-scroll"] table');
    expect(table).not.toBeNull();
    const head = table!.textContent ?? "";
    expect(head).toContain("技能");
    expect(head).toContain("挂载人数");
    expect(head).toContain("覆盖状态");
    expect(q('[data-testid="mtx-resource-empty"]')?.textContent).toContain("真零");
  });

  it("工具维度没有员工级读口 ⇒ 员工列整列不进版面，卡底声明缺读口", async () => {
    respond({
      [URLS.matrix]: matrixWith(),
      [URLS.tools]: upstreamDown(),
      [URLS.spaces]: SPACES,
    });
    await renderPage();
    await act(async () => {
      q('[data-testid="mtx-kind-tool"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();
    expect(qa('[data-testid^="mtx-empcol-"]')).toHaveLength(0);
    expect(q('[data-testid="mtx-resource-note"]')?.textContent).toContain("工具登记");
  });

  it("知识空间是真读口：空间名与文档数上屏", async () => {
    respond({
      [URLS.matrix]: matrixWith(),
      [URLS.skills]: { items: SKILLS },
      [URLS.spaces]: SPACES,
    });
    await renderPage("/employees?tab=matrix&res=kb");
    const row = q('[data-testid="mtx-resrow-1"]');
    expect(row?.textContent).toContain("产品知识库");
    expect(row?.textContent).toContain("12 篇文档");
  });

  it("资源类型切换是真地址：?res=tool 直开就是工具那档", async () => {
    respond({ [URLS.matrix]: matrixWith(), [URLS.spaces]: SPACES });
    await renderPage("/employees?tab=matrix&res=tool");
    expect(q('[data-testid="mtx-kind-tool"]')?.getAttribute("aria-pressed")).toBe("true");
    // 工具档的骨架列名是服务/操作/接入状态；操作与接入没有读口 ⇒ 只剩服务列。
    expect(q('[data-testid="mtx-reshead-name"]')?.textContent).toContain("服务");
    expect(q('[data-testid="mtx-reshead-ops"]')).toBeNull();
    expect(q('[data-testid="mtx-reshead-access"]')).toBeNull();
    expect(q('[data-testid="mtx-reshead-state"]')).not.toBeNull();
  });
});

describe("四态与兜底", () => {
  it("矩阵读口 404 + 员工名单 200：行来自名单，能力列不渲染，卡底说清缺读口", async () => {
    respond({
      [URLS.matrix]: notWired("matrix.read_not_wired"),
      [URLS.employees]: { items: [{ employeeId: "emp_9999AAAA0000BBBB", name: "阿吉", lifecycleState: "active" }] },
      [URLS.spaces]: SPACES,
    });
    await renderPage();
    expect(qa('[data-testid^="mtx-row-emp_"]')).toHaveLength(1);
    expect(q('[data-testid="mtx-col-skills"]')).toBeNull();
    const note = q('[data-testid="mtx-people-note"]');
    expect(note?.textContent).toContain("员工能力矩阵");
    expect(note?.textContent).toContain("缺读口");
  });

  it("名单两条腿都没回：摆空的说明行，不补 0", async () => {
    respond({
      [URLS.matrix]: notWired("matrix.read_not_wired"),
      [URLS.employees]: notWired("employees.read_not_wired"),
      [URLS.spaces]: SPACES,
    });
    await renderPage();
    const empty = q('[data-testid="mtx-people-empty"]');
    expect(empty?.textContent).toContain("没有读口");
    expect(empty?.textContent).not.toContain("0 名");
  });

  it("矩阵 200 但空集：名单写「真零」，不是读取失败", async () => {
    respond({ [URLS.matrix]: { items: [], asOf: AS_OF }, [URLS.spaces]: SPACES });
    await renderPage();
    expect(q('[data-testid="mtx-people-empty"]')?.textContent).toContain("真零");
  });
});

describe("卡三 · 清点与口径", () => {
  it("一行 11px：真读数 + 缺读口声明 + 读取时刻", async () => {
    respond({
      [URLS.matrix]: matrixWith(),
      [URLS.skills]: { items: SKILLS, asOf: AS_OF },
      [URLS.tools]: upstreamDown(),
      [URLS.mcp]: notWired("mcp.read_not_wired"),
      [URLS.spaces]: SPACES,
    });
    await renderPage();
    const summary = q('[data-testid="mtx-summary"]');
    expect(summary).not.toBeNull();
    expect(summary!.textContent).toContain("员工");
    expect(summary!.textContent).toContain("在岗");
    expect(summary!.textContent).toContain("技能登记");
    expect(summary!.textContent).toContain("2");
    expect(q('[data-testid="mtx-missing-summary"]')?.textContent).toBe("缺读口：工具登记、MCP 服务器");
    expect(summary!.textContent).toContain("读取于 2026-11-24 16:30");
  });

  it("六条读口都在时，卡三写「六条读口本次都在」，不列假缺项", async () => {
    respond({
      [URLS.matrix]: matrixWith(),
      [URLS.skills]: { items: SKILLS, asOf: AS_OF },
      [URLS.tools]: { items: [{ id: "tool:web.search" }] },
      [URLS.mcp]: { items: [{ id: "mcp:files" }] },
      [URLS.employees]: { items: [] },
      [URLS.spaces]: SPACES,
    });
    await renderPage();
    expect(q('[data-testid="mtx-missing-summary"]')).toBeNull();
    expect(text()).toContain("六条读口本次都在");
  });
});