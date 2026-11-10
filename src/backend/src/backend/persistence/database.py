from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator, Optional, Sequence, TypeVar, Generic

from sqlalchemy import create_engine, select, event
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from sqlite3 import Connection as SQLite3Connection

from persistence.model import WorkoutEntity, Base, WorkoutEventEntity, PeakForceTestResult, CriticalForceTestResult


class DuplicateEntryError(Exception):
    """Raised when saving a Workout whose workout_id already exists."""


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


E = TypeVar('E')
ID = TypeVar('ID')
class Repository(Generic[E, ID]):
    t: type[object]

    @staticmethod
    def save(entry: E) -> E:
        try:
            with _session_scope() as session:
                session.add(entry)
        except IntegrityError as exc:
            raise DuplicateEntryError(f"An entry with the same id already exists") from exc

        return entry

    @classmethod
    def get_by_id(cls, pk: ID) -> Optional[E]:
        with _session_scope() as session:
            return session.get(cls.t, pk)

    @classmethod
    def delete(cls, pk: ID) -> bool:
        """
        Returns True if an entry was deleted, False if none was found.
        """
        with _session_scope() as session:
            workout = session.get(cls.t, pk)
            if workout is None:
                return False
            session.delete(workout)
            return True

    @classmethod
    def get_all(cls) -> Sequence[E]:
        with _session_scope() as session:
            return session.scalars(select(cls.t)).all()


class WorkoutRepository(Repository[WorkoutEntity, str]):
    t = WorkoutEntity


class WorkoutEventRepository(Repository[WorkoutEventEntity, int]):
    t = WorkoutEventEntity

    @staticmethod
    def get_all_by_workout_id(workout_id: str) -> Sequence[WorkoutEventEntity]:
        with _session_scope() as session:
            return session.scalars(select(WorkoutEventEntity).where(WorkoutEventEntity.workout_id == workout_id)).all()


class PeakForceResultRepository(Repository[PeakForceTestResult, str]):
    t = PeakForceTestResult


class CriticalForceResultRepository(Repository[CriticalForceTestResult, str]):
    t = CriticalForceTestResult
