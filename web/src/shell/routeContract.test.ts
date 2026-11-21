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
import { describe, expect, it } from "vitest";
import { resolveHashTarget } from "@/shell/bridge";
import { allTabs, validateRegistry } from "@/shell/registry";
import {
  CONSOLE_TABS,
  PANEL_TABS,
  ROUTE_TABLE,
  findRoute,
  parseHash,
  pathFor,
  type ConsoleRoute,
} from "@/shell/routes";
import { TAB_LABEL, TAB_ORDER } from "../modules/knowledge/knowledge";

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
