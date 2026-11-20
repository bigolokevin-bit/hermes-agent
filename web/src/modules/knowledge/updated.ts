/**
 * R75 — 「最近更新」时间呈现的单一 helper：/knowledge 三处（空间列表时间格、空间详情文档
 * 更新列、全库检索命中更新列）的值与 title 都由这一个函数判出，禁止各处再写第二套格式化
 * 或第二套 title 文案。
 *
 * 口径边界（哪些不走这里，保持原语义）：
 * · asOf「数据截至」行（stampOf/knAsOfFacts，knM 台账）不是「最近更新」，不动；
 * · 时间语义前缀标签（最近更新 / 最近同步 / 登记时间…由 syncMomentOf 选择）保留在调用方，
 *   本函数只管值本身与 title 两句；
 * · 行内预览与复制文本里的时间字段不属于三处表格列，维持既有 hint 口径。
 */

const BJT = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** 缺失/非法时的固定 title 句（逐字，含「不拿本机时间顶替」的声明）。 */
export const UPDATED_MISSING_TITLE = "上游未返回时间；不用本机时间顶替。";

export function updatedText(iso: string | null | undefined): { value: string; title: string } {
  if (typeof iso !== "string" || iso.trim() === "") {
    return { value: "—", title: UPDATED_MISSING_TITLE };
  }
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    return { value: "—", title: UPDATED_MISSING_TITLE };
  }
  const shown = BJT.format(new Date(ms)).replace("T", " ").slice(0, 16);
  return { value: shown, title: `时间 ${iso}（UTC）` };
}
