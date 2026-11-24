// @vitest-environment jsdom
// AU-01 — the three context chains of a record (谁 / 哪次运行 / 哪次判定).
//
// 查重结论 (git grep first): `audit.detail.resource.link.test.tsx` owns the
// RESOURCE way out (aud-resource-*), `resourceLinks.test.tsx` owns that table.
// This file owns ONLY the context chains (aud3-chain-*) and the contextLinks
// table — one face, one owner, no rewritten lines.
//
// Pinned per ticket DoD (三类链各有正/负测试 + 无编造链接):
//   actor   正: employee handle → /employees/<裸编号> ; human → /identity?tab=people
//           (到名录不到人 — the zero-route fact rides in the title, 不假承诺);
//           负: system/service → 说值不给链; 无 actor 编号 → 无关联;
//   run     正: runId 带回 → /runs?run=<原值> (RunsModulePage.tsx:1104 读该参数);
//           负: 无 runId → 「无关联」, 页面不拿 correlation 凑;
//   decision正: policyDecisionId 带回 → 值上屏 + 明说无页面 (不链);
//           负: 缺值 → 「无关联」。
// 禁臆造 destinations: every link href lands inside the closed proven set.
// Harness lineage: audit.detail.resource.link.test.tsx (BASE+&detail mount,
// aud02-detail scope, fetch-cost ledger).

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "./AuditEventsModulePage";
import {
  AUDIT_CHAIN_NO_PAGE_TEXT,
  AUDIT_CHAIN_UNRELATED_TEXT,
  actorChainOf,
  runChainOf,
  decisionChainOf,
} from "./contextLinks";
import { auditDetailFrom } from "./model";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const RUN = "rn_01M81AZV6P7TAX8KGXKKTEVZG1";
const PDI = "pd_D538A8B578DC44D49E42A78328";
const EMP = "employee:8812000000000011";

const ROW_FULL = "evt_au01_full_0000000001";
const ROW_HUMAN = "evt_au01_human_0000000001";
const ROW_MACHINE = "evt_au01_machine_0000000001";
const ROW_BARE = "evt_au01_bare_0000000001";

const BASE = "/audit?window=custom&from=2026-11-05T02:00:00Z&to=2026-11-19T02:00:00Z&limit=25";

function rowOf(eventId: string, actor: Record<string, unknown>, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    eventId,
    action: "dispatch.event",
    occurredAt: "2026-11-19T01:20:00Z",
    recordedAt: "2026-11-19T01:20:05Z",
    outcome: "succeeded",
    actor,
    resource: { type: "task", id: "tk_20261119_au01" },
    correlationId: "corr-au01-chain-face",
    requestId: `req-${eventId}`,
    ...extra,
  };
}

const ITEMS = [
  rowOf(ROW_FULL, { type: "employee", id: EMP }, { runId: RUN, policyDecisionId: PDI }),
  rowOf(ROW_HUMAN, { type: "human", id: "1" }),
  rowOf(ROW_MACHINE, { type: "system", id: "runtime-worker" }),
  rowOf(ROW_BARE, {}, { actor: null }),
];

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

async function render(entry: string): Promise<void> {
  await act(async () => {
    if (root) act(() => root?.unmount());
  });
  root = null;
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[entry]}>
        <AuditEventsModulePage />
      </MemoryRouter>,
    );
  });
  await waitFor(() => document.querySelector(".animate-pulse") === null, "skeleton gone");
}

function chain(key: string): Element | null {
  return document.querySelector(`[data-testid='aud02-detail'] [data-testid='aud3-chain-${key}']`);
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));

/** detail 模型（与屏幕同一条 builder，非第二读）。 */
function chainsOf(event: Record<string, unknown>) {
  const detail = auditDetailFrom({ audit: event });
  if (!detail) throw new Error("chainsOf: auditDetailFrom returned null");
  return { detail, actor: actorChainOf(detail.actor), run: runChainOf(detail.links), decision: decisionChainOf(detail.links) };
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      const id = new URL(target, "http://console.test").searchParams.get("id");
      return { audit: ITEMS.find((item) => item.eventId === id) ?? null };
    }
    return { items: ITEMS, nextCursor: null };
  });
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("AU-01 contextLinks table — actor chain", () => {
  it("员工主体 → 详情路由，编号裸值进 href、全 handle 不上屏", () => {
    const { actor } = chainsOf(ITEMS[0]);
    expect(actor.kind).toBe("link");
    if (actor.kind !== "link") return;
    expect(actor.href).toBe("/employees/8812000000000011");
    expect(actor.title).toContain("App.tsx:1376");
  });
  it("成员主体 → 名录页链，title 明说零路由（到名录不到人，不假承诺）", () => {
    const { actor } = chainsOf(ITEMS[1]);
    expect(actor.kind).toBe("link");
    if (actor.kind !== "link") return;
    expect(actor.href).toBe("/identity?tab=people");
    expect(actor.title).toContain("零路由");
    expect(actor.title).not.toContain("编号");
  });
  it("机器主体 → 说值不给链；无编号 → 无关联", () => {
    const machine = chainsOf(ITEMS[2]);
    expect(machine.actor.kind).toBe("no-page");
    // 值照屏幕同词说（model 单源，不在表里另造一份 label）
    expect(machine.actor.kind === "no-page" && machine.actor.label).toBe(machine.detail.actor.label);
    const bare = chainsOf(ITEMS[3]);
    expect(bare.actor.kind).toBe("unrelated");
  });
});

describe("AU-01 contextLinks table — run / decision chains", () => {
  it("runId 带回 → /runs?run= 原值；缺 → 无关联（不拿 correlation 凑）", () => {
    const full = chainsOf(ITEMS[0]);
    expect(full.run.kind).toBe("link");
    if (full.run.kind !== "link") return;
    expect(full.run.href).toBe(`/runs?run=${RUN}`);
    expect(full.run.title).toContain("RunsModulePage.tsx:1104");
    const noRun = chainsOf(ITEMS[1]);
    expect(noRun.run.kind).toBe("unrelated");
    expect(noRun.run.title).toContain("runId");
  });
  it("策略判定带回 → 值上屏明说无页面；缺 → 无关联", () => {
    const full = chainsOf(ITEMS[0]);
    expect(full.decision.kind).toBe("no-page");
    expect(full.decision.kind === "no-page" && full.decision.title).toContain(PDI);
    const noPd = chainsOf(ITEMS[1]);
    expect(noPd.decision.kind).toBe("unrelated");
  });
});

describe("AU-01 record pane — chains render from the one table", () => {
  it("full event: 两条真锚 + 一条说而不链；零编造、机器 id 不上字面", async () => {
    await render(`${BASE}&detail=${ROW_FULL}`);
    await waitFor(() => chain("actor") !== null, "chains painted");

    const actor = chain("actor") as HTMLElement;
    expect(actor.tagName).toBe("A");
    expect(actor.getAttribute("href")).toBe("/employees/8812000000000011");
    expect(actor.getAttribute("target")).toBe("_blank");
    expect(actor.getAttribute("rel")).toBe("noreferrer noopener");

    const run = chain("run") as HTMLElement;
    expect(run.tagName).toBe("A");
    expect(run.getAttribute("href")).toBe(`/runs?run=${RUN}`);
    // 短码上屏、全 id 只在 title（与资源链同一词面纪律）
    expect(run.textContent).toContain("运行 ·");
    expect(run.textContent).not.toContain(RUN);
    expect(run.getAttribute("title")).toContain(RUN);

    const decision = chain("decision") as HTMLElement;
    expect(decision.tagName).toBe("SPAN");
    expect(decision.getAttribute("data-aud-chain-kind")).toBe("no-page");
    expect(decision.textContent).toContain(AUDIT_CHAIN_NO_PAGE_TEXT);

    // the chain block never becomes a fourth reading
    const before = urls();
    await act(async () => {
      run.click();
    });
    expect(urls()).toEqual(before);
  });

  it("bare event: 三链各就各位——名录链/无关联/无关联，「无关联」不是空白也不是「—」", async () => {
    await render(`${BASE}&detail=${ROW_HUMAN}`);
    await waitFor(() => chain("run") !== null, "chains painted");
    const actor = chain("actor") as HTMLElement;
    expect(actor.getAttribute("href")).toBe("/identity?tab=people");
    const run = chain("run") as HTMLElement;
    expect(run.getAttribute("data-aud-chain-kind")).toBe("unrelated");
    expect(run.textContent).toBe(`哪次运行：${AUDIT_CHAIN_UNRELATED_TEXT}`);
    const decision = chain("decision") as HTMLElement;
    expect(decision.getAttribute("data-aud-chain-kind")).toBe("unrelated");
    const box = document.querySelector("[data-testid='aud3-chains']");
    expect(box?.textContent).not.toContain("undefined");
    expect(box?.textContent).not.toContain("null");
  });

  it("destinations are a CLOSED set of proven routes — 禁臆造", () => {
    const probes = ITEMS.map((e) => chainsOf(e));
    const proven = ["/employees/", "/identity?tab=people", "/runs?run="];
    for (const { actor, run } of probes) {
      for (const chain of [actor, run]) {
        if (chain.kind === "link") {
          expect(proven.some((r) => chain.href.startsWith(r)), chain.href).toBe(true);
          expect(chain.href).not.toContain("undefined");
          expect(chain.href).not.toContain("null");
        }
      }
    }
  });
});
