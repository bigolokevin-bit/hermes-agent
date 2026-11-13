"""P1-2: one C1 forward POST per admitted Feishu message — intake path only, never the FIFO replay.

Root cause (disk-verified): ``_hm_admit_event`` forwarded at intake, then the durable-FIFO
drain re-entered ``_handle_message`` for the SAME admitted message (with
``executing_admission`` set) and forwarded a second time — C1 answered the replay with
``duplicate=true``. The fix gates the forward on ``not executing_admission.get()``.

The C1-side dedupeKey remains the backstop for genuine re-admissions (two independent
deliveries of one message_id still produce two forwards, by design); masking is NOT done
by keying an in-process TTL cache.
"""

import asyncio
from types import SimpleNamespace

import pytest

from gateway.session import Platform, SessionSource
from gateway.session_ingress import executing_admission

CHAT = "oc_0adeac8168d48d413693f1e64a330db5"


def _source() -> SessionSource:
    return SessionSource(
        platform=Platform.FEISHU,
        chat_id=CHAT,
        chat_type="group",
        user_id="ou_13307adaffb2fce3ef9a99bf2af39c1e",
        user_name="kevin",
    )


def _event(message_id: str):
    return SimpleNamespace(
        source=_source(),
        internal=False,
        _bot_loop_admitted=True,  # skip the bot-chain counters; not under test
        message_id=message_id,
        text="hello",
        timestamp=None,
        raw_message={"sender": {"sender_id": {"open_id": "ou_13307adaffb2fce3ef9a99bf2af39c1e"}}},
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
def forwards(monkeypatch):
    """Count bridge forwards by replacing the module attribute the intake hook resolves."""
    import gateway.channel_event_bridge as bridge

    seen = []
    monkeypatch.setattr(bridge, "forward_inbound_event",
                        lambda event, source: seen.append(event.message_id))
    return seen


def _admit(runner, event):
    async def go():
        return await runner._hm_admit_event(event)

    return asyncio.run(go())


def _admit_as_replay(runner, event):
    async def go():
        token = executing_admission.set(True)
        try:
            return await runner._hm_admit_event(event)
        finally:
            executing_admission.reset(token)

    return asyncio.run(go())


def test_single_admission_forwards_once(runner, forwards):
    assert _admit(runner, _event("om_a")) is not None
    assert forwards == ["om_a"]


def test_fifo_replay_does_not_reforward(runner, forwards):
    """The exact production pair: intake admission + drain replay of the same message."""
    event = _event("om_dup")
    assert _admit(runner, event) is not None
    assert _admit_as_replay(runner, event) is not None
    assert forwards == ["om_dup"], "replay pass must not POST a second time"


def test_replay_only_still_forwarded_by_dedupe_contract(runner, forwards):
    """Two genuine admissions of one message_id both forward (C1 dedupeKey answers
    duplicate=true); the gate must not suppress real re-deliveries."""
    assert _admit(runner, _event("om_x")) is not None
    assert _admit(runner, _event("om_x")) is not None
    assert forwards == ["om_x", "om_x"]


def test_distinct_messages_each_forward(runner, forwards):
    assert _admit(runner, _event("om_1")) is not None
    assert _admit(runner, _event("om_2")) is not None
    assert _admit_as_replay(runner, _event("om_3")) is not None
    assert forwards == ["om_1", "om_2"]


def test_internal_event_never_forwards(runner, forwards):
    event = _event("om_int")
    event.internal = True
    assert _admit(runner, event) is not None
    assert forwards == []
