// COLLAB data layer — the reads, the words, and the shape laws. Pure layer:
// nothing here touches the DOM, and every assertion is about what the page is
// allowed to put on screen.

import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import {
  GAP,
  LIST_PATH,
  NO_REQUEST_ID,
  NOT_RECORDED,
  PAGE_LIMIT,
  actorLabel,
  askedLine,
  beijingMinute,
  errorInfo,
  isMachineHandle,
  listUrl,
  loadDelegations,
  normalizeDelegation,
  scopeCell,
  shortCode,
  sourceWords,
  statusWords,
  validityCell,
} from "./delegations";

const err = (status: number, requestId?: string): ApiError =>
  new ApiError("x", { status, body: "{}", url: LIST_PATH, requestId });

afterEach(() => {
  api.fetchJSON.mockReset();
});

describe("the route", () => {
  it("keeps the /agent-api/api/ segment on the single route it asks", () => {
    expect(LIST_PATH).toBe("/agent-api/api/delegations");
    expect(listUrl()).toBe(`/agent-api/api/delegations?limit=${PAGE_LIMIT}`);
    expect(askedLine()).toContain("/agent-api/api/delegations");
  });

  it("asks that route and no other", async () => {
    api.fetchJSON.mockResolvedValue({ items: [] });
    await loadDelegations();
    expect(api.fetchJSON.mock.calls).toHaveLength(1);
    expect(String(api.fetchJSON.mock.calls[0]?.[0])).toBe(listUrl());
  });

  it("treats a 401 as an expected local answer, not a reload signal", async () => {
    api.fetchJSON.mockResolvedValue({ items: [] });
    await loadDelegations();
    const options = api.fetchJSON.mock.calls[0]?.[2] as { allowUnauthorized?: boolean } | undefined;
    expect(options?.allowUnauthorized).toBe(true);
  });
});

describe("rows only ever come from an answer", () => {
  const ROW = {
    delegationId: "dl_01ABC234DEF567",
    requestId: "req_9f3a4b7c",
    fromEmployeeId: "emp_1a2b3c4d",
    fromEmployeeName: "陈可",
    toEmployeeId: "emp_7z8y9x0w",
    status: "accepted",
    scope: "整理本周巡检记录，缺项点名到人",
    expiresAt: "2026-11-30T18:00:00Z",
    source: "console",
    createdAt: "2026-11-19T02:00:00Z",
  };

  it("reads the fields the contract names, in camelCase", () => {
    const row = normalizeDelegation(ROW);
    expect(row?.delegationId).toBe("dl_01ABC234DEF567");
    expect(row?.from).toEqual({ name: "陈可", id: "emp_1a2b3c4d" });
    expect(row?.to).toEqual({ name: null, id: "emp_7z8y9x0w" });
    expect(row?.status).toBe("accepted");
  });

  it("also reads the snake_case spelling the domain uses", () => {
    const row = normalizeDelegation({
      delegation_id: "dl_2",
      from_employee_id: "emp_a1b2c3d4",
      to_employee_id: "emp_e5f6g7h8",
      status: "requested",
    });
    expect(row?.from.id).toBe("emp_a1b2c3d4");
    expect(row?.to.id).toBe("emp_e5f6g7h8");
  });

  it("refuses a row with no id instead of painting an unquotable line", () => {
    expect(normalizeDelegation({ status: "accepted" })).toBeNull();
    expect(normalizeDelegation(null)).toBeNull();
    expect(normalizeDelegation("dl_1")).toBeNull();
  });

  it("keeps a missing value missing — never 0, never an empty string", () => {
    const row = normalizeDelegation({ delegationId: "dl_3" });
    expect(row?.requestId).toBeNull();
    expect(row?.expiresAt).toBeNull();
    expect(row?.source).toBeNull();
    expect(row?.scopeText).toBeNull();
    expect(row?.capabilityCount).toBeNull();
    expect(row?.from.name).toBeNull();
    expect(row?.from.id).toBeNull();
  });

  it("does not accept a handle as a display name", () => {
    const row = normalizeDelegation({ delegationId: "dl_4", fromName: "emp_1a2b3c4d" });
    expect(row?.from.name).toBeNull();
    expect(row?.from.id).toBe("emp_1a2b3c4d");
  });

  it("reads a nested actor record", () => {
    const row = normalizeDelegation({
      delegationId: "dl_5",
      toEmployee: { employeeId: "emp_9f8e7d6c", displayName: "李牧" },
    });
    expect(row?.to).toEqual({ name: "李牧", id: "emp_9f8e7d6c" });
  });

  it("counts capability items without treating their codes as prose", () => {
    const row = normalizeDelegation({
      delegationId: "dl_6",
      capabilities: ["read_reports", "send_summary"],
    });
    expect(row?.scopeText).toBeNull();
    expect(row?.capabilityCount).toBe(2);
  });

  it("rejects a 2xx that is not a list instead of inventing rows", async () => {
    api.fetchJSON.mockResolvedValue({ total: 12 });
    const state = await loadDelegations();
    expect(state.phase).toBe("error");
    expect(state.rows).toEqual([]);
    expect(state.failure?.sentence).toContain("不是委托清单");
  });

  it("separates an empty answer from a failed one", async () => {
    api.fetchJSON.mockResolvedValue({ items: [] });
    const empty = await loadDelegations();
    expect(empty.phase).toBe("empty");
    expect(empty.failure).toBeNull();

    api.fetchJSON.mockRejectedValue(err(500, "rid-500"));
    const failed = await loadDelegations();
    expect(failed.phase).toBe("error");
    expect(failed.failure?.requestId).toBe("rid-500");
  });

  it("counts the rows it could not attribute an id to", async () => {
    api.fetchJSON.mockResolvedValue({ items: [{ delegationId: "dl_7" }, { status: "accepted" }] });
    const state = await loadDelegations();
    expect(state.phase).toBe("ready");
    expect(state.rows).toHaveLength(1);
    expect(state.unreadable).toBe(1);
  });
});

describe("401 is a login leg, not an error and not a denial", () => {
  it("folds a 401 into the login phase with its request id", async () => {
    api.fetchJSON.mockRejectedValue(err(401, "a91c9379dde14714b039d547281bc8a8"));
    const state = await loadDelegations();
    expect(state.phase).toBe("login");
    expect(state.rows).toEqual([]);
    expect(state.failure?.requestId).toBe("a91c9379dde14714b039d547281bc8a8");
    expect(state.failure?.sentence).toContain("登录");
  });

  it("never writes a 401 as zero delegations", async () => {
    api.fetchJSON.mockRejectedValue(err(401));
    const state = await loadDelegations();
    expect(state.phase).not.toBe("empty");
    expect(state.unreadable).toBe(0);
  });
});

describe("403 and 404 are one answer", () => {
  it("fold both into the denied phase", async () => {
    for (const status of [403, 404]) {
      api.fetchJSON.mockRejectedValue(err(status, "rid-shared"));
      const state = await loadDelegations();
      expect(state.phase).toBe("denied");
      expect(state.failure?.requestId).toBe("rid-shared");
    }
  });

  it("give the same sentence and never repeat the route back", () => {
    const forbidden = errorInfo(err(403, "rid-a"));
    const missing = errorInfo(err(404, "rid-b"));
    expect(forbidden.sentence).toBe(missing.sentence);
    expect(forbidden.technical).toBe(missing.technical);
    expect(JSON.stringify([forbidden.sentence, forbidden.technical, missing.sentence, missing.technical])).not.toContain(
      "delegations",
    );
  });
});

describe("other codes read as failures", () => {
  it.each([
    [400, "缺少服务要求的条件"],
    [429, "太频繁"],
    [500, "暂时没有响应"],
    [503, "暂时没有响应"],
    [0, "网络不可达"],
  ])("status %i says %s in words", (status, phrase) => {
    const info = errorInfo(err(status, "rid"));
    expect(info.sentence).toContain(phrase);
    expect(info.requestId).toBe("rid");
  });

  it("reads a non-ApiError as unreachable rather than as a crash", () => {
    const info = errorInfo(new Error("boom"));
    expect(info.status).toBe(0);
    expect(info.requestId).toBeNull();
  });

  it("says 「未提供」 when the answer carried no request id", () => {
    expect(NO_REQUEST_ID).toBe("未提供");
    expect(errorInfo(err(500)).requestId).toBeNull();
  });
});

describe("people are named, never printed as handles", () => {
  it.each([
    "emp_1a2b3c4d",
    "human:1",
    "0f1e2d3c-4b5a-4978-8675-4321fedcba09",
    "a1b2c3d4e5f60718",
  ])("recognises %s as a machine handle", (value) => {
    expect(isMachineHandle(value)).toBe(true);
  });

  it("does not mistake a person's name for a handle", () => {
    expect(isMachineHandle("陈可")).toBe(false);
    expect(isMachineHandle("Liang Yu")).toBe(false);
  });

  it("takes an 8-character code and nothing else", () => {
    expect(shortCode("emp_9f3a4b7c")).toBe("9F3A4B7C");
    expect(shortCode("emp_9f3a4b7c111")).toBe("A4B7C111");
    expect(shortCode("dl_01ABC234DEF567")).toBe("34DEF567");
    expect(shortCode("human:1")).toBe("");
    expect(shortCode(null)).toBe("");
  });

  it("renders 「姓名 · 8 位短码」 when a name came with the id", () => {
    const label = actorLabel({ name: "陈可", id: "emp_9f3a4b7c" }, "from");
    expect(label.text).toBe("陈可 · 9F3A4B7C");
    expect(label.title).toBe("陈可 · emp_9f3a4b7c");
    expect(label.text).not.toContain("emp_");
  });

  it("falls back to the role plus code when only the handle arrived", () => {
    expect(actorLabel({ name: null, id: "emp_9f3a4b7c" }, "to").text).toBe("受托员工 · 9F3A4B7C");
    expect(actorLabel({ name: null, id: "emp_9f3a4b7c" }, "from").text).toBe("委托员工 · 9F3A4B7C");
  });

  it("says 未指派 for a delegation nobody received, and never 未指派 for a missing delegator", () => {
    expect(actorLabel({ name: null, id: null }, "to")).toEqual({ text: "未指派", title: null });
    expect(actorLabel({ name: null, id: null }, "from")).toEqual({ text: NOT_RECORDED, title: null });
  });

  it("does not print a fragment of a handle that is too short to be a code", () => {
    const label = actorLabel({ name: null, id: "human:1" }, "to");
    expect(label.text).toBe("受托员工（编号不完整）");
    expect(label.text).not.toContain("human:1");
    expect(label.title).toBe("human:1");
  });
});

describe("the words on the surface", () => {
  it("maps every state of the frozen contract to Chinese", () => {
    const seen = ["requested", "accepted", "handed_off", "completed", "rejected", "expired"].map(
      (status) => statusWords(status).text,
    );
    expect(seen).toEqual(["已提出，等待接受", "已接受", "已交接回发起方", "已完成", "已拒绝", "已过期"]);
    for (const text of seen) expect(text).not.toMatch(/^[a-z_]+$/);
  });

  it("refuses to show an unknown status token on the surface", () => {
    const unknown = statusWords("in_flight");
    expect(unknown.text).toBe("状态未识别");
    expect(unknown.raw).toBe("in_flight");
    expect(statusWords(null).text).toBe(NOT_RECORDED);
  });

  it("maps sources to words and keeps the raw token off the surface", () => {
    expect(sourceWords("console").text).toBe("控制台发起");
    expect(sourceWords("scheduler").text).toBe("定时任务发起");
    expect(sourceWords("mystery").text).toBe("来源未识别");
    expect(sourceWords(null).text).toBe(NOT_RECORDED);
    expect(sourceWords("mystery").raw).toBe("mystery");
  });

  it("reads scope as one human line, with the audience it names", () => {
    const row = normalizeDelegation({
      delegationId: "dl_8",
      scope: "代看客户回访记录",
      audience: "客户回访组",
    });
    expect(scopeCell(row!).text).toBe("代看客户回访记录（对 客户回访组）");
  });

  it("falls back to counting capabilities when no sentence came", () => {
    const row = normalizeDelegation({ delegationId: "dl_9", capabilities: ["read_reports"], audience: "emp_9f3a4b7c" });
    const cell = scopeCell(row!);
    expect(cell.text).toBe("可执行 1 项能力");
    expect(cell.detail).toBe("对 对象 · 9F3A4B7C");
    expect(JSON.stringify(cell)).not.toContain("read_reports");
  });

  it("says 未记录 with a reason when the answer carried no scope at all", () => {
    const row = normalizeDelegation({ delegationId: "dl_10" })!;
    const cell = scopeCell(row);
    expect(cell.text).toBeNull();
    expect(cell.reason).toContain("没有");
  });

  it("never puts a snake_case code in the scope column", () => {
    const row = normalizeDelegation({ delegationId: "dl_11", scope: "read_reports_only" })!;
    expect(row.scopeText).toBeNull();
  });
});

describe("times read in Beijing to the minute", () => {
  it("converts an instant to Asia/Shanghai", () => {
    expect(beijingMinute("2026-11-30T18:00:00Z").text).toBe("2026-12-01 02:00");
  });

  it("reads epoch seconds and epoch milliseconds the same moment", () => {
    expect(beijingMinute("1798000000").text).toBe(beijingMinute("1798000000000").text);
    expect(beijingMinute("1798000000").text).not.toBeNull();
  });

  it("keeps a non-instant off the surface with the reason", () => {
    expect(beijingMinute(null)).toEqual({ text: null, reason: "服务没有给出这个时间" });
    expect(beijingMinute("next tuesday").text).toBeNull();
    expect(beijingMinute("").text).toBeNull();
  });

  it("marks an expiry that has already passed instead of showing a bare stamp", () => {
    const past = validityCell({ expiresAt: "2020-01-01T00:00:00Z" });
    expect(past.note).toBe("已到期");
    expect(past.text).toBe("2020-01-01 08:00");
    const future = validityCell({ expiresAt: "2999-01-01T00:00:00Z" });
    expect(future.note).toBeNull();
  });

  it("leaves 生效至 unrecorded when the answer has no such field", () => {
    const cell = validityCell({ expiresAt: null });
    expect(cell.text).toBeNull();
    expect(cell.note).toBeNull();
    expect(cell.reason).toBe("服务没有给出这个时间");
  });
});

describe("the gap number", () => {
  it("carries the number this lane claimed", () => {
    expect(GAP).toBe("GAP-10");
  });
});
