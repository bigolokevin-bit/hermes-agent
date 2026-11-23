// @vitest-environment jsdom
/**
 * PE-02 — 员工详情四区块「参数名 + 防串数据」契约。
 *
 * 现场 bug（pages/EmployeeDetailPage.tsx，越权显示级）：四个区块把过滤参数拼成
 * 裸 `?employee=`，BFF 不识别该参数名 ⇒
 *   - sessions / tasks：静默返回全租户未过滤列表（现网实证 /api/tasks?employee=
 *     emp_86A81CE8FF6E 返回 20 条里 10 条 assignee 是别人 emp_0166858D5621）；
 *   - runs / audit：直接 400 missing_filter，永久错误块。
 *
 * 本文件把四个参数名逐个钉死（条款 4，先红后绿）：
 *   sessions → /api/sessions?employeeId=
 *   runs     → /api/runs?employeeId=&limit=20
 *   tasks    → /api/tasks?assignee=employee:
 *   audit    → /api/audit?resourceId=
 * 并断言全站 URL 里不出现裸 `?employee=` 形制。
 *
 * 另锁护栏（条款 3）：一旦返回行里混进别人的数据，该区块整块转错误态
 * 「返回数据不属于该员工」，绝不部分渲染、绝不假 0/假成功。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchJSON = vi.fn();
vi.mock("@/lib/api", () => ({
  fetchJSON: (...args: unknown[]) => fetchJSON(...args),
}));

import EmployeeDetailPage from "@/pages/EmployeeDetailPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const EMP = "emp_86A81CE8FF6E";
const OTHER = "emp_0166858D5621";
const DETAIL = { id: EMP, employeeId: EMP, name: "小鲤", status: "active" };

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

const urls = (): string[] => fetchJSON.mock.calls.map((call) => String(call[0]));
const urlFor = (endpoint: string): string =>
  urls().find((u) => u.startsWith(`/agent-api/api/${endpoint}?`)) ?? "";
const panel = (): HTMLElement => container.querySelector('[role="tabpanel"]') as HTMLElement;
const panelText = (): string => panel()?.textContent ?? "";
const rowCount = (): number => panel()?.querySelectorAll("li").length ?? 0;

/** 四端点各自返回「只属于该员工」的行，键名按 BFF 实测形制：
 *  sessions/runs = employeeId，tasks = assignee 对象，audit = resource.id。 */
function serveOwned(): void {
  fetchJSON.mockImplementation((url: string) => {
    const u = String(url);
    if (u.startsWith("/agent-api/api/sessions?"))
      return Promise.resolve({ items: [{ id: "sess_1", employeeId: EMP, title: "本周选题讨论" }] });
    if (u.startsWith("/agent-api/api/tasks?"))
      return Promise.resolve({
        items: [{ id: "task_1", assignee: { type: "employee", id: EMP }, title: "整理竞品拆解", status: "open" }],
      });
    if (u.startsWith("/agent-api/api/runs?"))
      return Promise.resolve({ items: [{ run_id: "run_1", employeeId: EMP, status: "succeeded", cost: 0.02 }] });
    if (u.startsWith("/agent-api/api/audit?"))
      return Promise.resolve({ events: [{ event_id: "ev_1", resource: { id: EMP }, action: "identity.link.create" }] });
    return Promise.resolve(DETAIL);
  });
}

async function renderPage(): Promise<void> {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[`/employees/${EMP}`]}>
        <Routes>
          <Route path="/employees/:id" element={<EmployeeDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  await act(async () => {});
}

async function openTab(label: string): Promise<void> {
  const tab = Array.from(container.querySelectorAll('[role="tab"]')).find(
    (b) => (b.textContent ?? "").trim() === label,
  );
  expect(tab, `tab ${label}`).toBeTruthy();
  await act(async () => {
    (tab as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {});
}

describe("PE-02 员工详情四区块参数名契约", () => {
  it("聊天：sessions 只认 employeeId，且值就是该员工", async () => {
    serveOwned();
    await renderPage();
    await openTab("聊天");
    expect(urlFor("sessions")).toBe(`/agent-api/api/sessions?employeeId=${EMP}`);
    expect(panelText()).toContain("本周选题讨论");
  });

  it("运行：runs 用 employeeId + limit=20（旧裸参数在现网是 400 missing_filter）", async () => {
    serveOwned();
    await renderPage();
    await openTab("运行");
    expect(urlFor("runs")).toBe(`/agent-api/api/runs?employeeId=${EMP}&limit=20`);
    expect(rowCount()).toBe(1);
    expect(panelText()).toContain("耗时");
  });

  it("任务：tasks 用 assignee=employee:{id} + limit=20", async () => {
    serveOwned();
    await renderPage();
    await openTab("任务");
    expect(urlFor("tasks")).toBe(`/agent-api/api/tasks?assignee=employee:${EMP}&limit=20`);
    expect(panelText()).toContain("整理竞品拆解");
  });

  it("审计：audit 用 resourceId（现网 actorId 两种形制都 0 条，resourceId 才取得到）", async () => {
    serveOwned();
    await renderPage();
    await openTab("审计");
    expect(urlFor("audit")).toBe(`/agent-api/api/audit?resourceId=${EMP}&limit=50`);
    expect(panelText()).toContain("identity.link.create");
  });

  it("四个区块都不再拼裸 ?employee=（BFF 忽略它 ⇒ 未过滤越权显示）", async () => {
    serveOwned();
    await renderPage();
    for (const label of ["聊天", "任务", "运行", "审计"]) await openTab(label);
    const bare = urls().filter((u) => /[?&]employee=/.test(u));
    expect(bare, `裸 ?employee= 仍在使用: ${bare.join(", ")}`).toEqual([]);
    expect(urls().filter((u) => /\/api\/(sessions|tasks|runs|audit)\?/.test(u))).toHaveLength(4);
  });
});

describe("PE-02 防串数据护栏", () => {
  it("任务里混进别人的 assignee ⇒ 该他人任务绝不出现，区块转错误态", async () => {
    fetchJSON.mockImplementation((url: string) => {
      const u = String(url);
      if (u.startsWith("/agent-api/api/tasks?"))
        return Promise.resolve({
          items: [
            { id: "task_1", assignee: { type: "employee", id: EMP }, title: "整理竞品拆解", status: "open" },
            { id: "task_x", assignee: { type: "employee", id: OTHER }, title: "别人名下的任务", status: "open" },
          ],
        });
      return Promise.resolve(DETAIL);
    });
    await renderPage();
    await openTab("任务");
    const text = panelText();
    expect(text).not.toContain("别人名下的任务");
    expect(text).not.toContain(OTHER);
    expect(text).toContain("返回数据不属于该员工");
    expect(rowCount(), "串数据时整块不渲染，不做部分过滤").toBe(0);
    // 走既有错误呈现通路（role=alert），不是假空态也不是假成功
    expect(panel().querySelector('[role="alert"]')).toBeTruthy();
  });

  it("聊天整页是别人的数据 ⇒ 同样拒绝渲染", async () => {
    fetchJSON.mockImplementation((url: string) => {
      const u = String(url);
      if (u.startsWith("/agent-api/api/sessions?"))
        return Promise.resolve({ items: [{ id: "sess_9", employeeId: OTHER, title: "别人的会话" }] });
      return Promise.resolve(DETAIL);
    });
    await renderPage();
    await openTab("聊天");
    expect(panelText()).not.toContain("别人的会话");
    expect(panelText()).toContain("返回数据不属于该员工");
  });

  it("空列表是诚实空态，不是护栏误伤", async () => {
    fetchJSON.mockImplementation((url: string) => {
      const u = String(url);
      if (/\/api\/(sessions|tasks|runs|audit)\?/.test(u)) return Promise.resolve({ items: [] });
      return Promise.resolve(DETAIL);
    });
    await renderPage();
    await openTab("聊天");
    expect(panelText()).toContain("暂无聊天");
    expect(panelText()).not.toContain("返回数据不属于该员工");
  });
});
