"""C1 authoritative gate: a Feishu group turn is skipped only when C1 took the event.

Contract pinned here (env ``SEAKOI_C1_AUTHORITATIVE``, default off):
- 2xx on the FIRST bridge POST → admission returns None (no local agent turn) and
  ``event._c1_authoritative == "suppressed"``; one WARNING names message_id/event_id.
- Any non-2xx → ``"fallback"``: the local reply continues, logged as post_failed.
- No verdict inside ``_AUTHORITATIVE_TIMEOUT_SECONDS`` → ``"timeout"``: same fail-open.
- Flag unset, DM, other platforms, FIFO replay → the literal 2-arg fire-and-forget
  ``forward_inbound_event(event, source)`` of today, with no verdict attribute set.

Harness copied from test_channel_event_forward_once.py (bare runner + asyncio.run);
``_post_once`` is replaced by a scripted fake so nothing touches the network, and the
spool points at ``tmp_path`` so nothing writes to a real home.
"""

import asyncio
from types import SimpleNamespace

import pytest

import gateway.channel_event_bridge as bridge
from gateway.session import Platform, SessionSource

CHAT = "oc_0adeac8168d48d413693f1e64a330db5"
BASE = "http://127.0.0.1:9"
FLAG = "SEAKOI_C1_AUTHORITATIVE"


def _source(chat_type="group", platform=Platform.FEISHU) -> SessionSource:
    return SessionSource(
        platform=platform,
        chat_id=CHAT,
        chat_type=chat_type,
        user_id="ou_sender",
        user_name="Sender",
    )


def _event(message_id: str, chat_type="group"):
    return SimpleNamespace(
        source=_source(chat_type),
        internal=False,
        _bot_loop_admitted=True,  # skip the bot-chain counters; not under test
        message_id=message_id,
        text="hello",
        timestamp=None,
        raw_message={"sender": {"sender_id": {"open_id": "ou_sender"}}},
        get_command=lambda: None,
    )


@pytest.fixture
def runner(monkeypatch):
    from gateway.run import GatewayRunner

    runner = object.__new__(GatewayRunner)
    runner._scale_to_zero_note_real_inbound = lambda: None

    async def _hook(event, source):
        return event

    runner._hm_pre_gateway_dispatch_hook = _hook
    runner._is_user_authorized_for_source = lambda source: True
    runner._admit_bot_message_for_source = lambda source: True
    runner._admit_bot_chain = lambda event: True
    return runner


@pytest.fixture(autouse=True)
def _reset_module_state():
    bridge._drain_task = None
    yield
    bridge._drain_task = None


@pytest.fixture
def env(tmp_path, monkeypatch):
    """Configured bridge, flag-free: each test turns the gate on it needs."""
    monkeypatch.setenv("SEAKOI_C1_BASE_URL", BASE)
    monkeypatch.setenv("SEAKOI_BRIDGE_SPOOL", str(tmp_path))
    monkeypatch.delenv(FLAG, raising=False)
    return tmp_path


def _admit(runner, event):
    async def go():
        return await runner._hm_admit_event(event)

    return asyncio.run(go())


def _verdict(state, event_id=None, duplicate=False):
    return {"ok": state, "event_id": event_id, "duplicate": duplicate}


def test_2xx_suppresses_local_turn(env, runner, monkeypatch, caplog):
    async def fake_post(base, payload, message_id, info=None):
        assert message_id == "om_gate"
        if info is not None:
            info["event_id"] = "evt_gate"
            info["duplicate"] = False

    monkeypatch.setattr(bridge, "_post_once", fake_post)
    monkeypatch.setenv(FLAG, "1")
    event = _event("om_gate")

    with caplog.at_level("WARNING", logger="gateway.run"):
        admitted = _admit(runner, event)

    assert admitted is None, "C1 owns this event: no local agent turn"
    assert event._c1_authoritative == "suppressed"
    assert (
        "local_reply_suppressed: message_id=om_gate event_id=evt_gate"
        " reason=c1_authoritative" in caplog.text
    )


def test_non_2xx_keeps_local_reply(env, runner, monkeypatch, caplog):
    async def fake_post(base, payload, message_id, info=None):
        return "status=500 body=boom"

    monkeypatch.setattr(bridge, "_post_once", fake_post)
    monkeypatch.setattr(bridge, "_RETRY_DELAYS", (0.01, 0.02))
    monkeypatch.setenv(FLAG, "true")
    event = _event("om_gate")

    with caplog.at_level("WARNING", logger="gateway.run"):
        admitted = _admit(runner, event)

    assert admitted is not None, "fail-open: the local reply still runs"
    assert event._c1_authoritative == "fallback"
    assert "local_reply_fallback: message_id=om_gate reason=post_failed" in caplog.text


def test_no_verdict_in_budget_keeps_local_reply(env, runner, monkeypatch, caplog):
    release = asyncio.Event()  # never set: the first attempt never answers

    async def fake_post(base, payload, message_id, info=None):
        await release.wait()

    monkeypatch.setattr(bridge, "_post_once", fake_post)
    monkeypatch.setattr(bridge, "_AUTHORITATIVE_TIMEOUT_SECONDS", 0.05)
    monkeypatch.setenv(FLAG, "1")
    event = _event("om_gate")

    with caplog.at_level("WARNING", logger="gateway.run"):
        admitted = _admit(runner, event)

    assert admitted is not None, "a slow C1 must never swallow the message"
    assert event._c1_authoritative == "timeout"
    assert "local_reply_fallback: message_id=om_gate reason=timeout" in caplog.text


def test_flag_unset_is_the_two_arg_fire_and_forget_of_today(env, runner, monkeypatch):
    seen = []

    def fake_forward(event, source):
        seen.append(event.message_id)

    def never_awaited(event, source):
        raise AssertionError("gate off: the verdict path must not be reached")

    monkeypatch.setattr(bridge, "forward_inbound_event", fake_forward)
    monkeypatch.setattr(bridge, "forward_and_await_verdict", never_awaited)
    event = _event("om_off")

    admitted = _admit(runner, event)

    assert admitted is not None
    assert seen == ["om_off"], "called with exactly the two positional args"
    assert not hasattr(event, "_c1_authoritative")


def test_gate_inactive_for_dm_and_other_platforms(env, runner, monkeypatch):
    seen = []

    def fake_forward(event, source):
        seen.append(event.message_id)

    monkeypatch.setattr(bridge, "forward_inbound_event", fake_forward)
    monkeypatch.setenv(FLAG, "1")
    dm = _event("om_dm", chat_type="dm")

    admitted = _admit(runner, dm)

    assert admitted is not None
    assert seen == ["om_dm"], "DMs are never gated"
    assert not hasattr(dm, "_c1_authoritative")


def test_gate_active_matrix(env, monkeypatch):
    monkeypatch.setenv("SEAKOI_C1_BASE_URL", BASE)
    feishu_group = _source()
    monkeypatch.setenv(FLAG, "1")
    assert bridge.authoritative_gate_active(feishu_group) is True
    assert bridge.authoritative_gate_active(_source(chat_type="dm")) is False
    assert (
        bridge.authoritative_gate_active(
            SimpleNamespace(platform=SimpleNamespace(value="webchat"), chat_type="group")
        )
        is False
    )
    monkeypatch.delenv(FLAG)
    assert bridge.authoritative_gate_active(feishu_group) is False
    monkeypatch.setenv(FLAG, "1")
    monkeypatch.delenv("SEAKOI_C1_BASE_URL")
    assert bridge.authoritative_gate_active(feishu_group) is False
    assert bridge.authoritative_gate_active(None) is False


def test_skipped_forward_resolves_waiter_at_once(env):
    """A forward that will never POST answers the gate immediately (no timeout burn)."""

    async def go():
        loop = asyncio.get_running_loop()
        fut = loop.create_future()
        event = _event("om_internal")
        event.internal = True
        bridge.forward_inbound_event(event, _source(), first_result=fut)
        return await asyncio.wait_for(fut, 0.5)

    assert asyncio.run(go()) == _verdict(False)
