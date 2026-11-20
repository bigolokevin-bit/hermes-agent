/**
 * audT — the chips for the filters that are on right now.
 *
 * There is one parameter table, and it is the address's. The filter bar writes
 * it, audG pastes it, audR shows it as one sentence, and these chips name it one
 * piece at a time. A chip is therefore not a new reading of the state: its words
 * ARE the seat sentence from `filterSeatMap` (the same function the card prints
 * and the clipboard copies), so a chip and the summary line cannot drift into two
 * different claims about one question.
 *
 * What counts as "on" is the same arithmetic the rest of the panel uses: the
 * default quick window with nothing else written is not a filter, a size equal to
 * the default is not a filter, and page 1 is not a filter. `from` + `to` are one
 * question and get one chip — a range nobody can half-remove.
 *
 * A value the address carries that this panel cannot name is NOT dropped. The
 * chip prints it verbatim and the title says 「该值未被识别」: a person has to be
 * able to read what their own link says and get rid of it. Such a chip is also
 * honest about reach — an unread window changed nothing on the wire, so removing
 * it asks nothing new.
 *
 * Machine handles stay off the surface, the way audB/aud9 pinned it: the operator
 * and resource chips speak 已按句柄筛 / 已按编号本地筛 and the raw value lives in
 * the `title`, as the aud8 chips have always done.
 */

import { type FilterSummaryInput, filterSeatMap } from "./filterSummary";
import { DEFAULT_WINDOW, FILTER_WINDOW_CHOICES } from "./window";

/** The chip keys, in the order the filter bar shows the same choices. */
export type AuditChipKey = "window" | "from-to" | "actor" | "action" | "resource" | "limit" | "page";

export interface AuditChip {
  key: AuditChipKey;
  /** The chip's words — the screen seat, or the address's own text when nothing matches it. */
  label: string;
  title: string;
  /** The address keys the × removes, read off the chip so words and write are one table. */
  params: readonly string[];
}

/** The anchor a probe matches on when the address says something this page cannot use. */
export const UNRECOGNISED_FILTER_TITLE = "该值未被识别";

export interface FilterChipsInput extends FilterSummaryInput {
  /** The window exactly as the address wrote it; `""` when it wrote none. */
  rawWindow: string;
  /** False when the chosen type code is one the picker cannot name. */
  typeKnown: boolean;
  /** The size exactly as the address wrote it, when it is not an offered size; `""` otherwise. */
  rawLimit: string;
}

const defaultWindowLabel =
  FILTER_WINDOW_CHOICES.find((choice) => choice.value === DEFAULT_WINDOW)?.label ?? DEFAULT_WINDOW;

/** The chips for the question this page is reading, in bar order. Empty = nothing is on. */
export function filterChipsOf(input: FilterChipsInput): AuditChip[] {
  const seats = filterSeatMap(input, "screen");
  const chips: AuditChip[] = [];
  const knownWindow = FILTER_WINDOW_CHOICES.some((choice) => choice.value === input.rawWindow);

  if (input.custom) {
    // from + to are one question: one chip, both keys go together.
    chips.push({
      key: "from-to",
      label: seats.window,
      title: "自定义区间的两端一起移除（地址里的 from 与 to），移除后回到默认时间窗",
      params: ["window", "from", "to"] as const,
    });
  } else if (input.rawWindow !== "" && !knownWindow) {
    chips.push({
      key: "window",
      label: `时间窗：${input.rawWindow}`,
      title: `${UNRECOGNISED_FILTER_TITLE}：地址写的「${input.rawWindow}」不在本面板的时间档里，所以这一页没有把它发出去；× 把它从地址里去掉，按${defaultWindowLabel}读`,
      params: ["window"] as const,
    });
  } else if (input.rawWindow !== "" && input.rawWindow !== DEFAULT_WINDOW) {
    chips.push({
      key: "window",
      label: seats.window,
      title: `地址写的是 window=${input.rawWindow}；× 移除后回到默认时间窗（${defaultWindowLabel}）`,
      params: ["window"] as const,
    });
  }

  if (input.type !== "") {
    chips.push({
      key: "action",
      label: input.typeKnown ? seats.type : `动作类型：${input.type}`,
      title: input.typeKnown
        ? `地址写的是 type=${input.type}，服务端按 action 精确匹配；× 移除这一条筛选`
        : `${UNRECOGNISED_FILTER_TITLE}：本面板的事件类型选项里没有「${input.type}」，但它已按原样作为 action 发给服务；× 移除这一条筛选`,
      params: ["type"] as const,
    });
  }

  if (input.actor !== "") {
    chips.push({
      key: "actor",
      label: seats.actor,
      title: `地址栏带入的操作者句柄（原值 ${input.actor}）已作为 actorId 发给服务；× 移除这一条筛选`,
      params: ["actor"] as const,
    });
  }

  if (input.resource !== "") {
    chips.push({
      key: "resource",
      label: seats.resource,
      title: `地址栏带入的资源编号（原值 ${input.resource}）；该参数由路由接受、过滤效果本环境未单独实测，本页同时在已加载的记录里本地匹配；× 移除这一条筛选`,
      params: ["resource"] as const,
    });
  }

  const defaultLimit = input.defaultLimit ?? 50;
  if (input.rawLimit !== "") {
    chips.push({
      key: "limit",
      label: `每页 ${input.rawLimit} 条`,
      title: `${UNRECOGNISED_FILTER_TITLE}：地址写的「${input.rawLimit}」不是本面板可请求的每页档位，所以没有把它发出去；× 把它从地址里去掉`,
      params: ["limit"] as const,
    });
  } else if (input.limit !== undefined && input.limit !== defaultLimit) {
    chips.push({
      key: "limit",
      label: seats.limit,
      title: `每页条数已生效；× 移除后回到默认每页 ${defaultLimit} 条`,
      params: ["limit"] as const,
    });
  }

  if (input.cursorCount > 0) {
    chips.push({
      key: "page",
      label: seats.page,
      title: `第 ${input.page} 页是靠 ${input.cursorCount} 个游标读出来的；× 回到第 1 页并丢掉游标`,
      params: ["cursor"] as const,
    });
  }

  return chips;
}
