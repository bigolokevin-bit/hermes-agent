/**
 * PE-03 — 员工详情五分区共用的取数状态机。
 *
 * 纪律（照卡面）：禁 fixture/假 0/假成功；取不到 = 失败态 + 原因 + 请求号；
 * 空态 ≠ 未接入，两套文案分开。防串数据护栏沿用 PE-02 的同一条文案：
 * BFF 会忽略它不认识的过滤参数并返回未过滤列表，归属对不上就整块转错误态，
 * 绝不部分渲染、绝不显示别人的行，也不拿假空态冒充「没有数据」。
 */
import { useEffect, useState } from "react";

import { fetchJSON } from "@/lib/api";

import {
  asRows,
  errStatus,
  humanize,
  isRecord,
  requestIdOf,
  type BlockState,
  type Rec,
} from "@/pages/EmployeesPage";

/** 护栏文案：数据归属对不上时的唯一说法，与 PE-02 钉死的句子逐字一致。 */
export const MISMATCH_MESSAGE = "返回数据不属于该员工，已停止显示以防串数据。";

/** 失败态：状态码 + 人话原因 + 请求号（缺 → null，呈现层显示「—」，不编造）。 */
export function failedState(err: unknown): BlockState<never> {
  return {
    k: "error",
    status: errStatus(err),
    message: humanize(err),
    requestId: requestIdOf(err),
  };
}

/**
 * 行的归属员工 id（沿用 PE-02 实测形制）：employeeId 直给，或 assignee /
 * resource 引用。取不到归属键返回 ""，由调用方决定放不放行（有的端点行内
 * 不带归属，见 AssignmentPane 注释）。
 */
export function rowOwner(row: Rec): string {
  const direct = row.employeeId;
  if (typeof direct === "string" || typeof direct === "number") return String(direct);
  const ref = row.assignee ?? row.resource;
  if (isRecord(ref)) {
    const id = ref.id;
    return typeof id === "string" || typeof id === "number" ? String(id) : "";
  }
  if (typeof ref === "string") return ref.startsWith("employee:") ? ref.slice("employee:".length) : ref;
  return "";
}

/**
 * 带防串护栏的行列表腿。ready 后 rows 是 asRows 摊平结果；
 * 任何一行归属对不上 → 整块 error（护栏文案）。
 */
export function useGuardedRows(
  url: string,
  employeeId: string,
): { state: BlockState<Rec[]>; reload: () => void } {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<BlockState<Rec[]>>({ k: "loading" });

  useEffect(() => {
    let alive = true;
    setState({ k: "loading" });
    fetchJSON<unknown>(url)
      .then((raw) => {
        if (!alive) return;
        const rows = asRows(raw);
        if (!rows.every((row) => rowOwner(row) === employeeId)) {
          // status 0 = 没有 HTTP 状态可用：请求本身是 200，坏的是数据归属。
          setState({ k: "error", status: 0, message: MISMATCH_MESSAGE, requestId: null });
          return;
        }
        setState({ k: "ready", data: rows });
      })
      .catch((err: unknown) => {
        if (alive) setState(failedState(err));
      });
    return () => {
      alive = false;
    };
  }, [url, employeeId, nonce]);

  return { state, reload: () => setNonce((n) => n + 1) };
}

/**
 * 对象腿（effective-config 这类非行列表形状）：原样返回解析后的对象；
 * 失败带原因 + 请求号，供上层按端点专属语义（如 409 no_effective_version）分流。
 */
export function useGuardedObject(
  url: string,
): { state: BlockState<Rec>; reload: () => void } {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<BlockState<Rec>>({ k: "loading" });

  useEffect(() => {
    let alive = true;
    setState({ k: "loading" });
    fetchJSON<unknown>(url)
      .then((raw) => {
        if (!alive) return;
        setState({ k: "ready", data: isRecord(raw) ? raw : {} });
      })
      .catch((err: unknown) => {
        if (alive) setState(failedState(err));
      });
    return () => {
      alive = false;
    };
  }, [url, nonce]);

  return { state, reload: () => setNonce((n) => n + 1) };
}
