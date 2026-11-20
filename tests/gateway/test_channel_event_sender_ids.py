"""L7 hop2: the bridge must read the Feishu sender open_id from SDK shapes too.

The websocket dispatcher stores the lark event *object* in ``raw_message``; the
old dict-only read in ``_sender_ids`` skipped every branch there, so the
payload fell back to ``source.user_id`` and C1 recognition never matched the
person (``externalId=415g466e`` instead of the ``ou_...`` open_id the link
carries). Contract pinned here (style of test_channel_event_mentions.py):

- ``_sender_ids`` resolves ``sender.sender_id.{open_id,union_id,user_id}`` from
  dicts *and* SDK model objects, nested ``raw.event.sender`` first then the
  flat ``raw.sender``; never raises, missing shapes yield ``None``.
- ``payload.sender.externalId`` is the open_id whenever one arrives; the
  ``source.user_id`` fallback stays for events with no sender id at all.
- The plain-dict (webhook) mapping and the ``source_user_id`` /
  ``source_user_id_alt`` keys are unchanged.

Pure payload mapping only — SimpleNamespace events, no network, no runner.
"""

from types import SimpleNamespace

from gateway.channel_event_bridge import _sender_ids, build_payload

OPEN_ID = "ou_13307adaffb2fce3ef9a99bf2af39c1e"
UNION_ID = "on_58bce7c9c2b0a4b0f7d0b1a2c3d4e5f6"
SID_USER_ID = "g8ba1f2c"
SOURCE_USER_ID = "415g466e"  # the wrong-shape fallback that broke hop2


def _source() -> SimpleNamespace:
    return SimpleNamespace(
        user_id=SOURCE_USER_ID,
        user_id_alt="on_source_alt",
        chat_type="group",
        chat_id="oc_0adeac8168d48d413693f1e64a330db5",
        is_bot=False,
    )


def _payload(raw_message) -> dict:
    event = SimpleNamespace(
        message_id="om_sender_1",
        text="hello bridge",
        timestamp=None,
        raw_message=raw_message,
    )
    payload = build_payload(event, _source())
    assert payload is not None, "mandatory identifiers present => payload built"
    return payload


def _ids(raw_message) -> dict:
    return _sender_ids(SimpleNamespace(raw_message=raw_message), _source())


# --- websocket / SDK-object shape (the hop2 bug) ------------------------------


def _sdk_sender_raw(nested: bool = True):
    """SDK-model shape as the websocket dispatcher delivers it: attribute
    access, not dicts. Mirrors im.v1.message_receive EventSender via
    SimpleNamespace — the production read is ``_field`` / getattr."""
    sender = SimpleNamespace(
        sender_id=SimpleNamespace(
            open_id=OPEN_ID, union_id=UNION_ID, user_id=SID_USER_ID
        ),
        sender_type="user",
    )
    if nested:
        return SimpleNamespace(event=SimpleNamespace(sender=sender))
    return SimpleNamespace(sender=sender)


def test_sdk_shape_open_id_reaches_payload():
    """The bug: over WS ``raw_message`` is an SDK object, open_id was never
    read and externalId fell back to source.user_id. Now externalId is the
    open_id and definitively not the user_id."""
    ids = _ids(_sdk_sender_raw())
    assert ids["open_id"] == OPEN_ID
    payload = _payload(_sdk_sender_raw())
    assert payload["sender"]["externalId"] == OPEN_ID
    assert payload["sender"]["externalId"] != SOURCE_USER_ID
    assert payload["sender"]["unionId"] == UNION_ID
    assert payload["sender"]["subjectUserId"] == SID_USER_ID


def test_sdk_shape_flat_sender():
    """Flat ``raw.sender`` on SDK objects maps identically to the nested path."""
    assert _ids(_sdk_sender_raw(nested=False))["open_id"] == OPEN_ID
    assert _payload(_sdk_sender_raw(nested=False))["sender"]["externalId"] == OPEN_ID


def test_sdk_shape_union_id_only():
    """No open_id on the SDK object: union_id maps to unionId, externalId
    keeps the source fallback contract (unchanged caller selection)."""
    raw = SimpleNamespace(
        event=SimpleNamespace(
            sender=SimpleNamespace(sender_id=SimpleNamespace(union_id=UNION_ID))
        )
    )
    ids = _ids(raw)
    assert ids["open_id"] is None
    assert ids["union_id"] == UNION_ID
    payload = _payload(raw)
    assert payload["sender"]["unionId"] == UNION_ID
    assert payload["sender"]["externalId"] == SOURCE_USER_ID


# --- webhook / plain-dict shape (regression) ----------------------------------


def test_dict_shape_nested_and_flat():
    """Both dict layouts map identically; webhook behaviour unchanged."""
    nested = {"event": {"sender": {"sender_id": {
        "open_id": OPEN_ID, "union_id": UNION_ID, "user_id": SID_USER_ID
    }}}}
    flat = {"sender": {"sender_id": {
        "open_id": OPEN_ID, "union_id": UNION_ID, "user_id": SID_USER_ID
    }}}
    for raw in (nested, flat):
        assert _ids(raw) == {
            "open_id": OPEN_ID,
            "union_id": UNION_ID,
            "user_id": SID_USER_ID,
            "source_user_id": SOURCE_USER_ID,
            "source_user_id_alt": "on_source_alt",
        }
        assert _payload(raw)["sender"]["externalId"] == OPEN_ID


# --- fallback + never-raising --------------------------------------------------


def test_no_sender_source_fallback_preserved():
    """No sender anywhere (or no raw at all): ids stay None, source keys
    survive, externalId falls back to source.user_id as before."""
    for raw in (None, {}, SimpleNamespace(), {"event": {}},
                {"message": {"mentions": []}}):
        ids = _ids(raw)
        assert ids["open_id"] is None
        assert ids["union_id"] is None
        assert ids["user_id"] is None
        assert ids["source_user_id"] == SOURCE_USER_ID
        assert ids["source_user_id_alt"] == "on_source_alt"
        assert _payload(raw)["sender"]["externalId"] == SOURCE_USER_ID


def test_odd_shapes_never_raise():
    """Malformed sender containers yield None ids, no exception, payload
    still builds on the source fallback."""
    odd = [
        {"sender": "not-a-dict"},
        {"sender": {"sender_id": "oops"}},
        {"event": {"sender": {"sender_id": {"open_id": ""}}}},
        SimpleNamespace(event=SimpleNamespace(sender=SimpleNamespace(sender_id=None))),
        SimpleNamespace(event="not-an-object"),
        "not-an-object-at-all",
    ]
    for raw in odd:
        assert _ids(raw)["open_id"] is None
        assert _payload(raw)["sender"]["externalId"] == SOURCE_USER_ID
