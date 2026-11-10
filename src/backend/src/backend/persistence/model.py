from __future__ import annotations

from datetime import datetime
from typing import Sequence, Optional

from sqlalchemy import String, DateTime, Enum, ForeignKey, Integer, TypeDecorator, Float
from sqlalchemy.orm import Mapped, mapped_column, DeclarativeBase

from schemas import WorkoutArm, WorkoutType, WorkoutEventType


class Base(DeclarativeBase):
    pass


class WorkoutEntity(Base):
    __tablename__ = "workouts"
    __test__ = False  # keep pytest from trying to collect this class

    workout_id: Mapped[str] = mapped_column(String, primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    workout_type: Mapped[WorkoutType] = mapped_column(Enum(WorkoutType), nullable=False)
    workout_arm: Mapped[WorkoutArm] = mapped_column(Enum(WorkoutArm), nullable=False)

    def __repr__(self) -> str:
        return (
            f"Workout(workout_id={self.workout_id!r}, "
            f"timestamp={self.timestamp!r}, "
            f"workout_type={self.workout_type!r}, "
            f"workout_arm={self.workout_arm!r})"
        )


class WorkoutEventEntity(Base):
    __tablename__ = "workout_events"
    __test__ = False

    event_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    workout_id: Mapped[str] = mapped_column(String, ForeignKey('workouts.workout_id', ondelete="CASCADE"), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    event_type: Mapped[WorkoutEventType] = mapped_column(Enum(WorkoutEventType), nullable=False)


class FloatList(TypeDecorator):
    impl = String
    cache_ok = True

    def process_bind_param(self, value: Optional[Sequence[float]], dialect):
        if value is None:
            return "None"
        return ",".join(map(str, value))

    def process_result_value(self, value: Optional[str], dialect):
        if value is None or value == "None":
            return None
        return list(map(float, value.split(",")))


class PeakForceTestResult(Base):
    __tablename__ = "peak_force_test_results"
    __test__ = False

    workout_id: Mapped[str] = mapped_column(String, ForeignKey('workouts.workout_id', ondelete="CASCADE"), primary_key=True, nullable=False)
    set_peaks: Mapped[Sequence[float]] = mapped_column(FloatList, nullable=False)
    max_force: Mapped[float] = mapped_column(Float, nullable=False)


class CriticalForceTestResult(Base):
    __tablename__ = "critical_force_test_results"
    __test__ = False

    workout_id: Mapped[str] = mapped_column(String, ForeignKey('workouts.workout_id', ondelete="CASCADE"), primary_key=True, nullable=False)
    set_averages: Mapped[Sequence[float]] = mapped_column(FloatList, nullable=False)
    critical_force: Mapped[float] = mapped_column(Float, nullable=False)
    w_prime: Mapped[float] = mapped_column(Float, nullable=False)
