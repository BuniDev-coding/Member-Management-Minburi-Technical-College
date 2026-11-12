from datetime import datetime

from . import db, BaseModel


def _d(v):
    return v.isoformat() if v else None


class AcademicYear(BaseModel):
    __tablename__ = "academic_years"

    id = db.Column(db.Integer, primary_key=True)
    year = db.Column(db.Integer, unique=True, nullable=False)
    name = db.Column(db.String(100))
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    is_current = db.Column(db.Boolean, nullable=False, default=False)
    note = db.Column(db.Text)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.now)

    @classmethod
    def current(cls):
        return cls.query.filter_by(is_current=True).first() or cls.query.order_by(cls.year.desc()).first()

    def to_dict(self):
        return {
            "id": self.id, "year": self.year,
            "name": self.name or f"ปีการศึกษา {self.year}",
            "start_date": _d(self.start_date), "end_date": _d(self.end_date),
            "is_current": self.is_current, "note": self.note,
        }


class Department(BaseModel):
    __tablename__ = "departments"

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(20), unique=True)
    name = db.Column(db.String(120), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.now)

    def to_dict(self):
        return {"id": self.id, "code": self.code, "name": self.name}


class Position(BaseModel):
    __tablename__ = "positions"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    level = db.Column(db.Integer, nullable=False, default=99)
    is_executive = db.Column(db.Boolean, nullable=False, default=False)
    is_committee = db.Column(db.Boolean, nullable=False, default=False)
    color = db.Column(db.String(20), default="#1F4FB5")
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.now)

    @classmethod
    def general(cls):
        """ตำแหน่ง 'สมาชิกทั่วไป' (ลำดับต่ำสุด)"""
        return cls.query.filter_by(name="สมาชิกทั่วไป").first() or cls.query.order_by(cls.level.desc()).first()

    def to_dict(self):
        return {
            "id": self.id, "name": self.name, "level": self.level,
            "is_executive": self.is_executive, "is_committee": self.is_committee,
            "color": self.color, "description": self.description,
        }


# ตัวเลือกในดรอปดาวน์ของแบบฟอร์มสมัครสมาชิก (แก้ไขได้ที่หน้า "ตั้งค่าข้อมูลการสมัคร")
# category → (ชื่อที่แสดง, คอลัมน์ในตาราง members ที่เก็บค่า, ความยาวสูงสุด, ค่าเริ่มต้น)
OPTION_CATEGORIES = {
    "prefix": ("คำนำหน้า", "prefix", 20, ["นาย", "นางสาว", "นาง", "เด็กชาย", "เด็กหญิง"]),
    "gender": ("เพศ", "gender", 10, ["ชาย", "หญิง", "อื่น ๆ"]),
    "blood_type": ("กรุ๊ปเลือด", "blood_type", 5, ["A", "B", "O", "AB"]),
    "education_level": ("ระดับชั้น", "education_level", 20, ["ปวช.1", "ปวช.2", "ปวช.3", "ปวส.1", "ปวส.2"]),
    "member_type": ("ระดับสมาชิก", "member_type", 30,
                    ["สามัญ ระดับสถานศึกษา", "สามัญ ระดับจังหวัด", "สามัญ ระดับภาค", "สามัญ ระดับชาติ", "วิสามัญ"]),
}


class FormOption(BaseModel):
    __tablename__ = "form_options"
    __table_args__ = (db.UniqueConstraint("category", "name", name="uq_form_options_category_name"),)

    id = db.Column(db.Integer, primary_key=True)
    category = db.Column(db.String(30), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    sort_order = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.now)

    @classmethod
    def names(cls, category):
        return [o.name for o in cls.query.filter_by(category=category).order_by(cls.sort_order, cls.id)]

    def to_dict(self):
        return {"id": self.id, "category": self.category, "name": self.name, "sort_order": self.sort_order}
