/**
 * R17 auth5: the console's own sign-in page.
 *
 * The proxy bridge (lane D) serves same-origin /auth/* routes: captcha, login,
 * whoami, logout. A successful login leaves an HttpOnly session cookie set by
 * the bridge; we never touch cookies from here and never store tokens.
 * Copy is plain Chinese; failures map by code, with a copyable request id when
 * the bridge returns one.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";

type Captcha = { captcha_key: string; captcha: string; request_id?: string | null };
type LoginReply = { ok?: boolean; code?: string; display?: string; request_id?: string | null };

const FAILURE_COPY: Record<string, string> = {
  "auth.invalid_credentials": "账号或密码不正确。",
  "auth.captcha_invalid": "验证码不正确，已为你刷新，请重试。",
};

function readCode(body: unknown): string {
  if (body && typeof body === "object" && typeof (body as { code?: unknown }).code === "string") {
    return (body as { code: string }).code;
  }
  return "other";
}

export default function LoginPage(): ReactNode {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [captchaText, setCaptchaText] = useState("");
  const [captcha, setCaptcha] = useState<Captcha | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "submitting" | "failed">("loading");
  const [failure, setFailure] = useState<{ sentence: string; requestId: string | null } | null>(null);
  const copiedRef = useRef<HTMLSpanElement | null>(null);
  const busyRef = useRef(false);

  const loadCaptcha = useCallback(async () => {
    try {
      const res = await fetch("/auth/captcha", { credentials: "same-origin" });
      const body = (await res.json().catch(() => null)) as Partial<Captcha> | null;
      if (res.ok && body && typeof body.captcha_key === "string" && typeof body.captcha === "string") {
        setCaptcha({
          captcha_key: body.captcha_key,
          captcha: body.captcha,
          request_id: body.request_id ?? null,
        });
        setPhase((p) => (p === "loading" ? "ready" : p));
      } else {
        setFailure({ sentence: "登录暂时不可用，请稍后重试。", requestId: null });
        setPhase("failed");
      }
    } catch {
      setFailure({ sentence: "登录暂时不可用，请稍后重试。", requestId: null });
      setPhase("failed");
    }
  }, []);

  useEffect(() => {
    void loadCaptcha();
  }, [loadCaptcha]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busyRef.current || phase === "submitting" || !captcha) return;
    busyRef.current = true;
    setPhase("submitting");
    setFailure(null);
    try {
      const res = await fetch("/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          user_name: userName.trim(),
          password,
          captcha_key: captcha.captcha_key,
          captcha: captchaText.trim(),
        }),
      });
      const body = (await res.json().catch(() => null)) as LoginReply | null;
      if (res.ok) {
        sessionStorage.setItem("auth5.session", "1");
        navigate("/overview", { replace: true });
        return;
      }
      const code = readCode(body);
      const rid = body?.request_id ?? captcha.request_id ?? null;
      setFailure({ sentence: FAILURE_COPY[code] ?? "登录暂时不可用，请稍后重试。", requestId: rid });
      setPhase("failed");
      if (code === "auth.captcha_invalid") void loadCaptcha();
    } catch {
      setFailure({ sentence: "登录暂时不可用，请稍后重试。", requestId: null });
      setPhase("failed");
    } finally {
      busyRef.current = false;
    }
  };

  const copyRequestId = async () => {
    if (!failure?.requestId) return;
    try {
      await navigator.clipboard.writeText(failure.requestId);
      if (copiedRef.current) copiedRef.current.textContent = "已复制";
    } catch {
      if (copiedRef.current) copiedRef.current.textContent = "复制失败，请手动选择";
    }
  };

  return (
    <div className="flex min-w-0 w-full max-w-full items-center justify-center px-4 py-10" data-testid="auth5-page">
      <form
        onSubmit={(e) => void submit(e)}
        className="flex w-full max-w-sm min-w-0 flex-col gap-3 rounded-md border border-border bg-card p-5"
        aria-busy={phase === "submitting" ? "true" : undefined}
        data-testid="auth5-form"
      >
        <h1 className="text-base font-medium">登录控制台</h1>
        <p className="text-xs text-muted-foreground">登录后即可访问数字员工、审批与运行等页面。</p>

        {phase === "loading" ? (
          <div className="h-10 w-full animate-pulse rounded-sm bg-muted/20" data-testid="auth5-loading" aria-label="加载中" />
        ) : null}

        <label className="flex min-w-0 flex-col gap-1 text-xs">
          账号
          <input
            className="min-w-0 rounded-sm border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            autoComplete="username"
            data-testid="auth5-user"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs">
          密码
          <input
            type="password"
            className="min-w-0 rounded-sm border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            data-testid="auth5-password"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs">
          验证码
          <input
            className="min-w-0 rounded-sm border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            value={captchaText}
            onChange={(e) => setCaptchaText(e.target.value)}
            autoComplete="off"
            data-testid="auth5-captcha-input"
          />
        </label>

        {captcha ? (
          <button
            type="button"
            onClick={() => void loadCaptcha()}
            title="点击图片换一个验证码"
            className="self-start rounded-sm border border-border"
            data-testid="auth5-captcha-image"
          >
            <img
              src={`data:image/png;base64,${captcha.captcha}`}
              alt="验证码图片，点击刷新"
              className="block h-10 max-w-full"
            />
          </button>
        ) : null}

        {failure ? (
          <div role="alert" className="flex min-w-0 flex-col gap-1 text-xs text-destructive" data-testid="auth5-error">
            <p className="min-w-0 break-words">{failure.sentence}</p>
            {failure.requestId ? (
              <p className="min-w-0 break-words text-muted-foreground">
                请求编号：<code className="break-all">{failure.requestId}</code>
                <button type="button" className="ml-1 underline" onClick={() => void copyRequestId()} data-testid="auth5-copy-request-id">
                  复制
                </button>
                <span ref={copiedRef} data-testid="auth5-copy-state" />
              </p>
            ) : (
              <p className="text-muted-foreground" data-testid="auth5-request-id-missing">
                本次请求未记录编号，可复制时间与操作路径反馈
              </p>
            )}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={phase === "submitting" || phase === "loading"}
          className="rounded-sm bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-60"
          data-testid="auth5-submit"
        >
          {phase === "submitting" ? "登录中…" : "登录"}
        </button>
        {phase === "failed" ? (
          <button
            type="button"
            onClick={() => {
              setFailure(null);
              setPhase("loading");
              void loadCaptcha();
            }}
            className="rounded-sm border border-border px-3 py-1.5 text-xs"
            data-testid="auth5-retry"
          >
            重试
          </button>
        ) : null}
      </form>
    </div>
  );
}
