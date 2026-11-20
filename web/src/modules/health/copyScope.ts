// One wording for every copy control on the system surfaces. The copied text is
// a projection of the rows already on screen; it is never a full export.
export const COPY_SCOPE_TEXT = "复制的是当前展开/当前排序下的已加载行，不是全量。";

export function withCopyScope(title: string): string {
  if (title.includes(COPY_SCOPE_TEXT)) return title;
  return `${title.replace(/[。；;]+$/, "")}。${COPY_SCOPE_TEXT}`;
}