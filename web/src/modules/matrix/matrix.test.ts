/**
 * 矩阵读口与视图模型的纯函数契约（不渲染）。
 *
 * 这里钉的是「一条读口只有四种结局」与「列的存在性由读口决定」两件事——
 * 页面上看到的每一个 0、每一个 ●、每一列，都必须能从这里倒推出来。
 */
import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api-error";

import {
  buildPeopleRows,
  buildResourceView,
  classifyRead,
  DASH,
  envelopeOf,
  IDLE_PORTS,
  initials,
  missingPorts,
  peopleColumns,
  readMatrixPayload,
  readRoster,
  readSkills,
  readSpaces,
  refLabel,
  resourceHead,
  shortCode,
  type Ports,
  type Read,
} from "./matrix";

const AS_OF = "2026-11-24T08:30:00Z";

function ready<T>(data: T): Read<T> {
  return { k: "ready", data, asOf: AS_OF };
}

function ports(overrides: Partial<Ports> = {}): Ports {
  return {
    matrix: ready({ people: [], budgets: new Map(), asOf: AS_OF }),
    roster: ready([]),
    skills: ready([]),
    tools: ready([]),
    mcp: ready([]),
    spaces: ready([]),
    ...overrides,
  };
}

function employee(overrides: Record<string, unknown> = {}) {
  return {
    employeeId: "emp_AAAABBBB00001111",
    name: "小鲤",
    title: "运营",
    lifecycleState: "active",
    skillRefs: [],
    skillCount: 0,
    ...overrides,
  };
}

describe("classifyRead — 一条腿只有四种结局", () => {
  it("200 且非空 ⇒ ready", () => {
    const read = classifyRead({
      status: 200,
      code: null,
      requestId: null,
      asOf: AS_OF,
      picked: [1],
      isEmpty: (data: number[]) => data.length === 0,
    });
    expect(read.k).toBe("ready");
  });

  it("200 但空集 ⇒ empty（真零，不是读取失败）", () => {
    const read = classifyRead({
      status: 200,
      code: null,
      requestId: null,
      asOf: AS_OF,
      picked: [] as number[],
      isEmpty: (data: number[]) => data.length === 0,
    });
    expect(read.k).toBe("empty");
  });

  it("404 与 502 都归 missing，但人话不同", () => {
    const notWired = classifyRead<number[]>({
      status: 404,
      code: "matrix.read_not_wired",
      requestId: "rid-1",
      asOf: null,
      picked: null,
      isEmpty: (data) => data.length === 0,
    });
    expect(notWired.k).toBe("missing");
    if (notWired.k === "missing") {
      expect(notWired.note).toContain("尚未接线");
      expect(notWired.title).toContain("404");
    }

    const upstream = classifyRead<number[]>({
      status: 502,
      code: "console.upstream_unavailable",
      requestId: null,
      asOf: null,
      picked: null,
      isEmpty: (data) => data.length === 0,
    });
    expect(upstream.k).toBe("missing");
    if (upstream.k === "missing") expect(upstream.note).toContain("上游");
  });

  it("401/403 归 error（不是「未接线」）", () => {
    for (const status of [401, 403]) {
      const read = classifyRead<number[]>({
        status,
        code: null,
        requestId: "rid",
        asOf: null,
        picked: null,
        isEmpty: (data) => data.length === 0,
      });
      expect(read.k).toBe("error");
    }
  });

  it("200 但形状不认识 ⇒ error，绝不猜成空集", () => {
    const read = classifyRead<number[]>({
      status: 200,
      code: null,
      requestId: null,
      asOf: null,
      picked: null,
      isEmpty: (data) => data.length === 0,
    });
    expect(read.k).toBe("error");
  });
});

describe("envelopeOf — 从 ApiError 取出状态码与信封", () => {
  it("读 code / asOf / rid", () => {
    const error = new ApiError("未接线", {
      status: 404,
      body: JSON.stringify({ code: "mcp.read_not_wired", asOf: AS_OF }),
      url: "/agent-api/api/mcp/servers",
      requestId: "rid-9",
    });
    const env = envelopeOf(error);
    expect(env).toEqual({ status: 404, code: "mcp.read_not_wired", requestId: "rid-9", asOf: AS_OF });
  });

  it("非 JSON 错误体只保留状态码", () => {
    const error = new ApiError("boom", { status: 500, body: "Internal Server Error", url: "/x" });
    expect(envelopeOf(error)).toEqual({ status: 500, code: null, requestId: null, asOf: null });
  });
});

describe("readMatrixPayload — 实测 BFF 形状", () => {
  it("items[] 的 skillRefs / skillCount / budget 都读得到", () => {
    const payload = readMatrixPayload({
      items: [
        employee({
          skillRefs: ["skill:检索", { skillId: "skill:写稿", version: "v3" }],
          skillCount: 2,
          budget: { dailyTokens: 1000, monthlyCostUsd: 2.5, perRunMaxUsd: 0.5 },
        }),
      ],
      asOf: AS_OF,
    });
    expect(payload?.people).toHaveLength(1);
    const person = payload!.people[0]!;
    expect(person.caps.skills?.map((ref) => ref.id)).toEqual(["skill:检索", "skill:写稿"]);
    expect(person.caps.skills?.[1]?.version).toBe("v3");
    expect(person.skillCount).toBe(2);
    expect(payload?.budgets.get("emp_AAAABBBB00001111")?.monthlyCostUsd).toBe(2.5);
  });

  it("没回 skillRefs 时 skillCount 为 null（这一维不进版面）", () => {
    const payload = readMatrixPayload({ items: [{ employeeId: "emp_1", name: "阿吉" }] });
    expect(payload?.people[0]?.caps.skills).toBeNull();
    expect(payload?.people[0]?.skillCount).toBeNull();
  });

  it("旧域形状 capabilities{skills,tools,knowledge} 也收", () => {
    const payload = readMatrixPayload({
      items: [
        {
          employeeId: "emp_2",
          capabilities: { skills: ["skill:a"], tools: ["tool:web"], knowledge: ["space:1"] },
        },
      ],
    });
    const person = payload!.people[0]!;
    expect(person.caps.skills?.map((ref) => ref.id)).toEqual(["skill:a"]);
    expect(person.caps.tools).toEqual(["tool:web"]);
    expect(person.caps.knowledge).toEqual(["space:1"]);
  });

  it("不认识的身体 ⇒ null（由 classifyRead 归为 error）", () => {
    expect(readMatrixPayload("{oops")).toBeNull();
    expect(readMatrixPayload(null)).toBeNull();
  });
});

describe("shortCode / initials / refLabel", () => {
  it("emp_ 原始 id 不上屏，只出 8 位大写短码", () => {
    expect(shortCode("emp_217a91ba995044df")).toBe("217A91BA");
    expect(shortCode(null)).toBe(DASH);
  });

  it("头像缩写：中文两字，拉丁首字母对", () => {
    expect(initials("小鲤", "AAAABBBB")).toBe("小鲤");
    expect(initials("Ada Lovelace", "AAAABBBB")).toBe("AL");
    expect(initials(null, "AAAABBBB")).toBe("AA");
  });

  it("技能芯片名：台账名优先，其次可读 id 尾段，最后「技能 N」", () => {
    const names = new Map([["skill:检索", "检索"]]);
    expect(refLabel("skill:检索", 0, names)).toBe("检索");
    expect(refLabel("skill:write-post", 1, names)).toBe("post");
    expect(refLabel("skill:deadbeefcafe", 2, names)).toBe("技能 3");
  });
});

describe("peopleColumns / buildPeopleRows — 列的存在性由读口决定", () => {
  it("只有技能回传时，只剩「技能」一列；四道门与缺口永不渲染", () => {
    const portsIn = ports({
      matrix: ready({
        people: readMatrixPayload({ items: [employee({ skillRefs: [], skillCount: 0 })] })!.people,
        budgets: new Map(),
        asOf: AS_OF,
      }),
    });
    expect(peopleColumns(portsIn).map((column) => column.key)).toEqual(["skills"]);
  });

  it("某一维只有一位员工回传，这一列就算有读口", () => {
    const people = readMatrixPayload({
      items: [employee({ employeeId: "emp_1" }), { employeeId: "emp_2", capabilities: { tools: ["tool:a"] } }],
    })!.people;
    const portsIn = ports({ matrix: ready({ people, budgets: new Map(), asOf: AS_OF }) });
    expect(peopleColumns(portsIn).map((column) => column.key)).toEqual(["skills", "tools"]);
  });

  it("技能芯片最多 3 枚，其余进 +N；skillCount 是真读数", () => {
    const people = readMatrixPayload({
      items: [employee({ skillRefs: ["a:1", "a:2", "a:3", "a:4", "a:5"], skillCount: 5 })],
    })!.people;
    const rows = buildPeopleRows(ports({ matrix: ready({ people, budgets: new Map(), asOf: AS_OF }) }));
    const cell = rows[0]!.cells.skills!;
    expect(cell.k).toBe("chips");
    if (cell.k === "chips") {
      expect(cell.chips).toHaveLength(3);
      expect(cell.more).toBe(2);
    }
    expect(rows[0]!.skillsCount).toBe(5);
  });

  it("只回了技能数、没回清单：写「N 项」，不猜挂的是哪几项", () => {
    const people = readMatrixPayload({ items: [employee({ skillCount: 4 })] })!.people;
    const rows = buildPeopleRows(ports({ matrix: ready({ people, budgets: new Map(), asOf: AS_OF }) }));
    const cell = rows[0]!.cells.skills!;
    expect(cell.k).toBe("text");
    if (cell.k === "text") expect(cell.text).toBe("4 项");
  });

  it("名单兜底：source 是 roster，技能格只有「—」（且该列不会因此进版面）", () => {
    const portsIn = ports({
      matrix: { k: "missing", note: "没有读口", title: null, asOf: null },
      roster: ready([{ employeeId: "emp_9", name: "阿吉", title: null, department: null, lifecycle: "active" }]),
    });
    const rows = buildPeopleRows(portsIn);
    expect(rows[0]!.source).toBe("roster");
    expect(rows[0]!.cells.skills?.k).toBe("dash");
    expect(peopleColumns(portsIn)).toEqual([]);
  });
});

describe("buildResourceView — ●/空、真零与整列不渲染", () => {
  const people = readMatrixPayload({
    items: [
      employee({ employeeId: "emp_A", name: "小鲤", skillRefs: ["skill:检索"], skillCount: 1 }),
      employee({ employeeId: "emp_B", name: "小满", lifecycleState: "draft", skillRefs: [], skillCount: 0 }),
    ],
  })!.people;

  it("命中画 ●、未命中留空，挂载人数据实", () => {
    const view = buildResourceView(
      ports({ matrix: ready({ people, budgets: new Map(), asOf: AS_OF }) }),
      "skill",
    );
    expect(view.columns.map((column) => column.key)).toEqual(["emp_A", "emp_B"]);
    expect(view.rows.map((row) => row.key)).toEqual(["skill:检索"]);
    const row = view.rows[0]!;
    expect(row.hits[0]?.k).toBe("mark");
    expect(row.hits[0]!.k === "mark" && row.hits[0]!.hit).toBe(true);
    expect(row.hits[1]!.k === "mark" && row.hits[1]!.hit).toBe(false);
    expect(row.count.k === "text" && row.count.text).toBe("1");
    expect(row.state.k === "state" && row.state.text).toBe("单点");
  });

  it("某位员工这一维没有回传 ⇒ 该员工列整列不进版面", () => {
    const mixed = readMatrixPayload({
      items: [employee({ employeeId: "emp_A" }), { employeeId: "emp_B", capabilities: {} }],
    })!.people;
    // emp_B 的 caps.skills 是 null（没有 capabilities.skills）
    expect(mixed[1]!.caps.skills).toBeNull();
    const view = buildResourceView(ports({ matrix: ready({ people: mixed, budgets: new Map(), asOf: AS_OF }) }), "skill");
    expect(view.columns.map((column) => column.key)).toEqual(["emp_A"]);
    expect(view.fullColumns).toBe(false);
    // 人数与覆盖状态只能「待核实」——列不齐就不能算人数
    expect(view.dropColumns).toContain("count");
    expect(view.rows.every((row) => row.state.k === "state" && row.state.text === "待核实")).toBe(true);
  });

  it("空集是真零：没有行，但读口结局仍是 empty（页面据此写「真零」）", () => {
    const emptyPeople = readMatrixPayload({ items: [employee({ skillRefs: [], skillCount: 0 })] })!.people;
    const view = buildResourceView(
      ports({
        matrix: ready({ people: emptyPeople, budgets: new Map(), asOf: AS_OF }),
        skills: { k: "empty", asOf: AS_OF },
      }),
      "skill",
    );
    expect(view.rows).toEqual([]);
    expect(view.kindRead.k).toBe("empty");
    expect(view.kindRead.k === "empty" || view.kindRead.k === "ready").toBe(true);
  });

  it("技能没有版本回传 ⇒ 已挂版本列进 dropColumns", () => {
    const view = buildResourceView(
      ports({ matrix: ready({ people, budgets: new Map(), asOf: AS_OF }) }),
      "skill",
    );
    expect(view.dropColumns).toContain("version");
  });
});

describe("resourceHead — 表头与表体同一来源", () => {
  const columns = [
    { key: "emp_A", label: "小鲤", code: "AAAA0000", isActive: true },
    { key: "emp_B", label: "小满", code: "BBBB0000", isActive: false },
  ];

  it("员工列插在名称列与计数/状态列之间", () => {
    const head = resourceHead("skill", columns, ["version"]);
    expect(head.map((def) => def.key)).toEqual([
      "name",
      "emp:emp_A",
      "emp:emp_B",
      "count",
      "state",
    ]);
  });

  it("drop 掉没有读口的列（tool 的操作/接入状态 + 人数）", () => {
    const head = resourceHead("tool", columns, ["ops", "access", "count"]);
    expect(head.map((def) => def.key)).toEqual(["name", "emp:emp_A", "emp:emp_B", "state"]);
  });

  it("名称列、员工列、覆盖状态列永远保留", () => {
    const head = resourceHead("kb", columns, ["scope", "count"]);
    expect(head[0]!.key).toBe("name");
    expect(head.at(-1)!.key).toBe("state");
    expect(head.some((def) => def.key === "emp:emp_A")).toBe(true);
  });
});

describe("missingPorts — 卡底与卡三的缺读口声明", () => {
  it("只列真缺的腿，按读口表顺序", () => {
    const notes = missingPorts(
      ports({
        matrix: { k: "missing", note: "这一项没有可用的读口", title: "HTTP 404", asOf: null },
        mcp: { k: "missing", note: "这一项的读口尚未接线", title: "HTTP 404", asOf: null },
      }),
    );
    expect(notes.map((note) => note.label)).toEqual(["员工能力矩阵", "MCP 服务器"]);
  });

  it("全绿时是空数组", () => {
    expect(missingPorts(ports())).toEqual([]);
    expect(missingPorts(IDLE_PORTS)).toEqual([]);
  });
});

describe("readSkills / readSpaces / readRoster — 清单形状", () => {
  it("skills 收 items[]，名称缺省回 id", () => {
    const skills = readSkills({ items: [{ id: "skill:a" }, { skillId: "skill:b", name: "写稿" }] });
    expect(skills?.map((item) => item.name)).toEqual(["skill:a", "写稿"]);
  });

  it("spaces 收 spaces[]（不是 items）", () => {
    const spaces = readSpaces({ spaces: [{ space_id: "1", name: "产品库", document_count: 3 }] });
    expect(spaces?.[0]).toMatchObject({ id: "1", name: "产品库", documents: 3 });
  });

  it("roster 只取身份字段", () => {
    const roster = readRoster({ items: [{ employeeId: "emp_1", lifecycle_state: "active" }] });
    expect(roster?.[0]?.lifecycle).toBe("active");
  });
});