/**
 * Q41a — 详情页读口「诚实未接探测」共用读腿。
 *
 * 纪律（照板面 Q41a + PE-03 口径）：
 *  - 真实请求先行：接线前是静态「未接入」文案，现改为真打 BFF GET——
 *    未接面（501 *.not_wired 族）→ notWired 态，文案逐字取服务端信封的
 *    code/message，请求号取真实 rid（缺 → 「—」，不编造）；
 *  - 禁造假 200：本模块不合成数据，200 空列表只说「暂无记录」；
 *  - 「未接入」≠「空态」≠「错误」：三套呈现分开（notWired 不用 role=alert）；
 *  - 防串数据护栏沿用 PE-02/PE-03 的 rowOwner 口径：行不带归属键放行
 *    （部分端点行内无归属，见 AssignmentPane 同例），归属对不上整块转错误态。
 */
import { useEffect, useState } from "react";

import { fetchJSON } from "@/lib/api";

import { MISMATCH_MESSAGE, rowOwner } from "./fetchState";
import {
  asRows,
  errStatus,
  humanize,
  pickStr,
  requestIdOf,
  type Rec,
} from "@/pages/EmployeesPage";

export type WiringState =
  | { k: "loading" }
  | { k: "notWired"; code: string; message: string; requestId: string | null }
  | { k: "ready"; rows: Rec[] }
  | { k: "error"; status: number; message: string; requestId: string | null };

/** 从 ApiError 体里取信封 code（BFF not_wired 族契约键）；取不到返回 null。 */
function codeOf(err: unknown): string | null {
  const body = err instanceof Error ? (err as { body?: unknown }).body : undefined;
  if (typeof body !== "string" || !body.trim().startsWith("{")) return null;
  try {
    const parsed = JSON.parse(body) as Rec;
    return typeof parsed.code === "string" && parsed.code ? parsed.code : null;
  } catch {
    return null;
  }
}

/**
 * 读腿状态机：loading → notWired（501 族）| ready（真行+护栏）| error（其余）。
 * url 或 rawId 变化自动重发；卸载后不回填。
 */
export function useNotWiredRead(url: string, rawId: string): {
  state: WiringState;
  reload: () => void;
} {
  const [state, setState] = useState<WiringState>({ k: "loading" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ k: "loading" });
    fetchJSON<unknown>(url)
      .then((raw) => {
        if (!alive) return;
        const rows = asRows(raw);
        if (!rows.every((row) => {
          const owner = rowOwner(row);
          return owner === "" || owner === rawId;
        })) {
          // status 0 = 请求本身 200，坏的是数据归属（与 fetchState 同语义）。
          setState({ k: "error", status: 0, message: MISMATCH_MESSAGE, requestId: null });
          return;
        }
        setState({ k: "ready", rows });
      })
      .catch((err: unknown) => {
        if (!alive) return;
        const status = errStatus(err);
        if (status === 501 || (status === 503 && (codeOf(err) ?? "").endsWith("not_wired"))) {
          setState({
            k: "notWired",
            code: codeOf(err) ?? "501.not_wired",
            message: humanize(err),
            requestId: requestIdOf(err),
          });
          return;
        }
        if (status === 404 && codeOf(err) === "console.unknown_route") {
          // Q41c（B 形制，L6 R378 实测正名）：现网 served BFF 该读口**未注册**——
          // authed 404 console.unknown_route 属未知路由兜底族，非 501 not_wired 族。
          // 前端不得把它折成错误态（用户会以为坏了），也不得冒充真数据：
          // 与 501 同样落「诚实未接入」，文案区分两种成因：
          // 404=服务端路由未注册（未实现），501/503=已注册但上游未接（不造数）。
          setState({
            k: "notWired",
            code: "console.unknown_route",
            message: "控制台服务端尚未注册该读口（路由未实现），未接入、不显示任何数据。",
            requestId: requestIdOf(err),
          });
          return;
        }
        setState({ k: "error", status, message: humanize(err), requestId: requestIdOf(err) });
      });
    return () => {
      alive = false;
    };
  }, [url, rawId, nonce]);

  return { state, reload: () => setNonce((n) => n + 1) };
}

/** 「未接入」独立文案块：code+message+请求号全取真实响应，非错误非空态。 */
export function NotWiredBlock({
  state,
  testid,
}: {
  state: Extract<WiringState, { k: "notWired" }>;
  testid: string;
}) {
  const rid = state.requestId ?? "—";
  return (
    <p
      className="text-sm text-muted-foreground"
      data-testid={testid}
      title={`服务端 code=${state.code}`}
    >
      未接入（{state.code}）：{state.message}（请求号 {rid}）
    </p>
  );
}

/** 行字段兜底：取不到显示「—」，绝不编造。 */
export function cell(row: Rec, keys: string[]): string {
  return pickStr(row, keys) ?? "—";
}
