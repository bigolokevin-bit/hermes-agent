import { describe, expect, it } from "vitest";
import { resolveHashTarget } from "@/shell/bridge";

const AUTH = new Set([
  "/", "/sessions", "/files", "/analytics", "/models", "/logs", "/cron",
  "/skills", "/plugins", "/mcp", "/pairing", "/channels", "/webhooks",
  "/system", "/profiles", "/profiles/new", "/config", "/env", "/docs",
  "/employees", "/employees/:employeeId", "/approvals", "/runs",
]);

const target = (hash: string) => {
  const t = resolveHashTarget(hash, AUTH);
  return `${t.pathname}${t.search}`;
};

describe("console hash bridge arbitration (stage 2)", () => {
  it("serves visible-tab forms", () => {
    expect(target("#/overview")).toBe("/overview");
    expect(target("#/overview?tab=usage")).toBe("/overview?tab=usage");
    expect(target("#/employees")).toBe("/employees");
    expect(target("#/employees?tab=matrix")).toBe("/employees?tab=matrix");
    expect(target("#/work?tab=runs")).toBe("/work?tab=runs");
    expect(target("#/approvals?tab=history")).toBe("/approvals?tab=history");
    expect(target("#/capabilities?tab=tools")).toBe("/capabilities?tab=tools");
    expect(target("#/system?tab=events")).toBe("/system?tab=events");
  });

  it("keeps existing App paths authoritative on compat-module conflicts", () => {
    expect(target("#/sessions")).toBe("/sessions");
    expect(target("#/metrics")).toBe("/analytics");
  });

  it("resolves redirect-only A.2 forms without navigation entries", () => {
    expect(target("#/cron")).toBe("/work");
    expect(target("#/skills")).toBe("/capabilities");
    expect(target("#/models")).toBe("/capabilities?tab=models");
    expect(target("#/channels")).toBe("/capabilities?tab=channels");
    expect(target("#/skills?tab=tools")).toBe("/capabilities?tab=tools");
    expect(target("#/models?tab=budget")).toBe("/capabilities?tab=models");
    expect(target("#/channels?tab=groups")).toBe("/capabilities?tab=channels");
  });

  it("normalizes tab-level compat rows onto canonical targets", () => {
    expect(target("#/knowledge?tab=scope")).toBe("/knowledge");
    expect(target("#/knowledge?tab=ingest")).toBe("/knowledge?tab=sources");
    // P0 n1: retrieval/citations address the knowledge module's own panels
    // through ?panel=; they are no longer aliased onto the outer evidence tab.
    expect(target("#/knowledge?tab=retrieval")).toBe("/knowledge?tab=spaces&panel=retrieval");
    expect(target("#/knowledge?tab=citations")).toBe("/knowledge?tab=spaces&panel=evidence");
    expect(target("#/identity?tab=tenant")).toBe("/identity");
    expect(target("#/identity?tab=admins")).toBe("/identity?tab=people&view=admins");
    expect(target("#/approvals?tab=mine")).toBe("/approvals?tab=pending&view=mine");
    expect(target("#/approvals?tab=policy")).toBe("/approvals");
    expect(target("#/work?tab=cron")).toBe("/work?tab=board&view=cron");
    // R39 compat: security is App-mounted (SecurityModulePage); the bridge
    // keeps the URL as-is instead of rewriting it onto the events pane.
    expect(target("#/system?tab=security")).toBe("/system?tab=security");
    expect(target("#/system?tab=retention")).toBe("/system?tab=events");
    expect(target("#/org")).toBe("/identity");
    expect(target("#/access")).toBe("/identity?tab=roles");
    expect(target("#/audit")).toBe("/system?tab=events");
  });

  it("lands default-tab query spellings on the canonical bare path", () => {
    expect(target("#/identity?tab=people")).toBe("/identity");
    expect(target("#/work?tab=board")).toBe("/work");
  });

  it("keeps employee-detail zone forms", () => {
    expect(target("#/employees/e1")).toBe("/employees/e1");
    expect(target("#/employees/e1?zone=config")).toBe("/employees/e1/config");
    expect(target("#/employees/e1?zone=tasks")).toBe("/employees/e1/tasks");
    expect(target("#/employees/e1?zone=runs")).toBe("/employees/e1/runs");
    expect(target("#/employees/e1?zone=evidence")).toBe("/employees/e1/evidence");
    // ZONE_ALIAS spellings land on the explicit workbench query form.
    expect(target("#/employees/e1?zone=overview")).toBe("/employees/e1?zone=workbench");
    expect(target("#/employees/e1?zone=chat")).toBe("/employees/e1?zone=workbench");
    expect(target("#/employees/e1?zone=audit")).toBe("/employees/e1/evidence");
  });

  it("falls back unknown forms to overview (PRD §7, no dead links)", () => {
    expect(target("#/frobnicate")).toBe("/overview");
    expect(target("#/employees")).not.toBe("/overview"); // sanity: known stays
    expect(target("#/")).toBe("/overview");
  });

  it("keeps unknown extra query params", () => {
    expect(target("#/overview?employee=e1&x=2")).toBe("/overview?employee=e1&x=2");
  });
});
