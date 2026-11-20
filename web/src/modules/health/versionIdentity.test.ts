import { describe, expect, it } from "vitest";
import { readSystemHealth } from "./systemHealth";
import { readVersionRowsFromHealth } from "../version/versionHealth";
import { VERSION_FIELD_KEYS, versionIdentity } from "./versionIdentity";

describe("version identity parity", () => {
  it("reads the same field keys for /system and the ver5 table", () => {
    const body = {
      ok: true,
      asOf: "2026-11-20T03:28:20Z",
      sources: [
        { id: "console", name: "控制台", state: "ok", version: "9.9.9" },
        { id: "build", name: "构建", state: "ok", build: "build-20261120" },
        { id: "missing", name: "缺字段", state: "ok" },
      ],
    };
    const system = readSystemHealth(body)!;
    const version = readVersionRowsFromHealth(body)!;
    expect(version.map((row) => row.version)).toEqual(system.rows.map((row) => row.version));
    expect(version[0]!.version).toBe("9.9.9");
    expect(version[1]!.version).toBe("build-20261120");
    expect(version[2]!.version).toBeNull();
    expect(version[2]!.versionReason).toContain("不编造版本号");
    expect(system.rows[2]!.versionReason).toBe(version[2]!.versionReason);
  });

  it("accepts every documented alias without accepting an unrelated field", () => {
    for (const key of VERSION_FIELD_KEYS) {
      expect(versionIdentity({ [key]: `v-${key}` })).toBe(`v-${key}`);
    }
    expect(versionIdentity({ unrelated: "x" })).toBeNull();
    expect(versionIdentity(null)).toBeNull();
  });
});
