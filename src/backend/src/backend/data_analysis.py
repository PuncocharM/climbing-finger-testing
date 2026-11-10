import datetime
import time
from typing import Sequence, List, Callable

import numpy as np
import pandas as pd

from config import Config, log
from persistence.database import WorkoutRepository, WorkoutEventRepository, PeakForceResultRepository, \
    CriticalForceResultRepository
from persistence.model import WorkoutEntity, WorkoutEventEntity, PeakForceTestResult, CriticalForceTestResult
from schemas import WorkoutType, WorkoutEventType


def load_data():
    df_data = pd.read_csv(Config.LOG_FILE_DATA, names=["timestamp", "weight", "max_weight", "status"])
    df_data['timestamp'] = pd.to_datetime(df_data['timestamp']) \
        .dt.tz_localize(None)
    df_data = df_data.set_index("timestamp")
    return df_data


def aggregate_sets(workout_events: Sequence[WorkoutEventEntity], df_data: pd.DataFrame, f: Callable) -> List[float] | None:
    set_aggregates: List[float] = []
    pull_start: datetime.datetime | None = None
    for workout_event in workout_events:
        timestamp = workout_event.timestamp
        match workout_event.event_type:
            case WorkoutEventType.PULL_START:
                pull_start = timestamp
            case WorkoutEventType.REST_START | WorkoutEventType.WORKOUT_END:
                if pull_start is None:
                    log.error("Rest or End before any pull")
                    return None


                pull_data = df_data.loc[pull_start + datetime.timedelta(seconds=1) : timestamp - datetime.timedelta(seconds=1), "weight"]
                if len(pull_data) == 0:
                    log.error(f"No data in the pull interval")
                    return None
                else:
                    set_aggregates.append(f(pull_data))

                pull_start = None

    return set_aggregates


def integrate_w_prime(pull_data: pd.Series, critical_force: float):
    x = pull_data.index.diff()[1:].total_seconds()
    y = (pull_data-critical_force)[1:]
    return np.dot(x, y)

def analyze_cf_repeaters(workout: WorkoutEntity, workout_events: Sequence[WorkoutEventEntity], df_data: pd.DataFrame):
    set_medians = aggregate_sets(workout_events, df_data, f=lambda x: np.median(x))
    if set_medians is None:
        return

    if len(set_medians) < 6:
        log.error("Less than 6 sets")
        return

    critical_force = float(np.mean(set_medians[-6:]))
    w_prime_elements = aggregate_sets(workout_events, df_data, f=lambda x: integrate_w_prime(x, critical_force))
    if w_prime_elements is None:
        return
    w_prime = sum(w_prime_elements)
    cftr = CriticalForceTestResult(workout_id=workout.workout_id, set_averages=set_medians, critical_force=critical_force, w_prime=w_prime)
    CriticalForceResultRepository.save(cftr)


def analyze_peak_force_test(workout: WorkoutEntity, workout_events: Sequence[WorkoutEventEntity], df_data: pd.DataFrame):
    set_peaks = aggregate_sets(workout_events, df_data, f=lambda x: np.max(x))
    if set_peaks is None:
        return

    max_force = max(set_peaks)
    pftr = PeakForceTestResult(workout_id=workout.workout_id, set_peaks=set_peaks, max_force=max_force)
    PeakForceResultRepository.save(pftr)


def process_workout_analytics(workout_id: str):
    time.sleep(1.5) # Allow final logging buffers to flush to disk
    df_data = load_data()

    workout = WorkoutRepository.get_by_id(workout_id)
    if workout is None:
        log.error(f"Workout does not exist: {workout_id}")
        return

    workout_events = WorkoutEventRepository.get_all_by_workout_id(workout_id)
    workout_events = list(sorted(workout_events, key=lambda e: e.timestamp))

    if len(workout_events) == 0:
        log.error(f"No workout events found for workout {workout_id}")
        return

    match workout.workout_type:
        case WorkoutType.PEAK_FORCE_TEST:
            analyze_peak_force_test(workout, workout_events, df_data)
        case WorkoutType.CRITICAL_FORCE_TEST_REPEATERS:
            analyze_cf_repeaters(workout, workout_events, df_data)
        case _:
            log.error(f"Unsupported workout type: {workout.workout_type}")
