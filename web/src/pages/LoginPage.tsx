/**
 * R17 auth5 / R18 fix: the console's own sign-in page.
 *
 * The proxy bridge (lane D) serves same-origin /auth/* routes: captcha, login,
 * whoami, logout. A successful login is only announced after /auth/whoami
 * confirms the session; the HttpOnly cookie is set by the bridge and never
 * touched here. Failures map by code to plain Chinese with a copyable request
 * id. ?state= renders the four honest states for acceptance probes.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { RequestIdCopy } from "@/components/RequestIdCopy";

type Captcha = { captcha_key: string; captcha: string; request_id?: string | null };
type LoginReply = { ok?: boolean; code?: string; request_id?: string | null };

const FAILURE_COPY: Record<string, string> = {
  "auth.invalid_credentials": "用户名或密码错误。",
  "auth.captcha_invalid": "验证码不正确，点图刷新重试。",
};

const GENERIC_FAILURE = "登录暂时不可用，请稍后重试。";
const NO_RID_FALLBACK = "本次请求未记录编号，可复制时间与操作路径反馈";

const FORCED = new Set(["loading", "empty", "error", "denied"]);

function forcedState(sp: URLSearchParams): string | null {
  const s = sp.get("state");
  return s && FORCED.has(s) ? s : null;
}

export default function LoginPage(): ReactNode {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const forced = forcedState(sp);
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [captchaText, setCaptchaText] = useState("");
  const [captcha, setCaptcha] = useState<Captcha | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "submitting" | "failed">("loading");
  const [failure, setFailure] = useState<{ sentence: string; requestId: string | null } | null>(null);
  const [nonce, setNonce] = useState(0);
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
        setNonce((n) => n + 1);
        setPhase((p) => (p === "loading" ? "ready" : p));
      } else {
        setFailure({ sentence: GENERIC_FAILURE, requestId: body?.request_id ?? null });
        setPhase("failed");
      }
    } catch {
      setFailure({ sentence: GENERIC_FAILURE, requestId: null });
      setPhase("failed");
    }
  }, []);

  useEffect(() => {
    void loadCaptcha();
  }, [loadCaptcha]);

  const submit = async () => {
    if (busyRef.current || phase === "submitting") return;
    if (!captcha) {
      // R18: never fail silently — the submit was pressed for a reason.
      setFailure({ sentence: "验证码还没加载出来，请稍候或点重试。", requestId: null });
      setPhase("failed");
      return;
    }
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
        // R18: only announce success once the session is confirmed.
        let who: Response | null = null;
        try {
          who = await fetch("/auth/whoami", { credentials: "same-origin" });
        } catch {
          who = null;
        }
        if (who && who.ok) {
          sessionStorage.setItem("auth5.session", "1");
          navigate("/overview", { replace: true });
          return;
        }
        setFailure({ sentence: "登录成功但会话未建立，请重试。", requestId: body?.request_id ?? captcha.request_id ?? null });
        setPhase("failed");
        return;
      }
      const code = body && typeof body.code === "string" ? body.code : "other";
      const rid = body?.request_id ?? captcha.request_id ?? null;
      setFailure({ sentence: FAILURE_COPY[code] ?? GENERIC_FAILURE, requestId: rid });
      setPhase("failed");
      if (code === "auth.captcha_invalid") void loadCaptcha();
    } catch {
      setFailure({ sentence: GENERIC_FAILURE, requestId: null });
      setPhase("failed");
    } finally {
      busyRef.current = false;
    }
  };

  const retry = () => {
    setFailure(null);
    setPhase("loading");
    void loadCaptcha();
  };

  if (forced) {
    // R18: the four honest states, reproducible from the URL.
    const titles: Record<string, string> = {
      loading: "正在准备登录…",
      empty: "登录服务暂时没有可用通道。",
      error: "登录没能进行。",
      denied: "无权限或未开放",
    };
    return (
      <div
        className="flex min-w-0 w-full max-w-full items-center justify-center px-4 py-10"
        data-testid="auth5-page"
        data-fixture="1"
      >
        <div className="flex w-full max-w-sm min-w-0 flex-col gap-3 rounded-md border border-border bg-card p-5" data-testid="auth5-forced-state">
          <span className="self-start rounded-sm border border-border px-1.5 py-0.5 text-xs text-muted-foreground">示例状态</span>
          <p className="min-w-0 break-words text-sm" data-testid="auth5-forced-title">
            {titles[forced]}
          </p>
          {forced === "loading" ? (
            <div className="h-10 w-full animate-pulse rounded-sm bg-muted/20" aria-label="加载中" />
          ) : null}
          {forced === "error" ? (
            <>
              <RequestIdCopy requestId="forced-demo-1" fallback={NO_RID_FALLBACK} />
              <button type="button" className="rounded-sm border border-border px-3 py-1.5 text-xs self-start" onClick={retry} data-testid="auth5-retry">
                重试
              </button>
            </>
          ) : null}
          {forced === "denied" ? (
            <p className="min-w-0 break-words text-xs text-muted-foreground">
              这个入口要么尚未对你开放，要么当前环境还没有提供它。请联系工作区管理员。
            </p>
          ) : null}
          {(forced === "empty" || forced === "denied") ? (
            <button type="button" className="rounded-sm border border-border px-3 py-1.5 text-xs self-start" onClick={retry} data-testid="auth5-retry">
              重试
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const busy = phase === "submitting";
  return (
    <div className="flex min-w-0 w-full max-w-full items-center justify-center px-4 py-10" data-testid="auth5-page">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        aria-busy={busy ? "true" : undefined}
        className="flex w-full max-w-sm min-w-0 flex-col gap-3 rounded-md border border-border bg-card p-5"
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
              key={nonce}
              src={`data:image/png;base64,${captcha.captcha}#n${nonce}`}
              alt="验证码图片，点击刷新"
              className="block h-10 max-w-full"
              data-nonce={nonce}
            />
          </button>
        ) : null}

        {failure ? (
          <div role="alert" className="flex min-w-0 flex-col gap-1 text-xs text-destructive" data-testid="auth5-error">
            <p className="min-w-0 break-words">{failure.sentence}</p>
            <p className="min-w-0 break-words text-muted-foreground">
              <RequestIdCopy requestId={failure.requestId} fallback={NO_RID_FALLBACK} />
            </p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || phase === "loading"}
          className="rounded-sm bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-60"
          data-testid="auth5-submit"
        >
          {busy ? "登录中…" : "登录"}
        </button>
        {phase === "failed" ? (
          <button
            type="button"
            onClick={retry}
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
