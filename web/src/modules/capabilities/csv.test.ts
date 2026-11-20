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

  it("builds the tab, query, sort, direction and Beijing-time contract", () => {
    const now = new Date("2026-11-19T22:15:00Z");
    expect(exportFilename({ tab: "skills" }, now)).toBe("capabilities-skills-all-default-default-20261120-0615.csv");
    expect(exportFilename({ tab: "tools", q: "web.search-2", sort: "name", dir: "asc" }, now)).toBe(
      "capabilities-tools-web.search-2-name-asc-20261120-0615.csv",
    );
  });

  it("folds Chinese, spaces and colons in a fragment to default and lowercases allowed text", () => {
    const now = new Date("2026-11-19T22:15:00Z");
    expect(exportFilename({ tab: "skills", q: "资料", sort: "name", dir: "asc" }, now)).toContain("-skills-default-name-asc-");
    expect(exportFilename({ tab: "skills", q: "web search", sort: "name", dir: "asc" }, now)).toContain("-skills-default-name-asc-");
    expect(exportFilename({ tab: "skills", q: "web:search", sort: "name", dir: "asc" }, now)).toContain("-skills-default-name-asc-");
    expect(exportFilename({ tab: "skills", q: "Web.Search", sort: "type", dir: "DESC" }, now)).toContain("-skills-web.search-type-desc-");
  });
});
