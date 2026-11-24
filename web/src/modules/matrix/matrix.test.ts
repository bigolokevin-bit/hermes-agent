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
  GATE_PORTS,
  gateTable,
  IDLE_GATE,
  IDLE_PORTS,
  initials,
  missingPorts,
  peopleColumns,
  readApprovalEvidence,
  readConfigView,
  readMatrixPayload,
  readRoster,
  readSkills,
  readSpaces,
  readStations,
  refLabel,
  resourceHead,
  shortCode,
  type GateEvidence,
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
    gate: { ...IDLE_GATE, k: "settled" },
    ...overrides,
  };
}

/** 四门证据桩：逐员工工位/有效配置 + 审批行，形状与 BFF 实测一致。 */
function gate(overrides: Partial<GateEvidence> = {}): GateEvidence {
  return {
    k: "settled",
    stations: {},
    configs: {},
    approvals: ready([]),
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
  it("结构列永远保留：四道门四列 / 缺口 / 工具 / 知识 / 部门，值读不到也不删列", () => {
    const portsIn = ports({
      matrix: ready({
        people: readMatrixPayload({ items: [employee({ skillRefs: [], skillCount: 0 })] })!.people,
        budgets: new Map(),
        asOf: AS_OF,
      }),
    });
    expect(peopleColumns(portsIn).map((column) => column.key)).toEqual([
      "skills",
      "v1",
      "v2",
      "v3",
      "v6",
      "gap",
      "tools",
      "kb",
      "dept",
    ]);
  });

  it("矩阵没有部门字段时按 employeeId 从员工台账补部门真值（只补这一个字段）", () => {
    const people = readMatrixPayload({ items: [employee({ employeeId: "emp_1", department: null })] })!.people;
    expect(people[0]!.department).toBeNull();
    const portsIn = ports({
      matrix: ready({ people, budgets: new Map(), asOf: AS_OF }),
      roster: ready([
        { employeeId: "emp_1", name: "小鲤", title: null, department: "产品部", lifecycle: "active" },
      ]),
    });
    const rows = buildPeopleRows(portsIn);
    expect(rows[0]!.department).toBe("产品部");
    if (rows[0]!.cells.dept?.k === "text") expect(rows[0]!.cells.dept.text).toBe("产品部");
  });

  it("部门是结构列：台账没有 department 时仍保留列，格内写「未登记」", () => {
    const people = readMatrixPayload({ items: [employee({ employeeId: "emp_1" })] })!.people;
    const portsIn = ports({ matrix: ready({ people, budgets: new Map(), asOf: AS_OF }) });
    const rows = buildPeopleRows(portsIn);
    expect(rows[0]!.department).toBeNull();
    expect(rows[0]!.cells.dept?.k).toBe("text");
    if (rows[0]!.cells.dept?.k === "text") expect(rows[0]!.cells.dept.text).toBe("未登记");
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

  it("名单兜底：source 是 roster，技能格只有「—」（技能列不进版面，结构列照留）", () => {
    const portsIn = ports({
      matrix: { k: "missing", note: "没有读口", title: null, asOf: null },
      roster: ready([{ employeeId: "emp_9", name: "阿吉", title: null, department: null, lifecycle: "active" }]),
    });
    const rows = buildPeopleRows(portsIn);
    expect(rows[0]!.source).toBe("roster");
    expect(rows[0]!.cells.skills?.k).toBe("dash");
    expect(peopleColumns(portsIn).map((column) => column.key)).toEqual([
      "v1",
      "v2",
      "v3",
      "v6",
      "gap",
      "tools",
      "kb",
      "dept",
    ]);
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

describe("四道门 — 复用 duty/readiness 的 verdict，V3 整门「未接」", () => {
  const people = readMatrixPayload({
    items: [
      employee({ employeeId: "emp_A", name: "小鲤" }),
      employee({ employeeId: "emp_B", name: "小满" }),
      employee({ employeeId: "emp_C", name: "阿吉" }),
    ],
  })!.people;
  const FUTURE = new Date(Date.now() + 86_400_000).toISOString();

  const evidence = gate({
    stations: {
      emp_A: ready([{ bindingType: "group", status: "active", channel: "feishu" }]),
      emp_B: ready([{ bindingType: "dm", status: "active", channel: "feishu" }]),
      emp_C: { k: "error", note: "工位读口本次没有读到", requestId: "rid-3" },
    },
    configs: {
      emp_A: ready({ scopes: ["product_assistant"], grants: [{ expiresAt: FUTURE }], resolvedAt: AS_OF }),
      emp_B: ready({ scopes: [], grants: [{ expiresAt: FUTURE }], resolvedAt: AS_OF }),
      emp_C: { k: "missing", note: "有效配置读口尚未接线", title: "HTTP 404", asOf: null },
    },
    approvals: ready([
      { subjectId: "emp_A", status: "approved", expiresAt: FUTURE, hasApprover: true },
      { subjectId: "emp_B", status: "expired", expiresAt: AS_OF, hasApprover: true },
    ]),
  });

  function tableWith(ev: GateEvidence) {
    return gateTable(ports({ matrix: ready({ people, budgets: new Map(), asOf: AS_OF }), gate: ev }));
  }

  it("V1/V2/V6 逐员工点灯：pass / fail / 证据没回写待核实（不进分子分母）", () => {
    const table = tableWith(evidence);
    expect(table.entries.get("emp_A")).toEqual({ v1: "pass", v2: "pass", v6: "pass" });
    expect(table.entries.get("emp_B")).toEqual({ v1: "fail", v2: "fail", v6: "fail" });
    // emp_C 的工位腿 error、有效配置腿 missing ⇒ 两门 null；审批腿回了 ⇒ v6 有判定。
    expect(table.entries.get("emp_C")).toEqual({ v1: null, v2: null, v6: "fail" });
  });

  it("缺口＝可判定门交集：未达 / 可判定只数三道门都给了判定的员工", () => {
    const table = tableWith(evidence);
    // emp_A 三门全过；emp_B 三门全不过；emp_C 两门没证据 ⇒ 不进分母。
    expect(table.gap).toEqual({ pass: 1, denom: 2 });
    expect(table.coverage).toEqual({ covered: 2, requested: 3 });
  });

  it("一格都没有可判定读数时给 null，不补 0", () => {
    const table = tableWith(
      gate({
        stations: { emp_A: { k: "missing", note: "工位读口没有", title: null, asOf: null } },
        configs: {},
        approvals: { k: "missing", note: "审批读口没有", title: null, asOf: null },
      }),
    );
    expect(table.gap).toEqual({ pass: null, denom: null });
  });

  it("V3 引用门整门无读口：每格写「未接」，不是「—」，也不计入交集", () => {
    const rows = buildPeopleRows(
      ports({ matrix: ready({ people, budgets: new Map(), asOf: AS_OF }), gate: evidence }),
    );
    for (const row of rows) {
      const cell = row.cells.v3!;
      expect(cell.k).toBe("gate");
      if (cell.k === "gate") {
        expect(cell.text).toBe("未接");
        expect(cell.state).toBe("unwired");
        expect(cell.title).toContain("V3");
      }
      expect(row.cells.gap?.k).toBe("text");
      if (row.cells.gap?.k === "text") expect(row.cells.gap.text).toBe("1 / 2");
    }
  });

  it("证据还在路上：缺口写「读取中」，不写 0", () => {
    const table = tableWith({ ...IDLE_GATE });
    expect(table.pending).toBe(true);
    expect(table.gap).toEqual({ pass: null, denom: null });
  });
});

describe("四门证据解析器 — 实测 BFF 形状", () => {
  it("workstations 收 items[]；空集是真零（V1 可据此判未过）", () => {
    expect(readStations({ items: [{ bindingType: "group", status: "active" }] })?.[0]).toMatchObject({
      bindingType: "group",
      status: "active",
    });
    expect(readStations({ items: [] })).toEqual([]);
    expect(readStations({ nope: 1 })).toBeNull();
  });

  it("effective-config 取 version.knowledgeScopes 与 grants.expiresAt", () => {
    const view = readConfigView({
      version: { knowledgeScopes: ["a", "b"] },
      grants: [{ expiresAt: "2026-12-31T00:00:00.000Z" }],
      resolvedAt: AS_OF,
    });
    expect(view).toEqual({
      scopes: ["a", "b"],
      grants: [{ expiresAt: "2026-12-31T00:00:00.000Z" }],
      resolvedAt: AS_OF,
    });
    expect(readConfigView({ employee: {} })).toBeNull();
  });

  it("approvals 只留数字员工的 message_send 决策", () => {
    const rows = readApprovalEvidence({
      items: [
        {
          status: "approved",
          binding: { subjectType: "employee", subjectId: "emp_A", changeKind: "message_send" },
          approvers: [{ userId: "human:1" }],
          expiresAt: "2026-12-31T00:00:00.000Z",
        },
        {
          status: "approved",
          binding: { subjectType: "task", subjectId: "task_1", changeKind: "message_send" },
          approvers: [],
        },
        {
          status: "denied",
          binding: { subjectType: "employee", subjectId: "emp_B", changeKind: "config_change" },
          approvers: [],
        },
      ],
    });
    expect(rows).toEqual([
      { subjectId: "emp_A", status: "approved", expiresAt: "2026-12-31T00:00:00.000Z", hasApprover: true },
    ]);
  });

  it("四条门读口的地址都带 /agent-api 前缀", () => {
    expect(GATE_PORTS.stations("emp_A")).toContain("/agent-api/api/workstations?id=emp_A");
    expect(GATE_PORTS.config("emp_A")).toContain("/agent-api/api/effective-config?id=emp_A");
    expect(GATE_PORTS.approvals).toBe("/agent-api/api/approvals?status=all&limit=100");
  });
});
