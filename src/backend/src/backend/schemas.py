import enum
from datetime import datetime
from enum import StrEnum
from typing import List

from pydantic import BaseModel


class WorkoutArm(enum.Enum):
    __test__ = False

    LEFT = "left"
    RIGHT = "right"
    BOTH = "both"


class WorkoutType(enum.Enum):
    __test__ = False

    CRITICAL_FORCE_TEST_REPEATERS = "CRITICAL_FORCE_TEST_REPEATERS"
    CRITICAL_FORCE_TEST_SUSTAIN = "CRITICAL_FORCE_TEST_SUSTAIN"
    PEAK_FORCE_TEST = "PEAK_FORCE_TEST"


class WorkoutSchema(BaseModel):
    timestamp: datetime
    workout_id: str
    workout_type: WorkoutType
    workout_arm: WorkoutArm


class WorkoutEventType(enum.Enum):
    __test__ = False

    WORKOUT_START = "WORKOUT_START"
    PULL_START = "PULL_START"
    REST_START = "REST_START"
    WORKOUT_END = "WORKOUT_END"
    WORKOUT_ABORT = "WORKOUT_ABORT"

class WorkoutEventSchema(BaseModel):
    timestamp: datetime
    event_type: WorkoutEventType


class Commands(StrEnum):
    TARE = "tare"
    START = "start"
    STOP = "stop"
    RESET_MAX_WEIGHT = "reset_max_weight"


class PeakForceTestSchema(BaseModel):
    set_peaks: List[float]
    max_force: float