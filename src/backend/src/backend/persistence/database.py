"""Database persistence for TestEntry using SQLAlchemy ORM and SQLite."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator, Optional, Sequence

from sqlalchemy import create_engine, select, event
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from sqlite3 import Connection as SQLite3Connection

from persistence.model import TestEntryEntity, Base, TestEventEntity


class DuplicateTestEntryError(Exception):
    """Raised when saving a TestEntry whose test_id already exists."""


_engine: Optional[Engine] = None
_SessionFactory: Optional[sessionmaker[Session]] = None


def init_db(db_url: str, echo: bool = False) -> Engine:
    """Create the engine, session factory and tables (if missing).

    Safe to call multiple times; calling it again with a different URL
    re-points the module at the new database.
    """
    global _engine, _SessionFactory
    _engine = create_engine(db_url, echo=echo)
    _SessionFactory = sessionmaker(bind=_engine, expire_on_commit=False)
    Base.metadata.create_all(_engine)
    return _engine


@contextmanager
def _session_scope() -> Iterator[Session]:
    if _SessionFactory is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    session = _SessionFactory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@event.listens_for(Engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    """Enforce a foreign key constraints in SQLite database
    """
    if isinstance(dbapi_connection, SQLite3Connection):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON;")
        cursor.close()


def save_test_entry(entry: TestEntryEntity) -> TestEntryEntity:
    """Persist a new TestEntry.

    Raises DuplicateTestEntryError if an entry with the same test_id exists.
    """
    try:
        with _session_scope() as session:
            session.add(entry)
    except IntegrityError as exc:
        raise DuplicateTestEntryError(f"A TestEntry with test_id={entry.test_id!r} already exists.") from exc
    return entry


def get_test_entry_by_id(test_id: str) -> Optional[TestEntryEntity]:
    """Return the TestEntry with the given test_id, or None if not found."""
    with _session_scope() as session:
        return session.get(TestEntryEntity, test_id)


def get_all_test_entries() -> Sequence[TestEntryEntity]:
    """Return all TestEntry rows, ordered by timestamp (oldest first)."""
    with _session_scope() as session:
        return session.scalars(select(TestEntryEntity).order_by(TestEntryEntity.timestamp)).all()


def delete_test_entry(test_id: str) -> bool:
    """Delete the TestEntry with the given test_id.

    Returns True if an entry was deleted, False if none was found.
    """
    with _session_scope() as session:
        entry = session.get(TestEntryEntity, test_id)
        if entry is None:
            return False
        session.delete(entry)
        return True


def save_test_event(test_event: TestEventEntity) -> TestEventEntity:
    with _session_scope() as session:
        session.add(test_event)

    return test_event


def get_test_event_by_id(event_id: int) -> Optional[TestEventEntity]:
    with _session_scope() as session:
        return session.get(TestEventEntity, event_id)


def get_all_test_events() -> Sequence[TestEventEntity]:
    with _session_scope() as session:
        return session.scalars(select(TestEventEntity).order_by(TestEventEntity.timestamp)).all()

