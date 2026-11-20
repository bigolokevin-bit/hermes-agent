"""L7 裁定 (2026-11-20): a paused session must never post a pause prompt into a GROUP chat.

Observed in the Feishu group: ``⏸️ This conversation is paused: ... Send /discard or
/reset`` — English pause copy plus slash advice, addressed to the whole room. Contract
pinned here (sync tests + ``asyncio.run``, spy on ``discard_lost_turns``, no network,
no daemon — in the style of test_messaging_discard_reach.py):

- ``_pause_outcome_for_chat`` on ``chat_type == "group"``: calls ``discard_lost_turns``
  exactly once per pause admission (the existing /discard path that lets saved followers
  run), logs ``paused_session_auto_discarded: chat=<id> reason=group_chat``, and returns
  ``None`` — for every reason, transient ones included.
- DM (and anything not group): no discard call, ``pause_notice`` semantics intact
  (once per episode via ``pause_notified``).
- DM copy is Chinese and free of slash commands; the shared paused marker is
  ``这条会话已暂停`` (test_native_pause_notice.PAUSE_MARKER).
"""

import asyncio
from types import SimpleNamespace

import pytest

import gateway.session_ingress as ingress
import gateway.slash_commands_session as slash_sessions
from gateway.session_contract import SessionRef

REF = SessionRef('p', 's')


def _source(chat_type, chat_id):
    return SimpleNamespace(chat_type=chat_type, chat_id=chat_id,
                           platform=SimpleNamespace(value='feishu'))


GROUP = _source('group', 'oc_0adeac8168d48d413693f1e64a330db5')
DM = _source('dm', 'u_private_1')


def _authority():
    live = SimpleNamespace(pause_notified=False, source=DM)
    return SimpleNamespace(sessions={'s': live}), live


@pytest.fixture
def discard_calls(monkeypatch):
    """Spy the auto-discard leg: the wrapper re-imports the name per call, so
    patching the module attribute is what production would execute."""
    calls = []

    async def fake(authority, session_id):
        calls.append(session_id)
        return 'discarded 1 lost turn'

    monkeypatch.setattr(slash_sessions, "discard_lost_turns", fake)
    return calls


ALL_REASONS = ('unknown_execution', 'runtime_draining', 'session_busy',
               'stale_generation')  # the last falls to the cause-fallback copy


# --- ① group: discard once, no notice, log line --------------------------------


@pytest.mark.parametrize('reason', ALL_REASONS)
def test_group_discards_once_and_returns_no_notice(reason, discard_calls, caplog):
    authority, live = _authority()
    with caplog.at_level("INFO", logger="gateway.session_ingress"):
        out = asyncio.run(ingress._pause_outcome_for_chat(authority, REF, reason, GROUP))
    assert out is None, "no pause copy may ever be sent into a group chat"
    assert discard_calls == ['s'], "exactly one auto-discard per paused admission"
    assert (
        "paused_session_auto_discarded: chat=oc_0adeac8168d48d413693f1e64a330db5"
        " reason=group_chat" in caplog.text
    )
    assert not live.pause_notified, "group path never touches the DM notice latch"


def test_group_without_chat_id_logs_session(discard_calls, caplog):
    authority, _live = _authority()
    source = SimpleNamespace(chat_type='group', chat_id=None)
    with caplog.at_level("INFO", logger="gateway.session_ingress"):
        asyncio.run(ingress._pause_outcome_for_chat(authority, REF, 'unknown_execution', source))
    assert "paused_session_auto_discarded: chat=s reason=group_chat" in caplog.text


# --- ② DM: notice kept, Chinese, command-free, no discard ----------------------


@pytest.mark.parametrize('reason', ALL_REASONS)
def test_dm_notice_is_chinese_without_slashes(reason, discard_calls):
    authority, _live = _authority()
    out = asyncio.run(ingress._pause_outcome_for_chat(authority, REF, reason, DM))
    assert isinstance(out, str) and out, "DM keeps the once-per-episode notice"
    assert any('\u4e00' <= ch <= '\u9fff' for ch in out), out
    for slash in ('/discard', '/reset', '/hermes'):
        assert slash not in out, (reason, out)
    assert discard_calls == [], "the DM branch must not auto-discard anything"


def test_dm_unknown_execution_names_continue_and_restart_words():
    authority, _live = _authority()
    out = asyncio.run(ingress._pause_outcome_for_chat(
        authority, REF, 'unknown_execution', DM))
    assert '这条会话已暂停' in out and '「继续」' in out and '重启' in out, out
    # the shared marker also appears on the cause-fallback copy (PAUSE_MARKER pin)
    authority, _live = _authority()
    cause = asyncio.run(ingress._pause_outcome_for_chat(authority, REF, 'whatever', DM))
    assert '这条会话已暂停' in cause, cause


def test_pause_latch_still_one_notice_per_dm_episode(discard_calls):
    authority, _live = _authority()
    first = asyncio.run(ingress._pause_outcome_for_chat(
        authority, REF, 'unknown_execution', DM))
    second = asyncio.run(ingress._pause_outcome_for_chat(
        authority, REF, 'unknown_execution', DM))
    assert isinstance(first, str) and second is None, "unchanged once-per-episode latch"
    assert discard_calls == []


def test_missing_source_is_not_group():
    """No/odd source shape (e.g. internal admission) must not hit the group leg."""
    authority, _live = _authority()
    for source in (None, SimpleNamespace(), object()):
        authority, _live = _authority()  # fresh latch per source: each is its own episode
        out = asyncio.run(ingress._pause_outcome_for_chat(
            authority, REF, 'unknown_execution', source))
        assert isinstance(out, str), source
