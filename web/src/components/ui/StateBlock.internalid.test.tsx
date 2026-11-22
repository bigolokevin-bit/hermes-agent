import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StateBlock, containsInternalIdShape } from "./StateBlock";

/**
 * 钉住「基元自身拒收内部标识」这条契约——L0 明确要求别只靠外部约束。
 * 覆盖两向：内部标识必须被拦、业务话术不得误伤。
 */
describe("StateBlock 内部标识拒收（rubric 优先于迁移）", () => {
  it("认得公认的内部标识形态", () => {
    for (const text of [
      "run_id",
      "session_id 未回流",
      "0f3e8a2b1c4d",
      "0f3e8a2b-1c4d-4e5f-8a9b-0c1d2e3f4a5b",
      "rid-0f3e8a2b1c4d",
    ]) {
      expect(containsInternalIdShape(text), text).toBe(true);
    }
  });

  it("业务话术与短标识不误伤", () => {
    for (const text of [
      "这条筛选没有留下结果",
      "会话 run-42 已断开",
      "工单 RUN-7F3A9C 已关闭",
      "换个时间范围试试。",
    ]) {
      expect(containsInternalIdShape(text), text).toBe(false);
    }
  });

  it("含内部标识的 detail 当场抛错，什么都不渲染", () => {
    expect(() =>
      renderToStaticMarkup(
        <StateBlock tone="error" title="读取失败" detail="run_id 0f3e8a2b1c4d 没有回音" />,
      ),
    ).toThrow(/不接受内部标识/);
  });

  it("干净文案照常渲染", () => {
    const html = renderToStaticMarkup(
      <StateBlock tone="empty" title="这条筛选没有留下结果" detail="换个时间范围试试。" />,
    );
    expect(html).toContain("这条筛选没有留下结果");
  });
});
