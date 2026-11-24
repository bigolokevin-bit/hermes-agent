// @vitest-environment node
// AU-03② — dead_letter 专项视图的诚实处置：入口不存在，且不造假列表。
//
// LIVE PROBE (2026-11-24, opsadmin cookie @127.0.0.1:8092, raw bodies in
// evidence/au03b-samples/dl-*.json + action-dead-letter.json, table in
// evidence/au03b-deadletter-probes.txt): the baseline bounded read returns
// total=494. Adding each of nine dead_letter-ish parameters — kind / event_type
// / type / status / category / queue / topic / view / is_dead_letter — returns
// HTTP 200 with total=494 UNCHANGED: the route ignores all of them, so none is
// a real filter. `action=dead_letter` answers total=0 (no such live code). And
// the 400 body names the seven filters the route DOES honour — none is a dead
// letter view. Conclusion: THIS deployment has no server-side dead_letter
// projection at the audit read.
//
// So the honest disposition is: the surface offers NO dead_letter entry. A dead
// letter count is `null` (未接入), never a fabricated 0 and never a filtered
// list dressed up as a dead-letter view. Wiring the projection is a DOMAIN
// (seakoi-agent-os) task — filed as a requirement in DONE-AU-03 for L0 to
// adjudicate (§8.4), never faked in the frontend.

import { describe, expect, it } from "vitest";

import { listUrl, NO_FILTERS, type ListFilters } from "./api";
import { auditPageFrom, eventTypeChoices } from "./model";

// The parameters the read route accepts, per its own 400 body (probed
// 2026-11-19 and re-shown 2026-11-24): runId taskId actorId resourceId action
// from to. Plus the page's own limit/cursor. Nothing else rides the wire.
const ALLOWED_WIRE_KEYS = ["limit", "action", "from", "to", "actorId", "resourceId", "cursor"];

describe("AU-03② — no dead_letter entry, no fake list", () => {
  it("the wire is only the accepted filter keys — no dead_letter spelling ever rides out", () => {
    const filters: ListFilters = {
      action: "task.created",
      from: "2026-11-01T00:00:00.000Z",
      to: "2026-11-24T00:00:00.000Z",
      actor: "employee-api",
      resource: "ap_1",
    };
    const url = new URL(listUrl("c1", filters, 25), "http://console.local");
    const sent = [...url.searchParams.keys()];
    for (const key of sent) {
      expect(ALLOWED_WIRE_KEYS, key).toContain(key);
    }
    for (const dead of ["kind", "event_type", "type", "status", "category", "queue", "topic", "view", "is_dead_letter"]) {
      expect(sent, dead).not.toContain(dead);
    }
  });

  it("an unfiltered scan is not offered: default listUrl carries only limit (the require_any 400 case)", () => {
    // listUrl with NO filters produces only `limit` — which the route 400s. The
    // page never asks this: it always carries a bounded window (see the window
    // consistency test). Pin the shape so no caller mistakes it for a real read.
    expect(listUrl(null, NO_FILTERS)).toBe("/agent-api/api/audit?limit=50");
    expect(listUrl(null, NO_FILTERS)).not.toMatch(/kind=|dead_letter|category=/);
  });

  it("dead_letter is not one of the offered type codes (it is not a live action)", () => {
    expect(eventTypeChoices().some((c) => /dead/i.test(c.value) || /dead/i.test(c.label))).toBe(false);
    expect(eventTypeChoices().some((c) => c.value === "dead_letter")).toBe(false);
  });

  it("a dead_letter-shaped answer field is never dressed up as a count", () => {
    // Defensive read model: an absent count stays absent, never 0. There is no
    // dead_letter projection to read, so no page field may report one — and a
    // payload that carries no dead_letter key must not fabricate one.
    const page = auditPageFrom({ events: [{ id: "e1", action: "task.created" }] })!;
    expect(page).not.toHaveProperty("deadLetter");
    expect(page).not.toHaveProperty("dead_letter");
    expect(page).not.toHaveProperty("deadLetterCount");
    // and a stray dead_letter number in the payload is NOT lifted into a total
    expect(auditPageFrom({ events: [], dead_letter: 7 })!.total).toBeNull();
  });
});
