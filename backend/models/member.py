from datetime import datetime

from . import db, BaseModel
from .lookup import AcademicYear, _d

STATUSES = {"active": "ปกติ", "pending": "รอตรวจสอบ", "inactive": "พ้นสภาพ"}
TEMPLATES = {
    "card": "Profile Card",
    "biography": "Biography",
    "executive": "Executive Profile",
    "portfolio": "Portfolio",
}
EDUCATION_LEVELS = ["ปวช.1", "ปวช.2", "ปวช.3", "ปวส.1", "ปวส.2"]
ACTIVITY_CATEGORIES = {"activity": "กิจกรรม", "achievement": "ผลงาน/รางวัล", "work": "ประวัติการทำงาน"}


class Member(BaseModel):
    __tablename__ = "members"

    id = db.Column(db.Integer, primary_key=True)
    # ข้อมูลสมาชิก
    member_no = db.Column(db.String(10), unique=True, nullable=False, index=True)
    academic_year_id = db.Column(db.Integer, db.ForeignKey("academic_years.id", ondelete="RESTRICT"),
                                 nullable=False, index=True)
    department_id = db.Column(db.Integer, db.ForeignKey("departments.id", ondelete="SET NULL"))
    education_level = db.Column(db.String(20))
    class_group = db.Column(db.String(20))
    status = db.Column(db.String(20), nullable=False, default="pending", index=True)
    joined_date = db.Column(db.Date)
    profile_template = db.Column(db.String(20), nullable=False, default="card")
    # ข้อมูลส่วนตัว
    student_id = db.Column(db.String(20), unique=True)
    prefix = db.Column(db.String(20))
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    first_name_en = db.Column(db.String(100))
    last_name_en = db.Column(db.String(100))
    nickname = db.Column(db.String(50))
    gender = db.Column(db.String(10))
    birth_date = db.Column(db.Date)
    national_id = db.Column(db.String(13))
    nationality = db.Column(db.String(50), default="ไทย")
    religion = db.Column(db.String(50))
    blood_type = db.Column(db.String(5))
    photo_path = db.Column(db.String(255))
    # ข้อมูลติดต่อ
    phone = db.Column(db.String(20))
    email = db.Column(db.String(120))
    line_id = db.Column(db.String(50))
    facebook = db.Column(db.String(120))
    address = db.Column(db.Text)              # ที่อยู่เต็ม (ระบบประกอบจากช่องด้านล่างอัตโนมัติ)
    house_no = db.Column(db.String(50))       # บ้านเลขที่
    moo = db.Column(db.String(10))            # หมู่ที่
    village = db.Column(db.String(120))       # หมู่บ้าน / อาคาร
    soi = db.Column(db.String(100))           # ซอย
    road = db.Column(db.String(100))          # ถนน
    province_id = db.Column(db.Integer, db.ForeignKey("provinces.id", ondelete="SET NULL"))
    district_id = db.Column(db.Integer, db.ForeignKey("districts.id", ondelete="SET NULL"))
    subdistrict_id = db.Column(db.Integer, db.ForeignKey("subdistricts.id", ondelete="SET NULL"))
    postal_code = db.Column(db.String(5))
    parent_name = db.Column(db.String(150))
    parent_phone = db.Column(db.String(20))
    # ประวัติบุคคล
    biography = db.Column(db.Text)
    skills = db.Column(db.Text)
    vision = db.Column(db.Text)
    note = db.Column(db.Text)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"))
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.now)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)

    academic_year = db.relationship("AcademicYear", lazy="joined")
    department = db.relationship("Department", lazy="joined")
    province = db.relationship("Province")
    district = db.relationship("District")
    subdistrict = db.relationship("Subdistrict")
    positions = db.relationship("MemberPosition", back_populates="member", cascade="all, delete-orphan",
                                passive_deletes=True, lazy="selectin")
    educations = db.relationship("MemberEducation", cascade="all, delete-orphan", passive_deletes=True,
                                 order_by="MemberEducation.sort_order")
    activities = db.relationship("MemberActivity", cascade="all, delete-orphan", passive_deletes=True,
                                 order_by="MemberActivity.sort_order")
    images = db.relationship("MemberImage", cascade="all, delete-orphan", passive_deletes=True)

    __table_args__ = (
        db.CheckConstraint("length(member_no) = 10", name="ck_members_member_no_len"),
        db.CheckConstraint("status IN ('active','pending','inactive')", name="ck_members_status"),
        db.CheckConstraint("profile_template IN ('card','biography','executive','portfolio')",
                           name="ck_members_template"),
        db.Index("ix_members_name", "first_name", "last_name"),
    )

    # ---- ค่าที่คำนวณ -----------------------------------------------------
    @property
    def full_name(self):
        return f"{self.prefix or ''}{self.first_name} {self.last_name}".strip()

    def compose_address(self):
        """ประกอบที่อยู่เต็มจากช่องย่อย เช่น 12/3 หมู่ 4 ซอยสุขใจ ถนนสีหบุรานุกิจ แขวงมีนบุรี เขตมีนบุรี กรุงเทพมหานคร 10510"""
        def pre(word, val):
            if not val or val.startswith(word):
                return val
            return f"{word} {val}" if val[0].isdigit() else f"{word}{val}"
        bkk = self.province and self.province.name_th == "กรุงเทพมหานคร"
        parts = [
            self.house_no,
            f"หมู่ {self.moo}" if self.moo else None,
            self.village,
            pre("ซอย", self.soi),
            pre("ถนน", self.road),
            f"{self.subdistrict.prefix or ''}{self.subdistrict.name_th}" if self.subdistrict else None,
            f"{self.district.prefix or ''}{self.district.name_th}" if self.district else None,
            (self.province.name_th if bkk else f"จังหวัด{self.province.name_th}") if self.province else None,
            self.postal_code,
        ]
        return " ".join(p for p in parts if p) or None

    def sorted_positions(self):
        return sorted(self.positions, key=lambda p: (p.academic_year.year if p.academic_year else 0), reverse=True)

    def current_position(self, year_id=None):
        """ตำแหน่งในปีที่ระบุ (ค่าเริ่มต้น = ปีการศึกษาปัจจุบัน) ถ้าไม่มีใช้ตำแหน่งล่าสุด"""
        if not self.positions:
            return None
        if year_id is None:
            cur = AcademicYear.current()
            year_id = cur.id if cur else None
        for mp in self.positions:
            if mp.academic_year_id == year_id:
                return mp
        return self.sorted_positions()[0]

    def missing_fields(self):
        checks = {
            "photo_path": "รูปถ่าย", "phone": "เบอร์ติดต่อ", "student_id": "เลขประจำตัวนักศึกษา",
            "department_id": "แผนกวิชา", "biography": "ประวัติส่วนตัว", "address": "ที่อยู่",
        }
        return [label for field, label in checks.items() if not getattr(self, field)]

    def to_summary(self):
        cp = self.current_position()
        return {
            "id": self.id,
            "member_no": self.member_no,
            "student_id": self.student_id,
            "prefix": self.prefix,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "full_name": self.full_name,
            "nickname": self.nickname,
            "photo_path": self.photo_path,
            "phone": self.phone,
            "status": self.status,
            "status_label": STATUSES.get(self.status, self.status),
            "academic_year_id": self.academic_year_id,
            "academic_year": self.academic_year.year if self.academic_year else None,
            "department_id": self.department_id,
            "department": self.department.name if self.department else None,
            "education_level": self.education_level,
            "position_id": cp.position_id if cp else None,
            "position": cp.position.name if cp else "สมาชิกทั่วไป",
            "position_color": cp.position.color if cp else None,
            "position_level": cp.position.level if cp else 99,
            "profile_template": self.profile_template,
            "missing": self.missing_fields(),
        }

    def to_dict(self):
        d = self.to_summary()
        d.update({
            "class_group": self.class_group,
            "joined_date": _d(self.joined_date),
            "first_name_en": self.first_name_en,
            "last_name_en": self.last_name_en,
            "gender": self.gender,
            "birth_date": _d(self.birth_date),
            "national_id": self.national_id,
            "nationality": self.nationality,
            "religion": self.religion,
            "blood_type": self.blood_type,
            "email": self.email,
            "line_id": self.line_id,
            "facebook": self.facebook,
            "address": self.address,
            "house_no": self.house_no,
            "moo": self.moo,
            "village": self.village,
            "soi": self.soi,
            "road": self.road,
            "province_id": self.province_id,
            "province": self.province.name_th if self.province else None,
            "district_id": self.district_id,
            "district": self.district.name_th if self.district else None,
            "district_prefix": self.district.prefix if self.district else None,
            "subdistrict_id": self.subdistrict_id,
            "subdistrict": self.subdistrict.name_th if self.subdistrict else None,
            "subdistrict_prefix": self.subdistrict.prefix if self.subdistrict else None,
            "postal_code": self.postal_code,
            "parent_name": self.parent_name,
            "parent_phone": self.parent_phone,
            "biography": self.biography,
            "skills": self.skills,
            "vision": self.vision,
            "note": self.note,
            "positions": [p.to_dict() for p in self.sorted_positions()],
            "educations": [e.to_dict() for e in self.educations],
            "activities": [a.to_dict() for a in self.activities],
            "images": [i.to_dict() for i in self.images],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        })
        return d


class MemberPosition(BaseModel):
    """ประวัติการดำรงตำแหน่ง — สมาชิก 1 คน มีได้หลายปี (ปีละ 1 ตำแหน่ง)"""
    __tablename__ = "member_positions"

    id = db.Column(db.Integer, primary_key=True)
    member_id = db.Column(db.Integer, db.ForeignKey("members.id", ondelete="CASCADE"), nullable=False)
    position_id = db.Column(db.Integer, db.ForeignKey("positions.id", ondelete="RESTRICT"), nullable=False,
                            index=True)
    academic_year_id = db.Column(db.Integer, db.ForeignKey("academic_years.id", ondelete="RESTRICT"),
                                 nullable=False, index=True)
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    note = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.now)

    member = db.relationship("Member", back_populates="positions")
    position = db.relationship("Position", lazy="joined")
    academic_year = db.relationship("AcademicYear", lazy="joined")

    __table_args__ = (db.UniqueConstraint("member_id", "academic_year_id", name="uq_member_year_position"),)

    def to_dict(self):
        return {
            "id": self.id,
            "position_id": self.position_id,
            "position": self.position.name if self.position else None,
            "position_color": self.position.color if self.position else None,
            "is_executive": self.position.is_executive if self.position else False,
            "academic_year_id": self.academic_year_id,
            "academic_year": self.academic_year.year if self.academic_year else None,
            "start_date": _d(self.start_date),
            "end_date": _d(self.end_date),
            "note": self.note,
        }


class MemberEducation(BaseModel):
    __tablename__ = "member_educations"

    id = db.Column(db.Integer, primary_key=True)
    member_id = db.Column(db.Integer, db.ForeignKey("members.id", ondelete="CASCADE"), nullable=False)
    level = db.Column(db.String(50))
    institution = db.Column(db.String(200), nullable=False)
    major = db.Column(db.String(120))
    graduated_year = db.Column(db.Integer)
    gpa = db.Column(db.String(10))
    sort_order = db.Column(db.Integer, default=0)

    def to_dict(self):
        return {"id": self.id, "level": self.level, "institution": self.institution, "major": self.major,
                "graduated_year": self.graduated_year, "gpa": self.gpa}


class MemberActivity(BaseModel):
    __tablename__ = "member_activities"

    id = db.Column(db.Integer, primary_key=True)
    member_id = db.Column(db.Integer, db.ForeignKey("members.id", ondelete="CASCADE"), nullable=False)
    category = db.Column(db.String(20), nullable=False, default="activity")
    title = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(120))
    organization = db.Column(db.String(200))
    activity_date = db.Column(db.Date)
    description = db.Column(db.Text)
    image_path = db.Column(db.String(255))
    sort_order = db.Column(db.Integer, default=0)

    __table_args__ = (
        db.CheckConstraint("category IN ('activity','achievement','work')", name="ck_activity_category"),
    )

    def to_dict(self):
        return {"id": self.id, "category": self.category,
                "category_label": ACTIVITY_CATEGORIES.get(self.category, self.category),
                "title": self.title, "role": self.role, "organization": self.organization,
                "activity_date": _d(self.activity_date), "description": self.description,
                "image_path": self.image_path}


class MemberImage(BaseModel):
    __tablename__ = "member_images"

    id = db.Column(db.Integer, primary_key=True)
    member_id = db.Column(db.Integer, db.ForeignKey("members.id", ondelete="CASCADE"), nullable=False)
    image_path = db.Column(db.String(255), nullable=False)
    caption = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.now)

    def to_dict(self):
        return {"id": self.id, "image_path": self.image_path, "caption": self.caption}
