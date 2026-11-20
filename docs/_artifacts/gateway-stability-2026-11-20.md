# 网关反复 SIGKILL 取证报告 — 2026-11-20

lane: `lane/L7-gateway-stability` ｜ 范围：`~/.hermes/logs/*`、`~/.local/state/seakoi-ops/*`、`/health` 实测采样
结论落点：**判定为外部 SIGKILL（非 keepalive 误杀、非 OOM）→ 走 D 路径，本次不做任何代码修改。**

## 1. 判定（任务 A）

`gateway.log:1544` 的 `Previous gateway life (pid=32185 …) exited UNCLEANLY` 事件，**不是** keepalive
"判定 down → 杀掉活着的网关"，也**不是** OOM/jetsam。pid 32185 在 keepalive 采取行动之前约 40 秒就已经死了。

时间线（本地时间，全部为原始日志行）：

| 时刻 | 证据（文件:行号） | 含义 |
|---|---|---|
| 15:13:35,706 | `agent.log` `conversation turn: session=20261112_105338_be54c4a2 … msg='那有什么写得比较好的周报样例吗'` | 轮次进行中（模型流已建连 15:13:35,784） |
| 15:13:52,396 | `agent.log:14797` `aiohttp.access: "GET /health HTTP/1.1" 200 527` | **轮次进行中 /health 仍返回 200** —— 来自 launchd runner 的 45s 探针 |
| 15:13:54,698 | `gateway.log:1544` 内 `last_heartbeat_at=…T07:13:54.698436+00:00` | 该进程最后一次心跳 |
| 15:13:55 – 15:13:59 | （无任何日志） | 死亡窗口 |
| 15:14:02 | `keepalive.log:30428` `WARN gateway probe DOWN port=8642 http=000 probe_fail=1/2 last_http=000 attempts=2/2`；`30429` `restart held reason=below-threshold` | cron runner 两次探测均**秒拒**（见 §2 算术），端口已无人监听 |
| 15:14:37 | `keepalive.log:30433` `WARN gateway probe DOWN port=8642 http=000`（裸格式，旧逻辑） | launchd runner 触发 sanctioned restart |
| 15:14:38,317 | `gateway-exit-diag.log` `tag=gateway.start pid=49138` | 新生命周期启动 |
| 15:14:38,922 | `gateway.log:1544` / `errors.log:705` UNCLEANLY 记账 | — |
| 15:14:41 | `keepalive.log:30434` `INFO gateway restart recovered port=8642 pid=49138 http=200` | stop+start 全程 **4 秒** |

排除 keepalive 的依据：

1. **4 秒不可能包含 30 秒 TERM 等待。** `ops/hermes.sh:124-131` 的 stop 是 `kill -TERM` → 轮询 30 次 1 秒 →
   仅当仍存活才 `kill -9`。15:14:37→15:14:41 只有 4 秒，说明走的是 `未在运行（无 pid 文件或进程已消失）` 快路径。
2. **start 未报端口冲突。** `ops/hermes.sh:107` 在 `lsof -iTCP:8642 -sTCP:LISTEN` 命中时直接 FATAL；本次正常启动，
   证明 15:14:38 端口确实是空的，旧进程早已消失。
3. **完全没有 SIGTERM 痕迹。** 同一日志里被 keepalive 正常停掉的进程都有显式记录：
   `gateway.log:1493` `15:01:19,364 WARNING gateway.run: Shutdown context: signal=SIGTERM …`、
   `gateway-exit-diag.log` `07:01:20.023 asyncio.run.returned pid=31852`；15:24 两次同理
   （`07:23:58.795` pid=49138、`07:24:09.445` pid=56444）。
   **pid 32185 在 exit-diag 里没有任何 `asyncio.run.returned` / `gateway.exit_nonzero` 记录** —— exit path 从未运行。
4. **keepalive 在 15:13:52 还拿到了 200**，也就是说它自己的上一轮认定服务健康，本轮(15:14:37)不可能已经在杀它。

排除 OOM 的依据：

- `gateway.log:1544` 记账字段 `last_mem=None suspected_oom=False`；
- `~/Library/Logs/DiagnosticReports/` 在 15:14 前后无 python/.ips 崩溃报告（最近的分别是 11-19、11-18、11-17 与当日 10:20 的 Chrome）；
- `log show --start 15:12 --end 15:16`（memorystatus / jetsam / low swap 谓词）**无匹配**；
- `~/.hermes/logs/gateway_faulthandler.log` 自 11-11 起为 **0 字节** → 不是 Python 层崩溃/abort；
- `gateway-shutdown-diag.log` 该窗口尾部 `--- recent dmesg (oom/killed) ---` 段为空，仅 `loadavg { 7.05 6.14 5.60 }`。

结论：**pid 32185 于 15:13:55–15:13:59 被外部 SIGKILL（`kill -9` / `pkill` 一类），本机现有日志无法指认发起者。**
另外两起（`gateway.log:1364` pid=88971@14:36:03、`gateway.log:1472` pid=21216@15:01:00）形态完全相同：
探针在死亡后 1–6 秒才记到 `http=000`，且 restart 到 recovered 只花 4–6 秒（快路径），
`gateway-exit-diag.log` 中两者均无 exit-path 记录 —— 同一类事件，非 keepalive 所为。

## 2. "秒拒 vs 超时" 的算术（判定 §1 的关键）

新逻辑 `probe_confirm` 失败重试是 `探测 → sleep 2 → 探测`。若 curl 真的等满 `-m 5` 超时：
5 + 2 + 5 = **12 秒以上**，`attempts=2/2` 的 DOWN 行应落在 15:14:12 之后。
实测：同一轮 c1/domain/runtime 记于 `15:14:00`（`keepalive.log:30425-30427`），gateway DOWN 记于 `15:14:02`
（`30428`）—— 两次探测合计耗时 < 0.5 秒 ⇒ **connection refused（无监听）**，不是超时（活着但不响应）。
15:14:37 一轮（`30431-30433`）四个服务同一秒内出结果，同样为秒拒。

## 3. 采样（任务 B）—— `/health` 不存在阻塞，C 方案不成立

采样方式：`curl -s -m 5 -o /dev/null -w '%{time_total} %{http_code}' --noproxy '*' http://127.0.0.1:8642/health`，
1 秒节拍，共 **200 次**（15:30:20–15:33:40），未重启网关、未干扰 L0。

| 指标 | 值 |
|---|---|
| 样本数 / 失败数 | 200 / **0** |
| HTTP 码分布 | `200 → 200`（无 000 / 4xx / 5xx） |
| min / median / p95 / max | 0.000617s / **0.002129s** / 0.003349s / **0.007136s** |

补充证据：`agent.log` 全量 `/health` 访问日志中，**从未出现过非 200**（仅 `/health/detailed` 401 与 `/healthz` 404 各两次，属其它日期其它路径）。
决定性一条：`agent.log:14797` 显示轮次进行到第 17 秒（15:13:35 起）时 `/health` 仍 200 返回。

代码侧与实测一致：`gateway/platforms/api_server.py:2266-2268` 的 `_handle_health` 是纯同步、零 await、零锁的
`json_response`；适配器与 aiohttp 站点跑在 `asyncio.run(start_gateway(config))`（`gateway/run.py:5139`）主循环上，
而**模型轮次跑在 `_run_in_executor_with_context` → `_UnboundedThreadExecutor` 的线程池里**
（`gateway/run.py:3976-3980`、`gateway/session_runtime_workers.py:136`）。轮次与 `/health` 不共享阻塞点。

⇒ 因此**不做 C**（`/health` 非阻塞化改造）：既无必要，也没有可复现的阻塞窗口。

## 4. 顺带发现（属 ops/**，留给 L7 的独立 CR，本次一行未改）

1. **防抖修复在 launchd runner 上还没生效。** `ops/keepalive.sh` 的连续失败门禁提交于
   `fffb1178 2026-11-20 14:41:43`（文件 mtime 14:48:22），而 launchd 进程
   `pid=27175` 启动于 **Nov 17 13:12:07**（已跑 3 天），仍执行内存里的旧逻辑 ——
   这就是 `keepalive.log:30433`、`30509` 两条 **裸 `DOWN`（无 `probe_fail=/attempts=` 后缀、无 held 行）**、
   一次失败即 stop 的来源。**建议：`launchctl kickstart -k gui/$UID/cn.seakoi.keepalive`（由 L0 执行）**，
   并让脚本在每轮自检 `git rev-parse HEAD` / 文件 mtime 变化即 `exec` 自身。
2. **两个 runner 并发且共享状态。** cron `*/2 * * * *`（日志 `~/.local/state/sekoi-ops/keepalive-cron.log`，注意拼写 `sekoi`）
   与 launchd 45s 循环（`~/.local/state/seakoi-ops/keepalive.log`）同时操作同一 `STATE_DIR`、
   同一 `keepalive-down-gateway` 计数文件与同一网关 pidfile。15:24 已出现竞态双跑：
   49138 于 15:23:58 TERM → 56444 起于 15:24:01 → 56444 于 15:24:08 再被 TERM → 58267 起于 15:24:31。
   **建议：只保留一个 runner（推荐 launchd），并给 `restart_svc` 加 `flock` 互斥。**
3. **取证留存不足。** `STATE_DIR/restart-last.out`（0600）每次重启被覆盖（现仅存 15:24 事件），
   stop/start 输出无时间戳、无 pid ⇒ 事后无法证明某次 `kill -9` 是否发生。
   **建议：追加写 `restart-<epoch>.out` 并在 `hermes.sh stop` 里打印 `TERM <pid> @<ts>` / `SIGKILL <pid> @<ts>`。**
4. **`kill -0 $pid` + 30s 后 `kill -9 $pid` 存在 pid 复用风险**（`ops/hermes.sh:126-128`）。
   上游已有同类防护范式可借：`agent/proxy_sources/iron_proxy.py:897`（先取 starttime，若 pid 被复用则放弃 SIGKILL）。
   **建议：stop 前先比对 pid 的进程启动时间/可执行路径。**

## 5. 对"外部 SIGKILL 来源"的排查建议（下一次死亡时才能定论）

- macOS 侧对 `kill -9` 无现成审计。最小代价方案：临时用 `launchctl submit` 或 `nohup` 外面包一层
  `python -c` 监控，或直接启用 EndpointSecurity/`opensnoop` 类工具记录 signal 来源；
- 先排除自查：本次已确认 15:13:30–15:14:45 窗口内 `agent.log` **无任何** `pkill`/`killall`/`kill -9`/`hermes.sh` 工具调用记录
  （全文件 `pkill` 仅命中 `gateway.lifecycle_ledger` 的告警文案本身），即不是当轮 agent 工具杀的自己；
- 亦已排除：`gateway/cgroup_cleanup.py`（systemd 专用）、`taskkill /T /F` 路径（Windows 专用 #85265）；
  本机 `launchctl list` 无网关作业，网关由 `nohup` 起，故不存在 launchd 看门狗升级 SIGKILL；
- 内存上限类建议（虽然本次 `suspected_oom=False`，仍值得设防线）：为网关进程组配置
  `launchd` `SoftMemoryLimit`/`HardMemoryLimit`（改为受管启动）或 `ulimit -v`，并在 keepalive 里
  每秒采样 `memory_pressure` 与 `ps -o rss`，把 `last_mem` 真正写进 exit-diag（现在恒为 `None`，等于没有 OOM 证据链）。

## 6. 变更与验收

- 代码修改：**无**（本文件为唯一产物；未触碰 `gateway/**`、`hermes_cli/**`、`ops/**`、`web/src`）。
- 是否重启网关：**不需要**，本次取证全程未重启（现网由 L0 管理，采样期间网关对新生命周期 pid 正常服务）。
- 复核入口：`gateway.log:1544`、`keepalive.log:30428/30429/30433/30434`、`agent.log:14797`、
  `gateway-exit-diag.log`（`07:14:38.317` start / `07:14:38.922` previous_unclean_exit）、
  采样原文 `/var/folders/…/opencode/health-sample.log`（200 行）。
