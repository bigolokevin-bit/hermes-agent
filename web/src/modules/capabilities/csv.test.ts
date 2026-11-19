// @vitest-environment node
import { describe, expect, it } from "vitest";
import { exportFilename, toCsv, type CsvRow } from "./csv";

const rows: CsvRow[] = [
  { name: "网页,搜索", type: "内置 · Web", enabled: "正常", updated_at: "2026-11-19 09:20" },
  { name: '带"引号"', type: null, enabled: "待核实", updated_at: null },
  { name: "换行\n名称", type: "MCP", enabled: "停用", updated_at: "2026-11-19 10:00" },
];

describe("capabilities CSV", () => {
  it("quotes commas, quotes and newlines per RFC4180 and leaves null empty", () => {
    const csv = toCsv(rows);
    expect(csv.split("\r\n")[0]).toBe("name,type,enabled,updated_at");
    expect(csv).toContain('"网页,搜索",');
    expect(csv).toContain('"带""引号""",,待核实,');
    expect(csv).toContain('"换行\n名称",MCP,停用,2026-11-19 10:00');
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("builds a Beijing-time filename", () => {
    expect(exportFilename("skills", new Date("2026-11-19T22:15:00Z"))).toBe("capabilities-skills-20261120-0615.csv");
    expect(exportFilename("tools", new Date("2026-11-19T22:15:00Z"))).toBe("capabilities-tools-20261120-0615.csv");
  });
});
