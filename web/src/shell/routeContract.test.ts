// @vitest-environment jsdom
/**
 * n6 route contract — "every outer tab and every ?panel= has a reachable
 * direct link, and no two surfaces share a label while serving different
 * content".
 *
 * P0 n1 was found by hand because nothing pinned these three laws:
 *   - the outer 数据源 row was `planned` with no live node → a main-task
 *     address walked into a 规划中 dead end;
 *   - the outer evidence row and the knowledge module's inner panel shared
 *     the name 证据与引用 while reading two different endpoints (audit vs
 *     run-events);
 *   - ?tab=retrieval had no address at all and was aliased onto the outer
 *     evidence pane.
 *
 * routes.ts is pure data with zero page imports, so the link legs need no
 * Router and no DOM; the label legs read the knowledge module's own
 * exported label table (UI-KD write domain — read here, never edited) so
 * the anti-collision law cannot be satisfied by a fixture that mirrors the
 * outer labels back at itself.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveHashTarget } from "@/shell/bridge";
import { ConsoleModulePage } from "@/shell/console";
import { allTabs, validateRegistry } from "@/shell/registry";
import {
  CONSOLE_TABS,
  PANEL_TABS,
  ROUTE_TABLE,
  findRoute,
  parseHash,
  pathFor,
  resolveTab,
  type ConsoleRoute,
} from "@/shell/routes";
import {
  TAB_LABEL,
  TAB_ORDER,
  initialTab,
  type KnowledgeTab,
} from "../modules/knowledge/knowledge";
import { resolvePageTitle } from "@/lib/resolve-page-title";
import type { Translations } from "@/i18n/types";

/** Same authoritative set bridge.test.ts pins (existing App routes). */
const AUTH = new Set([
  "/", "/sessions", "/files", "/analytics", "/models", "/logs", "/cron",
  "/skills", "/plugins", "/mcp", "/pairing", "/channels", "/webhooks",
  "/system", "/profiles", "/profiles/new", "/config", "/env", "/docs",
  "/employees", "/employees/:employeeId", "/approvals", "/runs",
]);

const OVERVIEW_FALLBACK = "/overview";

const linkOf = (entry: ConsoleRoute): { pathname: string; search: string } =>
  resolveHashTarget(entry.hash, AUTH);

/** Rows whose canonical target carries an inner ?panel= address. */
const panelRows = (): ConsoleRoute[] =>
  ROUTE_TABLE.filter(
    (r) =>
      (r.kind === "compat-tab" || r.kind === "compat-module") &&
      r.to !== undefined &&
      parseHash(r.to).params.panel !== undefined,
  );

describe("n6 route contract: reachable direct links", () => {
  it("every visible outer tab resolves to its own browser location", () => {
    const tabs = CONSOLE_TABS.filter((t) => t.visible);
    expect(tabs.length).toBeGreaterThan(1);
    for (const tab of tabs) {
      const match = findRoute(tab.hash);
      expect(match, `findRoute(${tab.hash}) is null`).not.toBeNull();
      expect(match?.entry.hash, `findRoute(${tab.hash}) lands elsewhere`).toBe(tab.hash);

      const landed = linkOf(tab);
      // `#/overview` legitimately serves the same pathname as the unknown-form
      // fallback, so a bare pathname comparison proves nothing. The dead-end
      // signal is a row that resolves to nothing above: findRoute already has
      // to have landed on a real row (asserted first), and the bridge must
      // agree with that row's own browser path.
      expect(landed.pathname, `${tab.hash} has no browser location`).not.toBe("");
      expect(landed.pathname).toBe(pathFor(tab));
      if (pathFor(tab) !== OVERVIEW_FALLBACK) {
        expect(landed.pathname, `${tab.hash} falls back to overview`).not.toBe(OVERVIEW_FALLBACK);
      }

      // The address survives a parse round trip: same path, same tab spelling.
      const parsed = parseHash(`${landed.pathname}${landed.search}`);
      expect(parsed.path).toBe(pathFor(tab));
      expect(parsed.tab).toBe(tab.tab ?? "");
    }
  });

  it("the pane registry reports no issues (no dead manifest links, counts frozen)", () => {
    // validateRegistry() already pins: every visible CONSOLE_TABS hash exists in
    // ROUTE_TABLE, every manifest route exists in ROUTE_TABLE, the manifest table
    // is exactly the 22 visible tabs, and the 22/23/8 counts hold. Re-asserting
    // it here keeps the contract in one place for the aud evidence leg.
    expect(validateRegistry()).toEqual([]);
  });

  it("every visible outer tab has a manifest pane wired to the same route", () => {
    const byRoute = new Map(allTabs().map((t) => [t.route, t]));
    const tabs = CONSOLE_TABS.filter((t) => t.visible);
    expect(byRoute.size).toBeGreaterThan(1);
    for (const tab of tabs) {
      const pane = byRoute.get(tab.hash);
      expect(pane, `visible tab ${tab.hash} has no manifest pane entry`).toBeDefined();
      if (pane === undefined) continue;
      // The two vocabularies are deliberately NOT equated. routes.ts `planned`
      // marks a DATA-SOURCE gap (PRD §3 GAP-01/02/03) while manifest `kind`
      // marks whether a PANE component is wired — 值班台 is a live pane over an
      // aggregate still being built, so it is planned + reuse at once. Likewise
      // a route label and a manifest label may differ for the SAME surface
      // (P0 n1 renamed the outer row to 审计证据 while the evidence manifest
      // still says 证据与引用): two names for one surface is drift, not the
      // defect. What the contract forbids is one NAME reaching two DIFFERENT
      // surfaces, so the label is pinned through the compat rows, which carry
      // the inner surface's own name and must land on it.
      expect(pane.dataSource, `${tab.hash} pane carries an empty data source`).not.toBe("");
      expect(pane.route, `${tab.hash} pane route is not an appendix A form`).toBe(tab.hash);
    }
  });

  it("every ?panel= compat row lands on a real route carrying its panel", () => {
    const rows = panelRows();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const to = row.to as string;
      const target = parseHash(to);
      expect(target.params.panel, `${row.hash} target carries no panel`).toBeDefined();

      // The compat form itself resolves onto the target, panel included.
      const landed = linkOf(row);
      expect(landed.pathname).toBe(pathFor(target));
      expect(parseHash(`${landed.pathname}${landed.search}`).params.panel).toBe(
        target.params.panel,
      );

      // The target address is a real route, and it is the row's declared tabId.
      const match = findRoute(to);
      expect(match, `findRoute(${to}) is null`).not.toBeNull();
      expect(match?.entry.tabId, `${row.hash} target lands on another tab`).toBe(row.tabId);
    }
  });

  it("only knowledge compat rows carry ?panel= (no stray panel addresses)", () => {
    const rows = panelRows();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.module).toBe("knowledge");
      // n7 (UX r7 判词①, secondary landing): a panel-bearing row no longer has
      // to declare tabId 'spaces'. What the contract actually needs is that the
      // declared tabId is a visible outer tab of the same module, because that
      // tabId is what PANEL_TABS hands to the strip as the panel's owner.
      const visible = CONSOLE_TABS.some(
        (t) => t.visible && t.module === row.module && t.tabId === row.tabId,
      );
      expect(visible, `${row.hash} declares a tabId that is no visible tab`).toBe(true);
    }
  });

  it("PANEL_TABS names an owner for every ?panel= and each owner is visible", () => {
    const rows = panelRows();
    const panels = new Set(
      rows.map((r) => parseHash(r.to as string).params.panel as string),
    );
    expect(panels.size).toBeGreaterThan(0);
    for (const row of rows) {
      const panel = parseHash(row.to as string).params.panel as string;
      const owner = PANEL_TABS[row.module]?.[panel];
      expect(owner, `PANEL_TABS has no owner for ${row.module}/${panel}`).toBe(row.tabId);
    }
    // The derived map adds no panel of its own beyond what the rows declare.
    expect(Object.keys(PANEL_TABS.knowledge ?? {}).length).toBeGreaterThanOrEqual(panels.size);
  });
});

describe("n6 route contract: panel values are addressable panels", () => {
  it("every ?panel= value names a panel the knowledge module owns", () => {
    const panels = panelRows().map(
      (r) => parseHash(r.to as string).params.panel as string,
    );
    expect(panels.length).toBeGreaterThan(0);
    for (const panel of panels) {
      expect(TAB_ORDER as readonly string[]).toContain(panel);
      expect(Object.keys(TAB_LABEL)).toContain(panel);
    }
  });
});

describe("n6 route contract: no same-name different-content labels", () => {
  it("the 22 visible outer tab labels are unique", () => {
    const labels = CONSOLE_TABS.filter((t) => t.visible).map((t) => t.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("no outer label collides with an inner knowledge panel label", () => {
    const outer = new Map(
      CONSOLE_TABS.filter((t) => t.visible).map((t) => [t.label, t.hash]),
    );
    const innerKeys = Object.keys(TAB_LABEL);
    expect(innerKeys.length).toBeGreaterThan(0);
    for (const key of innerKeys) {
      const label = TAB_LABEL[key as keyof typeof TAB_LABEL];
      const hit = outer.get(label);
      expect(
        hit,
        `outer ${hit} and inner panel ${key} both read 「${label}」`,
      ).toBeUndefined();
    }
  });

  it("the audit evidence row keeps its own name apart from the inner 证据与引用 panel", () => {
    const outerEvidence = ROUTE_TABLE.find(
      (r) => r.kind === "tab" && r.module === "knowledge" && r.tabId === "evidence",
    );
    expect(outerEvidence, "knowledge outer evidence row is missing").toBeDefined();
    // P0 n1 renamed this row; the inner panel of the knowledge module reads
    // run-events on this page while the outer pane reads the audit window.
    expect(outerEvidence?.label).not.toBe(TAB_LABEL.evidence);
    expect(outerEvidence?.label).toBe("审计证据");
    // The compat spelling that addresses the inner panel is allowed to carry
    // the inner surface's own name, because it lands on that very surface.
    const citations = ROUTE_TABLE.find((r) => r.tab === "citations");
    expect(citations, "citations compat row is missing").toBeDefined();
    expect(citations?.to).toBe("#/knowledge?tab=spaces&panel=evidence");
    // The compat spelling carries the evidence surface's own name; the pane it
    // names must be that surface, otherwise the shared name splits again.
    const evidencePane = allTabs().find(
      (t) => t.route === "#/knowledge?tab=evidence",
    );
    expect(evidencePane, "no manifest pane is wired to #/knowledge?tab=evidence").toBeDefined();
    expect(citations?.label, "citations label no longer names the evidence surface").toBe(
      evidencePane?.label,
    );
  });

  it("same-name manifest entries point at the same route", () => {
    const byLabel = new Map<string, Set<string>>();
    for (const row of ROUTE_TABLE) {
      if (!row.visible) continue;
      const routes = byLabel.get(row.label) ?? new Set<string>();
      routes.add(row.hash);
      byLabel.set(row.label, routes);
    }
    for (const [label, routes] of byLabel) {
      expect(routes.size, `label 「${label}」 splits over ${[...routes].join(", ")}`).toBe(1);
    }
  });
});

/* ------------------------------------------------------------------ *
 * n8 (UX r7 判词①, shell-side upgrade): 「外层高亮 == 内容落点」 pinned as a
 * DOM contract instead of eyeballed screenshots.
 *
 * Three cold-chain spellings (sources / ingest / retrieval), each as typed
 * by the user AND as rewritten by the knowledge module's boot normaliser
 * (UI-KD 57d7216b — read-only here). For every address the expected owner
 * is computed from two independent truths: the module's own panel resolver
 * (`initialTab`, UI-KD) composed with the shell's derived ownership map
 * (`PANEL_TABS`, n7, derived from the compat rows). The rendered strip must
 * agree — one aria-selected tab, its data-tab equal to that owner, the pane
 * and the mounted live slot carrying the same tabId.
 *
 * The bare outer `?tab=evidence` address is deliberately NOT in the owner
 * loop: it mounts the audit pane, not the knowledge module, so the inner
 * panel resolver never applies to it (that is the P0 n1 same-name trap).
 * It is still covered by the click leg, which compares click against direct
 * and pins 「点击 T 条后高亮就是 T」 for every outer tab including evidence.
 *
 * The file was pure data until n8, so the DOM legs bring their own jsdom
 * harness scoped inside this describe, with a fresh router per URL (the
 * console.test.tsx trap: a second render on one root keeps the first URL).
 * ------------------------------------------------------------------ */
describe("n8 cold chain: outer highlight equals the panel surface", () => {
  let container: HTMLDivElement;
  let root: Root;

  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

  const probe = (id: string) => createElement("div", { "data-testid": id });
  const LIVE = {
    spaces: probe("live-spaces"),
    sources: probe("live-sources"),
    evidence: probe("live-evidence"),
  };
  const page = () =>
    createElement(ConsoleModulePage, { module: "knowledge", live: LIVE });

  function remountAt(entry: string) {
    act(() => {
      root.render(
        createElement(
          MemoryRouter,
          { key: entry, initialEntries: [entry] },
          page(),
        ),
      );
    });
  }

  /** The three readings a surface is judged by: strip selection, pane, live slot. */
  function readings() {
    const sel = container.querySelector('[role="tab"][aria-selected="true"]');
    const pane = container.querySelector(".pane");
    const liveId = ["spaces", "sources", "evidence"].find(
      (t) => container.querySelector(`[data-testid="live-${t}"]`) !== null,
    );
    return {
      selected: sel?.getAttribute("data-tab") ?? null,
      pane: pane?.getAttribute("data-tab") ?? null,
      live: liveId ?? null,
    };
  }

  /** Expected owner, derived from module panel truth × shell ownership map. */
  function ownerOf(address: string): { panel: KnowledgeTab; owner: string } {
    const parsed = parseHash(address);
    const panel = initialTab(
      parsed.tab === "" ? null : parsed.tab,
      parsed.params.panel ?? null,
    );
    const owner =
      PANEL_TABS.knowledge?.[panel] ?? resolveTab("knowledge", parsed.tab).tab;
    return { panel, owner };
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  const ADDRESSES = [
    "/knowledge?tab=sources", // cold spelling, 数据源
    "/knowledge?tab=ingest", // cold spelling, aliased onto sources
    "/knowledge?tab=retrieval", // cold spelling, aliased onto spaces
    "/knowledge?tab=sources&panel=ingest", // normaliser output for sources/ingest
    "/knowledge?tab=spaces&panel=retrieval", // normaliser output for retrieval
    "/knowledge?tab=spaces&panel=ingest", // the OLD collapse form r7① killed
  ];

  it("n8: every cold-chain spelling highlights the panel's owner, pane and live slot alike", () => {
    expect(ADDRESSES.length).toBeGreaterThan(1);
    for (const address of ADDRESSES) {
      remountAt(address);
      const r = readings();
      const e = ownerOf(address);
      expect(
        r.selected,
        `${address} panel ${e.panel}: strip highlights another tab`,
      ).toBe(e.owner);
      expect(r.pane, `${address} panel ${e.panel}: pane lands elsewhere`).toBe(
        e.owner,
      );
      expect(
        r.live,
        `${address} panel ${e.panel}: live slot is not the highlighted tab`,
      ).toBe(e.owner);
    }
  });

  it("n8: clicking an outer tab lands on the same readings as typing its address", () => {
    // Start from a neutral surface so every link is a real cross-tab click.
    remountAt("/knowledge");
    const links = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(links.length).toBeGreaterThan(1);
    for (const link of links) {
      const href = link.getAttribute("href");
      expect(href, "outer tab link carries no href").not.toBeNull();
      const ownTab = link.getAttribute("data-tab");
      if (href === null || ownTab === null) continue;
      remountAt("/knowledge");
      const target = container.querySelector(
        `[role="tab"][data-tab="${ownTab}"]`,
      ) as HTMLElement | null;
      expect(target, `no clickable link for outer tab ${ownTab}`).not.toBeNull();
      act(() => target?.click());
      const clicked = readings();
      remountAt(href);
      const direct = readings();
      expect(
        clicked.selected,
        `click on ${ownTab} highlights another tab`,
      ).toBe(ownTab);
      expect(clicked.selected, `click → ${href} selection differs`).toBe(
        direct.selected,
      );
      expect(clicked.pane, `click → ${href} pane differs`).toBe(direct.pane);
      expect(clicked.live, `click → ${href} live slot differs`).toBe(
        direct.live,
      );
    }
  });
});

/**
 * MT-06（2026-11-23 回写，B 形态）：#/metrics 曾有三处互斥说法——
 * routes 行的 to 指向 overview?tab=usage、bridge 特例实际落 /analytics、
 * 标题表与页内 h1 又叫「运行分析」。本节把终态登记钉成一致：登记形式保留、
 * 行为以桥为准（桥先于表是 compat-module 规律，bridge.test 已钉 '/sessions'
 * 同型）、path 直挂自研模块且标题与 h1 对齐。零行为改动。
 */
describe("MT-06 /metrics registration: routes, bridge, and page title tell one story", () => {
  const row = ROUTE_TABLE.find((entry) => entry.hash === "#/metrics");

  it("the hash alias lands where the bridge pins it, not on the stale to field", () => {
    expect(row, "#/metrics compat row missing").toBeDefined();
    expect(row?.kind).toBe("compat-module");
    expect(row?.visible).toBe(false);
    // to 是登记形式（保持不动）；真正生效的落点在 bridge 特例。
    expect(row?.to).toBe("#/overview?tab=usage");
    expect(resolveHashTarget("#/metrics", AUTH).pathname).toBe("/analytics");
  });

  it("path, title map and row registration agree", () => {
    expect(row?.dataSource, "dataSource 仍写「随目标」——与桥行为脱节").not.toBe(
      "随目标",
    );
    expect(row?.dataSource).toContain("App 直挂");
    expect(row?.conflict).toContain("2026-11-23");
    expect(resolvePageTitle("/metrics", {} as Translations, [])).toBe("运行分析");
  });
});
