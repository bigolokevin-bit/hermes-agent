// @vitest-environment node
// AU-03① — 事件类型枚举与后端同源。
//
// THE OBSERVED SET is the complete list of `action` values sampled VERBATIM off
// the running BFF through the opsadmin-authenticated read leg on 2026-11-24:
// full bounded window, 10 cursor pages, 494 rows, 21 distinct codes
// (raw JSON in the lane worktree: evidence/au03b-samples/, table in
// evidence/au03b-enumeration.txt). Each of the five codes this round ADDED to
// the picker was individually re-probed and answers its own rows with every
// hit carrying the exact code (approval.denied=2, employee.updated=1,
// workstation.unbound=7, recognition.unknown=17, channel.event_ingested=3);
// the underscore respelling `task_created` answers ZERO. So:
//   picker set == wire set  — no offered code without server effect,
//                             no server code missing from the picker.
// This file is the contract that keeps the two tables one table.

import { describe, expect, it } from "vitest";

import { listUrl } from "./api";
import { actionView, eventTypeChoices, LIVE_ACTION_CODES } from "./model";

/** The 21 codes the service was seen carrying, verbatim (see header). */
const OBSERVED_LIVE_SET: readonly string[] = [
  "approval.consumed",
  "approval.decided",
  "approval.denied",
  "approval.expired",
  "budget.ledger_entry_applied",
  "budget.ledger_ensured",
  "budget.soft_alert_sent",
  "channel.event_ingested",
  "dispatch.event",
  "employee.create.denied",
  "employee.lifecycle.denied",
  "employee.lifecycle.transitioned",
  "employee.updated",
  "employee.created",
  "employee.version.created",
  "grant.created",
  "recognition.unknown",
  "task.created",
  "workstation.bound",
  "workstation.bind_conflict",
  "workstation.unbound",
];

describe("AU-03① — the type filter and the backend read one table", () => {
  it("offers exactly the codes the live ledger carries — nothing more, nothing less", () => {
    expect([...LIVE_ACTION_CODES].sort()).toEqual([...OBSERVED_LIVE_SET].sort());
  });

  it("carries every one of the five codes that used to be missing from the picker", () => {
    for (const code of ["approval.denied", "employee.updated", "workstation.unbound", "recognition.unknown", "channel.event_ingested"]) {
      expect(eventTypeChoices().some((choice) => choice.value === code), code).toBe(true);
    }
  });

  it("no offered choice is a code the wire has never carried (no control that pretends)", () => {
    for (const choice of eventTypeChoices()) {
      expect(OBSERVED_LIVE_SET, choice.value).toContain(choice.value);
    }
  });

  it("the wire codes are sent verbatim — action matches literally", () => {
    for (const choice of eventTypeChoices()) {
      expect(listUrl(null, { action: choice.value, from: "a", to: "b" })).toContain(
        `&action=${encodeURIComponent(choice.value)}`,
      );
    }
    // an underscore respelling is not offered and never reaches the wire as a choice
    expect(eventTypeChoices().some((choice) => choice.value === "task_created")).toBe(false);
  });

  it("labels: word readings where approved, the code's own spelling where not", () => {
    const choices = new Map(eventTypeChoices().map((choice) => [choice.value, choice.label]));
    // words built ONLY from vocabulary this table already approved
    expect(choices.get("approval.denied")).toBe("驳回审批"); // was already mapped under the folded key
    expect(choices.get("employee.updated")).toBe("修改数字员工配置");
    expect(choices.get("workstation.unbound")).toBe("解绑工位"); // inverse of 绑定工位
    // subject tokens nothing here names — own spelling, never a translated claim
    expect(choices.get("recognition.unknown")).toBe("recognition.unknown");
    expect(choices.get("channel.event_ingested")).toBe("channel.event_ingested");
    expect(choices.get("dispatch.event")).toBe("dispatch.event");
  });

  it("no two options share one label — a picker you cannot read apart is a control that pretends", () => {
    const labels = eventTypeChoices().map((choice) => choice.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("the row display law is untouched: an unmapped code still reads 其他事件 on rows", () => {
    // eventTypeChoices changed; actionView did NOT. The ledger rows keep R31.
    expect(actionView("recognition.unknown").label).toBe("其他事件");
    expect(actionView("recognition.unknown").known).toBe(false);
  });
});
