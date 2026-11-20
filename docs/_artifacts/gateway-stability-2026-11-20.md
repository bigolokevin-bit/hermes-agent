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

---

## 5. 第二轮补证：15:41 事件（pid 69401）—— 判定不变，机制收窄

`gateway.log:1702` 的 UNCLEANLY 与前三次同签名，且**新增一条排除性事实：被杀时网关是空载的**。

### 5.1 原始行（前后 2 分钟）

| 时刻 | 证据（文件:行号） | 含义 |
|---|---|---|
| 15:34:06,198 | gateway.log:1662-1700 `Received SIGTERM` + `Shutdown context: signal=SIGTERM … loadavg_1m=3.05` | 上一任被 L0 受管重启**正常**送走（0.23s） |
| 15:34:10,288 | 同上 | 69401 起（L0 于 15:34 的受管重启） |
| 15:34:20,285 | 69401 最后一行 | **此后 6 分 50 秒零输出**；agent.log 在 15:40 之后无任何 inbound/turn 事件 → 空载 |
| 15:40:24,492 | agent.log:15398 `"GET /health" 200` | 最后一次成功应答（launchd 探针） |
| 15:40:44,275 | gateway.log:1702 `last_heartbeat_at=…07:40:44.275188Z` | 心跳戛止 → 死亡窗口起点 |
| 15:41:09 | keepalive.log:30628-30631 c1/domain/runtime **同秒全 OK** + `WARN gateway probe DOWN port=8642 http=000`（裸形，无 `probe_fail=`/`attempts=`） | 秒拒而非 5s 超时；其它三个服务活着 |
| 15:41:10,379 / ,911 | gateway-exit-diag.log:128 / :129 `gateway.start pid=76056` / `previous_unclean_exit prior_pid=69401`；errors.log:724 | 新任启动即记账 |
| 15:41:13 | keepalive.log:30632 `restart recovered port=8642 pid=76056 http=200` | DOWN→recovered = **4 秒** |

- cron 侧 `keepalive-cron.log:6762-6773`：15:38:00 / 15:40:00 / 15:42:00 三次 `gateway probe OK http=200` —— cron runner 全程没看见故障，15:41 属于 launchd 45s 循环。
- `gateway_faulthandler.log`：0 字节，mtime 仍为 Nov 11 23:40 → 无 Python 级崩溃回溯。
- OOM 再次排除：`suspected_oom=False`、`last_mem=None`；DiagnosticReports 最新为 Nov 20 10:20 Chrome（15:41 无任何 .ips）；shutdown-diag 的 dmesg-oom 段为空。
- **69401 在 exit-diag 里没有 `asyncio.run.returned` / `gateway.exit_nonzero`**（对比 31852/49138/56444 都有）→ 退出路径根本没跑，与前三次同一结论。

### 5.2 判定（任务 A 更新一句）

15:41 与 14:36 / 15:01 / 15:14 / 88971 / 21216 / 32185 **同类：外部 SIGKILL，不是 keepalive 判定后杀活的网关，不是 OOM**。
理由同 §2 的三条算术（4 秒 restart 容不下 30s TERM 等待；同秒四服务证明探针为秒拒；`ops/hermes.sh:107` 端口被占即 FATAL，而 15:41:10 起得干净）。
并且 69401 死时**空载、无任何 turn**，所以"turn 进行中被杀"这一支彻底没有证据支持。

### 5.3 任务 B：`/health` 第二轮实测（现网关 76056，空载）

`curl -s -m 5 -o /dev/null -w '%{time_total} %{http_code}' --noproxy '*' http://127.0.0.1:8642/health`，1s 一次，150 次，15:54:42→15:57:23
（原始数据 `…/T/opencode/health-sample2.log`）：

| n | http_code | min | 中位 | p95 | max |
|---|---|---|---|---|---|
| 150 | 200 ×150（0 失败） | 0.001032s | **0.002168s** | 0.002989s | **0.003786s** |

第一轮 n=200：中位 0.002129s / max 0.007136s。生产侧自 15:41 起 agent.log 有 **189 次 `GET /health 200`**，
含 turn 进行中的那一次（agent.log:14797 `15:13:52,396 … 200`，距 15:13:35,706 turn 起点 17 秒）。
**最慢 3.8ms，与 5s 探针上限相差三个数量级 → keepalive 的 `curl -m 5` 不可能把 /health 判成超时。**
本轮仍未合成付费 turn（76056 自 15:41 起零 turn，制造 turn 需要花额度）；改以上述生产 turn 内 200 + 代码路径作证。
代码路径：`api_server.py:2266-2268 _handle_health` 纯同步、零 await、零锁；模型 turn 走
`run.py:3976-3980 _run_in_executor_with_context` 的线程执行器（`session_runtime_workers.py:136`），本就不占事件循环。
⇒ **任务 C（把 /health 挪到独立线程/快照）仍是伪需求，本次不改 `gateway/**`、不改 `hermes_cli/**`。**

### 5.4 ops 核实（用户点名的一行；未部署、未重启任何东西）

```
$ grep -c DOWN_THRESHOLD ops/keepalive.sh      →  6
$ git merge-base --is-ancestor 7bea9b98 HEAD   →  CR-038 已在 HEAD
$ git merge-base --is-ancestor dace6a128 HEAD  →  CR-039 已在 HEAD
$ stat -f '%Sm' ops/keepalive.sh               →  Nov 20 14:48:22 2026
$ ps -p 27175 -o lstart                        →  Tue Nov 17 13:12:07 2026（etime 03-02:41）
```
**修复在仓库里，在跑的那个 launchd 循环里没有**：pid 27175 从 11-17 起就是常驻 loop，shell 早已把脚本读进内存，
14:48 落盘的 CR-039 不会被它加载 → 15:41:09 仍是裸 `DOWN` + 立即 restart（没有 `held`，没有 `probe_fail=`），
即"单探针失败即重启"的旧行为。这是上一轮报告 §4.1 的结论，本轮 15:41 事件把它再证了一次。

### 5.5 新发现：网关继承启动者的进程组（结构暴露，签名与全部 14 次完全吻合）

```
$ ps -o pid,ppid,pgid,stat,lstart -p 27175 -p 76056 -p 46199
27175     1 27175 S    Tue Nov 17 13:12:07   /bin/sh …/ops/keepalive.sh      ← launchd job cn.seakoi.keepalive
76056     1 27175 S    Fri Nov 20 15:41:09   .venv/bin/python … gateway run  ← 现网关，pgid = keepalive 的组
46199     1 46199 SNs  Wed Nov 18 21:36:59   … hermes dashboard              ← 对比组：自成会话 leader
$ ps -eo pgid | grep -c 27175 → 同组还有 32108/34667/67994（c1、domain、runtime 的 uv run）与其子进程、sleep 45
```

`ops/hermes.sh:113` 用 `nohup "$BIN" gateway run >>"$LOGFILE" 2>&1 &` + `disown`，**没有 `setsid`**：
`nohup` 只屏蔽 SIGHUP，进程组与会话照抄启动者。于是网关永远活在"最后一次启动它的那个组"里 ——
launchd 循环启动的就在 27175，L0 在终端/会话 shell 里重启的就在那条 shell 的组。
任何对该组的定向清扫（会话 shell 拆除、`launchctl kickstart -k`/bootout、工具侧进程组 kill）都会
**一次性 SIGKILL 整个组**，留下的痕迹正好是这 14 次的样子：没有 exit path、没有 SIGTERM 行、
没有 faulthandler 回溯、没有崩溃报告、没有 jetsam、端口瞬间关闭、探针秒拒。
仓库内自带的 kill 原语已经排除：`agent/deadline.py:447-506 kill_process_tree()` 有
`pgid=os.getpgid(pid)` + `if pgid == pid` 自检（注释明写避免误伤调用方所在组），
`tools/code_execution_tool.py:806-825` 是 TERM→等 5s→才 KILL，且 32185/69401 都没有 SIGTERM 痕迹。

**因此修正上一轮 §4.1 的处置顺序**（重要）：直接执行 `launchctl kickstart -k gui/$UID/cn.seakoi.keepalive`
会顺手 SIGKILL 现网关 76056 —— 它就在 27175 组里。安全顺序：
先把网关换出该组（`ops/hermes.sh` 的 start 改 `setsid`，属 `ops/**` 写域，留给 L7 的独立 CR），
或先受管重启网关、再 kickstart keepalive。

### 5.6 下一次 flap 的取证装置（不改代码即可执行，供 L0/L7 决定）

- 常驻 1s 进程表快照：`ps -eo pid,ppid,pgid,sess,stat,lstart,comm` 追加写入 `$STATE_DIR/proc-snapshot.log`
  （带时间戳、轮转），下次 UNCLEANLY 直接看死亡那一秒**同组还有哪些进程一起消失** —— 一次就能区分
  组清扫 vs 按 pid 点杀，并暴露发起方的短命父进程。
- 在 `restart_svc` 侧补上时间戳化的 `TERM <pid> @<ts>` / `SIGKILL <pid> @<ts>` 与按 epoch 命名的
  `restart-<epoch>.out`（现 `restart-last.out` 每次覆盖，事后无法证明 kill -9 是否真的开火）。
- 记录每任网关的 `pid/pgid/sess/lstart` 到 lifecycle ledger，把"启动者是谁"变成可查事实。

### 5.7 本轮结论

- 判定：**外部 SIGKILL（组清扫为首要嫌疑，见 §5.5），非 keepalive 误杀、非 OOM、非 /health 阻塞**；L0 的 15:24/15:34 两次受管重启不是凶手，board `24a4bd06` 的「14th attributed (SIGKILL of 69401, not L0)」与本报告一致。
- 代码修改：**无**（`gateway/**`、`hermes_cli/**`、`ops/**`、`web/src` 均未动）。
- 需要重启网关：**不需要**。本报告与取证建议不涉及任何重启动作。

## 7. 本车道收口清单（19:05 系统级交付纪律，用户裁定，逐字收录）

> 从这拍起，「后端修复的完成」= ①commit pushed ②运行时进程启动时间晚于该 commit ③一条能证明新逻辑生效的读数（日志/接口/DB）。少一项不算完成，也不许在回执里写「已修复」。

每条后端类交付按此三项自检，缺一即写「未收口」：

| 项 | 取证口径 |
|---|---|
| ① commit pushed | `git ls-remote` 对端 sha == 本地 HEAD，且运行树 `merge-base --is-ancestor` 含该 commit |
| ② 运行晚于 commit | `ps -o pid,lstart` 的 lstart 晚于该 commit 的时间戳（不是 etime 估算） |
| ③ 新逻辑生效读数 | 日志/接口/DB 任一条能指向新代码；无真实流量时以「进程启动后重新编译的 `__pycache__/*.pyc` mtime」+「新代码路径上的真实 200」佐证，并明写哪一段尚未被触发 |

## 8. 派发 worker 受管重启（2026-11-20 19:10，L7 执行，非代码变更）

- 载体：launchd `cn.seakoi.dispatch-worker`（**不是** `ops/dispatch-worker.sh` 的 `com.seakoi.dispatch-worker`，标签漂移即 `.sh stop` 报 `no pid record` 的原因；属 ops 写域，本车道未改）。
- 动作：`launchctl kickstart -k gui/$UID/cn.seakoi.dispatch-worker`，rc=0，19:10:03 完成，空窗 ≈1s；旧 9568/9570（lstart Nov 17 14:19:57）双双消失，`dispatch-worker.lock` 由新 pid **96901** 以 FD 3u 持有（单实例锁未被残留进程占死）。
- 回退一行：`cd /Users/kevin_studio/Projects/seakoi-agent-os-l0-board && (set -a; . ~/.seakoi/sekoi.env; . ~/.seakoi/hermes.env; . ~/.seakoi/c1.env; set +a; export SEAKOI_RUNTIME_DB_PATH="$HOME/.local/state/seakoi-ops/runtime-dev.db" HERMES_API_KEY="$API_SERVER_KEY" SEAKOI_CHANNELS_BASE_URL="$SEAKOI_C1_BASE_URL" SEAKOI_CHANNELS_INTERNAL_TOKEN="$SEAKOI_C1_INTERNAL_TOKEN" SEAKOI_WORKER_SEND_GATE=1 UV_OFFLINE=1; exec /opt/homebrew/bin/uvx --offline --with httpx --with pydantic python -m services.runtime.scheduler)`（旧 pid 9568→9570）。
- 三项自检（125ef0af / main 594120e3，19:06:59 入运行树）：① 运行树 HEAD `5f0db708` == `origin/main`，porc=0，`merge-base --is-ancestor 594120e3|125ef0af HEAD` 均真；② 新 pid 96899/96901 lstart **19:10:03 > 19:06:59**；③ `runtime_http.cpython-314.pyc` mtime **19:10:03**（由新进程从 19:06:59 源码重编），新进程 19:10:04 起 `POST :8101/v1/policy/budget/ledger/entries → 200`，重启后 `409 / request.idempotency_conflict` 计数 **0**（当日最后一次 18:26:57,947 属旧 pid 9570）。
- 未收口之处（据实）：`policy:{event_id}:{digest[:16]}` 所在的 **P1 `/v1/policy/check`** 路径重启后尚无真实事件触发（轮次持续空批），故 P1 的 200 仍缺一次线上读数；观察一行：`tail -f ~/.local/state/seakoi-ops/dispatch-worker.err.log | grep -E "policy/check|实得 HTTP"`。运行树 `grep -c "_canonical_body_digest" services/runtime/runtime_http.py` = **2**（定义 :208 + 调用 :709），非任务书预期的 1。

## 9. 第③项取证：新幂等键线上生效（2026-11-20 19:26，L7 执行，非代码变更）

用户裁定第③项任选 (a)/(b)/(c)。**(a) 不可得**：19:10:03 起 `/v1/policy/check` 调用数为 0（空批），且 worker 日志从不打印键本身（`grep -c "policy:ce_"` = 0）。故走 **(b)+(c)**。

载体核实：8101 = pid 13742（lstart 18:17:59，PGID 27175）跑 `ops/domain-dev-server.py`，该脚本只是 bootstrap，真正 `app = create_app(repository.Repository(conn), …)` ⇒ 服务的是生产路由 `services/domain/http_app.py:241 POST /v1/policy/check` → `services/domain/policy.py:check()`（`request_hash = util.digest(body)`，`find_idempotency(tenant, endpoint, key)` 命中即 `_cached_result`）。DB = `~/.local/state/seakoi-ops/domain-dev.db`。

探针（`/private/var/folders/…/item3_probe.py`，键由**运行树自己的** `_canonical_body_digest`/`_stable_requested_at` 计算，`uv run --offline` 复用缓存，未装任何依赖，未打印任何凭据）：

```
action        = run.execute
requestedAt   = 1970-01-01T00:00:57Z
body_sha256   = 59376b2fcb1981fc61ae37fd802c514dfb0b548affe394a173f930aa0dc4876f
IDEMPOTENCY-KEY = policy:ce_L7ITEM3PROOF20261120A1:59376b2fcb1981fc
segments      = 3
--- call 1: HTTP 200
{"decidedAt": "2026-11-20T11:26:29.373Z", "decision": "deny", "decisionId": "pd_6CC8C3D8EEA9472BB3B0227AB3", "reasonCode": "policy.denied_by_budget", "reasonText": "今日额度不存在，按拒绝处理。", "versionNo": 2}
--- call 2: HTTP 200
{"decidedAt": "2026-11-20T11:26:29.373Z", "decision": "deny", "decisionId": "pd_6CC8C3D8EEA9472BB3B0227AB3", "reasonCode": "policy.denied_by_budget", "reasonText": "今日额度不存在，按拒绝处理。", "versionNo": 2}
```

同体同键两次 ⇒ 200/200 且 `decisionId`/`decidedAt` 完全一致 = 缓存命中回放路径（正是修复要打通的那条）。deny 属 fail-closed 预算（今日无 `budget_ledger` 行），不涉及额度变更。

(c) DB 原文（只读 `mode=ro`）：

```
policy:ce_L7ITEM3PROOF20261120A1:59376b2fcb1981fc|POST /v1/policy/check|200|59376b2fcb1981fc61ae37fd802c514dfb0b548affe394a173f930aa0dc4876f|2026-11-20T11:26:29.374Z
policy:ce_01M7W7WKK0Y8T13D62BF03ZYG3|POST /v1/policy/check|200|89a8fcad…|2026-11-20T10:26:29.756Z
policy:ce_01M7VXG30J9DWJFYVSK62DNHDY|POST /v1/policy/check|200|58f2d6f9…|2026-11-20T07:24:54.513Z
```

键形制直方图：`NEW-3seg 1 条（19:26:29）` vs `OLD-2seg 10 条（最晚 18:26:29，全部在 19:10 重启之前）`；库内 `request_hash` 与探针算得的 body 指纹逐位相同，且键后缀 = 其前 16 hex ⇒ 「同键必同体」按设计成立。旧代码只可能产出两段键（`git show 125ef0af`：`-idempotency_key=f"policy:{event.event_id}"`）。

写面已界定（调用前先 `.backup` 到 `/var/folders/…/domain-dev.pre-1918.db`，712704 B 只读副本）：employee 3→3、**policy_decision 81→82**、**idempotency_key 238→239**、budget_ledger 8→8、approval 10→10、approval_decision 6→6、grant 6→6、employee_version 6→6、audit_event 175→175。探针行（事件 id `ce_L7ITEM3PROOF20261120A1`）**保留**供审计，不删除。

计数口径更正：上一版用 `awk '$2>"19:10:03"'` 只比时间戳段，会误匹配 11-17 的行；改用日期+时间双条件后重算，19:10:03 至今真 409 = **0**，当日最后一次 409 = `18:26:57,947`（旧 pid 9570）。结论未变，口径已修正。

未动 8100/8101/8642，未重启网关。三项自检：①已推 commit（运行树 HEAD 5f0db708 == origin/main）②进程 lstart 19:10:03 > 19:06:59 ③本条 §9 读数 ⇒ **第③项已取证**；按纪律仍不写「已修复」（P1 真实事件流尚未在新进程上自然发生）。
