"""ข้อมูลพื้นฐานที่ระบบต้องมีเสมอ (เรียกอัตโนมัติตอนเริ่มระบบ)"""
from datetime import date

from models import db, Position, AcademicYear, User, ROLE_PERMISSIONS

DEFAULT_POSITIONS = [
    # name, level, is_executive, is_committee, color
    ("ประธาน", 1, True, True, "#C62828"),
    ("รองประธาน", 2, True, True, "#1F4FB5"),
    ("กรรมการ", 3, False, True, "#0F8A78"),
    ("สมาชิกทั่วไป", 9, False, False, "#D98200"),
]


def current_thai_academic_year(today=None):
    """ปีการศึกษาไทยเริ่ม พ.ค. — ก่อน พ.ค. ยังนับเป็นปีการศึกษาก่อนหน้า"""
    today = today or date.today()
    return today.year + 543 - (1 if today.month < 5 else 0)


def ensure_defaults():
    changed = False
    if Position.query.count() == 0:
        for name, level, exe, com, color in DEFAULT_POSITIONS:
            db.session.add(Position(name=name, level=level, is_executive=exe, is_committee=com, color=color))
        changed = True
    if AcademicYear.query.count() == 0:
        y = current_thai_academic_year()
        db.session.add(AcademicYear(year=y, name=f"ปีการศึกษา {y}", is_current=True,
                                    start_date=date(y - 543, 5, 16), end_date=date(y - 542, 3, 31)))
        changed = True
    if User.query.count() == 0:
        u = User(username="admin", full_name="ผู้ดูแลระบบ", role="superadmin")
        u.set_password("admin1234")
        u.set_permissions(ROLE_PERMISSIONS["superadmin"])
        db.session.add(u)
        changed = True
    if changed:
        db.session.commit()
