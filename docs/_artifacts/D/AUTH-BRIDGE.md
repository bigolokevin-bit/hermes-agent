# AUTH-BRIDGE — 9122 登录/会话桥（四路由，仅回环）

- 日期：2026-11-19 15:4x–15:5x（参谋令卡，硬截止 16:30）
- 改动：l7-ops 仓 `ops/v4_proxy.py`（commit `ae8bdc7e`，分支 lane/L7-t15）增 `/auth/captcha|login|whoami|logout` 四路由 + 上游常量。
  备份：`/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/v4_proxy.py.bak-r37`
- **回退一行命令**：
  `cd /Users/kevin_studio/Projects/l7-ops && git revert --no-edit ae8bdc7e && launchctl kickstart -k gui/$(id -u)/cn.seakoi.v4-serve`

## 契约与安全边界（按卡实现）

- 上游=Bisheng `V4_AUTH_UPSTREAM`（默认 `http://127.0.0.1:7860`）：`public_key`（PKCS#1 512-bit）、
  `get_captcha`、`login`（RSA PKCS#1 v1.5 加密口令 base64）、`user/info`（只认
  `access_token_cookie` 会话 cookie——BFF server.py L856 实测口径同源）。
- 加密走 `uv run --no-project --with cryptography python -c ...`（口令经 stdin 管道，
  **不进 argv/日志/落盘**）；系统 python 无 cryptography，未 pip install。
  坑：`python -` 会把 stdin 当**程序**读（首版 500=stdout 空），payload 必须配 `-c`。
- 仅 `client_address[0] in (127.0.0.1,::1)`，否则 403 `auth.forbidden`（且服务本身 bind 127.0.0.1）。
- 日志只记 `user_name` 与 `rid`；`/auth/*` 先于 `/agent-api` 与 SPA 兜底分派。
- 登录成功 `Set-Cookie: access_token_cookie=<tok>; Path=/; HttpOnly; SameSite=Lax`（无 Domain）；
  响应体不含 token 明文。错误映射：`auth.invalid_credentials|captcha_invalid|bad_request|upstream_unavailable|crypto_unavailable`。

## 服务生效（受管重启）

- `launchctl kickstart -k gui/$(id -u)/cn.seakoi.v4-serve`
- pid 99197 → 61410（首版）→ **61816**（修复 `-c` 后终版）；`lsof -nP -iTCP:9122 -sTCP:LISTEN -t`=61816。
- 全程未 kill 非 pidfile 进程；`root=200` 复验。

## 验收原始 stdout（2026-11-19 15:5x 首验 + 15:46 复跑含响应头版；口令取自治理文档未打印，验证码取自 docker logs；Set-Cookie 值打码）

注：本文件落 fork D 证据树而非 l7-ops——治理仓车道钩子写域白名单（ops/ deploy/ apps/console/ docs/ops/ docs/upstream/ openspec/changes/）不含 docs/_artifacts/，AUTH 代码提交仍在 l7-ops@ae8bdc7e。

```text
== A) captcha ==
captcha_key= cap_ee74d5ce img_b64_len= 8692
== B) login ==
{"ok": true, "user": {"user_id": 1, "user_name": "opsadmin"}, "rid": "e68e16bb"}
1                                    # ← cookie jar 中 access_token_cookie 行数
== C) employees ==
with_cookie=200
items= 1
no_cookie=401
== D) whoami ==
{"user_id": 1, "tenant_id": null, "granted": true, "display": "opsadmin"}
{"code": "auth.unauthenticated", "rid": "a167adb3", "message": "登录状态缺失或已过期，请重新登录"}
== E) logout ==
{"ok": true, "rid": "ac99c992"}
0                                    # ← 清 cookie 后 jar 内已无 access_token_cookie
```

## 人用登录路径（18:00-19:00 看真数据）

浏览器打开 `http://127.0.0.1:9122/auth/captcha` 抄验证码（PNG base64 可存图查看）→
POST login 或由登录腿注入 cookie → 同源 9122 的 `/agent-api/*` 即带 `access_token_cookie` 直通。
验证码上游会校验：图看不清就重取 `captcha_key` 再来；无法看图时可用
`docker logs --since 40s bisheng-backend | grep captcha_char`（仅本机排障口径）。
