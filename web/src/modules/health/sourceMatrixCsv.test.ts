// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { csvRows, exportFilename, SYS7_HEADER, SYS10_HEADER, toCsv, toMatrixText, toPlainText } from "./sourceMatrixCsv";
import type { SourceRow } from "./sourceReads";

function row(patch: Partial<SourceRow>): SourceRow {
  return {
    id: "health",
    label: "系统健康清单",
    path: "/agent-api/api/health",
    status: "ok",
    statusReason: null,
    durationMs: 42,
    durationReason: null,
    asOf: "2026-11-19 23:17",
    asOfIso: "2026-11-19T15:17:09Z",
    asOfReason: null,
    requestId: null,
    ...patch,
  };
}

describe("source matrix CSV", () => {

  it("builds header plus rows in screen order and keeps missing values as —", () => {
    const text = toPlainText([
      row({}),
      row({ id: "domain", label: "域服务探针", path: "/agent-api/api/skills", status: "unwired", durationMs: null, asOf: null, asOfIso: null }),
    ]);
    const lines = text.trimEnd().split("\n");
    expect(lines[0]).toBe(SYS10_HEADER.join(" | "));
    expect(lines[1]).toBe("系统健康清单 | /agent-api/api/health | 成功 | 42 ms | 2026-11-19 23:17");
    expect(lines[2]).toBe("域服务探针 | /agent-api/api/skills | 读口未接入 | — | —");
    expect(text.endsWith("\n")).toBe(true);
  });
  it("uses the fixed header and keeps missing values empty", () => {
    const csv = toCsv(csvRows([
      row({}),
      row({ id: "domain", label: "域服务探针", path: "/agent-api/api/skills", status: "unwired", durationMs: null, asOf: null, asOfIso: null }),
    ]));
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(SYS7_HEADER.join(","));
    expect(lines[1]).toBe("系统健康清单,/agent-api/api/health,成功,42,2026-11-19T15:17:09Z");
    expect(lines[2]).toBe("域服务探针,/agent-api/api/skills,读口未接入,,");
    expect(lines[3]).toBe("");
  });

  it("escapes commas, quotes and newlines per RFC 4180", () => {
    const csv = toCsv([{
      name: '带,逗号"与引号',
      path: "/a,b",
      state: "成功",
      elapsed_ms: 0,
      as_of: "2026-11-19T15:17:09Z",
    }]);
    expect(csv).toContain('"带,逗号""与引号"');
    expect(csv).toContain('"/a,b"');
    expect(csv.split("\r\n")[1]).toContain(",0,");
  });

  it("names the file in Beijing time to the minute", () => {
    expect(exportFilename(new Date("2026-11-19T22:15:30Z"))).toBe("system-sources-20261120-0615.csv");
  });
});
describe("source matrix table copy", () => {
  it("uses tab separators, screen order and keeps missing values as —", () => {
    const text = toMatrixText([
      row({}),
      row({ id: "domain", label: "域服务探针", path: "/agent-api/api/skills", status: "unwired", durationMs: null, asOf: null, asOfIso: null }),
    ]);
    const lines = text.trimEnd().split("\n");
    expect(lines[0]).toBe(SYS10_HEADER.join("\t"));
    expect(lines[1]).toBe("系统健康清单\t/agent-api/api/health\t成功\t42 ms\t2026-11-19 23:17");
    expect(lines[2]).toBe("域服务探针\t/agent-api/api/skills\t读口未接入\t—\t—");
    expect(text.endsWith("\n")).toBe(true);
  });
});
