from typing import TYPE_CHECKING, Any

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import event
from sqlalchemy.engine import Engine

db = SQLAlchemy()

if TYPE_CHECKING:
    # สำหรับตัวตรวจโค้ด (Pylance/Pyrefly) เท่านั้น: บอกว่าโมเดลรับ keyword เช่น Member(first_name=...) ได้
    # ตอนรันจริงใช้ db.Model ตามปกติ
    class BaseModel:
        query: Any
        __table__: Any
        __tablename__: str

        def __init__(self, **kwargs: Any) -> None: ...
else:
    BaseModel = db.Model


@event.listens_for(Engine, "connect")
def _sqlite_pragma(dbapi_connection, connection_record):
    """เปิด Foreign Key ทุกครั้งที่เชื่อมต่อ SQLite (ฐานข้อมูลอื่นจะไม่ทำอะไร)"""
    import sqlite3
    if isinstance(dbapi_connection, sqlite3.Connection):
        cur = dbapi_connection.cursor()
        cur.execute("PRAGMA foreign_keys = ON")
        cur.close()


from .user import User, ROLE_PERMISSIONS, ALL_PERMISSIONS  # noqa: E402,F401
from .lookup import AcademicYear, Department, Position, FormOption, OPTION_CATEGORIES  # noqa: E402,F401
from .address import Province, District, Subdistrict  # noqa: E402,F401
from .election import Election, ElectionCandidate  # noqa: E402,F401
from .member import (  # noqa: E402,F401
    Member, MemberPosition, MemberEducation, MemberActivity, MemberImage,
    STATUSES, TEMPLATES, EDUCATION_LEVELS, MEMBER_TYPES,
)
