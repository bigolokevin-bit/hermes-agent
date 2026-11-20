"""V1: the C1 forward is a per-event one-shot latch, not a per-drain-marker gate.

Root cause (L0 disk-verified): the intake-only guard ``not executing_admission.get()``
never ran the forward for a busy session — intake parked before this block and the
durable-FIFO drain re-entry arrived with the marker set — so the bridge was never
called at all. The guard is now ``not getattr(event, "_c1_forwarded", False)`` with the
latch set as the block's first statement: every path (intake or drain) forwards at
most once, and a drain-only admission still forwards. Flag off stays the literal
2-arg fire-and-forget ``forward_inbound_event(event, source)``.

Harness copied from test_channel_event_authoritative.py (bare runner + asyncio.run);
both bridge entrypoints are replaced by recorders, so nothing touches the network or
the spool. Production imports them inside the guarded block at call time, which is
why patching the module attributes is what binds.
"""

import asyncio
from types import SimpleNamespace

import pytest

import gateway.channel_event_bridge as bridge
from gateway.session import Platform, SessionSource
from gateway.session_ingress import executing_admission

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


def _event(message_id: str):
    return SimpleNamespace(
        source=_source(),
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


@pytest.fixture
def env(tmp_path, monkeypatch):
    """Flag-free environment: the gate stays off unless a test turns it on."""
    monkeypatch.setenv("SEAKOI_C1_BASE_URL", BASE)
    monkeypatch.setenv("SEAKOI_BRIDGE_SPOOL", str(tmp_path))
    monkeypatch.delenv(FLAG, raising=False)
    return tmp_path


@pytest.fixture
def calls(monkeypatch):
    """Recorder for both bridge entrypoints: entries are (args, kwargs)."""
    seen = {"forward": [], "verdict": []}

    def fake_forward(*args, **kwargs):
        seen["forward"].append((args, kwargs))

    async def fake_verdict(*args, **kwargs):
        seen["verdict"].append((args, kwargs))
        return ("fallback", {})

    monkeypatch.setattr(bridge, "forward_inbound_event", fake_forward)
    monkeypatch.setattr(bridge, "forward_and_await_verdict", fake_verdict)
    return seen


def _admit(runner, event):
    async def go():
        return await runner._hm_admit_event(event)

    return asyncio.run(go())


def _admit_as_drain_replay(runner, event):
    """The busy path: durable-FIFO drain re-entry with ``executing_admission`` set."""

    async def go():
        token = executing_admission.set(True)
        try:
            return await runner._hm_admit_event(event)
        finally:
            executing_admission.reset(token)

    return asyncio.run(go())


def test_drain_reentry_forwards_unlatched_event(env, runner, calls):
    """The V1 bug: a busy session admits ONLY on the drain pass — it must still POST."""
    event = _event("om_drain")

    assert _admit_as_drain_replay(runner, event) is not None

    assert len(calls["forward"]) == 1, "drain-only admission forwards exactly once"
    assert calls["forward"][0][0][0] is event


def test_intake_admission_forwards_once(env, runner, calls):
    event = _event("om_intake")

    assert _admit(runner, event) is not None

    assert len(calls["forward"]) == 1
    assert event._c1_forwarded is True


def test_second_drain_replay_of_latched_event_stays_at_one(env, runner, calls):
    """intake + two drain re-entries of the SAME event object: the latch caps at one."""
    event = _event("om_dup")

    assert _admit(runner, event) is not None
    assert _admit_as_drain_replay(runner, event) is not None
    assert _admit_as_drain_replay(runner, event) is not None

    assert len(calls["forward"]) == 1, "S7b-2: never a second POST for one event"


def test_flag_off_is_the_two_positional_args_call(env, runner, calls):
    """Gate off: exactly ``forward_inbound_event(event, source)``, verdict path untouched."""
    event = _event("om_off")

    admitted = _admit(runner, event)

    assert admitted is not None
    assert len(calls["forward"]) == 1
    args, kwargs = calls["forward"][0]
    assert args == (event, event.source) and not kwargs
    assert calls["verdict"] == []
