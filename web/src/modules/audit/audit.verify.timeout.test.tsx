// @vitest-environment jsdom
/**
 * AU-05 — 校验页超时/取消/进度 与 在飞竞态稳定（前端域，写域 web/src/modules/audit/）。
 *
 * 口径（板 task-lanes AU-05 + backlogs knowledge-audit-sessions §AU-05 步骤③）：
 *  - 大窗校验不再无限挂：时限到 → timeout 态（abort 断连、明说「不是结果」）；
 *  - 人可取消：canceled 态，迟到的回答不得覆盖（竞态牙齿）；
 *  - 进度可见但诚实：走过的秒数（elapsed），不编百分比不编完成度；
 *  - 小窗快路不降级：时限前回答正常到达 → ready 原形制回归；
 *  - 502（BFF 上游放弃族）在时限前到达 → 仍走 unavailable，不被超时分支劫持。
 * 阈值：VERIFY_TIMEOUT_MS=8000（BFF UPSTREAM_TIMEOUT=5.0s + 连接余量；现读
 * seakoi-agent-os/apps/console/server.py:307，写回见 DONE 卡）。
 */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import { useAuditVerify, VERIFY_TIMEOUT_MS } from "@/modules/audit/useAuditData";
import AuditVerifyModulePage from "@/modules/audit/AuditVerifyModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Held = {
  url: string;
  signal?: AbortSignal;
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
};

let held: Held[] = [];

let root: Root | null = null;
let container: HTMLDivElement;

beforeEach(() => {
  document.body.replaceChildren();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  held = [];
  api.fetchJSON.mockReset();
  api.fetchJSON.mockImplementation((url: string, init?: { signal?: AbortSignal }) =>
    new Promise((resolve, reject) => {
      held.push({ url, signal: init?.signal, resolve, reject });
    }));
});

afterEach(() => {
  act(() => root?.unmount());
  // 收尾清场：所有在飞 Promise 一律了结（组件已卸载，结果被 seq 守卫吞掉），
  // 不给后续文件留 open handle / 迟到微任务。
  const pending = held.splice(0);
  for (const h of pending) {
    try {
      h.resolve(null);
    } catch {
      /* already settled */
    }
  }
});

async function flush(ms = 0): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

const q = (sel: string): Element | null => document.body.querySelector(sel);
const text = (): string => document.body.textContent ?? "";

/** 直测钩子：短时限 + 探针面板（与页面同款 testid 语义）。 */
function Probe({ timeoutMs }: { timeoutMs: number }): ReactNode {
  const v = useAuditVerify(null, { timeoutMs });
  return (
    <div>
      <span data-testid="probe-phase">{v.phase}</span>
      <span data-testid="probe-timeout">{v.timeoutMs}</span>
      <button onClick={() => v.run("2026-11-23T00:00:00Z", "2026-11-24T00:00:00Z")}>go</button>
      <button onClick={v.cancel}>cancel</button>
    </div>
  );
}

async function mount(node: ReactNode): Promise<void> {
  await act(async () => {
    root?.render(node);
  });
}

async function clickByTestId(testid: string): Promise<void> {
  const node = q(`[data-testid='${testid}']`) as HTMLButtonElement | null;
  if (!node) throw new Error(`button ${testid} not found`);
  await act(async () => {
    node.click();
  });
}

async function clickText(label: string): Promise<void> {
  const node = Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").includes(label));
  if (!node) throw new Error(`button ${label} not found`);
  await act(async () => {
    (node as HTMLButtonElement).click();
  });
}

describe("AU-05 verify 超时/取消态（钩子层，短时限注入）", () => {
  it("时限到 → timeout 态 + 断连（signal.aborted）+ 不产出结果", async () => {
    await mount(<Probe timeoutMs={120} />);
    await clickByTestId("probe-phase"); // no-op click on span harmless
    const go = Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "go")!;
    await act(async () => {
      go.click();
    });
    expect(q("[data-testid='probe-phase']")!.textContent).toBe("loading");
    await flush(200);
    expect(q("[data-testid='probe-phase']")!.textContent).toBe("timeout");
    expect(held[0].signal?.aborted).toBe(true);
  });

  it("timeout 后服务迟到回答不得覆盖（竞态牙齿）", async () => {
    await mount(<Probe timeoutMs={120} />);
    const go = Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "go")!;
    await act(async () => {
      go.click();
    });
    await flush(200);
    expect(q("[data-testid='probe-phase']")!.textContent).toBe("timeout");
    await act(async () => {
      held[0].resolve({ verified: 5, total: 5, broken: 0 });
    });
    await flush(10);
    expect(q("[data-testid='probe-phase']")!.textContent).toBe("timeout"); // 不被迟到覆盖
  });

  it("取消 → canceled 态；迟到回答同样作废", async () => {
    await mount(<Probe timeoutMs={60_000} />);
    const go = Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "go")!;
    await act(async () => {
      go.click();
    });
    const cancel = Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "cancel")!;
    await act(async () => {
      cancel.click();
    });
    expect(q("[data-testid='probe-phase']")!.textContent).toBe("canceled");
    expect(held[0].signal?.aborted).toBe(true);
    await act(async () => {
      held[0].resolve({ verified: 9, total: 9, broken: 0 });
    });
    await flush(10);
    expect(q("[data-testid='probe-phase']")!).toBeTruthy();
    expect(q("[data-testid='probe-phase']")!.textContent).toBe("canceled");
  });

  it("小窗快路不降级：时限前到达 → ready 正常出数", async () => {
    await mount(<Probe timeoutMs={5_000} />);
    const go = Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "go")!;
    await act(async () => {
      go.click();
    });
    await act(async () => {
      held[0].resolve({ verified: 12, total: 12, broken: 0 });
    });
    await flush(10);
    expect(q("[data-testid='probe-phase']")!.textContent).toBe("ready");
  });

  it("502 在时限前到达 → unavailable 不被超时分支劫持", async () => {
    await mount(<Probe timeoutMs={5_000} />);
    const go = Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "go")!;
    await act(async () => {
      go.click();
    });
    await act(async () => {
      held[0].reject(new ApiError("502: upstream down", { status: 502, body: '{"code":"console.upstream_unavailable","message":"上游暂不可达"}', url: "/agent-api/api/audit-verify" }));
    });
    await flush(10);
    expect(q("[data-testid='probe-phase']")!.textContent).toBe("unavailable");
  });

  it("连点两窗：只采纳最后一次回答，前一窗在飞作废且各窗带自己的 ISO 界", async () => {
    await mount(<Probe timeoutMs={60_000} />);
    const go = Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "go")!;
    await act(async () => {
      go.click();
    });
    await act(async () => {
      go.click();
    });
    expect(held.length).toBe(2);
    expect(held[0].signal?.aborted).toBe(true); // 第一条被主动断，不占后道
    for (const h of held) expect(h.url).toContain("from=2026-11-23T00%3A00%3A00Z");
    await act(async () => {
      held[0].resolve({ verified: 1, total: 1, broken: 1 }); // 迟到旧答
    });
    await flush(10);
    expect(q("[data-testid='probe-phase']")!.textContent).toBe("loading");
    await act(async () => {
      held[1].resolve({ verified: 4, total: 4, broken: 0 });
    });
    await flush(10);
    expect(q("[data-testid='probe-phase']")!.textContent).toBe("ready");
  });
});

describe("AU-05 校验页进度与取消（页面层，默认 8s 时限在册）", () => {
  it("默认时限 8000ms 常量入册（阈值写回口径）", () => {
    expect(VERIFY_TIMEOUT_MS).toBe(8_000);
  });

  it("loading 面板带已等待秒数与取消按钮", async () => {
    await mount(<AuditVerifyModulePage />);
    await flush(30);
    expect(text()).toContain("还没有运行校验");
    await clickText("最近 24 小时");
    expect(q("[data-testid='aud01-verify-loading']")).toBeTruthy();
    expect(q("[data-testid='aud01-verify-cancel']")).toBeTruthy();
    expect(q("[data-testid='aud01-verify-elapsed']")?.textContent).toContain("已等待");
    await flush(320); // 至少一个 tick
    expect(q("[data-testid='aud01-verify-elapsed']")?.textContent).toMatch(/已等待 \d+\.\d s／本页时限 8s|已等待 \d+\.\ds／本页时限 8s/);
  });

  it("页面点取消 → 已取消卡（不是已通过也不是失败），可重跑", async () => {
    await mount(<AuditVerifyModulePage />);
    await flush(30);
    await clickText("最近 24 小时");
    await clickByTestId("aud01-verify-cancel");
    expect(q("[data-testid='aud01-verify-canceled']")).toBeTruthy();
    expect(text()).toContain("没有跑完就没有结论");
    await clickByTestId("aud01-verify-canceled-retry");
    expect(q("[data-testid='aud01-verify-loading']")).toBeTruthy();
  });

  it("verify 请求走真实游标契约 URL（分页参数纪律：ISO 界在 URL 不在屏）", async () => {
    await mount(<AuditVerifyModulePage />);
    await flush(30);
    await clickText("最近 24 小时");
    expect(held.length).toBe(1);
    expect(held[0].url).toMatch(/^\/agent-api\/api\/audit-verify\?from=\d{4}-\d{2}-\d{2}T\d{2}%3A\d{2}%3A\d{2}/);
    expect(held[0].url).toContain("to=");
    expect(text()).not.toMatch(/20\d\d-\d\d-\d\dT\d\d:\d\dZ/); // ISO 不上屏（北京时间标注另行在册）
  });
});
