# authstate 前置检查（UI-QA 车道共用）

一页说明：跑控制台取图 / `shots.mjs` / obs 归因之前，先花 2 秒确认手里的登录态文件到底还能不能用。
脚本：`docs/_artifacts/ui-qa/check-authstate.mjs`（纯 node、零依赖、只读，不打印任何 cookie 值）。

## 为什么需要这一步

`R-OBS-authstate-6c626741.md` 的教训：交付门禁的 auth 面台账长期把 `authStateFile` 指向
`~/.local/state/sekoi-ops/v4-auth-state.json`，而那份票**已过期**。过期票在网关侧等价于匿名，
于是「auth 面」与「anon 面」读数互相矛盾（auth 面出现几千行 401、reload 死循环、`main` 停在
`⠋ Loading…`），obs 归因因此绕了好几轮远路才回到「先看状态码」这条正路上。
一次 `node check-authstate.mjs` 就能把这个变量提前钉死。

配套判定口径（历件已入库，勿改）：**401 = 鉴权/登录态问题；404 = 上游未接线读口（与 cookie 无关）**。
台账里的 `ceAuthority=login-state` 只是固定文案，不是因果结论。

## 用法

```bash
# 默认查现网取图用的那份（ui-qa）
node docs/_artifacts/ui-qa/check-authstate.mjs

# 同时查 ui-qa 与 v4 两份，退出码取最坏值
node docs/_artifacts/ui-qa/check-authstate.mjs --all

# 指定别的路径 / 机器可读 / 提前告警阈值（小时）
node docs/_artifacts/ui-qa/check-authstate.mjs --state=$HOME/.local/state/sekoi-ops/ui-qa-auth-state.json
node docs/_artifacts/ui-qa/check-authstate.mjs --all --json
node docs/_artifacts/ui-qa/check-authstate.mjs --warn-before=2
```

目录可用 `SEKOI_OPS_DIR` 覆写（默认 `$HOME/.local/state/sekoi-ops`）。

**退出码**：`0` = 全部有效；`1` = 至少一枚 cookie 已过期，或最短剩余低于 `--warn-before` 阈值；
`2` = 文件缺失 / JSON 不可解析 / 没有 `cookies[]` 数组。非零即「别拿这份票去取图或归因」。

> 时间一律 **UTC**（含 `mtime`），北京时间 = +8h。同一份文件 `mtime 2026-11-21 06:00:43`（北京）
> 在脚本里显示为 `2026-11-20 22:00:43`（UTC），不是两个文件。

## 三段真实输出（本机实测，2026-11-21 10:08–10:09 UTC）

有效（`--all`，末行 `exit=1` 是因为同批里 v4 那份已过期）：

```
# authstate preflight — 判定时刻 2026-11-21 10:08:31（epoch 1795255711，时间为 UTC，北京时间 = +8h）

[ui-qa] /Users/kevin_studio/.local/state/sekoi-ops/ui-qa-auth-state.json
  513B mtime=2026-11-20 22:00:43 权限=600
  状态：VALID  最短剩余 11.9h
    - access_token_cookie @ 100.117.184.117/  到期 2026-11-21 22:00:43（取处 storageState）  剩 11.9h
        subject={"user_id": 1, "user_name": "opsadmin", "tenant_id": 1, "token_version": 3}  issuer=bisheng

[v4] /Users/kevin_studio/.local/state/sekoi-ops/v4-auth-state.json
  431B mtime=2026-11-19 11:12:48 权限=644
  状态：EXPIRED
    - access_token_cookie @ 127.0.0.1/  到期 2026-11-20 11:12:01（取处 jwt.exp）  已过期 22.9h
        subject={"user_id": 1, "user_name": "opsadmin", "tenant_id": 1, "token_version": 3}  issuer=bisheng

判定口径：401 = 鉴权/登录态问题（先看这里）；404 = 上游未接线读口（与 cookie 无关）。
exit=1
```

缺文件（`--state=` 指到不存在的路径）：

```
# authstate preflight — 判定时刻 2026-11-21 10:09:30（epoch 1795255770，时间为 UTC，北京时间 = +8h）

[default] /Users/kevin_studio/.local/state/sekoi-ops/nope.json
  状态：MISSING  文件不存在或不可读

判定口径：401 = 鉴权/登录态问题（先看这里）；404 = 上游未接线读口（与 cookie 无关）。
exit=2
```

`--json` 字段（截自实测）：顶层 `checkedAt` / `epoch` / `warnBeforeH` / `results[]`；每个结果含
`alias`、`file`、`ok`、`status`（valid|expired|missing|bad-json|no-cookies|session-only）、
`cookies[]`（`name`、`domain`、`path`、`source`＝storageState|jwt.exp|none、`expires`、`expiresAt`、
`remaining`、`session`、`subject`、`issuer`）、`note`、`size`、`mtime`、`mode`、`counts`。

## 到期判定规则（脚本内实现，人工核验同口径）

每枚 cookie 取 `expires > 0`（playwright storageState 用**秒级** epoch，`-1` = 会话级）；
取不到就回退解 JWT payload 的 `exp`（base64url，**不验签**）。两者都无 → `status=session-only`，
不判过期但会提示：会话级票一旦被服务端吊销，只能靠状态码发现。

手工三步核验（不跑脚本时）：

```bash
stat -f '%N %z %Sm' -t '%F %H:%M:%S' ~/.local/state/sekoi-ops/ui-qa-auth-state.json
jq -r '.cookies[]|[.name,.expires,.domain,.path]|@tsv' ~/.local/state/sekoi-ops/ui-qa-auth-state.json
jq -r '.cookies[]|select(.name=="access_token_cookie")|.value' ~/.local/state/sekoi-ops/ui-qa-auth-state.json \
  | cut -d. -f2- | tr '_-' '/+' | base64 -D 2>/dev/null   # 读 payload 的 exp，与 date +%s 对比
```

## 与 shots.mjs 的接法

`docs/_artifacts/tonight/shots.mjs` 用哪个登录态由命令行决定（`:72` 解析 `--auth-state=`；
`:258-259` / `:279-280` 有 state 就注 `storageState`、没有就 `addInitScript` 置
`window.__HERMES_AUTH_REQUIRED__`；`:469-470` 把 `mode` / `authStateFile` 写进 summary）。
现网跑法（台账默认 base 仍是 `http://127.0.0.1:9122`，与派单要求的现网不一致）：

```bash
node docs/_artifacts/tonight/shots.mjs \
  --base=http://100.117.184.117:8183 \
  --auth-state="$HOME/.local/state/sekoi-ops/ui-qa-auth-state.json"
```

同理，obs 归因脚本 `obs-6632f340.mjs` 的 `MODE=auth` 默认就用 ui-qa 那份（`STATE=` 可覆写）。

## 已知两份 state 文件的当前状态

| 文件 | 大小 | mtime（UTC） | 域 | 到期（UTC） | 结论 |
|---|---|---|---|---|---|
| `ui-qa-auth-state.json` | 513B / 600 | 2026-11-20 22:00:43 | 100.117.184.117 | 2026-11-21 22:00:43 | 有效，取图/归因用这份 |
| `v4-auth-state.json` | 431B / 644 | 2026-11-19 11:12:48 | 127.0.0.1 | 2026-11-20 11:12:01 | 已过期，别再用（台账 auth 面此前一直在用） |

过期时的处置：需要重走 opsadmin RSA 登录腿产出新 state（覆写同一路径、`chmod 600`）。
仓库内**没有**该登录腿脚本（`ls ops` 为空、`git grep` 无匹配），口令与凭据一律不进产物与回执。
