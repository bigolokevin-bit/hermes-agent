/**
 * audJ — one helper for the two fields every /audit surface shows: WHEN and WHO.
 *
 * The rule this file exists to hold: the same event must not read 「2026-11-19
 * 09:20」 in the list and 「2026-11-19 09:20:00」 in the preview, and a missing
 * field must not be filled by the browser's clock. Every surface calls these
 * two functions and prints exactly what comes back.
 *
 * Time is absolute Beijing wall clock to the second (`YYYY-MM-DD HH:mm:ss`),
 * never a relative phrase. The raw value the service sent — an ISO instant in
 * UTC — rides along in `title`, with the zone named, because a person quoting
 * a timestamp has to be able to show which instant the screen was derived from.
 *
 * An operator is shown as a person-readable name. When the answer carried no
 * name, the short code stands in and the full identifier stays in `title` —
 * `human:…`, `emp_…` or a UUID never reach the surface, because an engineering
 * handle on the human layer is the mistake this module has already made once.
 */

import { beijingSeconds } from "./model";
import type { Person } from "./model";


/** The word for a time the service did not send. Never a guessed instant. */
export const AUDJ_TIME_MISSING = "该字段未返回";

/** Why the time is missing, for the `title` a person can hover. */
export const AUDJ_TIME_MISSING_TITLE = "服务没有带回这条记录的时间；这里不拿浏览器时间顶替";

/** The zone sentence that goes with every shown instant. */
export const AUDJ_TIME_ZONE = "北京时间（UTC+8）";

export interface AuditTimeView {
  /** The text on screen: Beijing wall clock to the second, or the missing word. */
  text: string;
  /** The raw instant the answer sent, quoted with its zone; or the reason. */
  title: string;
}

/**
 * The instant a record is read at.
 *
 * `raw` is what the service sent (ISO UTC, or an epoch in seconds or
 * milliseconds); `minute` is the same instant already spoken to the minute by
 * the model, used only when seconds cannot be derived from `raw` — so a row
 * never silently loses its seconds because a different surface kept them.
 */
export function auditTimeView(raw: string | null | undefined, minute?: string | null): AuditTimeView {
  const source = (raw ?? "").trim();
  // The answer has been seen sending epoch SECONDS and epoch MILLISECONDS as a
  // string. `beijingSeconds` reads a number as milliseconds, so a ten-digit
  // value is widened here — the same rule the model's own Beijing formatter
  // uses — instead of landing in January 1970 on screen.
  const epochOnly = /^(\d{10})(\d{3})?$/.exec(source);
  const instant = epochOnly ? Number(source) * (epochOnly[2] ? 1 : 1000) : source;
  const seconds = beijingSeconds(instant);
  if (seconds) {
    return {
      text: seconds,
      // The instant is quoted exactly as it arrived, zone named, next to the
      // reading on screen: a person pasting a timestamp has to be able to show
      // which UTC moment the Beijing words came from.
      title: `服务原值 ${source}（UTC）· 屏上为${AUDJ_TIME_ZONE}，精确到秒`,
    };
  }
  const shown = (minute ?? "").trim();
  if (shown) {
    // A raw value that is not an instant at all is still quoted — as what it
    // is — and the title never claims a UTC conversion that did not happen.
    return {
      text: shown,
      title: source
        ? `服务带回的原文是「${source}」，不是一个可换算的瞬间；屏上是这条记录给的${AUDJ_TIME_ZONE}文本，到${shown.length > 16 ? "秒" : "分钟"}`
        : `屏上是服务直接给的${AUDJ_TIME_ZONE}文本，到${shown.length > 16 ? "秒" : "分钟"}；没带回可换算的原始瞬间`,
    };
  }
  return { text: AUDJ_TIME_MISSING, title: AUDJ_TIME_MISSING_TITLE };
}

export interface AuditActorView {
  /** Person-readable name, or 「未指派」 when the answer attributed nothing. */
  text: string;
  /** The full identifier, or the reason there is none. */
  title: string;
}

/**
 * The operator. `maskedName` already keeps handles off the label, so this
 * helper's job is to pin the same promise for every surface: a real name when
 * the answer sent one, the short code plus the full id in `title` when it did
 * not, and a stated reason instead of an empty cell.
 */
export function auditActorView(person: Pick<Person, "label" | "raw">): AuditActorView {
  const label = (person.label ?? "").trim();
  const raw = (person.raw ?? "").trim();
  if (!label || label === "未指派") {
    return { text: "未指派", title: raw ? `服务只带回标识 ${raw}，没有带回可展示的名字` : AUDJ_ACTOR_MISSING_TITLE };
  }
  return { text: label, title: raw ? `服务标识 ${raw}（原始值只在这里给出）` : "服务没有带回这一位的标识" };
}

/** The word for an operator the answer never attributed. */
export const AUDJ_ACTOR_MISSING_TITLE = "服务没有带回这条记录的操作者";
