"""Pytest tests for test_persistence."""
import random
import string
from datetime import datetime, timedelta
from typing import Optional

import pytest
from sqlalchemy.exc import IntegrityError

from persistence import database
from persistence.database import init_db
from persistence.models import WorkoutEntity, WorkoutArm, WorkoutEventEntity, PeakForceTestResult, \
    CriticalForceTestResult
from schemas import WorkoutType, WorkoutEventType

DEFAULT_WORKOUT_ID = "test-001"


@pytest.fixture
def db(tmp_path):
    """Initialize a fresh SQLite database file for each test."""
    engine = init_db(f"sqlite:///{tmp_path / 'test.db'}")
    yield engine
    engine.dispose()


def make_entry(workout_id=DEFAULT_WORKOUT_ID, timestamp: Optional[datetime]=None, **overrides):
    return WorkoutEntity(
        workout_id=workout_id,
        timestamp=timestamp or datetime.now(),
        workout_type=overrides.get("workout_type", WorkoutType.PEAK_FORCE_TEST),
        workout_arm=overrides.get("workout_arm", WorkoutArm.LEFT),
    )


def test_save_and_get_by_id(db):
    entry_id = ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))  # random string
    timestamp = datetime.now()

    database.WorkoutRepository.save(make_entry(entry_id, timestamp, test_type=WorkoutType.PEAK_FORCE_TEST, test_arm=WorkoutArm.LEFT))

    result = database.WorkoutRepository.get_by_id(entry_id)

    assert result is not None
    assert result.workout_id == entry_id
    assert result.timestamp == timestamp
    assert result.workout_type is WorkoutType.PEAK_FORCE_TEST
    assert result.workout_arm is WorkoutArm.LEFT


def test_get_missing_returns_none(db):
    assert database.WorkoutRepository.get_by_id("missing") is None


def test_save_duplicate_id_raises(db):
    database.WorkoutRepository.save(make_entry())

    with pytest.raises(database.DuplicateEntryError):
        database.WorkoutRepository.save(make_entry())

    assert len(database.WorkoutRepository.get_all()) == 1


@pytest.mark.parametrize("workout_type", list(WorkoutType))
@pytest.mark.parametrize("workout_arm", list(WorkoutArm))
def test_all_enum_values_round_trip(db, workout_type, workout_arm):
    database.WorkoutRepository.save(make_entry(workout_type=workout_type, workout_arm=workout_arm))

    result = database.WorkoutRepository.get_by_id(DEFAULT_WORKOUT_ID)

    assert result is not None
    assert result.workout_type is workout_type
    assert result.workout_arm is workout_arm


def test_get_all_empty(db):
    assert database.WorkoutRepository.get_all() == []


# def test_get_all_ordered_by_timestamp(db):
#     base = datetime(2025, 1, 1)
#     database.WorkoutRepository.save(make_entry("c", base + timedelta(days=2)))
#     database.WorkoutRepository.save(make_entry("a", base))
#     database.WorkoutRepository.save(make_entry("b", base + timedelta(days=1)))
#
#     results = database.WorkoutRepository.get_all()
#
#     assert [e.workout_id for e in results] == ["a", "b", "c"]


def test_delete_existing_entry(db):
    database.WorkoutRepository.save(make_entry())

    assert database.WorkoutRepository.delete(DEFAULT_WORKOUT_ID) is True
    assert database.WorkoutRepository.get_by_id(DEFAULT_WORKOUT_ID) is None
    assert database.WorkoutRepository.get_all() == []


def test_delete_missing_entry_returns_false(db):
    assert database.WorkoutRepository.delete("missing") is False


def test_delete_only_removes_target(db):
    database.WorkoutRepository.save(make_entry("keep"))
    database.WorkoutRepository.save(make_entry("remove"))

    database.WorkoutRepository.delete("remove")

    assert [e.workout_id for e in database.WorkoutRepository.get_all()] == ["keep"]


def test_functions_require_init_db(monkeypatch):
    monkeypatch.setattr(database, "_SessionFactory", None)

    with pytest.raises(RuntimeError, match="init_db"):
        database.WorkoutRepository.get_by_id("anything")


def test_save_test_event_and_get_by_id(db):
    test_entry = make_entry()
    test_entry = database.WorkoutRepository.save(test_entry)


    test_event = WorkoutEventEntity(workout_id=test_entry.workout_id, timestamp=test_entry.timestamp,
                                    event_type=WorkoutEventType.PULL_START)
    test_event = database.WorkoutEventRepository.save(test_event)

    result = database.WorkoutEventRepository.get_by_id(test_event.event_id)
    assert result is not None
    assert result.workout_id == test_entry.workout_id
    assert result.timestamp == test_entry.timestamp
    assert result.event_type == WorkoutEventType.PULL_START


def test_save_test_event_wrong_test_id(db):
    timestamp = datetime.now()
    test_event = WorkoutEventEntity(workout_id="does_not_exist", timestamp=timestamp,
                                    event_type=WorkoutEventType.PULL_START)

    with pytest.raises(database.DuplicateEntryError):
        database.WorkoutEventRepository.save(test_event)

    events = database.WorkoutEventRepository.get_all()
    assert len(events) == 0



def test_delete_test_cascades_events(db):
    test_entry = make_entry()
    test_entry = database.WorkoutRepository.save(test_entry)


    test_event = WorkoutEventEntity(workout_id=test_entry.workout_id, timestamp=test_entry.timestamp,
                                    event_type=WorkoutEventType.PULL_START)
    database.WorkoutEventRepository.save(test_event)

    events_before = database.WorkoutEventRepository.get_all()
    assert len(events_before) == 1

    result_delete = database.WorkoutRepository.delete(DEFAULT_WORKOUT_ID)
    assert result_delete is True

    events_after = database.WorkoutEventRepository.get_all()
    assert len(events_after) == 0


def test_delete_event(db):
    test_entry = make_entry()
    test_entry = database.WorkoutRepository.save(test_entry)


    test_event = WorkoutEventEntity(workout_id=test_entry.workout_id, timestamp=test_entry.timestamp,
                                    event_type=WorkoutEventType.PULL_START)
    database.WorkoutEventRepository.save(test_event)

    tests_before = database.WorkoutRepository.get_all()
    assert len(tests_before) == 1
    events_before = database.WorkoutEventRepository.get_all()
    assert len(events_before) == 1

    database.WorkoutEventRepository.delete(test_event.event_id)

    tests_after = database.WorkoutRepository.get_all()
    assert len(tests_after) == 1
    events_after = database.WorkoutEventRepository.get_all()
    assert len(events_after) == 0


def test_save_peak_force_test_result(db):
    test_entry = make_entry()
    test_entry = database.WorkoutRepository.save(test_entry)

    pftr = PeakForceTestResult(workout_id=test_entry.workout_id, set_peaks=[0.5, -1.4, 5], max_force=5)
    database.PeakForceResultRepository.save(pftr)


def test_save_critical_force_test_result(db):
    test_entry = make_entry()
    test_entry = database.WorkoutRepository.save(test_entry)

    cftr = CriticalForceTestResult(workout_id=test_entry.workout_id, set_averages=[0.5, -1.4, 5], critical_force=5, w_prime=1000)
    database.CriticalForceResultRepository.save(cftr)
    