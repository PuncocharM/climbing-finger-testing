"""Pytest tests for test_persistence."""
import random
import string
from datetime import datetime, timedelta
from typing import Optional

import pytest
from sqlalchemy.exc import IntegrityError

from persistence import database
from persistence.database import init_db, save_test_entry, get_test_entry_by_id, DuplicateTestEntryError, \
    get_all_test_entries, delete_test_entry, save_test_event, get_all_test_events, delete_test_event, \
    save_peak_force_result, get_test_event_by_id
from persistence.model import TestEntryEntity, TestArm, TestEventEntity, PeakForceTestResults
from schemas import TestType, TestEventType

DEFAULT_TEST_ENTRY_ID = "test-001"


@pytest.fixture
def db(tmp_path):
    """Initialize a fresh SQLite database file for each test."""
    engine = init_db(f"sqlite:///{tmp_path / 'test.db'}")
    yield engine
    engine.dispose()


def make_entry(test_id=DEFAULT_TEST_ENTRY_ID, timestamp: Optional[datetime]=None, **overrides):
    return TestEntryEntity(
        test_id=test_id,
        timestamp=timestamp or datetime.now(),
        test_type=overrides.get("test_type", TestType.PEAK_FORCE),
        test_arm=overrides.get("test_arm", TestArm.LEFT),
    )


def test_save_and_get_by_id(db):
    entry_id = ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))  # random string
    timestamp = datetime.now()

    save_test_entry(make_entry(entry_id, timestamp, test_type=TestType.PEAK_FORCE, test_arm=TestArm.LEFT))

    result = get_test_entry_by_id(entry_id)

    assert result is not None
    assert result.test_id == entry_id
    assert result.timestamp == timestamp
    assert result.test_type is TestType.PEAK_FORCE
    assert result.test_arm is TestArm.LEFT


def test_get_missing_returns_none(db):
    assert get_test_entry_by_id("missing") is None


def test_save_duplicate_id_raises(db):
    save_test_entry(make_entry())

    with pytest.raises(DuplicateTestEntryError):
        save_test_entry(make_entry())

    assert len(get_all_test_entries()) == 1


@pytest.mark.parametrize("test_type", list(TestType))
@pytest.mark.parametrize("test_arm", list(TestArm))
def test_all_enum_values_round_trip(db, test_type, test_arm):
    save_test_entry(make_entry(test_type=test_type, test_arm=test_arm))

    result = get_test_entry_by_id(DEFAULT_TEST_ENTRY_ID)

    assert result.test_type is test_type
    assert result.test_arm is test_arm


def test_get_all_empty(db):
    assert get_all_test_entries() == []


def test_get_all_ordered_by_timestamp(db):
    base = datetime(2025, 1, 1)
    save_test_entry(make_entry("c", base + timedelta(days=2)))
    save_test_entry(make_entry("a", base))
    save_test_entry(make_entry("b", base + timedelta(days=1)))

    results = get_all_test_entries()

    assert [e.test_id for e in results] == ["a", "b", "c"]


def test_delete_existing_entry(db):
    save_test_entry(make_entry())

    assert delete_test_entry(DEFAULT_TEST_ENTRY_ID) is True
    assert get_test_entry_by_id(DEFAULT_TEST_ENTRY_ID) is None
    assert get_all_test_entries() == []


def test_delete_missing_entry_returns_false(db):
    assert delete_test_entry("missing") is False


def test_delete_only_removes_target(db):
    save_test_entry(make_entry("keep"))
    save_test_entry(make_entry("remove"))

    delete_test_entry("remove")

    assert [e.test_id for e in get_all_test_entries()] == ["keep"]


def test_functions_require_init_db(monkeypatch):
    monkeypatch.setattr(database, "_SessionFactory", None)

    with pytest.raises(RuntimeError, match="init_db"):
        get_test_entry_by_id("anything")


def test_save_test_event_and_get_by_id(db):
    test_entry = make_entry()
    test_entry = save_test_entry(test_entry)


    test_event = TestEventEntity(test_id=test_entry.test_id, timestamp=test_entry.timestamp,
                             event_type=TestEventType.PULL_START)
    test_event = save_test_event(test_event)

    result = get_test_event_by_id(test_event.event_id)
    assert result is not None
    assert result.test_id == test_entry.test_id
    assert result.timestamp == test_entry.timestamp
    assert result.event_type == TestEventType.PULL_START


def test_save_test_event_wrong_test_id(db):
    timestamp = datetime.now()
    test_event = TestEventEntity(test_id="does_not_exist", timestamp=timestamp,
                                 event_type=TestEventType.PULL_START)

    with pytest.raises(IntegrityError):
        save_test_event(test_event)

    events = get_all_test_events()
    assert len(events) == 0



def test_delete_test_cascades_events(db):
    test_entry = make_entry()
    test_entry = save_test_entry(test_entry)


    test_event = TestEventEntity(test_id=test_entry.test_id, timestamp=test_entry.timestamp,
                                 event_type=TestEventType.PULL_START)
    save_test_event(test_event)

    events_before = get_all_test_events()
    assert len(events_before) == 1

    result_delete = delete_test_entry(DEFAULT_TEST_ENTRY_ID)
    assert result_delete is True

    events_after = get_all_test_events()
    assert len(events_after) == 0


def test_delete_event(db):
    test_entry = make_entry()
    test_entry = save_test_entry(test_entry)


    test_event = TestEventEntity(test_id=test_entry.test_id, timestamp=test_entry.timestamp,
                                 event_type=TestEventType.PULL_START)
    save_test_event(test_event)

    tests_before = get_all_test_entries()
    assert len(tests_before) == 1
    events_before = get_all_test_events()
    assert len(events_before) == 1

    delete_test_event(test_event.event_id)

    tests_after = get_all_test_entries()
    assert len(tests_after) == 1
    events_after = get_all_test_events()
    assert len(events_after) == 0


def test_save_peak_force_test_result(db):
    test_entry = make_entry()
    test_entry = save_test_entry(test_entry)

    pftr = PeakForceTestResults(test_id=test_entry.test_id, set_peaks=[0.5, -1.4, 5], max_force=5)
    save_peak_force_result(pftr)
    