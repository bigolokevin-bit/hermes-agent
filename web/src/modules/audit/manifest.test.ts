// @vitest-environment node
// T33 manifest: the two shapes the shell reads, checked against the shell's own
// rules — a route that exists (never a dead link), an icon key App already
// resolves, and a label that matches the pane the route table names.

import { describe, expect, it } from "vitest";

import { ROUTE_TABLE } from "@/shell/routes";
import auditManifest, { auditModuleManifest } from "./manifest";

describe("audit manifest", () => {
  it("is the flat nav shape with the Chinese label and an existing icon key", () => {
    expect(auditModuleManifest).toEqual({
      id: "audit",
      path: "/system",
      label: "审计事件",
      icon: "Shield",
    });
  });

  it("names the same tab the route table already carries", () => {
    const row = ROUTE_TABLE.find((entry) => entry.hash === auditManifest.tabs[0]!.route);
    expect(row?.label).toBe(auditModuleManifest.label);
    expect(row?.visible).toBe(true);
  });

  it("declares the three endpoints it actually calls", () => {
    expect(auditManifest.tabs[0]!.dataSource).toBe("/api/audit /api/audit/detail?id= /api/audit/verify?from=&to=");
  });

  it("is data only and stays 'planned' — the pane mount is the wiring lane's", () => {
    expect(auditManifest.module).toBe("audit");
    expect(auditManifest.tabs).toHaveLength(1);
    expect(auditManifest.tabs[0]!.kind).toBe("planned");
    expect(auditManifest.tabs[0]!.reuse).toBeUndefined();
  });

  it("the registry finds no problem with it", async () => {
    const { validateRegistry, getManifest } = await import("@/shell/registry");
    expect(validateRegistry().filter((issue) => issue.includes("audit"))).toEqual([]);
    expect(getManifest("audit")?.tabs[0]?.label).toBe("审计事件");
  });
});
