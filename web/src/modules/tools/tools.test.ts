// @vitest-environment node
// T27 pure layer: the route is the real one (the `/api/` segment included), an
// absent value stays absent instead of becoming 0 or a guessed word, and the
// status vocabulary folds without inventing a state the upstream never sent.

import { describe, expect, it } from "vitest";

import {
  GAP,
  SERVERS_PATH,
  STATUS_LABEL,
  beijingMinute,
  isDenied,
  readFailure,
  readServers,
  serversUrl,
  type FailureInfo,
} from "./tools";

describe("the route", () => {
  it("keeps the /api/ segment, which is what makes it the BFF route", () => {
    expect(SERVERS_PATH).toBe("/agent-api/api/mcp/servers");
    expect(serversUrl()).toBe("/agent-api/api/mcp/servers?limit=50");
    expect(serversUrl()).toContain("/api/mcp/servers");
  });

  it("names the GAP it belongs to", () => {
    expect(GAP).toBe("GAP-04");
  });
});

describe("403 and 404 are one state", () => {
  it("denies both, and nothing else", () => {
    expect(isDenied(403)).toBe(true);
    expect(isDenied(404)).toBe(true);
    expect(isDenied(401)).toBe(false);
    expect(isDenied(500)).toBe(false);
    expect(isDenied(200)).toBe(false);
  });
});

describe("reading the answer", () => {
  it("takes the list from wherever the answer hung it", () => {
    const shapes = [
      [{ name: "甲" }],
      { servers: [{ name: "甲" }] },
      { items: [{ name: "甲" }] },
      { data: [{ name: "甲" }] },
      { data: { servers: [{ name: "甲" }] } },
    ];
    for (const shape of shapes) {
      const read = readServers(shape);
      expect(read.kind).toBe("rows");
      if (read.kind === "rows") expect(read.rows).toHaveLength(1);
    }
  });

  it("folds the five spellings of liveness into three states", () => {
    const read = readServers({
      servers: [
        { name: "a", status: "connected" },
        { name: "b", status: "OK" },
        { name: "c", status: "disconnected" },
        { name: "d", status: "Error" },
        { name: "e", status: "probe-v2" },
        { name: "f" },
      ],
    });
    if (read.kind !== "rows") throw new Error("expected rows");
    expect(read.rows.map((row) => row.status)).toEqual([
      "available",
      "available",
      "unavailable",
      "unavailable",
      "unknown",
      "unknown",
    ]);
  });

  it("never turns a missing value into 0, an empty string or a guess", () => {
    const read = readServers({ servers: [{ id: "srv_9c1f2a3b4d5e6f70" }] });
    if (read.kind !== "rows") throw new Error("expected rows");
    const [row] = read.rows;
    expect(row?.name).toBeNull();
    expect(row?.status).toBe("unknown");
    expect(row?.reason).toBeNull();
    expect(row?.checkedAt).toBeNull();
    expect(read.declaredTotal).toBeNull();
    // unknown has no count of its own: nothing here is a 0 standing in for a gap
    expect(STATUS_LABEL.unknown).toBe("—");
  });

  it("counts a row it cannot read instead of painting it", () => {
    const read = readServers({ servers: [{ name: "有名字" }, "纯字符串", null, 42] });
    if (read.kind !== "rows") throw new Error("expected rows");
    expect(read.rows.map((row) => row.name)).toEqual(["有名字"]);
    expect(read.unreadable).toBe(3);
  });

  it("an answer that is not a list is a shape failure, not an empty list", () => {
    for (const payload of [{ status: "ok" }, "servers", null, 7, undefined]) {
      expect(readServers(payload).kind).toBe("shape");
    }
  });

  it("keeps the declared total and the cursor when the answer sends them", () => {
    const read = readServers({ servers: [{ name: "甲" }], total: 128, nextCursor: "cur_2" });
    if (read.kind !== "rows") throw new Error("expected rows");
    expect(read.declaredTotal).toBe(128);
    expect(read.nextCursor).toBe("cur_2");
  });

  it("a nameless but identified row is kept, keyed by what the answer sent", () => {
    const read = readServers({ servers: [{ serverId: "srv_01" }] });
    if (read.kind !== "rows") throw new Error("expected rows");
    expect(read.rows[0]?.rawId).toBe("srv_01");
    expect(read.rows[0]?.name).toBeNull();
  });
});

describe("the reason never becomes engineering text", () => {
  it("keeps a sentence and folds a wire shape away", () => {
    const said = readServers({ servers: [{ name: "甲", status: "unavailable", reason: "远端拒绝了连接" }] });
    if (said.kind !== "rows") throw new Error("expected rows");
    expect(said.rows[0]?.reason).toBe("远端拒绝了连接");

    for (const key of ["reason", "error", "detail", "message"] as const) {
      const folded = readServers({ servers: [{ name: "甲", status: "unavailable", [key]: '{"code":"mcp.refused"}' }] });
      if (folded.kind !== "rows") throw new Error("expected rows");
      expect(folded.rows[0]?.reason).toBeNull();
    }
  });

  it("folds a bare status token or an HTTP code into the gap instead", () => {
    for (const value of ["ECONNREFUSED", "502", "connection refused x".slice(0, 0) + "not_a_human_sentence"]) {
      const read = readServers({ servers: [{ name: "甲", status: "unavailable", reason: value }] });
      if (read.kind !== "rows") throw new Error("expected rows");
      expect(read.rows[0]?.reason).toBeNull();
    }
  });

  it("truncates a runaway message rather than wrapping the page in it", () => {
    const read = readServers({ servers: [{ name: "甲", status: "unavailable", reason: `说明：${"很长".repeat(200)}` }] });
    if (read.kind !== "rows") throw new Error("expected rows");
    expect((read.rows[0]?.reason ?? "").length).toBeLessThanOrEqual(201);
    expect(read.rows[0]?.reason).toMatch(/…$/);
  });
});

describe("times are Beijing to the minute", () => {
  it("renders an instant in Beijing wall clock", () => {
    expect(beijingMinute("2026-11-19T01:20:00Z")).toBe("2026-11-19 09:20");
  });

  it("reads epoch seconds and milliseconds too", () => {
    const same = beijingMinute("1763515200");
    expect(same).toBe(beijingMinute("1763515200000"));
    expect(same).not.toBeNull();
  });

  it("returns null for anything that is not an instant, so the caller writes 「—」", () => {
    for (const value of [null, "", "昨天", "not-a-date", "2026-13-45T99:99:99Z"]) {
      expect(beijingMinute(value)).toBeNull();
    }
  });

  it("never shows the wire form of the instant", () => {
    const shown = beijingMinute("2026-11-19T01:20:00.000Z") ?? "";
    expect(shown).not.toMatch(/T\d{2}:\d{2}|Z$/);
  });
});

describe("failure wording", () => {
  const info = (status: number, requestId: string | null = null): FailureInfo => ({
    status,
    requestId,
    technical: status === 404 ? "404 /agent-api/api/mcp/servers" : null,
  });

  it("says a login gap in words a person can act on, not a code", () => {
    const copy = readFailure(new Error("x"), info(401));
    expect(copy.sentence).toContain("登录");
    expect(copy.sentence).not.toMatch(/401|HTTP|agent-api/);
  });

  it("names an unreachable service without the transport jargon", () => {
    for (const status of [0, -1]) {
      const copy = readFailure(new Error("ECONNREFUSED"), info(status));
      expect(copy.sentence).toContain("连不上");
      expect(copy.sentence).not.toMatch(/ECONNREFUSED|agent-api/);
    }
  });

  it("keeps the request id it was given and stays null when there was none", () => {
    expect(readFailure(new Error("x"), info(500, "req-abc")).requestId).toBe("req-abc");
    expect(readFailure(new Error("x"), info(500)).requestId).toBeNull();
  });
});
