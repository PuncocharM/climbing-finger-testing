import enum
from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel


class TestArm(enum.Enum):
    __test__ = False

    LEFT = "left"
    RIGHT = "right"
    BOTH = "both"


class TestType(enum.Enum):
    __test__ = False

    CRITICAL_FORCE_REPEATERS = "CRITICAL_FORCE_REPEATERS"
    CRITICAL_FORCE_SUSTAIN = "CRITICAL_FORCE_SUSTAIN"
    PEAK_FORCE = "PEAK_FORCE"


class TestEntrySchema(BaseModel):
    timestamp: datetime
    test_id: str
    test_type: TestType
    test_arm: TestArm


class TestEventType(enum.Enum):
    __test__ = False

    TEST_START = "TEST_START"
    PULL_START = "PULL_START"
    REST_START = "REST_START"
    TEST_END = "TEST_END"
    TEST_ABORT = "TEST_ABORT"

class TestEventSchema(BaseModel):
    timestamp: datetime
    event_type: TestEventType


class Commands(StrEnum):
    TARE = "tare"
    START = "start"
    STOP = "stop"
    RESET_MAX_WEIGHT = "reset_max_weight"
