from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Enum, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, DeclarativeBase, relationship, backref

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
    test_id: Mapped[str] = mapped_column(String, ForeignKey('test_entries.test_id'), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    event_type: Mapped[TestEventType] = mapped_column(Enum(TestEventType), nullable=False)

    test_entry = relationship(TestEntryEntity, backref=backref('events', cascade="all, delete-orphan"))

