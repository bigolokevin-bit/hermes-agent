/**
 * Lane work · T14 R3 task create form (`#/work?tab=board` 的「新建任务」入口)。
 *
 * 写链坐实（bff-v4-serve/apps/console/server.py，只读核对）：
 * POST /api/tasks → 域 POST /v1/tasks，required_field=title，
 * 创建人由 BFF 按已认证会话注入（前端 body 不带身份），
 * Idempotency-Key 头必填——缺失 BFF 直接 400 request.missing_idempotency_key。
 * 因此本表单：提交一次生成一个幂等键，失败重试复用同键（防双击双建），
 * 成功后换新键。端点不存在/未授权时如实报错，绝不本地伪造成功。
 */
import { useRef, useState } from "react";

import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { fetchJSON } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { csrfFailureCopy, csrfWriteHeaders } from "@/lib/csrf";
import { RequestIdCopy } from "@/components/RequestIdCopy";

import { employeeLabel, errorInfo, shortRef } from "./tasksBoard";
import { ConsoleSelect } from "@/shell/ConsoleSelect";

const CREATE_URL = "/agent-api/api/tasks";

type SubmitState =
  | { k: "idle" }
  | { k: "submitting" }
  | { k: "success"; id: string | null }
  | { k: "error"; message: string; requestId: string | null };

/** 域响应的新任务 id 字段拼写未冻结，容错提取；取不到不编造。 */
function createdId(body: unknown): string | null {
  if (typeof body === "string" && body.trim()) return body.trim();
  if (body && typeof body === "object") {
    const rec = body as Record<string, unknown>;
    for (const key of ["id", "task_id", "taskId"]) {
      const v = rec[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    const task = rec["task"];
    if (task && typeof task === "object") {
      const tid = (task as Record<string, unknown>)["id"] ?? (task as Record<string, unknown>)["task_id"];
      if (typeof tid === "string" && tid.trim()) return tid.trim();
    }
  }
  return null;
}

export function TaskCreateForm({
  nameMap,
  onCreated,
  onClose,
}: {
  nameMap: Record<string, string>;
  /** 成功拿到 id 时回调（看板据此定位详情并刷新）；id 未知时不调用。 */
  onCreated: (taskId: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState("normal");
  const [dueAt, setDueAt] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<SubmitState>({ k: "idle" });
  // 幂等键：一开场就生成，重试复用；成功（或用户重开表单）后才换新键。
  const idemRef = useRef<string>(crypto.randomUUID());

  const employeeIds = Object.keys(nameMap).sort();

  async function submit(e: { preventDefault: () => void }) {
    e.preventDefault();
    const t = title.trim();
    if (!t) {
      setState({ k: "error", message: "标题是必填的，先写一句话说明这个任务。", requestId: null });
      return;
    }
    if (state.k === "submitting") return;
    // CSRF double-submit: without the session cookie there is no honest
    // write to attempt — say so instead of sending a doomed request.
    const csrf = csrfWriteHeaders();
    if (!csrf) {
      setState({
        k: "error",
        message: "需要登录后才能提交。当前没有可用的写入会话，请先登录。",
        requestId: null,
      });
      return;
    }
    setState({ k: "submitting" });
    const body: Record<string, unknown> = {
      title: t,
      priority,
      source: { kind: "manual" },
    };
    if (assignee) body["assignee"] = { type: "employee", id: assignee };
    if (dueAt) body["due_at"] = new Date(dueAt).toISOString();
    if (note.trim()) body["note"] = note.trim();
    try {
      const res = await fetchJSON<unknown>(CREATE_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...csrf,
          "Idempotency-Key": idemRef.current,
        },
        body: JSON.stringify(body),
      });
      const id = createdId(res);
      // 建下一条用新幂等键；本次已终结。
      idemRef.current = crypto.randomUUID();
      setState({ k: "success", id });
      if (id) onCreated(id);
    } catch (err: unknown) {
      const info = errorInfo(err);
      const csrfCopy = csrfFailureCopy(
        info.status,
        err instanceof ApiError ? err.body : null,
      );
      // 401 的通用文案是给读场景的，这里补一句写场景的话。
      setState({
        k: "error",
        message: csrfCopy
          ? csrfCopy.sentence
          : info.status === 401
            ? "需要登录：登录状态已失效，任务没有提交。重新登录后再试。"
            : info.status === 403
              ? "这个写入没有被后台允许，任务没有提交。需要开通时，请联系工作区管理员。"
              : info.status === 400
                ? "提交的内容后台没有接受，任务没有提交。请检查标题与指派后重试。"
                : `任务没有创建成功：${info.message}`,
        requestId: csrfCopy?.requestId ?? info.requestId,
      });
    }
  }

  if (state.k === "success") {
    return (
      <Card data-testid="tsk4-create-success">
        <CardContent className="flex flex-col items-start gap-2 p-4">
          <h2 className="text-sm font-semibold">任务已创建</h2>
          {state.id ? (
            <p className="text-xs text-muted-foreground">
              新任务编号 <code title={state.id}>{shortRef(state.id)}</code>
              <button
                type="button"
                aria-label="复制新任务编号"
                data-testid="tsk4-copy-new-id"
                className="ml-1 text-xs underline underline-offset-2"
                onClick={() => {
                  void navigator.clipboard?.writeText(state.k === "success" && state.id ? state.id : "");
                }}
              >
                复制
              </button>
              ，已在看板中打开它的详情。
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              后台确认创建成功，但没有回传任务编号；刷新看板后能看到这条新任务。
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" outlined onClick={onClose} data-testid="tsk4-create-done">
              返回看板
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const busy = state.k === "submitting";

  return (
    <Card data-testid="tsk4-create-form">
      <CardContent className="p-4">
        <form className="flex min-w-0 flex-col gap-3" onSubmit={(e) => void submit(e)}>
          <h2 className="text-sm font-semibold">新建任务</h2>

          <label className="flex min-w-0 flex-col gap-1 text-xs">
            <span className="text-muted-foreground">标题（必填）</span>
            <input
              className="min-w-0 rounded-sm border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white/90"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              data-testid="tsk4-create-title"
            />
          </label>

          <label className="flex min-w-0 flex-col gap-1 text-xs">
            <span className="text-muted-foreground">指派给</span>
            <ConsoleSelect
              className="min-w-0 rounded-sm border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white/90"
              value={assignee}
              onChange={(next) => setAssignee(next)}
              data-testid="tsk4-create-assignee"
              options={[
                { value: "", label: "暂不指派" },
                ...employeeIds.map((id) => ({ value: id, label: employeeLabel(id, nameMap[id]) })),
              ]}
            />
            {employeeIds.length === 0 ? (
              <span className="text-muted-foreground">
                员工目录还没读到，可先不指派，创建后再在看板里核对。
              </span>
            ) : null}
          </label>

          <label className="flex min-w-0 flex-col gap-1 text-xs">
            <span className="text-muted-foreground">优先级</span>
            <ConsoleSelect
              className="min-w-0 rounded-sm border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white/90"
              value={priority}
              onChange={(next) => setPriority(next)}
              data-testid="tsk4-create-priority"
              options={[
                { value: "normal", label: "普通" },
                { value: "high", label: "高" },
                { value: "low", label: "低" },
              ]}
            />
          </label>

          <label className="flex min-w-0 flex-col gap-1 text-xs">
            <span className="text-muted-foreground">期限（可选，按本地时区记录）</span>
            <input
              type="datetime-local"
              className="min-w-0 rounded-sm border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white/90"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              data-testid="tsk4-create-due"
            />
          </label>

          <label className="flex min-w-0 flex-col gap-1 text-xs">
            <span className="text-muted-foreground">说明（可选）</span>
            <textarea
              className="min-w-0 rounded-sm border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white/90"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              data-testid="tsk4-create-note"
            />
          </label>

          {state.k === "error" ? (
            <div
              className="flex min-w-0 flex-col gap-1 rounded-sm border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive"
              role="alert"
              data-testid="tsk4-create-error"
            >
              <span>{state.message}</span>
              <span className="text-muted-foreground">
                <RequestIdCopy
                  requestId={state.requestId}
                  fallback="本次请求未记录编号，可复制时间与操作路径反馈"
                />
              </span>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              type="submit"
              disabled={busy}
              data-testid="tsk4-create-submit"
            >
              {busy ? "提交中…" : "建立任务"}
            </Button>
            <Button size="sm" outlined type="button" onClick={onClose} disabled={busy}>
              取消
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            提交走任务服务真接口；同一张表单在提交成功前重试不会产生重复任务。
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
