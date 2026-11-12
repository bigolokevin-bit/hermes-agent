"""Seakoi fork patch: fire-and-forget forward of admitted Feishu inbound messages to C1.

Upstream base: 7c0e12a5. This module is additive; the only upstream hook is a single
call in ``GatewayInboundMixin._hm_admit_event`` right after the authorization gate.

Behaviour contract (S7b-2):
- Feishu only; disabled unless ``SEAKOI_C1_BASE_URL`` is set in the gateway env.
- Non-blocking: schedules a detached task, 300 ms total timeout. Never retries, never
  queues, never raises into the reply path.
- Logs land on the ``gateway.run`` logger (=> ~/.hermes/logs/gateway.log):
  success ``channel_event_posted`` (message_id/event_id/duplicate),
  failure ``channel_event_post_failed`` (message_id + HTTP code or exception class;
  never message text or tokens).
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Optional, Set

logger = logging.getLogger("gateway.run")

_TIMEOUT_SECONDS = 0.3
_MAX_TEXT_CHARS = 4000
_PLACEHOLDER_EVENT_ID = "ce_pending"  # C1 always overrides with a server-side ULID

_background_tasks: Set["asyncio.Task[None]"] = set()


def _base_url(source: Any) -> Optional[str]:
    """Return the C1 base URL iff this event should be forwarded (feishu + configured)."""
    platform = getattr(getattr(source, "platform", None), "value", None)
    if platform != "feishu":
        return None
    base = (os.environ.get("SEAKOI_C1_BASE_URL") or "").strip().rstrip("/")
    return base or None


def _iso_ms(dt: Any) -> str:
    from datetime import datetime, timezone

    if not isinstance(dt, datetime):
        dt = datetime.now().astimezone()
    if dt.tzinfo is None:
        dt = dt.astimezone()
    dt = dt.astimezone(timezone.utc)
    return f"{dt.strftime('%Y-%m-%dT%H:%M:%S')}.{dt.microsecond // 1000:03d}Z"


def _sender_ids(event: Any, source: Any) -> dict:
    """Extract open_id/union_id/tenant user_id from the raw Feishu event when present."""
    open_id = union_id = user_id = None
    raw = getattr(event, "raw_message", None)
    try:
        if isinstance(raw, dict):
            sender = raw.get("sender")
            sid = sender.get("sender_id") if isinstance(sender, dict) else None
            if isinstance(sid, dict):
                open_id = sid.get("open_id") or None
                union_id = sid.get("union_id") or None
                user_id = sid.get("user_id") or None
    except Exception:  # noqa: BLE001 - defensive: raw shape varies across event kinds
        pass
    return {
        "open_id": open_id,
        "union_id": union_id,
        "user_id": user_id,
        "source_user_id": getattr(source, "user_id", None),
        "source_user_id_alt": getattr(source, "user_id_alt", None),
    }


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
        "content": {"text": text},
        "receivedAt": _iso_ms(getattr(event, "timestamp", None)),
        "status": "accepted",
    }


async def _post(base: str, payload: dict, message_id: str) -> None:
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
                    except Exception:  # noqa: BLE001
                        body = {}
                if 200 <= resp.status < 300:
                    logger.info(
                        "channel_event_posted: message_id=%s event_id=%s duplicate=%s",
                        message_id,
                        body.get("eventId"),
                        body.get("duplicate"),
                    )
                else:
                    logger.warning(
                        "channel_event_post_failed: message_id=%s status=%s code=%s",
                        message_id,
                        resp.status,
                        body.get("code"),
                    )
    except asyncio.CancelledError:
        raise
    except Exception as exc:  # noqa: BLE001 - forwarding must never surface errors
        logger.warning(
            "channel_event_post_failed: message_id=%s error=%s",
            message_id,
            type(exc).__name__,
        )


def forward_inbound_event(event: Any, source: Any) -> None:
    """Never raises. Schedules a detached fire-and-forget POST when enabled."""
    message_id = "?"
    try:
        base = _base_url(source)
        if not base:
            return
        message_id = getattr(event, "message_id", None) or "?"
        if getattr(event, "internal", False) or getattr(event, "is_bot", False):
            return
        payload = build_payload(event, source)
        if payload is None:
            return
        loop = asyncio.get_running_loop()
        task = loop.create_task(_post(base, payload, message_id))
        _background_tasks.add(task)
        task.add_done_callback(_background_tasks.discard)
    except RuntimeError:
        logger.warning(
            "channel_event_post_failed: message_id=%s error=NoRunningLoop", message_id
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "channel_event_post_failed: message_id=%s error=%s",
            message_id,
            type(exc).__name__,
        )
