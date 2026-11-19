// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import KnowledgeModulePage from "./KnowledgeModulePage";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function render(path = "/knowledge") {
  act(() => root.unmount());
  root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <KnowledgeModulePage />
      </MemoryRouter>,
    );
  });
  await act(async () => {});
}

describe("KnowledgeModulePage", () => {
  it("shows 未接入 + GAP-03 for spaces, document count and retrieval, never 0", async () => {
    await render();
    const text = container.textContent ?? "";
    expect(text).toContain("未接入");
    expect(text).toContain("GAP-03");
    expect(text).toContain("不显示 0");
    expect(text).toContain("不展示样例命中");
    expect(container.querySelector('a[href="/approvals"]')).toBeTruthy();
  });

  it("deep-links the sources tab and states the missing endpoint", async () => {
    await render("/knowledge?tab=sources");
    expect(container.textContent).toContain("数据源未接入");
    expect(container.querySelector('[data-testid="knw4-tab-sources"]')?.getAttribute("aria-selected")).toBe("true");
  });

  it("renders all four forced states without fake data", async () => {
    await render("/knowledge?state=loading");
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    await render("/knowledge?state=empty");
    expect(container.textContent).toContain("当前没有空间");
    await render("/knowledge?state=error");
    expect(container.textContent).toContain("本次请求未记录编号");
    await render("/knowledge?state=denied");
    expect(container.textContent).toContain("无权访问");
  });
});
