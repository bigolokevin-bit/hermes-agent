// @vitest-environment jsdom
/**
 * R190 — 审计列表列排序与筛选组合同源护栏（纯测试，零产品改动）。
 *
 * 现场裁决（禁臆造）：
 * - 排序消费参=asort/adir（sorting.ts L32「The address keys are ?asort= / ?adir=」）；
 *   工单字面 ?sort=&dir= 不是本模块消费的参数名——④按现状锁「字面 sort/dir 与
 *   非法 asort/adir 都不改写地址、不成对即无排序」。
 * - 排序=本地维：pickSort 从不发请求（L920 注释 sorting touches no cursor,
 *   no page and no filter）；服务端请求 URL 从不带排序参。
 * - 人类侧「事件类型」URL 参名=type，台账读口 wire 参名=action（L776/L779）；
 *   chip key=action（filterChips.ts）。
 * - 计数位现场实名=aud01-status（L1546 aria-live 读数行「已显示 N 条审计事件…」）；
 *   工单点名的 aud5-row-count 在 src/modules/ 全树零命中=载体名按现状裁决。
 *
 * 已覆盖只回证据：audit.window.test.ts audU ①-⑤（档=固定 from/to 对、切档恰一读
 * 保留其他维度、chip 只删档、非法区间不读）；sorting.test.ts 纯函数五 it（三态
 * 循环、成对才生效、缺值两向恒末、ARIA）；filterChips.test.ts（from-to 一 chip
 * 双删）；csv.test.ts L55-57（exportName 窗 tag 字面）。本文件增量=组合 DOM 面：
 * ①点排序钮 URL 写入+请求零增+行序变+aria-sort 回填；②排序×切窗并存的实跑形态；
 * ③移除 type/action chip 只删该维、排序保持；④非法不成对参原样保留+回行序+读数如实。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import { AuditEventsModulePage } from "./AuditEventsModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

function LocationProbe(): ReactNode {
  const location = useLocation();
  return <span data-testid="probe-location">{`${location.pathname}${location.search}`}</span>;
}

const waitFor = async (cond: () => boolean, label: string): Promise<void> => {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
};

async function render(entry: string): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[entry]}>
        <AuditEventsModulePage />
        <LocationProbe />
      </MemoryRouter>,
    );
  });
  await waitFor(() => !document.querySelector(".animate-pulse"), "skeleton gone");
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): string[] => urls().filter((url) => /^\/agent-api\/api\/audit\?/.test(url));

/** 地址作为排序后的 key=value 集合（audit.deeplink 同款读法）。 */
function pairs(): string[] {
  const text = document.querySelector("[data-testid='probe-location']")?.textContent ?? "";
  const query = text.includes("?") ? text.slice(text.indexOf("?") + 1) : "";
  return [...new URLSearchParams(query)].map(([key, value]) => `${key}=${value}`).sort();
}

const rowsOrder = (): string[] =>
  [...document.querySelectorAll('[data-testid^="aud01-row-"]')].map((el) =>
    String(el.getAttribute("data-testid")).replace("aud01-row-", ""),
  );

const ariaSortOf = (column: string): string | null =>
  document.querySelector(`[data-testid="aud-sort-head-${column}"]`)?.getAttribute("aria-sort") ?? null;

async function clickTestId(testid: string): Promise<void> {
  const node = document.querySelector(`[data-testid="${testid}"]`) as HTMLElement | null;
  expect(node, testid).toBeTruthy();
  await act(async () => {
    node?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {});
}

const A = {
  eventId: "evt_aaa0000000000001",
  action: "task.created",
  occurredAt: "2026-11-19T01:20:00Z",
  recordedAt: "2026-11-19T01:20:01Z",
  outcome: "succeeded",
  actor: { type: "human", id: "user:2f3a4b5c6d7e8f90", displayName: "李思" },
  resource: { type: "approval", id: "ap_1122334455667788" },
  requestId: "req-a-1",
};
const B = {
  eventId: "evt_bbb0000000000002",
  action: "approval.expired",
  occurredAt: "2026-11-19T03:40:00Z",
  recordedAt: "2026-11-19T03:40:01Z",
  outcome: "failed",
  actor: { type: "human", id: "user:9988776655443322", displayName: "王五" },
  resource: { type: "approval", id: "ap_9988776655443322" },
  requestId: "req-b-2",
};
const C = {
  eventId: "evt_ccc0000000000003",
  action: "login",
  // 故意没有 occurredAt —— 缺值行两向恒末。
  recordedAt: "2026-11-19T05:00:01Z",
  outcome: "succeeded",
  actor: { type: "human", id: "user:1010101010101010", displayName: "赵六" },
  resource: { type: "task", id: "tk_1010101010101010" },
  requestId: "req-c-3",
};
const SERVICE_ORDER = [A, B, C]; // 服务回行序（断言清除后回到它）。

function answerRows(rows: unknown[]): void {
  api.fetchJSON.mockImplementation(async () => ({ items: rows }));
}

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

describe("R190 ① column sort writes the address, never the service", () => {
  it("clicking 时间 writes asort/adir, reorders rows, backfills aria-sort and asks nothing", async () => {
    answerRows(SERVICE_ORDER);
    await render("/audit");
    expect(rowsOrder()).toEqual(["evt_aaa0000000000001", "evt_bbb0000000000002", "evt_ccc0000000000003"]);
    const readsBefore = listReads().length;

    await clickTestId("aud-sort-button-time"); // asc
    expect(pairs()).toContain("asort=time");
    expect(pairs()).toContain("adir=asc");
    expect(ariaSortOf("time")).toBe("ascending");
    // 时间升序：01:20 → 03:40 → 缺值恒末
    expect(rowsOrder()).toEqual(["evt_aaa0000000000001", "evt_bbb0000000000002", "evt_ccc0000000000003"]);

    await clickTestId("aud-sort-button-time"); // desc
    expect(ariaSortOf("time")).toBe("descending");
    // 降序：有值的倒过来，缺值仍在最后
    expect(rowsOrder()).toEqual(["evt_bbb0000000000002", "evt_aaa0000000000001", "evt_ccc0000000000003"]);

    await clickTestId("aud-sort-button-time"); // cleared
    expect(ariaSortOf("time")).toBe("none");
    expect(pairs().some((p) => p.startsWith("asort="))).toBe(false);
    expect(pairs().some((p) => p.startsWith("adir="))).toBe(false);
    expect(rowsOrder(), "cleared returns the service order").toEqual([
      "evt_aaa0000000000001",
      "evt_bbb0000000000002",
      "evt_ccc0000000000003",
    ]);

    expect(listReads().length, "sorting asks the ledger nothing").toBe(readsBefore);
    for (const url of listReads()) {
      expect(url, "请求 URL 从不带排序参").not.toMatch(/asort=|adir=|sort=|order=/);
    }
  });
});

describe("R190 ② sort × window coexist, the window switch keeps its own contract", () => {
  it("switching the tier while sorted: one new read with from/to, sort handled per live behaviour", async () => {
    answerRows(SERVICE_ORDER);
    await render("/audit?asort=action&adir=asc");
    expect(ariaSortOf("action")).toBe("ascending");
    const readsBefore = listReads().length;

    await clickTestId("aud01-filter-window-24h");
    expect(listReads().length, "切窗恰好一读").toBe(readsBefore + 1);
    const last = listReads()[listReads().length - 1] ?? "";
    expect(last, "服务端请求带 from/to 逐字").toMatch(/[?&]from=/);
    expect(last).toMatch(/[?&]to=/);
    expect(last, "排序参从不进请求").not.toMatch(/asort=|adir=/);
    // 并存关系按现状锁：切窗保留排序维度（audit.window「keeps action, operator…」
    // 的同族契约——若现场清掉排序参，此处 FAIL 即为现场差异证据，按实跑记录）。
    expect(pairs(), "切窗后地址仍带排序对（并存，现状锁）").toEqual(
      expect.arrayContaining(["asort=action", "adir=asc"]),
    );
    expect(ariaSortOf("action"), "切窗后 aria-sort 回填不丢").toBe("ascending");
  });
});

describe("R190 ③ removing the type chip deletes only that dimension", () => {
  it("chip × 删 type/action 维、排序保持、重取一次且请求无排序参", async () => {
    answerRows([A, B, C]);
    await render("/audit?type=task.created&asort=time&adir=desc");
    expect(ariaSortOf("time")).toBe("descending");
    const chip = document.querySelector('[data-testid="aud-chip-action-clear"]') as HTMLButtonElement | null;
    expect(chip, "type 维的 chip（wire 名 action）在场").toBeTruthy();

    const readsBefore = listReads().length;
    await clickTestId("aud-chip-action-clear");
    expect(listReads().length, "删维触发恰一读").toBe(readsBefore + 1);
    expect(pairs().some((p) => p.startsWith("type="))).toBe(false);
    expect(pairs(), "排序对保持").toEqual(expect.arrayContaining(["asort=time", "adir=desc"]));
    expect(ariaSortOf("time"), "排序态不丢").toBe("descending");
    const last = listReads()[listReads().length - 1] ?? "";
    expect(last, "新请求无 type/action 过滤、无排序参").not.toMatch(/action=|asort=|adir=/);
  });
});

describe("R190 ④ illegal sort params rewrite nothing", () => {
  it("?sort=nope&dir=sideways（非现场参名）与非法 asort/adir 都原样保留、无排序生效", async () => {
    answerRows(SERVICE_ORDER);
    await render("/audit?sort=nope&dir=sideways&asort=__what__&adir=up");
    // 地址逐字保留：四个参都没被改写/吞掉
    expect(pairs()).toEqual(
      ["adir=up", "asort=__what__", "dir=sideways", "sort=nope"].sort(),
    );
    // 不成对/不认识的排序值=无排序：所有列 aria-sort=none，行序=服务回行序
    for (const column of ["time", "actor", "action", "resource"]) {
      expect(ariaSortOf(column), `aud-sort-head-${column}`).toBe("none");
    }
    expect(rowsOrder()).toEqual(["evt_aaa0000000000001", "evt_bbb0000000000002", "evt_ccc0000000000003"]);
    // 读数行如实。现场裁决：工单点名的 aud5-row-count 在全 src 不存在——
    // 本模块的计数位=aria-live 读数行 aud01-status（L1546，文本「已显示 N 条
    // 审计事件（窗口）…」），按其现名锁。
    const countText = document.querySelector('[data-testid="aud01-status"]')?.textContent ?? "";
    expect(countText, "读数行报三行").toContain("已显示 3 条审计事件");
    expect(listReads().length, "非法参不触发额外读").toBe(1);
  });
});
