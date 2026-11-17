"""L7 V1 group-@ gate: the bridge must forward Feishu ``content.mentions`` to C1.

Without mentions in the payload C1 can never see a group @ and the V1 gate
fails closed to ``ignored`` for every group message. Contract pinned here:

- ``_mentions`` reads ``raw["event"]["message"]["mentions"]`` first, then the
  flat ``raw["message"]["mentions"]``; never raises, ``[]`` when absent or
  oddly shaped.
- ``externalId`` = first non-empty of ``id.open_id`` / ``id.union_id`` /
  ``id.user_id``; entries without one are dropped (C1 requires externalId).
  ``name`` passes through only when non-empty.
- ``content.mentions`` appears only when non-empty; otherwise the body stays
  byte-identical to the pre-mentions shape (downstream contract tests pin it).

Pure payload mapping only — SimpleNamespace events (style of
test_channel_event_forward_once.py), no network, no gateway runner.
"""

from types import SimpleNamespace

from gateway.channel_event_bridge import _mentions, build_payload

SENDER_OPEN_ID = "ou_13307adaffb2fce3ef9a99bf2af39c1e"
TEXT = "@_user_1 hello bridge"


def _source() -> SimpleNamespace:
    return SimpleNamespace(
        user_id=SENDER_OPEN_ID,
        user_id_alt="on_union_sender",
        chat_type="group",
        chat_id="oc_0adeac8168d48d413693f1e64a330db5",
        is_bot=False,
    )


def _content(raw_message) -> dict:
    event = SimpleNamespace(
        message_id="om_mention_1",
        text=TEXT,
        timestamp=None,
        raw_message=raw_message,
    )
    payload = build_payload(event, _source())
    assert payload is not None, "mandatory identifiers present => payload built"
    return payload["content"]


def _nested(raw_mentions) -> dict:
    raw = {
        "sender": {"sender_id": {"open_id": SENDER_OPEN_ID}},
        "event": {"message": {"mentions": raw_mentions}},
    }
    return raw


def test_nested_path_two_mentions():
    """open_id wins over union_id/user_id; user_id-only entry still maps."""
    raw = _nested(
        [
            {
                "key": "@_user_1",
                "id": {
                    "open_id": "ou_alice",
                    "union_id": "on_alice",
                    "user_id": "alice",
                },
                "name": "Alice",
            },
            {"key": "@_user_2", "id": {"user_id": "bob"}, "name": "Bob"},
        ]
    )
    assert _content(raw)["mentions"] == [
        {"externalId": "ou_alice", "name": "Alice"},
        {"externalId": "bob", "name": "Bob"},
    ]


def test_flat_path_mentions():
    """raw["message"]["mentions"] hits when the nested path is absent; union_id
    is the second-priority identifier."""
    raw = {
        "sender": {"sender_id": {"open_id": SENDER_OPEN_ID}},
        "message": {"mentions": [{"id": {"union_id": "on_carol"}, "name": "Carol"}]},
    }
    assert _content(raw)["mentions"] == [{"externalId": "on_carol", "name": "Carol"}]


def test_no_mentions_legacy_body_byte_compatible():
    """Absent / empty-list mentions => no key at all; content == {"text": ...}."""
    content = _content({"sender": {"sender_id": {"open_id": SENDER_OPEN_ID}}})
    assert "mentions" not in content
    assert content == {"text": TEXT}
    assert "mentions" not in _content(_nested([]))


def test_entries_without_usable_id_dropped():
    """Missing id dict, empty id dict, and empty-string ids are all discarded;
    a blank name omits the name key but keeps the entry."""
    raw = _nested(
        [
            {"name": "Ghost"},
            {"id": {}, "name": "NoIds"},
            {"id": {"open_id": "", "union_id": "", "user_id": ""}, "name": "Blanks"},
            "not-a-dict",
            {"id": {"open_id": "ou_real"}, "name": ""},
        ]
    )
    assert _content(raw)["mentions"] == [{"externalId": "ou_real"}]


def test_odd_shapes_never_raise():
    """mentions non-list / None / malformed containers => [] from _mentions, and
    the payload still builds without the mentions key."""
    odd_events = [
        {"event": {"message": {"mentions": "oops"}}},
        {"message": {"mentions": None}},
        {"message": {"mentions": {"open_id": "ou_x"}}},  # dict, not list
        {"event": "not-a-dict"},
        {"event": {"message": "not-a-dict"}},
        {},
        None,
    ]
    for raw in odd_events:
        assert _mentions(SimpleNamespace(raw_message=raw)) == []
        assert "mentions" not in _content(raw)
