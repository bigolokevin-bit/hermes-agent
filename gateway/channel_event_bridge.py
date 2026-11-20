"""Seakoi fork patch: forward of admitted Feishu inbound messages to C1.

Upstream base: 7c0e12a5. This module is additive; the only upstream hook is a single
call in ``GatewayInboundMixin._hm_admit_event`` right after the authorization gate.

Behaviour contract (S7b-2 + L7 spool):
- Feishu only; disabled unless ``SEAKOI_C1_BASE_URL`` is set in the gateway env.
- Non-blocking: schedules a detached task per event, so admission never waits on C1.
  Each POST attempt keeps the 300 ms total timeout.
- Bounded retry: a failed attempt is retried, at most 3 attempts in total, sleeping
  0.5 s then 1.0 s between attempts (``asyncio.sleep``; the loop is never blocked).
  Retries are capped by ``_TOTAL_BUDGET_SECONDS`` (4 s) so one message cannot hold
  its task forever. Success returns without touching the spool.
- Local spool fallback: only after the third failed attempt is one JSON line appended
  to ``SEAKOI_BRIDGE_SPOOL`` (default
  ``~/.local/state/sekoi-ops/bridge-spool.jsonl``). Each line is
  ``{dedupeKey, payload, attempts, firstFailedAt}`` with no credentials. The spool is
  capped at 200 lines: overflow drops the oldest and logs the count only.
- Spool replay: every new event schedules a best-effort drain on its own detached
  task before that event's own POST is scheduled, so a C1 outage is worked off
  without slowing the first send. Each entry is re-posted with its original
  ``dedupeKey`` (C1 dedupes); delivered lines are removed, failures are kept.
  Corrupt lines (bad JSON, missing/!= ``dedupeKey``) are dropped, never raised.
  Writes are atomic (temp file + ``os.replace``) under one ``asyncio.Lock``.
- Logs land on the ``gateway.run`` logger (=> ~/.hermes/logs/gateway.log):
  success ``channel_event_posted`` (message_id/event_id/duplicate), retries
  ``channel_event_post_retry``, terminal failure ``channel_event_post_failed``
  (message_id + attempt count + HTTP status or exception class; never message text
  or tokens), spool lines carry dedupeKey/attempts only.
- Mentions passthrough (V1 group-@ gate): Feishu ``mentions`` are forwarded as
  ``content.mentions = [{"externalId", "name"?}]``. When there are none the key is
  omitted entirely, so the legacy body shape stays byte-identical. Dedupe semantics
  are unchanged; only the delivery guarantee changed (retry + spool).
- C1 authoritative gate (``SEAKOI_C1_AUTHORITATIVE``, default OFF): for Feishu GROUP
  events only, admission bounded-waits (``_AUTHORITATIVE_TIMEOUT_SECONDS``, 1.5 s,
  async — the loop is never blocked) for the FIRST POST result of the same forward.
  A 2xx verdict lets the caller skip the local agent turn (C1 owns the reply); any
  non-2xx reason, an early skip, or a timeout fails open and the local turn runs.
  Unset flag / DM / other platforms / FIFO replay: the plain 2-arg fire-and-forget
  forward, byte-identical to the behaviour above.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any, List, Optional, Set, Tuple
from datetime import UTC

logger = logging.getLogger("gateway.run")

_TIMEOUT_SECONDS = 0.3
_MAX_TEXT_CHARS = 4000
_PLACEHOLDER_EVENT_ID = "ce_pending"  # C1 always overrides with a server-side ULID

_RETRY_DELAYS: tuple[float, ...] = (0.5, 1.0)  # between attempts => 3 attempts max
_MAX_ATTEMPTS = len(_RETRY_DELAYS) + 1
_TOTAL_BUDGET_SECONDS = 4.0  # hard cap per event: attempts + sleeps + transport
_SPOOL_ENV = "SEAKOI_BRIDGE_SPOOL"
_SPOOL_DEFAULT_PATH = "~/.local/state/seakoi-ops/bridge-spool.jsonl"
# The default once dropped the ``a`` in ``seakoi``; that directory is never written
# again and only exists so a host already running the buggy build can be migrated.
_SPOOL_LEGACY_DEFAULT_PATH = "~/.local/state/sekoi-ops/bridge-spool.jsonl"
_SPOOL_CAP = 200

# C1 authoritative gate: default OFF. With the flag unset the inbound path stays the
# plain fire-and-forget forward above; nothing in this section runs.
_AUTHORITATIVE_ENV = "SEAKOI_C1_AUTHORITATIVE"
# Bounded wait for the FIRST POST verdict, read from this module attribute at call
# time so tests can shorten it.
_AUTHORITATIVE_TIMEOUT_SECONDS = 1.5

_legacy_spool_migrated = False

_background_tasks: set[asyncio.Task[None]] = set()
_spool_lock: Optional[asyncio.Lock] = None
_spool_lock_loop: Optional[asyncio.AbstractEventLoop] = None
_drain_task: Optional[asyncio.Task[None]] = None


def _base_url(source: Any) -> Optional[str]:
    """Return the C1 base URL iff this event should be forwarded (feishu + configured)."""
    platform = getattr(getattr(source, "platform", None), "value", None)
    if platform != "feishu":
        return None
    base = (os.environ.get("SEAKOI_C1_BASE_URL") or "").strip().rstrip("/")
    return base or None


def authoritative_active() -> bool:
    """Whether the C1 authoritative gate env flag is truthy (``1``/``true``)."""
    return (os.environ.get(_AUTHORITATIVE_ENV) or "").strip().lower() in ("1", "true")


def authoritative_gate_active(source: Any) -> bool:
    """Whether this event's admission should await the first POST verdict.

    Feishu-only is enforced via ``_base_url``; DM and unconfigured sources never
    gate, so the flag can only ever change behaviour for Feishu group traffic.
    """
    if not authoritative_active():
        return False
    if source is None:
        return False
    if getattr(source, "chat_type", None) != "group":
        return False
    return _base_url(source) is not None


def _iso_ms(dt: Any) -> str:
    from datetime import datetime, timezone

    if not isinstance(dt, datetime):
        dt = datetime.now().astimezone()
    if dt.tzinfo is None:
        dt = dt.astimezone()
    dt = dt.astimezone(UTC)
    return f"{dt.strftime('%Y-%m-%dT%H:%M:%S')}.{dt.microsecond // 1000:03d}Z"


def _sender_ids(event: Any, source: Any) -> dict:
    """Extract open_id/union_id/tenant user_id from the raw Feishu event when present.

    Reads ``sender.sender_id`` from plain dicts (HTTP webhook) *and* lark SDK
    model objects (websocket dispatcher) identically, via ``_field``; the
    sender is resolved from the nested ``raw.event.sender`` first, then the
    flat ``raw.sender`` (same shape handling as ``_mentions``). Before this,
    the dict-only read silently skipped every branch on the websocket path,
    ``open_id`` never arrived and callers fell back to ``source.user_id``.
    Never raises: odd or missing shapes leave the ids ``None``.
    """
    open_id = union_id = user_id = None
    raw = getattr(event, "raw_message", None)
    try:
        sender = _field(_field(raw, "event"), "sender")
        if sender is None:
            sender = _field(raw, "sender")
        sid = _field(sender, "sender_id")
        if sid is not None:
            open_id = _field(sid, "open_id") or None
            union_id = _field(sid, "union_id") or None
            user_id = _field(sid, "user_id") or None
    except Exception:
        pass
    return {
        "open_id": open_id,
        "union_id": union_id,
        "user_id": user_id,
        "source_user_id": getattr(source, "user_id", None),
        "source_user_id_alt": getattr(source, "user_id_alt", None),
    }


def _field(obj: Any, name: str) -> Any:
    """Read ``name`` from a dict *or* an SDK model object; ``None`` when absent.

    The Feishu adapter hands the raw event through two shapes: plain dicts on the
    HTTP webhook path and lark SDK model objects on the websocket path (the
    dispatcher callback stores the SDK event itself in ``raw_message``). Both must
    map identically.
    """
    if isinstance(obj, dict):
        return obj.get(name)
    return getattr(obj, name, None)


def _mentions(event: Any) -> list:
    """Map Feishu ``mentions`` from the raw event to the C1 ``content.mentions`` shape.

    Reads ``raw.event.message.mentions`` first, then the flat
    ``raw.message.mentions``, from either dicts or SDK model objects. Per entry
    ``externalId`` is the first non-empty of ``id.open_id`` / ``id.union_id`` /
    ``id.user_id`` (entries without one are dropped: the C1 contract requires
    externalId); ``name`` passes through only when non-empty. Never raises: any
    missing or odd-shaped input yields ``[]``.
    """
    out: list = []
    try:
        raw = getattr(event, "raw_message", None)
        if raw is None:
            return []
        items = _field(_field(_field(raw, "event"), "message"), "mentions")
        if items is None:
            items = _field(_field(raw, "message"), "mentions")
        if not isinstance(items, list):
            return []
        for item in items:
            ident = _field(item, "id")
            if ident is None:
                continue
            external_id = (
                _field(ident, "open_id")
                or _field(ident, "union_id")
                or _field(ident, "user_id")
            )
            if not external_id:
                continue
            entry: dict = {"externalId": external_id}
            name = _field(item, "name")
            if name:
                entry["name"] = name
            out.append(entry)
    except Exception:
        return []
    return out


def build_payload(event: Any, source: Any) -> Optional[dict]:
    """Map an admitted MessageEvent to the C1 ChannelEvent body (camelCase wire form).

    Returns None (skip) when mandatory identifiers are missing. ``eventId``/``tenantId``
    are placeholders: C1 overwrites both with authoritative server-side values.
    """
    message_id = getattr(event, "message_id", None)
    if not message_id:
        return None
    ids = _sender_ids(event, source)
    external_id = ids["open_id"] or ids["source_user_id"]
    if not external_id:
        return None
    app_id = (os.environ.get("FEISHU_APP_ID") or "feishu_default_app").strip()
    event_type = "message_created"
    chat_type = {"dm": "p2p", "group": "group"}.get(
        getattr(source, "chat_type", "") or "", "unknown"
    )
    conversation_ref = getattr(source, "chat_id", None) or ""
    if not conversation_ref:
        return None
    is_bot = bool(getattr(source, "is_bot", False))
    text = getattr(event, "text", "") or ""
    if len(text) > _MAX_TEXT_CHARS:
        text = text[:_MAX_TEXT_CHARS] + "…[truncated]"
    content: dict = {"text": text}
    mentions = _mentions(event)
    if mentions:  # empty => no key at all: legacy body stays byte-identical
        content["mentions"] = mentions
    return {
        "eventId": _PLACEHOLDER_EVENT_ID,
        "tenantId": (os.environ.get("SEAKOI_C1_TENANT_ID") or "").strip(),
        "channel": "feishu",
        "appId": app_id,
        "eventType": event_type,
        "dedupeKey": f"feishu:{app_id}:{message_id}:{event_type}",
        "externalMessageId": message_id,
        "chatType": chat_type,
        "conversationRef": conversation_ref,
        "sender": {
            "externalId": external_id,
            "unionId": ids["union_id"] or ids["source_user_id_alt"],
            "subjectUserId": ids["user_id"] or ids["source_user_id"],
            "senderType": "bot" if is_bot else "person",
        },
        "content": content,
        "receivedAt": _iso_ms(getattr(event, "timestamp", None)),
        "status": "accepted",
    }


# --- spool -------------------------------------------------------------------
#
# One JSON object per line, oldest first. Only the payload already built for the
# wire plus bookkeeping is stored: no tokens, no headers, nothing derived from
# ``SEAKOI_C1_INTERNAL_TOKEN``. Entries are produced solely by ``_forward_task``
# after a terminal failure and consumed by ``drain_spool``.


def _spool_path() -> str:
    raw = (os.environ.get(_SPOOL_ENV) or "").strip()
    return os.path.expanduser(raw or _SPOOL_DEFAULT_PATH)


def _migrate_legacy_spool_once(target: str) -> None:
    """Best-effort move of a spool left in the misspelled default directory.

    Runs at most once per process, on first spool use. Only a plain rename inside
    the same filesystem is attempted; anything that goes wrong is logged as a
    warning and the legacy file is left exactly where it was — losing a replay
    opportunity is preferable to losing the entry or crashing the bridge. Logs
    name the two paths and the line count, never a payload. The once-per-process flag
    is raised only when a move actually succeeds, so a host whose first attempt hits a
    filesystem error keeps trying on the next spool use.
    """
    global _legacy_spool_migrated
    if _legacy_spool_migrated:
        return
    legacy = os.path.expanduser(_SPOOL_LEGACY_DEFAULT_PATH)
    if target == legacy or not os.path.isfile(legacy) or os.path.exists(target):
        return
    try:
        os.makedirs(os.path.dirname(target) or ".", exist_ok=True)
        os.rename(legacy, target)
        with open(target, encoding="utf-8") as handle:
            lines = sum(1 for line in handle if line.strip())
    except Exception as exc:  # migration must never break the bridge
        logger.warning(
            "channel_event_spool_migrate_failed: error=%s", type(exc).__name__
        )
        return
    _legacy_spool_migrated = True
    logger.info(
        "channel_event_spool_migrated: from=%s to=%s lines=%s", legacy, target, lines
    )


def _spool_lock_for_running_loop() -> asyncio.Lock:
    """Return the process' one spool lock, bound to the running loop.

    ``asyncio.Lock`` pins its loop on first contention, so a lock created under a
    previous loop (tests run one loop per case) is replaced instead of reused.
    """
    global _spool_lock, _spool_lock_loop
    loop = asyncio.get_running_loop()
    if _spool_lock is None or _spool_lock_loop is not loop:
        _spool_lock = asyncio.Lock()
        _spool_lock_loop = loop
    return _spool_lock


def _utc_now_iso() -> str:
    """UTC ISO8601 with milliseconds and a ``Z`` suffix."""
    return _iso_ms(None)


def _valid_entry(entry: Any) -> bool:
    """A spool line is replayable only with a dedupeKey the payload also carries."""
    if not isinstance(entry, dict):
        return False
    dedupe_key = entry.get("dedupeKey")
    payload = entry.get("payload")
    if not isinstance(dedupe_key, str) or not dedupe_key:
        return False
    if not isinstance(payload, dict):
        return False
    return payload.get("dedupeKey") == dedupe_key


def _spool_read(path: str) -> tuple[list[dict], int]:
    """Parse the spool file. Returns ``(entries, corrupt_line_count)``.

    Never raises: an unreadable file reads as empty, and lines that fail to parse
    or lack a usable dedupeKey are counted (for one count-only warning) and dropped.
    """
    entries: list[dict] = []
    corrupt = 0
    try:
        with open(path, "r", encoding="utf-8") as fh:
            lines = fh.read().splitlines()
    except FileNotFoundError:
        return entries, corrupt
    except OSError as exc:
        logger.warning("bridge_spool_read_failed: error=%s", type(exc).__name__)
        return entries, corrupt
    for line in lines:
        if not line.strip():
            continue
        try:
            entry = json.loads(line)
        except ValueError:
            corrupt += 1
            continue
        if not _valid_entry(entry):
            corrupt += 1
            continue
        entries.append(entry)
    return entries, corrupt


def _spool_write(path: str, entries: list[dict]) -> None:
    """Atomically replace the spool with ``entries`` (temp file + ``os.replace``)."""
    directory = os.path.dirname(path) or "."
    os.makedirs(directory, exist_ok=True)
    tmp_path = f"{path}.tmp"
    with open(tmp_path, "w", encoding="utf-8") as fh:
        for entry in entries:
            fh.write(json.dumps(entry, ensure_ascii=False, sort_keys=True))
            fh.write("\n")
        fh.flush()
        os.fsync(fh.fileno())
    os.replace(tmp_path, path)


def _spool_write_safe(path: str, entries: list[dict]) -> bool:
    try:
        _spool_write(path, entries)
        return True
    except OSError as exc:
        logger.warning("bridge_spool_write_failed: error=%s", type(exc).__name__)
        return False


async def _spool_append(entry: dict) -> None:
    """Append one entry under the spool lock, dropping the oldest past the cap."""
    async with _spool_lock_for_running_loop():
        path = _spool_path()
        _migrate_legacy_spool_once(path)
        entries, corrupt = _spool_read(path)
        if corrupt:
            logger.warning("bridge_spool_corrupt_lines_dropped: count=%s", corrupt)
        entries.append(entry)
        overflow = len(entries) - _SPOOL_CAP
        if overflow > 0:
            entries = entries[overflow:]
            logger.warning(
                "bridge_spool_overflow: dropped=%s cap=%s", overflow, _SPOOL_CAP
            )
        if _spool_write_safe(path, entries):
            logger.warning(
                "channel_event_spooled: dedupeKey=%s attempts=%s",
                entry.get("dedupeKey"),
                entry.get("attempts"),
            )


async def _replay_spool_locked(base: str) -> None:
    """One best-effort replay pass. Caller holds the spool lock.

    Each entry gets a single attempt (a drain must not spend the retry budget per
    line); whatever still fails stays on disk for the next pass. Entries are
    re-posted with their stored payload, hence their original dedupeKey.
    """
    path = _spool_path()
    _migrate_legacy_spool_once(path)
    if not os.path.isfile(path):
        return
    entries, corrupt = _spool_read(path)
    if corrupt:
        logger.warning("bridge_spool_corrupt_lines_dropped: count=%s", corrupt)
    if not entries:
        if corrupt:
            _spool_write_safe(path, [])
        return
    remaining: list[dict] = []
    replayed = 0
    for entry in entries:
        payload = entry["payload"]
        message_id = payload.get("externalMessageId") or "?"
        reason = await _post_once(base, payload, message_id)
        if reason is None:
            replayed += 1
            logger.info(
                "channel_event_spool_replayed: dedupeKey=%s", entry["dedupeKey"]
            )
        else:
            remaining.append(entry)
            logger.warning(
                "channel_event_spool_replay_failed: dedupeKey=%s error=%s",
                entry["dedupeKey"],
                reason,
            )
    if replayed:
        _spool_write_safe(path, remaining)
    logger.info(
        "channel_event_spool_drained: replayed=%s remaining=%s",
        replayed,
        len(remaining),
    )


async def drain_spool(base: str) -> None:
    """Never raises. Re-post every spooled event once, keeping the failures."""
    async with _spool_lock_for_running_loop():
        try:
            await _replay_spool_locked(base)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("bridge_spool_drain_failed: error=%s", type(exc).__name__)


# --- transport ---------------------------------------------------------------


async def _post_once(
    base: str, payload: dict, message_id: str, info: Optional[dict] = None
) -> Optional[str]:
    """One POST attempt. Returns None on success, else a short reason (no content).

    ``info`` is an optional caller-owned dict: on a 2xx it is filled with the same
    ``event_id``/``duplicate`` values the success log line reports, so the
    authoritative gate can see the first verdict without parsing logs.
    """
    import aiohttp

    headers = {
        "X-Tenant-Id": (os.environ.get("SEAKOI_C1_TENANT_ID") or "").strip(),
        "X-Internal-Token": (os.environ.get("SEAKOI_C1_INTERNAL_TOKEN") or "").strip(),
    }
    url = f"{base}/v1/channel-events"
    try:
        timeout = aiohttp.ClientTimeout(total=_TIMEOUT_SECONDS)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(url, json=payload, headers=headers) as resp:
                body: dict = {}
                if resp.status < 500:
                    try:
                        body = await resp.json(content_type=None)
                    except Exception:
                        body = {}
                if 200 <= resp.status < 300:
                    logger.info(
                        "channel_event_posted: message_id=%s event_id=%s duplicate=%s",
                        message_id,
                        body.get("eventId"),
                        body.get("duplicate"),
                    )
                    if info is not None:
                        event_id = body.get("eventId")
                        info["event_id"] = (
                            str(event_id) if event_id is not None else None
                        )
                        info["duplicate"] = bool(body.get("duplicate"))
                    return None
                return f"status={resp.status}"
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        return type(exc).__name__


def _resolve_first_result(first_result: Any, verdict: dict) -> None:
    """Settle the gate's waiter with the first POST outcome; never raises.

    No waiter (``None``) or an already-settled future is a no-op, and a future
    whose loop is gone must never break the retry loop.
    """
    try:
        if first_result is None or first_result.done():
            return
        first_result.set_result(verdict)
    except Exception:
        # Best-effort waiter: a dead future must never disturb the retry/spool path.
        logger.debug("channel_event_gate: first-result resolve failed", exc_info=True)


async def _post_with_retry(
    base: str, payload: dict, message_id: str, first_result: Any = None
) -> bool:
    """POST with at most ``_MAX_ATTEMPTS`` attempts inside a 4 s budget.

    With ``first_result`` (the authoritative gate) the FIRST attempt reports its
    verdict to the waiter and the remaining attempts run exactly as before; without
    it the call shape stays the plain 3-positional fire-and-forget.
    """
    loop = asyncio.get_running_loop()
    deadline = loop.time() + _TOTAL_BUDGET_SECONDS
    reason = "not_attempted"
    attempt = 0
    for attempt in range(1, _MAX_ATTEMPTS + 1):
        if first_result is not None and attempt == 1:
            info: dict = {}
            reason = await _post_once(base, payload, message_id, info=info)
            _resolve_first_result(
                first_result,
                {
                    "ok": reason is None,
                    "event_id": info.get("event_id"),
                    "duplicate": info.get("duplicate"),
                },
            )
        else:
            reason = await _post_once(base, payload, message_id)
        if reason is None:
            return True
        if attempt >= _MAX_ATTEMPTS:
            break
        delay = _RETRY_DELAYS[attempt - 1]
        if loop.time() + delay > deadline:
            logger.warning(
                "channel_event_post_retry_skipped: message_id=%s attempt=%s"
                " reason=budget_exhausted",
                message_id,
                attempt,
            )
            break
        logger.warning(
            "channel_event_post_retry: message_id=%s attempt=%s error=%s",
            message_id,
            attempt,
            reason,
        )
        await asyncio.sleep(delay)
    logger.warning(
        "channel_event_post_failed: message_id=%s attempts=%s error=%s",
        message_id,
        attempt,
        reason,
    )
    return False


async def _forward_task(
    base: str, payload: dict, message_id: str, first_result: Any = None
) -> None:
    """Detached per-event task: retry, then spool only on terminal failure."""
    try:
        if await _post_with_retry(base, payload, message_id, first_result):
            return
        await _spool_append(
            {
                "dedupeKey": payload["dedupeKey"],
                "payload": payload,
                "attempts": _MAX_ATTEMPTS,
                "firstFailedAt": _utc_now_iso(),
            }
        )
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        logger.warning(
            "channel_event_post_failed: message_id=%s error=%s",
            message_id,
            type(exc).__name__,
        )


def _schedule_drain(loop: asyncio.AbstractEventLoop, base: str) -> None:
    """Kick one detached drain unless the previous one is still in flight."""
    global _drain_task
    if _drain_task is not None and not _drain_task.done():
        return
    task = loop.create_task(drain_spool(base))
    _drain_task = task
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)


def forward_inbound_event(event: Any, source: Any, first_result: Any = None) -> None:
    """Never raises. Schedules the drain and the retrying POST, then returns.

    ``first_result`` is the authoritative gate's future: every skip that will never
    POST settles it immediately with a not-ok verdict, so the waiter falls back at
    once instead of burning its timeout.
    """
    message_id = "?"
    skipped = {"ok": False, "event_id": None, "duplicate": False}
    try:
        base = _base_url(source)
        if not base:
            _resolve_first_result(first_result, skipped)
            return
        message_id = getattr(event, "message_id", None) or "?"
        if getattr(event, "internal", False) or getattr(event, "is_bot", False):
            _resolve_first_result(first_result, skipped)
            return
        payload = build_payload(event, source)
        if payload is None:
            _resolve_first_result(first_result, skipped)
            return
        loop = asyncio.get_running_loop()
        _schedule_drain(loop, base)  # spool first; never awaited from this path
        task = loop.create_task(
            _forward_task(base, payload, message_id, first_result)
        )
        _background_tasks.add(task)
        task.add_done_callback(_background_tasks.discard)
    except RuntimeError:
        # No running loop: the future stays unresolved on purpose — the waiter's
        # timeout is what fails this message open back to the local reply.
        logger.warning(
            "channel_event_post_failed: message_id=%s error=NoRunningLoop", message_id
        )
    except Exception as exc:
        logger.warning(
            "channel_event_post_failed: message_id=%s error=%s",
            message_id,
            type(exc).__name__,
        )


async def forward_and_await_verdict(event: Any, source: Any) -> tuple[str, dict]:
    """Forward, then await the FIRST POST result bounded (C1 authoritative gate).

    Returns ``(state, verdict)``: ``"suppressed"`` on a 2xx — the caller must skip
    the local agent turn because C1 owns the reply; ``"fallback"`` on any non-2xx
    or skipped forward, and ``"timeout"`` when the first attempt has not answered
    within ``_AUTHORITATIVE_TIMEOUT_SECONDS`` — in both cases the caller keeps the
    local reply (fail-open; the detached forward and its spool continue anyway).
    Awaits without blocking the loop. Never raises to the caller.
    """
    loop = asyncio.get_running_loop()
    fut = loop.create_future()
    try:
        forward_inbound_event(event, source, first_result=fut)
    except Exception:
        logger.warning(
            "channel_event_gate_failed: message_id=%s",
            getattr(event, "message_id", None),
            exc_info=True,
        )
        return "fallback", {}
    try:
        verdict = await asyncio.wait_for(fut, _AUTHORITATIVE_TIMEOUT_SECONDS)
    except TimeoutError:
        return "timeout", {}
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.debug("channel_event_gate: waiter failed", exc_info=True)
        return "fallback", {}
    if verdict.get("ok"):
        return "suppressed", verdict
    return "fallback", verdict
