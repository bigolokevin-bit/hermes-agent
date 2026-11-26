// 能力与接入（/capabilities）四页共用的写口层。
//
// 读口的四种结局在 paneApi.ts；这里只管「发一次真写，把上游原话带回来」。
// 三条纪律：
//   1. 失败原文上屏：detail / code / message 逐字取，不改写成人话，HTTP 码挂在末尾；
//   2. 明文 key 只活在调用栈里一次：进错误原文前先替换成占位串；
//   3. 不猜成功：非 2xx 就是失败，2xx 但形状不认识也按失败报（把 text 原样贴上）。
import { recordOf } from "./paneApi";

export type WriteReply = { ok: boolean; status: number; json: unknown; text: string };

export async function sendJson(url: string, method: string, body?: unknown): Promise<WriteReply> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      credentials: "include",
      mode: "same-origin",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, json: null, text: "" };
  }
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text.trim() ? (JSON.parse(text) as unknown) : null;
  } catch {
    json = null;
  }
  return { ok: response.ok, status: response.status, json, text };
}

/** 屏上任何位置都不许出现明文 key：上游原文里也要先抹掉。 */
export function maskSecret(raw: string, secret: string | null): string {
  return secret && secret.length > 0 ? raw.split(secret).join("[已隐去 key]") : raw;
}

/** 上游错误原文：detail / code / message 逐字取出，不改写成人话。 */
export function upstreamError(reply: WriteReply, secret: string | null): string {
  if (reply.status === 0) return "连不上控制台服务（请求没有发出去）";
  const root = recordOf(reply.json);
  const parts = [root.detail, root.code, root.message]
    .map((value) => {
      if (typeof value === "string") return value.trim();
      if (value === null || value === undefined) return "";
      try {
        return JSON.stringify(value);
      } catch {
        return "";
      }
    })
    .filter((value) => value.length > 0);
  const message = parts.length > 0 ? parts.join(" · ") : reply.text.trim();
  return maskSecret(message ? `${message}（HTTP ${reply.status}）` : `HTTP ${reply.status}`, secret);
}

export type Note = { tone: "ok" | "bad" | "info"; text: string };

/** 「—」之外的第三种结局：上游回话里截前 80 字，多余的用省略号。 */
export function clip(value: string, max = 80): string {
  const oneLine = value.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}
