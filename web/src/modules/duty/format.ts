import { num, text } from "./types";

/** Beijing wall-clock to the minute; unparseable/missing → "—". */
const BEIJING = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function beijing(value: unknown): string {
  if (value == null || value === "") return "—";
  let ms: number | null = null;
  if (typeof value === "number") {
    ms = value > 1e11 ? value : value * 1000;
  } else if (typeof value === "string") {
    const s = value.trim();
    if (/^\d{9,}$/.test(s)) {
      const n = Number(s);
      ms = n > 1e11 ? n : n * 1000;
    } else {
      const parsed = Date.parse(s);
      ms = Number.isNaN(parsed) ? null : parsed;
    }
  }
  if (ms === null || !Number.isFinite(ms) || ms <= 0) return "—";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  const at = (t: Intl.DateTimeFormatPartTypes) =>
    BEIJING.formatToParts(d).find((p) => p.type === t)?.value ?? "";
  const [y, mo, da, hh, mi] = [at("year"), at("month"), at("day"), at("hour"), at("minute")];
  if (!y || !mo || !da) return "—";
  return `${y}-${mo}-${da} ${hh}:${mi}`;
}

/** USD with cents; missing → "—" (real zero stays $0.00). */
export function usd(value: unknown): string {
  const n = num(value);
  if (n === null) return "—";
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function dashed(value: unknown): string {
  const n = num(value);
  return n === null ? "—" : String(n);
}

/**
 * 外部标识：oc_ 会话号、ou_ 发信人号。这类值一律不裸上屏——不论长度都收成
 * 「后6位」短码形（w182 点单口径；中段截断形不算数）。原值不丢：它留在链接
 * 与 title 里，完整 id 照样取得回。
 */
const EXTERNAL_ID = /^(?:oc|ou)_[0-9A-Za-z]+$/;

export function shortId(raw: string | null | undefined): string {
  const v = text(raw);
  if (!v) return "—";
  if (EXTERNAL_ID.test(v)) return `后6位 ${v.slice(-6)}`;
  if (v.length <= 12) return v;
  return `${v.slice(0, 6)}…${v.slice(-4)}`;
}

export function duration(start: string | undefined, end: string | undefined): string {
  if (!start) return "—";
  const a = Date.parse(start);
  const b = end ? Date.parse(end) : Date.now();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return "—";
  const sec = Math.round((b - a) / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

/** Beijing calendar day [00:00, now] as UTC ISO strings for the runtime window. */
export function beijingDayWindow(now = new Date()): { from: string; to: string; date: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? "";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  // Beijing is UTC+8 year-round; 00:00 local == previous day 16:00Z.
  const startMs = Date.parse(`${date}T00:00:00+08:00`);
  return {
    from: new Date(startMs).toISOString(),
    to: now.toISOString(),
    date,
  };
}

export function daysAgoWindow(days: number, now = new Date()): { from: string; to: string } {
  const start = now.getTime() - days * 24 * 3600 * 1000;
  return { from: new Date(start).toISOString(), to: now.toISOString() };
}

/** Beijing weekday 1=Mon … 7=Sun for the activity heat row. */
export function beijingWeekday(now = new Date()): number {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    weekday: "short",
  }).format(now);
  return { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[name] ?? 1;
}

export function beijingHour(now = new Date()): number {
  const hh = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return Number(hh);
}

export function lifecycleLabel(raw: string | undefined): string {
  const map: Record<string, string> = {
    active: "在岗",
    onboarding: "入职中",
    paused: "已暂停",
    offboarding: "离职中",
    draft: "草稿",
    archived: "已归档",
  };
  return raw ? map[raw] ?? "—" : "—";
}

/** Never show a bare emp_/employee: id on screen; keep the tail only. */
export function employeeLabel(name: string | undefined, id: string): string {
  if (name && name.trim()) return name.trim();
  const tail = id
    .replace(/^[^:]*:/, "")
    .replace(/[^0-9A-Za-z]/g, "")
    .slice(-4);
  return tail ? `员工 · ${tail}` : "员工";
}