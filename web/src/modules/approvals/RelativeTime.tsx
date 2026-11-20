/**
 * R76 — one helper for every time column on /approvals (both tabs' rows, the
 * apv9 preview, the apd6 trail): the screen shows a RELATIVE reading computed
 * at render time; the title always carries the absolute Beijing second plus
 * the ISO8601 UTC原文, so 「同一行四处同值」 is verifiable verbatim. Missing
 * or unparseable stamps read 「该字段未返回」 — the current time is never
 * fabricated in their place, and nothing here touches the URL or storage.
 */
import { useEffect, useState } from "react";

/** Beijing wall clock, no dependency on the machine TZ (same shape as beijing()). */
const SEC = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
const MINUTE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Accepts the same shapes beijing() accepts; free text is never a timestamp. */
export function epochOf(value: string | null | undefined): number | null {
  if (!value) return null;
  const raw = value.trim();
  let date: Date;
  if (/^\d{9,10}$/.test(raw)) date = new Date(Number(raw) * 1000);
  else if (/^\d{11,13}$/.test(raw)) date = new Date(Number(raw));
  else if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/.test(raw)) date = new Date(raw);
  else return null;
  const ms = date.getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** 刚刚 / N 分钟前 / N 小时前 / N 天前；未来时间或 >7 天退回绝对到分。 */
/** en-CA puts a comma before the time; the contract wants a plain space. */
function plain(fmt: Intl.DateTimeFormat, d: Date): string {
  return fmt.format(d).replace(/,\s*/, " ");
}

export function relativeBeijing(ms: number, now: number): string {
  const diff = now - ms;
  if (diff < 0) return plain(MINUTE, new Date(ms));
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff <= 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`;
  return plain(MINUTE, new Date(ms));
}

export function timeTitle(ms: number, iso: string): string {
  return `绝对 ${plain(SEC, new Date(ms))}（北京时间） · ISO ${iso}`;
}

export const TIME_MISSING = "该字段未返回";
const TIME_MISSING_TITLE = "读口没有回传这个时间字段，或它不是合法时间；这里不补当前时间。";

export function RelativeTime({ iso, testid }: { iso: string | null | undefined; testid?: string }) {
  const ms = epochOf(iso);
  // The render body must not read the clock (purity); the moment is taken
  // once when the component mounts — a display value, never persisted.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
  }, []);
  if (ms === null) {
    return (
      <span className="text-muted-foreground" data-testid={testid} title={TIME_MISSING_TITLE}>
        {TIME_MISSING}
      </span>
    );
  }
  return (
    <span className="break-all" data-testid={testid} title={timeTitle(ms, iso ?? "")}>
      {now === null ? plain(MINUTE, new Date(ms)) : relativeBeijing(ms, now)}
    </span>
  );
}
