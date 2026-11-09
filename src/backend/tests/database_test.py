"""Pytest tests for test_persistence."""
import random
import string
from datetime import datetime, timedelta
from typing import Optional

import pytest
from sqlalchemy.exc import IntegrityError

from persistence import database
from persistence.database import init_db, save_workout, get_workout_by_id, DuplicateWorkoutError, \
    get_all_workouts, delete_workout, save_workout_event, get_all_workout_events, delete_workout_event, \
    save_peak_force_result, get_workout_event_by_id
from persistence.model import WorkoutEntity, WorkoutArm, WorkoutEventEntity, PeakForceTestResults
from schemas import WorkoutType, WorkoutEventType

DEFAULT_WORKOUT_ID = "test-001"


@pytest.fixture
def db(tmp_path):
    """Initialize a fresh SQLite database file for each test."""
    engine = init_db(f"sqlite:///{tmp_path / 'test.db'}")
    yield engine
    engine.dispose()


def make_entry(test_id=DEFAULT_WORKOUT_ID, timestamp: Optional[datetime]=None, **overrides):
    return WorkoutEntity(
        test_id=test_id,
        timestamp=timestamp or datetime.now(),
        test_type=overrides.get("test_type", WorkoutType.PEAK_FORCE_TEST),
        test_arm=overrides.get("test_arm", WorkoutArm.LEFT),
    )


def test_save_and_get_by_id(db):
    entry_id = ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))  # random string
    timestamp = datetime.now()

    save_workout(make_entry(entry_id, timestamp, test_type=WorkoutType.PEAK_FORCE_TEST, test_arm=WorkoutArm.LEFT))

    result = get_workout_by_id(entry_id)

    assert result is not None
    assert result.workout_id == entry_id
    assert result.timestamp == timestamp
    assert result.workout_type is WorkoutType.PEAK_FORCE_TEST
    assert result.workout_arm is WorkoutArm.LEFT


def test_get_missing_returns_none(db):
    assert get_workout_by_id("missing") is None


def test_save_duplicate_id_raises(db):
    save_workout(make_entry())

    with pytest.raises(DuplicateWorkoutError):
        save_workout(make_entry())

    assert len(get_all_workouts()) == 1


@pytest.mark.parametrize("test_type", list(WorkoutType))
@pytest.mark.parametrize("test_arm", list(WorkoutArm))
def test_all_enum_values_round_trip(db, test_type, test_arm):
    save_workout(make_entry(test_type=test_type, test_arm=test_arm))

    result = get_workout_by_id(DEFAULT_WORKOUT_ID)

    assert result.workout_type is test_type
    assert result.workout_arm is test_arm


def test_get_all_empty(db):
    assert get_all_workouts() == []


def test_get_all_ordered_by_timestamp(db):
    base = datetime(2025, 1, 1)
    save_workout(make_entry("c", base + timedelta(days=2)))
    save_workout(make_entry("a", base))
    save_workout(make_entry("b", base + timedelta(days=1)))

    results = get_all_workouts()

    assert [e.workout_id for e in results] == ["a", "b", "c"]


def test_delete_existing_entry(db):
    save_workout(make_entry())

    assert delete_workout(DEFAULT_WORKOUT_ID) is True
    assert get_workout_by_id(DEFAULT_WORKOUT_ID) is None
    assert get_all_workouts() == []


def test_delete_missing_entry_returns_false(db):
    assert delete_workout("missing") is False


def test_delete_only_removes_target(db):
    save_workout(make_entry("keep"))
    save_workout(make_entry("remove"))

    delete_workout("remove")

    assert [e.workout_id for e in get_all_workouts()] == ["keep"]


def test_functions_require_init_db(monkeypatch):
    monkeypatch.setattr(database, "_SessionFactory", None)

    with pytest.raises(RuntimeError, match="init_db"):
        get_workout_by_id("anything")


def test_save_test_event_and_get_by_id(db):
    test_entry = make_entry()
    test_entry = save_workout(test_entry)


    test_event = WorkoutEventEntity(test_id=test_entry.workout_id, timestamp=test_entry.timestamp,
                                    event_type=WorkoutEventType.PULL_START)
    test_event = save_workout_event(test_event)

    result = get_workout_event_by_id(test_event.event_id)
    assert result is not None
    assert result.workout_id == test_entry.workout_id
    assert result.timestamp == test_entry.timestamp
    assert result.event_type == WorkoutEventType.PULL_START


def test_save_test_event_wrong_test_id(db):
    timestamp = datetime.now()
    test_event = WorkoutEventEntity(test_id="does_not_exist", timestamp=timestamp,
                                    event_type=WorkoutEventType.PULL_START)

    with pytest.raises(IntegrityError):
        save_workout_event(test_event)

    events = get_all_workout_events()
    assert len(events) == 0



def test_delete_test_cascades_events(db):
    test_entry = make_entry()
    test_entry = save_workout(test_entry)


    test_event = WorkoutEventEntity(test_id=test_entry.workout_id, timestamp=test_entry.timestamp,
                                    event_type=WorkoutEventType.PULL_START)
    save_workout_event(test_event)

    events_before = get_all_workout_events()
    assert len(events_before) == 1

    result_delete = delete_workout(DEFAULT_WORKOUT_ID)
    assert result_delete is True

    events_after = get_all_workout_events()
    assert len(events_after) == 0


def test_delete_event(db):
    test_entry = make_entry()
    test_entry = save_workout(test_entry)


    test_event = WorkoutEventEntity(test_id=test_entry.workout_id, timestamp=test_entry.timestamp,
                                    event_type=WorkoutEventType.PULL_START)
    save_workout_event(test_event)

    tests_before = get_all_workouts()
    assert len(tests_before) == 1
    events_before = get_all_workout_events()
    assert len(events_before) == 1

    delete_workout_event(test_event.event_id)

    tests_after = get_all_workouts()
    assert len(tests_after) == 1
    events_after = get_all_workout_events()
    assert len(events_after) == 0


def test_save_peak_force_test_result(db):
    test_entry = make_entry()
    test_entry = save_workout(test_entry)

    pftr = PeakForceTestResults(test_id=test_entry.workout_id, set_peaks=[0.5, -1.4, 5], max_force=5)
    save_peak_force_result(pftr)
    