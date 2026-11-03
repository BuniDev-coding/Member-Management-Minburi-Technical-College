from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import event
from sqlalchemy.engine import Engine

db = SQLAlchemy()


@event.listens_for(Engine, "connect")
def _sqlite_pragma(dbapi_connection, connection_record):
    """เปิด Foreign Key ทุกครั้งที่เชื่อมต่อ SQLite (ฐานข้อมูลอื่นจะไม่ทำอะไร)"""
    import sqlite3
    if isinstance(dbapi_connection, sqlite3.Connection):
        cur = dbapi_connection.cursor()
        cur.execute("PRAGMA foreign_keys = ON")
        cur.close()


from .user import User, ROLE_PERMISSIONS, ALL_PERMISSIONS  # noqa: E402,F401
from .lookup import AcademicYear, Department, Position  # noqa: E402,F401
from .member import (  # noqa: E402,F401
    Member, MemberPosition, MemberEducation, MemberActivity, MemberImage,
    STATUSES, TEMPLATES, EDUCATION_LEVELS,
)
