"""L7: a C1 outage must not drop channel events — bounded retry plus a local spool.

Production evidence (2026-11-17 12:41): one real group message was lost because the
bridge was fire-and-forget (300 ms, no retry, no spool) and C1 answered with
``ClientConnectorError``. Contract pinned here:

- ``_post_with_retry`` makes at most 3 attempts, sleeping ``_RETRY_DELAYS`` between
  them, and returns True as soon as one succeeds without touching the spool.
- ``_forward_task`` appends exactly one JSON line only after the third failure:
  ``{dedupeKey, payload, attempts, firstFailedAt}`` (UTC, millisecond, ``Z``).
- ``drain_spool`` re-posts each stored payload with its original dedupeKey, removes
  delivered lines, keeps failures, and drops corrupt lines instead of raising.
- The spool is capped at 200 lines (oldest dropped, count-only warning), writes are
  atomic, and no log line may carry message text, open_id or a token.

No network: ``_post_once`` is replaced by a scripted fake, or ``aiohttp`` by a fake
module for the real-transport classification cases. Sync tests + ``asyncio.run``,
in the style of test_channel_event_forward_once.py (no pytest-asyncio needed).
"""

import asyncio
import json
import re
import sys
from types import SimpleNamespace

import pytest

import gateway.channel_event_bridge as bridge

SPOOL_ENV = "SEAKOI_BRIDGE_SPOOL"
BASE = "http://c1.invalid"
TEXT = "SENTINEL_BODY_must_never_reach_a_log_line"
TOKEN = "SENTINEL_INTERNAL_TOKEN"
ISO_Z = re.compile(r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$")


def _run(coro):
    return asyncio.run(coro)


def _payload(message_id="om_1", text=TEXT):
    return {
        "eventId": "ce_pending",
        "dedupeKey": f"feishu:app:{message_id}:message_created",
        "externalMessageId": message_id,
        "content": {"text": text},
    }


def _entry(payload, attempts=3, first_failed_at="2026-11-17T04:41:00.123Z"):
    return {
        "dedupeKey": payload["dedupeKey"],
        "payload": payload,
        "attempts": attempts,
        "firstFailedAt": first_failed_at,
    }


def _write_lines(path, entries):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "".join(json.dumps(entry) + "\n" for entry in entries), encoding="utf-8"
    )


def _read_entries(path):
    return [json.loads(line) for line in path.read_text().splitlines() if line]


class _Poster:
    """Scripted ``_post_once``: pops one reason per call (None = delivered)."""

    def __init__(self, outcomes=()):
        self.calls = []
        self._outcomes = list(outcomes)

    async def __call__(self, base, payload, message_id):
        self.calls.append((base, payload.get("dedupeKey"), message_id))
        return self._outcomes.pop(0) if self._outcomes else None


@pytest.fixture(autouse=True)
def _reset_module_state():
    bridge._drain_task = None
    yield
    bridge._drain_task = None


@pytest.fixture
def spool(tmp_path, monkeypatch):
    path = tmp_path / "state" / "bridge-spool.jsonl"
    monkeypatch.setenv(SPOOL_ENV, str(path))
    monkeypatch.setenv("SEAKOI_C1_INTERNAL_TOKEN", TOKEN)
    monkeypatch.setattr(bridge, "_RETRY_DELAYS", (0.01, 0.02))
    return path


def test_contract_defaults():
    """The shipped knobs, independent of the fast-sleep patching in the fixture."""
    assert bridge._RETRY_DELAYS == (0.5, 1.0)
    assert bridge._MAX_ATTEMPTS == 3
    assert bridge._TOTAL_BUDGET_SECONDS <= 4.0
    assert bridge._SPOOL_CAP == 200
    assert "bridge-spool.jsonl" in bridge._SPOOL_DEFAULT_PATH


def test_second_attempt_success_writes_no_spool(spool, monkeypatch):
    poster = _Poster(["ClientConnectorError", None])
    monkeypatch.setattr(bridge, "_post_once", poster)

    async def go():
        loop = asyncio.get_running_loop()
        started = loop.time()
        delivered = await bridge._post_with_retry(BASE, _payload(), "om_1")
        return delivered, loop.time() - started

    delivered, elapsed = _run(go())
    assert delivered is True
    assert len(poster.calls) == 2
    assert elapsed >= 0.01, "the retry slept before re-attempting"
    assert not spool.exists()


def test_three_failures_write_one_spool_line(spool, monkeypatch):
    payload = _payload()
    poster = _Poster(["ClientConnectorError"] * 3)
    monkeypatch.setattr(bridge, "_post_once", poster)

    _run(bridge._forward_task(BASE, payload, "om_1"))

    assert len(poster.calls) == 3, "exactly three attempts"
    entries = _read_entries(spool)
    assert len(entries) == 1
    entry = entries[0]
    assert set(entry) == {"dedupeKey", "payload", "attempts", "firstFailedAt"}
    assert entry["dedupeKey"] == payload["dedupeKey"]
    assert entry["payload"] == payload
    assert entry["attempts"] == 3
    assert ISO_Z.match(entry["firstFailedAt"])


def test_drain_replays_with_original_key_and_removes_lines(spool, monkeypatch):
    payload_a, payload_b = _payload("om_a"), _payload("om_b")
    _write_lines(spool, [_entry(payload_a), _entry(payload_b)])
    poster = _Poster([None, None])
    monkeypatch.setattr(bridge, "_post_once", poster)

    _run(bridge.drain_spool(BASE))

    assert [call[1] for call in poster.calls] == [
        payload_a["dedupeKey"],
        payload_b["dedupeKey"],
    ], "replays reuse the stored dedupeKey (C1 is the dedupe authority)"
    assert _read_entries(spool) == []


def test_drain_keeps_entries_that_still_fail(spool, monkeypatch):
    payload_a, payload_b = _payload("om_a"), _payload("om_b")
    stored_a, stored_b = _entry(payload_a), _entry(payload_b)
    _write_lines(spool, [stored_a, stored_b])
    poster = _Poster([None, "ClientConnectorError"])
    monkeypatch.setattr(bridge, "_post_once", poster)

    _run(bridge.drain_spool(BASE))

    assert _read_entries(spool) == [stored_b], "failed line stays, byte-identical"


def test_corrupt_lines_dropped_without_raising(spool, monkeypatch, caplog):
    payload = _payload("om_good")
    good = _entry(payload)
    spool.parent.mkdir(parents=True, exist_ok=True)
    spool.write_text(
        "{not json\n"
        + json.dumps({"payload": payload})  # no dedupeKey
        + "\n"
        + json.dumps(
            {"dedupeKey": "k_mismatch", "payload": payload}
        )  # payload key differs
        + "\n"
        + json.dumps(good)
        + "\n",
        encoding="utf-8",
    )
    poster = _Poster([None])
    monkeypatch.setattr(bridge, "_post_once", poster)

    with caplog.at_level("INFO", logger="gateway.run"):
        _run(bridge.drain_spool(BASE))  # must not raise

    assert len(poster.calls) == 1
    assert _read_entries(spool) == []
    assert "bridge_spool_corrupt_lines_dropped: count=3" in caplog.text


def test_spool_cap_drops_oldest(spool, monkeypatch, caplog):
    filled = [_entry(_payload(f"om_{i:03d}")) for i in range(200)]
    _write_lines(spool, filled)
    newest = _payload("om_new")
    poster = _Poster(["ClientConnectorError"] * 3)
    monkeypatch.setattr(bridge, "_post_once", poster)

    with caplog.at_level("INFO", logger="gateway.run"):
        _run(bridge._forward_task(BASE, newest, "om_new"))

    entries = _read_entries(spool)
    assert len(entries) == 200
    assert entries[0]["dedupeKey"] == filled[1]["dedupeKey"], "oldest dropped"
    assert entries[-1]["dedupeKey"] == newest["dedupeKey"]
    assert "bridge_spool_overflow: dropped=1 cap=200" in caplog.text
    assert TEXT not in caplog.text, "the overflow warning counts lines only"


def test_logs_carry_no_text_and_no_credentials(spool, monkeypatch, caplog):
    monkeypatch.setattr(bridge, "_post_once", _Poster(["ClientConnectorError"] * 3))

    with caplog.at_level("DEBUG", logger="gateway.run"):
        _run(bridge._forward_task(BASE, _payload(), "om_1"))

    assert "channel_event_post_failed: message_id=om_1 attempts=3" in caplog.text
    assert "error=ClientConnectorError" in caplog.text
    assert TEXT not in caplog.text
    assert TOKEN not in caplog.text
    assert "ou_" not in caplog.text, "no open_id on any line"


class _FailingSession:
    def __init__(self, timeout=None):
        self.timeout = timeout

    async def __aenter__(self):
        raise OSError("connection refused")

    async def __aexit__(self, *exc_info):
        return False


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


class _Session:
    def __init__(self, response):
        self._response = response

    def __call__(self, timeout=None):
        return self

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc_info):
        return False

    def post(self, url, json=None, headers=None):
        return self._response


def _install_fake_aiohttp(monkeypatch, session_factory):
    module = SimpleNamespace(
        ClientTimeout=lambda total: SimpleNamespace(total=total),
        ClientSession=session_factory,
    )
    monkeypatch.setitem(sys.modules, "aiohttp", module)


def test_real_transport_reports_reason_without_secrets(spool, monkeypatch, caplog):
    _install_fake_aiohttp(monkeypatch, _FailingSession)

    with caplog.at_level("INFO", logger="gateway.run"):
        reason = _run(bridge._post_once(BASE, _payload(), "om_1"))

    assert reason == "OSError"
    assert TOKEN not in caplog.text
    assert TEXT not in caplog.text


def test_real_transport_classifies_http_status(spool, monkeypatch):
    _install_fake_aiohttp(monkeypatch, _Session(_Response(503, {"code": "down"})))
    assert _run(bridge._post_once(BASE, _payload(), "om_1")) == "status=503"


def test_new_event_is_not_delayed_by_a_slow_drain(spool, monkeypatch):
    started = []
    release = asyncio.Event()  # bound on first use, inside the test's loop
    poster = _Poster([None])
    monkeypatch.setattr(bridge, "drain_spool", _slow_drain(started, release))
    monkeypatch.setattr(bridge, "_post_once", poster)
    monkeypatch.setenv("SEAKOI_C1_BASE_URL", BASE)

    async def go():
        loop = asyncio.get_running_loop()
        before = loop.time()
        bridge.forward_inbound_event(_event("om_fast"), _source())
        assert loop.time() - before < 0.05, "admission stays sync and cheap"
        for _ in range(100):
            if poster.calls:
                break
            await asyncio.sleep(0.01)
        assert poster.calls, "the new event posts while the drain is still blocked"
        assert started == [BASE], "the drain was kicked as well"
        release.set()
        await asyncio.sleep(0)

    _run(go())


def _slow_drain(started, release):
    async def drain(base):
        started.append(base)
        await release.wait()

    return drain


def _source():
    return SimpleNamespace(
        platform=SimpleNamespace(value="feishu"),
        chat_id="oc_chat",
        chat_type="group",
        user_id="ou_sender",
        user_id_alt=None,
        is_bot=False,
    )


def _event(message_id):
    return SimpleNamespace(
        message_id=message_id,
        text=TEXT,
        timestamp=None,
        raw_message={"sender": {"sender_id": {"open_id": "ou_sender"}}},
        internal=False,
        is_bot=False,
    )