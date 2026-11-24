/**
 * 「能力与权限」矩阵的读口层（六条腿，各自归档，互不顶替）。
 *
 * 这里只做三件事：发请求、把错误信封摊平成 status/code/rid、把结局交给
 * `classifyRead`。任何一条腿失败都不影响其它腿——卡一、卡二、卡三各取所需。
 *
 * 六条腿**逐条落位**（谁先回谁先上屏）：一条慢腿（上游超时、网关挂住）不该
 * 把整页锁在骨架态，否则「读到了的」也看不见。
 *
 * 工程语言（路由 / 状态码 / 上游代号）只保留在 `Read.title` 里（hover 可查），
 * 句子层由 `missingNote` 出人话。
 */
import { useCallback, useEffect, useState } from "react";

import { fetchJSON } from "@/lib/api";

import {
  classifyRead,
  envelopeOf,
  GATE_FANOUT_LIMIT,
  GATE_PORTS,
  IDLE_PORTS,
  PORTS,
  peopleOf,
  readApprovalEvidence,
  readAsOf,
  readConfigView,
  readCountedItems,
  readMatrixPayload,
  readRoster,
  readSkills,
  readSpaces,
  readStations,
  type GateEvidence,
  type Ports,
  type Read,
} from "./matrix";

import type { ApprovalEvidence, ConfigView, StationBinding } from "../duty/readiness";

/** 读一条腿：200 交给解析器，非 2xx 走四态归档；解析器回 null ⇒ error（不猜）。 */
export async function readLeg<T>(
  url: string,
  parse: (body: unknown) => T | null,
  isEmpty: (data: T) => boolean,
): Promise<Read<T>> {
  try {
    const body = await fetchJSON<unknown>(url);
    return classifyRead({
      status: 200,
      code: null,
      requestId: null,
      asOf: readAsOf(body),
      picked: parse(body),
      isEmpty,
    });
  } catch (error) {
    const env = envelopeOf(error);
    return classifyRead({
      status: env.status,
      code: env.code,
      requestId: env.requestId,
      asOf: env.asOf,
      picked: null,
      isEmpty,
    });
  }
}

/** 六条腿的请求（已启动，未等待）；顺序即卡三「缺读口」的列出口径。 */
export type PortsKey = keyof Ports;

export function portReads(): [PortsKey, Promise<Read<unknown>>][] {
  return [
    ["matrix", readLeg(PORTS.matrix, readMatrixPayload, (data) => data.people.length === 0)],
    ["roster", readLeg(PORTS.employees, readRoster, (data) => data.length === 0)],
    ["skills", readLeg(PORTS.skills, readSkills, (data) => data.length === 0)],
    ["tools", readLeg(PORTS.tools, readCountedItems, (data) => data.length === 0)],
    ["mcp", readLeg(PORTS.mcp, readCountedItems, (data) => data.length === 0)],
    ["spaces", readLeg(PORTS.spaces, readSpaces, (data) => data.length === 0)],
  ];
}

/**
 * 四道门证据：工位与有效配置按员工扇出（上限与 duty 的 32 一致），审批一次取全量。
 * 每条腿各自归档：某位员工的工位没回，只让他这一门的 V1 记「待核实」，不连坐别人。
 */
export async function readGateEvidence(employeeIds: string[]): Promise<GateEvidence> {
  const ids = employeeIds.slice(0, GATE_FANOUT_LIMIT);
  const stations: Record<string, Read<StationBinding[]>> = {};
  const configs: Record<string, Read<ConfigView>> = {};
  await Promise.all(
    ids.map(async (id) => {
      const [stationRead, configRead] = await Promise.all([
        readLeg<StationBinding[]>(GATE_PORTS.stations(id), readStations, (data) => data.length === 0),
        readLeg<ConfigView>(GATE_PORTS.config(id), readConfigView, () => false),
      ]);
      stations[id] = stationRead;
      configs[id] = configRead;
    }),
  );
  const approvals = await readLeg<ApprovalEvidence[]>(
    GATE_PORTS.approvals,
    readApprovalEvidence,
    (data) => data.length === 0,
  );
  return { k: "settled", stations, configs, approvals };
}

/** 一次读全（等所有腿都有结局）；页面本身走逐条落位，不等慢腿。 */
export async function readPorts(): Promise<Ports> {
  const entries = portReads();
  const settled = await Promise.all(entries.map(([, promise]) => promise));
  const ports = { ...IDLE_PORTS };
  entries.forEach(([key], index) => {
    (ports as unknown as Record<PortsKey, Read<unknown>>)[key] = settled[index]!;
  });
  ports.gate = await readGateEvidence(peopleOf(ports).people.map((person) => person.employeeId));
  return ports;
}

export function useMatrixPorts(): { ports: Ports; reload: () => void } {
  const [ports, setPorts] = useState<Ports>(IDLE_PORTS);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    for (const [key, promise] of portReads()) {
      void promise.then((read) => {
        if (!alive) return;
        setPorts((prev) => ({ ...prev, [key]: read } as Ports));
      });
    }
    return () => {
      alive = false;
    };
  }, [attempt]);

  // 四道门证据要等名单落位才知道扇出给谁：名单一变（或刷新）就重取一次。
  const { people } = peopleOf(ports);
  const employeeIds = people.map((person) => person.employeeId).join(",");
  const rosterSettled = ports.matrix.k !== "loading" || ports.roster.k !== "loading";

  useEffect(() => {
    if (!rosterSettled) return;
    let alive = true;
    const ids = employeeIds ? employeeIds.split(",") : [];
    void readGateEvidence(ids).then((gate) => {
      if (!alive) return;
      setPorts((prev) => ({ ...prev, gate }));
    });
    return () => {
      alive = false;
    };
  }, [attempt, rosterSettled, employeeIds]);

  // 重读先在事件里清空（effect 只负责订阅读口，不在体内同步 setState）。
  const reload = useCallback(() => {
    setPorts(IDLE_PORTS);
    setAttempt((n) => n + 1);
  }, []);
  return { ports, reload };
}