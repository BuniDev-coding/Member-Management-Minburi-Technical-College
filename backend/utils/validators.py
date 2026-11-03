"""ฟังก์ชันตรวจสอบและแปลงค่าข้อมูล"""
import re
from datetime import date, datetime

MEMBER_NO_RE = re.compile(r"^\d{10}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_RE = re.compile(r"^0\d{8,9}$")


class ValidationError(Exception):
    def __init__(self, errors):
        self.errors = errors if isinstance(errors, dict) else {"_": str(errors)}
        super().__init__(next(iter(self.errors.values())))


def is_valid_member_no(value) -> bool:
    return bool(value) and bool(MEMBER_NO_RE.match(str(value)))


def clean_str(value, max_len=None):
    if value is None:
        return None
    value = str(value).strip()
    if not value:
        return None
    return value[:max_len] if max_len else value


def clean_digits(value):
    v = clean_str(value)
    return re.sub(r"[\s-]", "", v) if v else None


def parse_date(value):
    """รับ 'YYYY-MM-DD' (ค.ศ.) คืน date หรือ None"""
    if not value:
        return None
    if isinstance(value, date):
        return value
    try:
        return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
    except ValueError:
        raise ValidationError({"date": f"รูปแบบวันที่ไม่ถูกต้อง: {value}"})


def parse_int(value):
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def parse_bool(value):
    if isinstance(value, bool):
        return value
    return str(value).lower() in ("1", "true", "yes", "on")
