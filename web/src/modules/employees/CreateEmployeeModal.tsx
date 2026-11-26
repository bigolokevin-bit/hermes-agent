/**
 * PE-08① · 员工新建模态（EMP-02 真实写入，幂等提交）。
 *
 * 现网契约（bff-v4-serve apps/console/server.py `_resource_write` 3014-3147，
 * services/domain/service.py `validate_create` 116-190，2026-11-24 实测）：
 * - POST /agent-api/api/employees → BFF 门序：身份 → CSRF 同源+双提交 →
 *   Idempotency-Key 必填（缺键 400 request.missing_idempotency_key，实测 P1）
 *   → 最小体校验 → 域 POST /v1/employees（体原样透传，上游 4xx/5xx 不改写）。
 * - 域要求 name/title/ownerUserId 皆非空 + 嵌套 initialVersion
 *   （jobDescription 非空、knowledgeScopes/skillRefs/grantIds 数组、
 *   responsePolicy{triggers 非空子集/mode=realtime/loopGuard/四枚 fail-closed
 *   fallback 字面量}、memoryScope）。缺任一 → 400 employee.invalid_initial_version
 *   （实测 P2：仅 name → "title is required"，逐字透传）。
 *   卡面「最小集 {name,title?,department?}」与实测冲突——以域源码为准，
 *   initialVersion 由前端按裁定构造（fail-closed 缺省，见 buildInitialVersion）。
 * - department：创建体是投影快照写入口（service.py _build_records
 *   `"department": body.get("department")`，projections.py 恒出键），表单如实采集；
 *   P-PE-2 的被忽略是**读口 query 参数**，与写体无关。
 * - 幂等键只在**成功**时落库（create_employee_with_version 同事务写 idempotency 行；
 *   校验失败仅记 denied 审计，键未消耗）⇒ 同一轮编辑复用同键重试安全；
 *   成功后换新键。502/503 状态未知：保留同键 + 冻结原体可重放（改体会撞
 *   409 request.idempotency_conflict，故 unknown 态字段只读）。
 * - 成功语义：200/201 后由父级重读列表（refetch），确认行在列才关表单、才发
 *   success toast；禁乐观插入；重读完成前提交钮保持 disabled。
 * - name 上限 120：卡面引域 schema 实测值（employee_models Field max_length=120）。
 *   现跑域的 dict 校验未检长度（121 字探针仅报 initialVersion，DONE 留痕），
 *   表单仍按裁定钉 maxLength=120——比上游更严不造假。
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@nous-research/ui";

import { RequestIdCopy } from "@/components/RequestIdCopy";
import { fetchJSON } from "@/lib/api";
import { composeEmployeeOverlay, composeEmployeeSoul } from "@/modules/chat/employeeSoul";
import { employeeProfileDescription, employeeProfileName } from "@/modules/chat/employeeProfile";
import { ApiError } from "@/lib/api-error";
import { csrfFailureCopy, csrfWriteHeaders } from "@/lib/csrf";

const CREATE_URL = "/agent-api/api/employees";

/** 域 schema 实测的姓名上限（卡面冻结值，校验文案引用它，不发明）。 */
export const EMP_NAME_MAX = 120;

export type CreatedRef = { id: string | null; name: string };

/** 父级重读列表的三种诚实结局。 */
export type VerifyOutcome =
  | { k: "found" }
  | { k: "absent" }
  | { k: "refetch-failed"; message: string };

type Phase = "editing" | "submitting" | "verifying" | "unknown" | "unconfirmed";

/** initialVersion 的 fail-closed 缺省（域契约默认值，逐项可在详情页后补）：
 *  知识域/技能/授权全空；仅 @ 提及触发、实时模式、常规 loopGuard；
 *  fallback 四枚字面量是契约钉死的（fail-closed, never allow）；
 *  budget 键缺省 → 域套用 policy_defaults.DEFAULT_BUDGET（显式 null 会被拒）。 */
export function buildInitialVersion(jobDescription: string) {
  return {
    jobDescription,
    knowledgeScopes: [] as string[],
    skillRefs: [] as { skillId: string; version: string }[],
    grantIds: [] as string[],
    responsePolicy: {
      triggers: ["mention"],
      mode: "realtime",
      loopGuard: { maxTurnsPerConversation: 20, maxToolCallsPerRun: 40 },
      fallback: {
        onUnknownSender: "deny_with_guidance",
        onLowConfidence: "ask_clarifying",
        onPolicyDeny: "explain_and_escalate",
        onBudgetExhausted: "denied_with_notification",
      },
    },
    memoryScope: { employeeScope: true, teamScopeIds: [] as string[], retentionDays: 90 },
  };
}

/** 创建回执的员工 id：字段拼写以域投影为准（id 实测；employeeId 容错），取不到不编造。 */
function createdId(body: unknown): string | null {
  if (body && typeof body === "object") {
    const rec = body as Record<string, unknown>;
    for (const key of ["id", "employeeId"]) {
      const v = rec[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return null;
}

/** 上游错误体逐字提取 {code, message}（BFF/域两家都是这个形状）；解不出的退成人话。 */
function upstreamQuote(err: ApiError): string {
  try {
    const parsed: unknown = JSON.parse(err.body);
    if (parsed && typeof parsed === "object") {
      const rec = parsed as Record<string, unknown>;
      const code = typeof rec.code === "string" ? rec.code : null;
      const message = typeof rec.message === "string" ? rec.message : null;
      if (code && message) return `${code}：${message}`;
      if (message) return message;
      if (code) return code;
    }
  } catch {
    /* 非 JSON 体：下面退回 ApiError.message（fetchJSON 已从 detail/message/error 取过人话句） */
  }
  return err.message;
}

export function CreateEmployeeModal({
  open,
  onClose,
  onVerifyCreated,
  onConfirmed,
}: {
  open: boolean;
  onClose: () => void;
  /** 2xx 之后由父级重读第一页并回报：新员工在列 / 不在列 / 重读失败。 */
  onVerifyCreated: (created: CreatedRef) => Promise<VerifyOutcome>;
  /** 重读确认在列后回调（success toast 归页面所有，模态卸载不吞回执）。 */
  onConfirmed: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [department, setDepartment] = useState("");
  // 人格（SOUL）：留空则按姓名/岗位/部门/职责自动生成；填写则原样使用。
  const [soul, setSoul] = useState("");
  const [phase, setPhase] = useState<Phase>("editing");
  const [feedback, setFeedback] = useState<{ message: string; requestId: string | null } | null>(null);
  // 幂等键：每轮打开（新编辑会话）生成一次，存 ref；本轮内所有重试沿用同键，
  // 拿到 2xx 回执即换新键（键已随成功落库，旧键只会被回放）。
  const idemRef = useRef<string>("");
  const nameRef = useRef<HTMLInputElement>(null);
  // busy 的键盘回调快照：避免把 Esc 监听器随每次状态切换重挂。
  const busyRef = useRef(false);

  const busy = phase === "submitting" || phase === "verifying";

  useEffect(() => {
    if (!open) return;
    idemRef.current = crypto.randomUUID();
    setPhase("editing");
    setFeedback(null);
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      // 提交/重读在途时不关：表单未终结，关闭会吞掉结果。
      if (e.key === "Escape" && !busyRef.current) onClose();
    };
    document.addEventListener("keydown", onKey);
    window.setTimeout(() => nameRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);

  busyRef.current = busy;

  if (!open) return null;

  const locked = phase === "unknown"; // 502/503：原体同键重放，字段冻结防 409 冲突

  async function submit() {
    if (busy) return;
    const n = name.trim();
    const t = title.trim();
    const o = ownerUserId.trim();
    const j = jobDescription.trim();
    if (!n) {
      setFeedback({ message: `姓名是必填的（最长 ${EMP_NAME_MAX} 字，按域 schema 实测值拦截）。`, requestId: null });
      return;
    }
    if (n.length > EMP_NAME_MAX) {
      setFeedback({ message: `姓名超出上限：${n.length} 字，最多 ${EMP_NAME_MAX} 字（域 schema 实测值）。`, requestId: null });
      return;
    }
    if (!t) {
      setFeedback({ message: "岗位是必填的（域契约实测：title is required）。", requestId: null });
      return;
    }
    if (!o) {
      setFeedback({ message: "责任人是必填的，填真实责任人 id，占位符会被域拒绝。", requestId: null });
      return;
    }
    if (!j) {
      setFeedback({ message: "职责说明是必填的（initialVersion.jobDescription，域实测非空）。", requestId: null });
      return;
    }
    // CSRF 双提交：没有会话 cookie 就没有诚实的写入——先说明，不发注定被拦的请求。
    const csrf = csrfWriteHeaders();
    if (!csrf) {
      setFeedback({ message: "需要登录后才能提交。当前没有可用的写入会话，请先登录。", requestId: null });
      return;
    }
    const body: Record<string, unknown> = {
      name: n,
      title: t,
      ownerUserId: o,
      initialVersion: buildInitialVersion(j),
    };
    const dept = department.trim();
    if (dept) body.department = dept;
    setPhase("submitting");
    setFeedback(null);
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "Idempotency-Key": idemRef.current,
      // 每趟请求一个新的追踪号（幂等键标识「这一轮编辑」，请求号标识「这一趟」）。
      "X-Request-Id": crypto.randomUUID(),
      ...csrf,
    };
    let res: unknown;
    try {
      res = await fetchJSON<unknown>(CREATE_URL, { method: "POST", headers, body: JSON.stringify(body) });
    } catch (err: unknown) {
      const api = err instanceof ApiError ? err : null;
      const status = api?.status ?? 0;
      if (status === 502 || status === 503) {
        // 上游超时 ≠ 失败：可能已建。保留同键 + 冻结原体，重放不会双建；
        // 若上游真建成了，重放会拿回缓存的成功回执。
        setPhase("unknown");
        setFeedback({
          message: `已提交状态未知，请刷新列表确认。（上游应答 ${status}${api ? `：${upstreamQuote(api)}` : ""}）重试将沿用同一幂等键，不会产生第二个员工。`,
          requestId: api?.requestId ?? null,
        });
        return;
      }
      if (status === 400 && api) {
        // 幂等门（理论上不会走到——本表单恒带键）与体校验拒绝都逐字透传。
        setPhase("editing");
        setFeedback({ message: `提交被拒绝：${upstreamQuote(api)}`, requestId: api.requestId ?? null });
        return;
      }
      const csrfCopy = api ? csrfFailureCopy(api.status, api.body, api.requestId) : null;
      setPhase("editing");
      setFeedback({
        message: csrfCopy
          ? csrfCopy.sentence
          : status === 401
            ? "需要登录：登录状态已失效，员工没有提交。重新登录后再试。"
            : status === 403
              ? "这个写入没有被后台允许，员工没有提交。需要开通时，请联系工作区管理员。"
              : api
                ? `员工没有提交成功：${api.message}`
                : "员工没有提交成功：服务暂时不可达，请稍后重试。",
        requestId: csrfCopy?.requestId ?? api?.requestId ?? null,
      });
      return;
    }
    // 拿到 2xx：本轮幂等键已终结（成功会落库），先换新键再重读列表。
    idemRef.current = crypto.randomUUID();

    // 建档那一刻就给它独立身份：专属 profile + 该员工自己的 SOUL.md。
    // 留空用自动生成的那份（姓名/岗位/部门/职责），填写则原样使用。
    // 失败不阻断创建（员工已在域侧落库）：打开对话时会再试一次并如实说明，
    // 所以这里不显示「已建好人格」这种没证据的话。
    const newId = createdId(res);
    const profileName = newId ? employeeProfileName(newId) : null;
    if (newId && profileName) {
      // 同一份素材两处用：SOUL.md（身份）与 agent.system_prompt（组织上下文叠加层）。
      // 新员工此刻还没有可读的版本号，所以版本行留空，不编 v1。
      const source = {
        name: n,
        title: t,
        department: dept || null,
        jobDescription: j,
        // 与初始版本的 fail-closed 缺省一致：仅被 @ 提及触发、realtime 应答。
        triggers: ["被 @ 提及"],
        mode: "realtime",
        versionNo: null,
        effectiveFrom: null,
      };
      const soulText = soul.trim() || composeEmployeeSoul(source);
      // 不 await：这一步不能拖慢「创建 → 重读确认」这条主链（确认句依赖它）。
      // 失败由对话页的 ensure 路径兜底重试，并在那里如实说明原因。
      void fetchJSON<unknown>("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileName,
          clone_from_default: true,
          soul: soulText,
          description: employeeProfileDescription(newId),
        }),
      })
        .then(() =>
          // 叠加层同拍写对：克隆默认档会带「上一位员工」的组织说明，必须换掉。
          // 这一层不能删（Hermes 的补充说明能力），只换内容。
          fetchJSON<unknown>(`/api/config?profile=${encodeURIComponent(profileName)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              config: { agent: { system_prompt: composeEmployeeOverlay(source) } },
            }),
          }),
        )
        .catch(() => undefined);
    }
    setPhase("verifying");
    const outcome = await onVerifyCreated({ id: createdId(res), name: n });
    if (outcome.k === "found") {
      // 确认句与关表单都交回页面：toast 的生命周期不能挂在被卸载的模态里。
      onConfirmed(n);
      onClose();
      return;
    }
    setPhase("unconfirmed");
    setFeedback({
      message:
        outcome.k === "absent"
          ? `创建请求已成功${createdId(res) ? `（回执 ${createdId(res)}）` : ""}，但按当前筛选重读名册没有见到TA：新员工初始为草稿态，可能被在职态筛选挡住。请清除筛选或稍后刷新确认；不要重复提交。`
          : `创建请求已成功，但列表重读失败：${outcome.message}。请稍后用「刷新」确认新员工是否出现；不要重复提交。`,
      requestId: null,
    });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="新建员工"
        data-testid="emp-create-modal"
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-white/15 bg-[#141414] p-4 shadow-xl"
      >
        <h2 className="font-mondwest text-base">新建员工</h2>
        <p className="mt-1 text-xs text-white/50">
          提交走员工服务真接口（POST /api/employees）；本轮重试沿用同一幂等键，成功前重复点击不会产生第二个员工。
        </p>
        <div className="mt-3 flex min-w-0 flex-col gap-3">
          <label className="flex min-w-0 flex-col gap-1 text-xs">
            <span className="text-white/55">姓名（必填，最长 {EMP_NAME_MAX} 字）</span>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={EMP_NAME_MAX}
              disabled={locked}
              className="min-w-0 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm"
              data-testid="emp-create-name"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs">
            <span className="text-white/55">岗位（必填，域实测 title is required）</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              disabled={locked}
              className="min-w-0 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm"
              data-testid="emp-create-title"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs">
            <span className="text-white/55">责任人 id（必填，真实负责人，占位符会被域拒绝）</span>
            <input
              value={ownerUserId}
              onChange={(e) => setOwnerUserId(e.target.value)}
              maxLength={120}
              disabled={locked}
              className="min-w-0 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm"
              data-testid="emp-create-owner"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs">
            <span className="text-white/55">职责说明（必填，作为初始版本 jobDescription）</span>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={3}
              disabled={locked}
              className="min-w-0 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm"
              data-testid="emp-create-job"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs">
            <span className="text-white/55">人格 SOUL（可选；留空则按姓名/岗位/部门/职责自动生成一份）</span>
            <textarea
              value={soul}
              onChange={(e) => setSoul(e.target.value)}
              rows={4}
              disabled={locked}
              placeholder="留空即可。填写会原样写进这位员工的 SOUL.md，成为它的身份与行为基调。"
              className="min-w-0 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm"
              data-testid="emp-create-soul"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs">
            <span className="text-white/55">部门（可选；创建时作为投影快照写入，之后仍以组织同步为准）</span>
            <input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              maxLength={120}
              disabled={locked}
              className="min-w-0 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm"
              data-testid="emp-create-department"
            />
          </label>
          <p className="text-xs text-white/40" data-testid="emp-create-defaults-note">
            初始版本按 fail-closed 缺省构造：仅被 @ 提及触发、知识域/技能/授权为空、记忆保留 90 天、预算套用服务端缺省；创建后可在详情页补。
          </p>

          {feedback ? (
            <div
              role="alert"
              data-testid="emp-create-feedback"
              className={`flex min-w-0 flex-col gap-1 rounded-md border p-2 text-xs ${
                phase === "unknown" || phase === "unconfirmed"
                  ? "border-amber-400/40 bg-amber-400/5 text-amber-200"
                  : "border-red-400/40 bg-red-400/5 text-red-200"
              }`}
            >
              <span>{feedback.message}</span>
              {feedback.requestId !== null ? (
                <span className="text-white/45">
                  <RequestIdCopy requestId={feedback.requestId} fallback="本次请求未记录编号" />
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => void submit()}
              disabled={busy}
              aria-disabled={busy || undefined}
              data-testid="emp-create-submit"
            >
              {phase === "submitting" ? "提交中…" : phase === "verifying" ? "重读列表确认中…" : phase === "unknown" ? "同键重试" : "提交创建"}
            </Button>
            <Button size="sm" outlined onClick={onClose} disabled={busy} data-testid="emp-create-cancel">
              {phase === "unconfirmed" || phase === "unknown" ? "关闭（稍后刷新确认）" : "取消"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
