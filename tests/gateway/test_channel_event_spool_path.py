"""Spool location contract (L3 fix: canonical ``seakoi-ops`` state directory).

The spool default once dropped the ``a`` in ``seakoi``, which left replayable
events in a directory no operator inspects or cleans. These tests pin three
things the fix card asked for:

1. with no ``SEAKOI_BRIDGE_SPOOL`` set, the path resolves under ``seakoi-ops``;
2. a spool file sitting in the misspelled directory is moved exactly once, and
   the move is a rename - line for line, no re-encoding, no duplication;
3. a failing move never raises: the legacy file stays put and the bridge keeps
   working, so a later spool use can try again.

Like the sibling spool tests these are synchronous and drive the coroutine
helpers through ``asyncio.run``; no network, no real C1, no pytest plugin.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Any, Optional

import pytest

from gateway import channel_event_bridge as bridge

SPOOL_ENV = "SEAKOI_BRIDGE_SPOOL"
BASE = "http://c1.invalid"
CANONICAL_REL = Path(".local") / "state" / "seakoi-ops" / "bridge-spool.jsonl"
LEGACY_REL = Path(".local") / "state" / "sekoi-ops" / "bridge-spool.jsonl"
SENTINEL = "SENTINEL_BODY_must_never_reach_a_log_line"


def _entry(message_id: str) -> dict[str, Any]:
    """One entry shaped exactly like ``_forward_task`` writes it."""
    key = f"feishu:app:{message_id}:message_created"
    return {
        "dedupeKey": key,
        "payload": {"dedupeKey": key, "text": SENTINEL, "eventId": "ce_pending"},
        "attempts": 3,
        "firstFailedAt": "2026-11-17T04:41:00.123Z",
    }


def _write_lines(path: Path, entries: list[dict[str, Any]]) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    body = "".join(json.dumps(e, ensure_ascii=False, sort_keys=True) + "\n" for e in entries)
    path.write_text(body, encoding="utf-8")
    return path


def _read_lines(path: Path) -> list[str]:
    if not path.is_file():
        return []
    return [line for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


@pytest.fixture()
def home(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Point HOME at a scratch tree and forget any explicit spool override."""
    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.delenv(SPOOL_ENV, raising=False)
    monkeypatch.setattr(bridge, "_legacy_spool_migrated", False, raising=False)
    # The real constants are user-relative defaults; keep their shape, retarget them
    # at the scratch HOME by leaving them untouched - expanduser reads the env above.
    return tmp_path


def test_default_path_is_the_canonical_state_dir(home: Path) -> None:
    resolved = Path(bridge._spool_path())
    assert resolved == home / CANONICAL_REL
    assert "seakoi-ops" in str(resolved)
    assert "sekoi-ops" not in str(resolved)


def test_env_override_still_wins(home: Path, monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    chosen = tmp_path / "operator-choice" / "spool.jsonl"
    monkeypatch.setenv(SPOOL_ENV, str(chosen))
    assert bridge._spool_path() == str(chosen)


def test_legacy_spool_is_moved_exactly_once(home: Path, caplog: pytest.LogCaptureFixture) -> None:
    legacy = home / LEGACY_REL
    entries = [_entry("om_legacy_1"), _entry("om_legacy_2")]
    _write_lines(legacy, entries)
    target = home / CANONICAL_REL
    assert not target.exists()

    with caplog.at_level(logging.INFO, logger="gateway.run"):
        bridge._migrate_legacy_spool_once(str(target))

    assert not legacy.exists(), "the misspelled file must not survive a successful move"
    assert _read_lines(target) == [
        json.dumps(e, ensure_ascii=False, sort_keys=True) for e in entries
    ], "migration is a rename: line for line, no rewrite"

    # Second call is a no-op, even if something lands in the legacy directory later.
    _write_lines(legacy, [_entry("om_after_1")])
    before = _read_lines(target)
    bridge._migrate_legacy_spool_once(str(target))
    assert _read_lines(target) == before
    assert legacy.is_file(), "the once-per-process flag must stop a second move"

    joined = "\n".join(record.getMessage() for record in caplog.records)
    assert "channel_event_spool_migrated" in joined
    assert SENTINEL not in joined, "migration logs name paths and counts, never a payload"
    assert "om_legacy_1" not in joined


def test_legacy_move_is_skipped_when_target_already_exists(home: Path) -> None:
    legacy = home / LEGACY_REL
    target = home / CANONICAL_REL
    _write_lines(legacy, [_entry("om_legacy_1")])
    _write_lines(target, [_entry("om_target_1")])

    bridge._migrate_legacy_spool_once(str(target))

    assert legacy.is_file(), "never overwrite or merge into a live spool"
    assert [json.loads(x)["dedupeKey"] for x in _read_lines(target)] == [
        "feishu:app:om_target_1:message_created"
    ]


def test_failed_move_never_raises_and_can_be_retried(
    home: Path, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    legacy = home / LEGACY_REL
    _write_lines(legacy, [_entry("om_legacy_1")])
    target = home / CANONICAL_REL

    def boom(*_args: Any, **_kwargs: Any) -> None:
        raise OSError("cross-device link")

    monkeypatch.setattr(bridge.os, "rename", boom)

    with caplog.at_level(logging.WARNING, logger="gateway.run"):
        bridge._migrate_legacy_spool_once(str(target))  # must not raise

    assert legacy.is_file()
    assert not target.exists()
    assert bridge._legacy_spool_migrated is False, "a failed move keeps retrying later"
    joined = "\n".join(record.getMessage() for record in caplog.records)
    assert "channel_event_spool_migrate_failed" in joined
    assert "OSError" in joined
    assert SENTINEL not in joined


async def _ok_post(base: str, payload: dict[str, Any], message_id: str) -> Optional[str]:
    return None


@pytest.mark.parametrize("entry_point", ["drain", "append"])
def test_first_spool_use_migrates_before_touching_the_file(
    home: Path, entry_point: str
) -> None:
    """Both mount points migrate ahead of any read of the canonical path."""
    legacy = home / LEGACY_REL
    target = home / CANONICAL_REL
    _write_lines(legacy, [_entry("om_legacy_1")])

    if entry_point == "drain":
        original_post = bridge._post_once
        bridge._post_once = _ok_post  # type: ignore[assignment]
        try:
            asyncio.run(bridge.drain_spool(BASE))
        finally:
            bridge._post_once = original_post  # type: ignore[assignment]
        assert not legacy.exists()
        assert target.is_file()
        assert _read_lines(target) == [], "the migrated entry is replayed, then dropped"
    else:
        asyncio.run(bridge._spool_append(_entry("om_new_1")))
        assert not legacy.exists(), "the append path migrates before it writes"
        keys = [json.loads(line)["dedupeKey"] for line in _read_lines(target)]
        assert keys == [
            "feishu:app:om_legacy_1:message_created",
            "feishu:app:om_new_1:message_created",
        ], "legacy entries keep their order: oldest first"


def test_migration_does_not_invent_a_file_when_nothing_is_legacy(home: Path) -> None:
    target = Path(bridge._spool_path())
    bridge._migrate_legacy_spool_once(str(target))
    assert not target.exists()
    assert not (home / LEGACY_REL).exists()
