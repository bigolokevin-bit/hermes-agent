#!/usr/bin/env bash
# V1 四跳只读取数器（gov 车道）
# 纪律：全程只读。sqlite 一律 mode=ro；HTTP 只发 GET；不写任何库、不启停任何服务、不发外部消息。
# 用法：V1-FOUR-HOP-RUNBOOK.sh <event_id|ce_...>     # 单事件串联
#       V1-FOUR-HOP-RUNBOOK.sh --latest              # 取最新一条 channel_event 再串联
#       V1-FOUR-HOP-RUNBOOK.sh --gate                # 只看「门是否生效」判别式
#       V1-FOUR-HOP-RUNBOOK.sh --env-names [pid]     # 只列环境变量名，永不回显值
set -uo pipefail

OPS="$HOME/.local/state/seakoi-ops"
C1_DB="file:$OPS/c1-events.db?mode=ro"
RT_DB="file:$OPS/runtime-dev.db?mode=ro"
GW_LOG="$OPS/hermes-gateway.log"
WK_LOG="$OPS/dispatch-worker.err.log"
C1_PORT=8100
AUD_PORT=8101
TENANT="${SEAKOI_C1_TENANT_ID:-t_seakoi_pilot}"
WORKER_PID="${V1_WORKER_PID:-9570}"
CHAT_REF="${V1_CHAT_REF:-oc_0adeac8168d48d413693f1e64a330db5}"

say() { printf '\n== %s\n' "$1"; }
ro()  { sqlite3 "$C1_DB" "$1"; }
rro() { sqlite3 "$RT_DB" "$1"; }

# 只取环境变量名（值永不落到 stdout）
env_names() { ps eww -p "${1:-$WORKER_PID}" -o command= 2>/dev/null | tr ' ' '\n' | grep -oE '^[A-Z][A-Z0-9_]*=' | sort -u; }

# 从运行中进程 env 取 C1 内部 token；只入变量，不打印、不落盘
c1_token() { ps eww -p "$WORKER_PID" -o command= 2>/dev/null | tr ' ' '\n' | sed -n 's/^SEAKOI_C1_INTERNAL_TOKEN=//p' | head -n1; }

count_of() { local n; n=$(grep -c -- "$1" "$2" 2>/dev/null) || true; printf '%s' "${n:-0}"; }

gate_check() {
  say "判别式：C1 权威门（hop0 前置）"
  local gwpid listening names
  gwpid=$(cat "$OPS/hermes-gateway.pid" 2>/dev/null || echo '')
  listening=$(lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | awk -v p="$gwpid" '$2==p && /:8642/ {print "yes"; exit}' || true)
  printf 'gateway pid(file)=%s  8642 listening=%s\n' "$gwpid" "${listening:-no}"
  if [ -n "$gwpid" ]; then
    names=$(env_names "$gwpid")
    if printf '%s\n' "$names" | grep -q '^SEAKOI_C1_AUTHORITATIVE='; then
      printf 'SEAKOI_C1_AUTHORITATIVE = 在 gateway env 里（值不回显；只有 1/true 才算开，其它值等同关）\n'
    else
      printf 'SEAKOI_C1_AUTHORITATIVE = 不在 gateway env 里 ⇒ 门关闭（代码默认 off）\n'
    fi
    printf 'gateway 侧 C1 相关变量名: %s\n' \
      "$(printf '%s\n' "$names" | grep -E '^SEAKOI_C1_[A-Z_]+=' | tr -d '=' | tr '\n' ' ')"
  else
    printf 'FAIL: 读不到 %s/hermes-gateway.pid ⇒ 无法判定门状态，记 MISSING 交运维道\n' "$OPS"
  fi
  printf 'local_reply_suppressed 行数 = %s（期望：门开且有群消息时为 1 的倍数；0 不代表门坏，只代表没触发过）\n' \
    "$(count_of 'local_reply_suppressed' "$GW_LOG")"
  printf 'local_reply_fallback  行数 = %s（>0 = C1 投递失败后本地兜底发话，需查 C1）\n' \
    "$(count_of 'local_reply_fallback' "$GW_LOG")"
  printf 'Feishu Dropped a group message 行数 = %s（>0 = 群消息在适配器就被拒，从未进 C1）\n' \
    "$(count_of 'Dropped a group message' "$GW_LOG")"
  grep -h -- 'Dropped a group message' "$GW_LOG" 2>/dev/null | tail -n1 | cut -c1-320
  printf '注：[Feishu] Sending response 这个字面量在 feishu 适配器里不存在（全仓 0 命中），不得当判据用；\n'
  printf '    双脑红旗改用「门开时 local_reply_suppressed=0 且 local_reply_fallback>0」或 hop3 出现两条不同来源出站。\n'
}

latest_event() { ro "SELECT event_id FROM channel_event ORDER BY received_at DESC LIMIT 1;"; }

capture() {
  local EV="$1" TOKEN
  case "$EV" in
    ce_[0-9A-Za-z]*) : ;;
    *) echo "FAIL: 不是 ce_ 开头的 event_id（得到 '$EV'）"; exit 2 ;;
  esac
  say "hop1 channel_event 行（sqlite 只读）"
  ro "SELECT event_id||' | '||status||' | '||event_type||' | '||chat_type||' | '||external_message_id||' | '||received_at FROM channel_event WHERE event_id='$EV';" || echo 'FAIL: sqlite 读取失败（库被占或路径错）'
  ro "SELECT 'mentions='||ifnull(json_extract(content,'\$.mentions'),'<NULL/无键>') FROM channel_event WHERE event_id='$EV';"
  ro "SELECT 'dedupe_key='||dedupe_key||' | sender='||json_extract(sender,'\$.externalId')||'/'||json_extract(sender,'\$.senderType')||' | attempt_no='||attempt_no||' | lease_until='||ifnull(lease_until,'NULL') FROM channel_event WHERE event_id='$EV';"

  say "hop2 worker 处理痕迹（日志 + runtime 库）"
  printf 'pending 轮询行（尾部 3 条）:\n'; grep -h 'channel-events/pending' "$WK_LOG" 2>/dev/null | tail -n3 | cut -c1-190
  printf '本事件 ack 行 = %s（1 = worker 领到并收尾；0 = 从未消费，去查 pending 轮次是否空批）\n' \
    "$(count_of "/v1/channel-events/$EV/ack" "$WK_LOG")"
  grep -h -- "/v1/channel-events/$EV/ack" "$WK_LOG" 2>/dev/null | cut -c1-190
  printf '本事件在 worker 日志出现行数 = %s\n' "$(count_of "$EV" "$WK_LOG")"
  printf 'audit POST 行（全日志总计）= %s（日志行不含 event_id，逐事件关联只能靠 hop4 审计库）\n' \
    "$(count_of "/v1/audit/events" "$WK_LOG")"
  printf '日志里的门标记行数：addressing_gate=%s identity_gate=%s dispatch.event=%s\n' \
    "$(count_of 'addressing_gate' "$WK_LOG")" \
    "$(count_of 'identity_gate' "$WK_LOG")" \
    "$(count_of 'dispatch.event' "$WK_LOG")"
  rro "SELECT 'agent_run 行数='||count(*) FROM agent_run WHERE channel_event_id='$EV';" 2>/dev/null \
    || echo 'FAIL: runtime 库读不到（路径或权限）→ hop2 的 DB 侧记 MISSING'
  rro "SELECT run_id||' | '||status||' | '||ifnull(reason_code,'-')||' | '||ifnull(employee_id,'-')||' | '||started_at FROM agent_run WHERE channel_event_id='$EV' ORDER BY created_at DESC LIMIT 3;" 2>/dev/null

  say "hop3 channel_outbound（intent_key 内嵌 ce_）"
  ro "SELECT '本事件出站行='||count(*)||'（其中 sent='||sum(status='sent')||'）' FROM channel_outbound WHERE intent_key LIKE '%$EV%';"
  ro "SELECT outbound_id||' | '||status||' | '||intent_key||' | sent_at='||ifnull(sent_at,'NULL')||' | attempts='||attempts||' | '||ifnull(last_error,'-') FROM channel_outbound WHERE intent_key LIKE '%$EV%' ORDER BY created_at DESC LIMIT 5;"
  ro "SELECT '今日 sent（UTC 日）='||count(*) FROM channel_outbound WHERE status='sent' AND date(sent_at)=date('now');"

  say "hop4 8101 审计（A4 按派生 eventId 逐字命中）"
  local EVID DEDUPE
  DEDUPE="$(ro "SELECT dedupe_key FROM channel_event WHERE event_id='$EV';")"
  EVID="ev-dispatch-$(CE="$EV" python3 -c "import hashlib,os;print(hashlib.sha256(('dispatch:'+os.environ['CE']).encode()).hexdigest()[:26])")"
  printf 'derived eventId = %s\n' "$EVID"
  TOKEN="$(c1_token)"
  if [ -z "$TOKEN" ]; then
    printf 'C1 token 从 pid %s env 取不到 ⇒ hop1 的 HTTP 复核跳过（sqlite 只读仍是主证）\n' "$WORKER_PID"
  else
    printf 'C1 token 已取得（不回显），长度 %s\n' "${#TOKEN}"
    curl -sS --max-time 5 "http://127.0.0.1:$C1_PORT/v1/channel-events/$EV" \
      -H "X-Tenant-Id: $TENANT" -H "X-Internal-Token: $TOKEN" \
      -o /tmp/v1-hop1-c1.json -w 'C1 GET HTTP %{http_code}\n' || echo 'FAIL: C1 GET 不通'
  fi
  curl -sS --max-time 5 "http://127.0.0.1:$AUD_PORT/v1/audit/events/$EVID" \
    -H "X-Tenant-Id: $TENANT" -o /tmp/v1-hop4-audit.json -w 'AUDIT GET HTTP %{http_code}\n' || echo 'FAIL: 8101 GET 不通'
  EV="$EV" DEDUPE="$DEDUPE" python3 - <<'PY'
import json, os
p = "/tmp/v1-hop4-audit.json"
ev, dedupe = os.environ["EV"], os.environ.get("DEDUPE", "")
keys = ("eventId", "tenantId", "sourceSystem", "action", "decision", "correlationId",
        "occurredAt", "recordedAt", "resource", "after", "outcome")
try:
    d = json.load(open(p))
except Exception as e:
    print(f"  hop4: 读不到/非 JSON（{type(e).__name__}）→ 记 MISSING，不当通过；用下面 E5 备查反查")
else:
    for k in keys:
        v = d.get(k, "<键不存在>")
        print(f"  {k} = {json.dumps(v, ensure_ascii=False) if not isinstance(v, str) else v}")
    cid = d.get("correlationId") or ""
    rid = (d.get("resource") or {}).get("id") if isinstance(d.get("resource"), dict) else ""
    print(f"  关联判定：correlationId==event_id → {'PASS' if cid == ev else f'MISSING（{cid or 空}）'}")
    print(f"  resource.id==hop1 dedupe_key → {'PASS' if rid and rid == dedupe else f'MISSING（{rid or 空}）'}")
    print(f"  deny 原因码 = {(d.get('after') or {}).get('reason_code', '<无 after.reason_code>')}")
PY
  say "hop4 备查 E5（A4 404 时按 resourceId=dedupe_key 反查，别另造查询串）"
  curl -sS --max-time 5 -G "http://127.0.0.1:$AUD_PORT/v1/audit/events" \
    --data-urlencode "resourceId=$DEDUPE" --data-urlencode "action=dispatch.event" --data-urlencode "limit=20" \
    -H "X-Tenant-Id: $TENANT" -o /tmp/v1-hop4-e5.json -w 'E5 GET HTTP %{http_code}\n' || echo 'FAIL: E5 不通'
  DEDUPE="$DEDUPE" python3 - <<'PY'
import json, os
try:
    d = json.load(open("/tmp/v1-hop4-e5.json"))
except Exception as e:
    print(f"  E5: 读不到/非 JSON（{type(e).__name__}）→ 记 MISSING")
else:
    if "code" in d:
        print(f"  E5 报错 = {d.get('code')} / {d.get('msg', '')}")
    else:
        rows = d.get("events") or []
        hits = [r for r in rows if (r.get("resource") or {}).get("id") == os.environ.get("DEDUPE")]
        print(f"  E5 events 键存在 = {('events' in d)}；返回 {len(rows)} 行，逐行客户端复核 {len(hits)} 行命中 resourceId")
        for r in rows[:5]:
            print(f"    {r.get('eventId')} | {r.get('action')} | {r.get('correlationId')} | "
                  f"{(r.get('decision') or {}).get('reason_code') if isinstance(r.get('decision'), dict) else r.get('decision')} | {r.get('recordedAt')}")
PY
}

case "${1:-}" in
  --gate) gate_check ;;
  --env-names) env_names "${2:-$WORKER_PID}" ;;
  --latest|"") capture "$(latest_event)" ; gate_check ;;
  *) capture "$1" ;;
esac
