"""L7: C1 answers an already-seen dedupeKey with HTTP 409 — that is idempotent
success, not a delivery failure. Production evidence (2026-11-20 gateway.log):
``channel_event_post_retry ... status=409`` three times, then a spool line for
an event C1 had accepted on the first POST.

Contract pinned here (style of test_channel_event_spool.py — fake aiohttp,
sync tests + asyncio.run, no network):

- 409: ``_post_once`` returns ``None`` (success), logs exactly
  ``channel_event_duplicate: message_id=<id> event_id=<id> reason=already_exists``
  once, no retry, no spool, no failed line. ``eventId`` from the 409 body is
  used; absent body ids yield the stable placeholder ``<unknown>``.
- The gate ``info`` dict is filled the same way as on 2xx
  (``event_id``/``duplicate=True``) — key shape unchanged.
- Other non-2xx (503) and connection errors keep the old behaviour exactly:
  3 attempts, retry + terminal lines, one spool line after the third failure.
"""

import asyncio
import json
import sys
from types import SimpleNamespace

import pytest

import gateway.channel_event_bridge as bridge

SPOOL_ENV = "SEAKOI_BRIDGE_SPOOL"
BASE = "http://c1.invalid"


def _run(coro):
    return asyncio.run(coro)


def _payload(message_id="om_1"):
    return {
        "eventId": "ce_pending",
        "dedupeKey": f"feishu:app:{message_id}:message_created",
        "externalMessageId": message_id,
        "content": {"text": "SENTINEL_BODY_must_never_reach_a_log_line"},
    }


@pytest.fixture
def spool(tmp_path, monkeypatch):
    path = tmp_path / "state" / "bridge-spool.jsonl"
    monkeypatch.setenv(SPOOL_ENV, str(path))
    monkeypatch.setenv("SEAKOI_C1_INTERNAL_TOKEN", "SENTINEL_INTERNAL_TOKEN")
    monkeypatch.setattr(bridge, "_RETRY_DELAYS", (0.01, 0.02))
    return path


class _Response:
    def __init__(self, status, body):
        self.status = status
        self._body = body

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc_info):
        return False

    async def json(self, content_type=None):
        return self._body


def _fake_module(response=None, fail=False, calls=None):
    class Session:
        def __init__(self, timeout=None):
            # one instantiation == one POST attempt, including the paths
            # that raise before reaching post()
            if calls is not None:
                calls.append("attempt")

        async def __aenter__(self):
            if fail:
                raise OSError("connection refused")
            return self

        async def __aexit__(self, *exc_info):
            return False

        def post(self, url, json=None, headers=None):
            return response

    return SimpleNamespace(
        ClientTimeout=lambda total: SimpleNamespace(total=total),
        ClientSession=Session,
    )


# --- 409 => success -----------------------------------------------------------


def test_409_post_once_success_and_gate_info(spool, monkeypatch):
    calls = []
    monkeypatch.setitem(
        sys.modules,
        "aiohttp",
        _fake_module(_Response(409, {"eventId": "ce_dup", "duplicate": True}), calls=calls),
    )
    info = {}
    reason = _run(bridge._post_once(BASE, _payload(), "om_1", info=info))
    assert reason is None, "409 maps to success, not a retry reason"
    assert info == {"event_id": "ce_dup", "duplicate": True}


def test_409_one_call_no_spool_duplicate_log(spool, monkeypatch, caplog):
    calls = []
    monkeypatch.setitem(
        sys.modules,
        "aiohttp",
        _fake_module(_Response(409, {"eventId": "ce_dup"}), calls=calls),
    )
    with caplog.at_level("INFO", logger="gateway.run"):
        _run(bridge._forward_task(BASE, _payload(), "om_1"))

    assert len(calls) == 1, "409 must not trigger a second attempt"
    assert not spool.exists(), "409 must not write a spool line"
    assert (
        "channel_event_duplicate: message_id=om_1 event_id=ce_dup reason=already_exists"
        in caplog.text
    )
    assert "channel_event_post_retry" not in caplog.text
    assert "channel_event_post_failed" not in caplog.text


def test_409_without_body_id_stable_placeholder(spool, monkeypatch, caplog):
    calls = []
    monkeypatch.setitem(
        sys.modules, "aiohttp", _fake_module(_Response(409, {}), calls=calls)
    )
    with caplog.at_level("INFO", logger="gateway.run"):
        _run(bridge._forward_task(BASE, _payload(), "om_2"))

    assert len(calls) == 1
    assert not spool.exists()
    assert (
        "channel_event_duplicate: message_id=om_2 event_id=<unknown> reason=already_exists"
        in caplog.text
    )


def test_409_gate_first_verdict_ok(spool, monkeypatch):
    """With the authoritative gate the FIRST attempt settles ok=True, so the
    local turn is skipped exactly like a 2xx; no further attempts."""
    calls = []
    monkeypatch.setitem(
        sys.modules,
        "aiohttp",
        _fake_module(_Response(409, {"eventId": "ce_dup"}), calls=calls),
    )

    async def go():
        fut = asyncio.get_running_loop().create_future()
        delivered = await bridge._post_with_retry(BASE, _payload(), "om_3", fut)
        return delivered, fut.result()

    delivered, verdict = _run(go())
    assert delivered is True
    assert len(calls) == 1
    assert verdict["ok"] is True
    assert verdict["event_id"] == "ce_dup"
    assert verdict["duplicate"] is True


# --- contrast: everything else keeps the old retry/spool behaviour ------------


def test_503_still_retries_then_spools(spool, monkeypatch, caplog):
    calls = []
    monkeypatch.setitem(
        sys.modules,
        "aiohttp",
        _fake_module(_Response(503, {"code": "down"}), calls=calls),
    )
    with caplog.at_level("INFO", logger="gateway.run"):
        _run(bridge._forward_task(BASE, _payload(), "om_4"))

    assert len(calls) == 3, "non-409 statuses keep the 3-attempt ladder"
    assert "channel_event_post_retry" in caplog.text
    assert "channel_event_post_failed" in caplog.text
    assert "channel_event_duplicate" not in caplog.text
    lines = [json.loads(l) for l in spool.read_text().splitlines() if l]
    assert len(lines) == 1
    assert lines[0]["attempts"] == 3


def test_connection_error_still_retries_then_spools(spool, monkeypatch):
    calls = []
    monkeypatch.setitem(sys.modules, "aiohttp", _fake_module(fail=True, calls=calls))
    _run(bridge._forward_task(BASE, _payload(), "om_5"))
    assert len(calls) == 3
    assert spool.exists()
