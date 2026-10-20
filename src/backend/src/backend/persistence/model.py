from __future__ import annotations

from datetime import datetime
from typing import Sequence, Optional

from sqlalchemy import String, DateTime, Enum, ForeignKey, Integer, TypeDecorator, Float
from sqlalchemy.orm import Mapped, mapped_column, DeclarativeBase

from schemas import TestArm, TestType, TestEventType


class Base(DeclarativeBase):
    pass


class TestEntryEntity(Base):
    __tablename__ = "test_entries"
    __test__ = False  # keep pytest from trying to collect this class

    test_id: Mapped[str] = mapped_column(String, primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    test_type: Mapped[TestType] = mapped_column(Enum(TestType), nullable=False)
    test_arm: Mapped[TestArm] = mapped_column(Enum(TestArm), nullable=False)

    def __repr__(self) -> str:
        return (
            f"TestEntry(test_id={self.test_id!r}, "
            f"timestamp={self.timestamp!r}, "
            f"test_type={self.test_type!r}, "
            f"test_arm={self.test_arm!r})"
        )


class TestEventEntity(Base):
    __tablename__ = "test_events"
    __test__ = False

    event_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    test_id: Mapped[str] = mapped_column(String, ForeignKey('test_entries.test_id', ondelete="CASCADE"), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    event_type: Mapped[TestEventType] = mapped_column(Enum(TestEventType), nullable=False)


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


class PeakForceTestResults(Base):
    __tablename__ = "peak_force_test_results"
    __test__ = False

    test_id: Mapped[str] = mapped_column(String, ForeignKey('test_entries.test_id', ondelete="CASCADE"), primary_key=True, nullable=False)
    set_peaks: Mapped[Sequence[float]] = mapped_column(FloatList, nullable=False)
    max_force: Mapped[float] = mapped_column(Float, nullable=False)
