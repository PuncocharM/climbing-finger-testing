from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator, Optional, Sequence

from sqlalchemy import create_engine, select, event
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from sqlite3 import Connection as SQLite3Connection

from persistence.model import WorkoutEntity, Base, WorkoutEventEntity, PeakForceTestResults


class DuplicateWorkoutError(Exception):
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


class WorkoutRepository:
    @staticmethod
    def save(workout: WorkoutEntity) -> WorkoutEntity:
        """Persist a new Workout.

        Raises DuplicateWorkoutError if an entry with the same workout_id exists.
        """
        try:
            with _session_scope() as session:
                session.add(workout)
        except IntegrityError as exc:
            raise DuplicateWorkoutError(f"A Workout with workout_id={workout.workout_id!r} already exists.") from exc
        return workout


    @staticmethod
    def get_by_id(workout_id: str) -> Optional[WorkoutEntity]:
        """Return the Workout with the given workout_id, or None if not found."""
        with _session_scope() as session:
            return session.get(WorkoutEntity, workout_id)


    @staticmethod
    def get_all() -> Sequence[WorkoutEntity]:
        """Return all Workout rows, ordered by timestamp (oldest first)."""
        with _session_scope() as session:
            return session.scalars(select(WorkoutEntity).order_by(WorkoutEntity.timestamp)).all()


    @staticmethod
    def delete(workout_id: str) -> bool:
        """Delete the Workout with the given workout_id.

        Returns True if an entry was deleted, False if none was found.
        """
        with _session_scope() as session:
            workout = session.get(WorkoutEntity, workout_id)
            if workout is None:
                return False
            session.delete(workout)
            return True


class WorkoutEventRepository:
    @staticmethod
    def save(workout_event: WorkoutEventEntity) -> WorkoutEventEntity:
        with _session_scope() as session:
            session.add(workout_event)

        return workout_event


    @staticmethod
    def get_by_id(event_id: int) -> Optional[WorkoutEventEntity]:
        with _session_scope() as session:
            return session.get(WorkoutEventEntity, event_id)


    @staticmethod
    def get_all_by_workout_id(workout_id: str) -> Sequence[WorkoutEventEntity]:
        with _session_scope() as session:
            return session.scalars(select(WorkoutEventEntity).where(WorkoutEventEntity.workout_id == workout_id)).all()


    @staticmethod
    def get_all() -> Sequence[WorkoutEventEntity]:
        with _session_scope() as session:
            return session.scalars(select(WorkoutEventEntity).order_by(WorkoutEventEntity.timestamp)).all()


    @staticmethod
    def delete(event_id: int) -> bool:
        with _session_scope() as session:
            workout_event = session.get(WorkoutEventEntity, event_id)
            if workout_event is None:
                return False
            session.delete(workout_event)
            return True



class PeakForceResultRepository:
    @staticmethod
    def save(peak_force_test_result: PeakForceTestResults) -> PeakForceTestResults:
        with _session_scope() as session:
            session.add(peak_force_test_result)

        return peak_force_test_result


    @staticmethod
    def get_by_id(workout_id: str) -> Optional[PeakForceTestResults]:
        with _session_scope() as session:
            return session.get(PeakForceTestResults, workout_id)
