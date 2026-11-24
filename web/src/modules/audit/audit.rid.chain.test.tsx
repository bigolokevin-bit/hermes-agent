// @vitest-environment jsdom
// R2xx — AU-04 请求号追踪一致性：审计面「rid 恒显恒复制」契约矩阵（前端腿）。
//
// 票面（backlogs/knowledge-audit-sessions.md §AU-04）：前端所有错误态显 rid 且
// 可复制；无 rid（超时/断连/无信封）给「拿不到」人话而不是空白。写域限
// web/src/modules/audit/（重派令收窄：BFF 头恒在性与 knowledge 面分卡）。
//
// 已覆盖、这里不重写（只回证据，矩阵行注在 DONE-AU-04.md）：
// - `AuditEventsModulePage.test.tsx` :436 首屏 500「请求编号：au-1101」+
//   `aud01-error-request-id-value` 可复制；:454 无 rid 502 走兜底句；
//   :470 403/404 同体不回显线路。
// - `audit.error.test.tsx` ①②：错误态读数行 + 翻页失败 rid=这次回传值。
// - `audit.paging.test.tsx`（R161）：整页失败 rid 行在位。
// - `audit.verify.timeout.test.tsx`（AU-05）：超时/取消竞态族。
// - `RetentionModulePage.test.tsx`：四态 + 403/404 同体。
//
// 本文件钉的是【从未被逐面板拼过】的接缝：四个共享失败面板
// （ErrorPanel/DeniedPanel/VerifyUnavailablePanel/InlineFailure）与
// RequestIdLine 的 rid 三形制恒等——屏上短形、title 全值、剪贴板全值同源，
// 无 rid 恒走同一句兜底（逐字），无一格空白、无一枚裸 32-hex 上屏、
// 无一枚面板私句漂移。这是「一码到底」的前端半：任何面板接上
// failure.requestId 就自动满足 DoD，面板作者无需各自记得。

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DeniedPanel, ErrorPanel, InlineFailure, RequestIdLine, VerifyUnavailablePanel } from "./states";
import type { FailureCopy } from "./copy";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const HEX32 = "0f1e2d3c4b5a69788796a5b4c3d2e1f0";
const HEX_SHORT = "0f1e2d3c";
const SCHEME = "req-aud-1101";
const NO_ID_SENTENCE = "本次请求未记录编号，可复制时间与操作路径反馈";

const clip = { calls: [] as string[] };
let root: Root | null = null;

function installClip(): void {
  clip.calls.length = 0;
  // jsdom 默认 isSecureContext=false，copyTextToClipboard 会绕去 execCommand；
  // 真浏览器写入口径=安全上下文+clipboard.writeText，按该形制钉桩。
  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value: true,
  });
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (text: string) => {
        clip.calls.push(text);
        return Promise.resolve();
      },
    },
  });
}

async function render(node: ReactNode): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(node);
  });
}

const q = (id: string): HTMLElement | null =>
  document.querySelector(`[data-testid="${id}"]`);
const text = (): string => document.body.textContent ?? "";

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const failure = (requestId: string | null): FailureCopy => ({
  sentence: "审计服务在处理时出了错，请稍后重试。",
  requestId,
  technical: null,
});

async function copyFrom(lineTestId: string): Promise<string> {
  const button = q(lineTestId)?.querySelector("button");
  expect(button, `copy button under ${lineTestId}`).toBeTruthy();
  await act(async () => {
    (button as HTMLElement).click();
  });
  await flush();
  return clip.calls[clip.calls.length - 1] ?? "";
}

beforeEach(() => {
  installClip();
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
});

// ── 面板矩阵：同一 rid 三形制恒等（屏短形/title 全值/剪贴板全值） ──────────

describe("AU-04 rid 恒显恒复制矩阵", () => {
  const panels = [
    {
      name: "ErrorPanel",
      testId: "m-error",
      render: (f: FailureCopy) => (
        <ErrorPanel failure={f} onRetry={() => undefined} testId="m-error" />
      ),
      lineId: "m-error-request-id",
    },
    {
      name: "DeniedPanel",
      testId: "m-denied",
      render: (f: FailureCopy) => (
        <DeniedPanel failure={f} testId="m-denied" />
      ),
      lineId: "m-denied-request-id",
    },
    {
      name: "VerifyUnavailablePanel",
      testId: "m-verify",
      render: (f: FailureCopy) => (
        <VerifyUnavailablePanel
          failure={f}
          onRetry={() => undefined}
          testId="m-verify"
        />
      ),
      lineId: "m-verify-request-id",
    },
    {
      name: "InlineFailure",
      testId: "m-inline",
      render: (f: FailureCopy) => <InlineFailure failure={f} testId="m-inline" />,
      lineId: "m-inline-request-id",
    },
  ] as const;

  for (const panel of panels) {
    it(`${panel.name}: 32-hex rid 屏显短形、title 与剪贴板逐字全值、裸 32-hex 不上屏`, async () => {
      await render(panel.render(failure(HEX32)));
      const line = q(panel.lineId);
      expect(line, `${panel.name} rid line exists`).toBeTruthy();
      expect(text()).toContain("请求编号：");
      expect(line?.textContent).toContain(HEX_SHORT);
      expect(text()).not.toContain(HEX32); // 短形上屏，全值只走 title/剪贴板
      const value = line?.querySelector("[title]");
      expect(value?.getAttribute("title")).toBe(HEX32);
      expect(await copyFrom(panel.lineId)).toBe(HEX32);
    });

    it(`${panel.name}: 非 32-hex 的方案号原样上屏且可逐字复制`, async () => {
      await render(panel.render(failure(SCHEME)));
      expect(text()).toContain(SCHEME);
      expect(await copyFrom(panel.lineId)).toBe(SCHEME);
    });

    it(`${panel.name}: 无 rid 恒给逐字「拿不到」句，不空白、无复制钮`, async () => {
      await render(panel.render(failure(null)));
      const line = q(panel.lineId);
      expect(line, `${panel.name} keeps the line even without rid`).toBeTruthy();
      expect(line?.textContent).toContain(NO_ID_SENTENCE);
      expect(line?.querySelector("button")).toBeNull();
    });
  }

  it("RequestIdLine：面板外的直拼位也走同一 body（testId 在位、句逐字）", async () => {
    await render(<RequestIdLine requestId={null} testId="m-standalone" />);
    expect(q("m-standalone")?.textContent).toContain(NO_ID_SENTENCE);
    await render(<RequestIdLine requestId={SCHEME} testId="m-standalone" />);
    expect(await copyFrom("m-standalone")).toBe(SCHEME);
  });

  it("technical 在位时 rid 行不进折叠体（排障号不藏在详情后）", async () => {
    await render(
      <ErrorPanel
        failure={{ ...failure(HEX32), technical: "boom: sqlite" }}
        onRetry={() => undefined}
        testId="m-tech"
      />,
    );
    const details = q("m-tech-details");
    expect(details, "technical collapsed by default").toBeTruthy();
    expect(text()).toContain(HEX_SHORT); // rid 短形在折叠体外恒可见
    expect(details?.textContent).not.toContain(HEX32);
  });
});
