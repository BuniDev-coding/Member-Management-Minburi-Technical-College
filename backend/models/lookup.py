from datetime import datetime

from . import db


def _d(v):
    return v.isoformat() if v else None


class AcademicYear(db.Model):
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


class Department(db.Model):
    __tablename__ = "departments"

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(20), unique=True)
    name = db.Column(db.String(120), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.now)

    def to_dict(self):
        return {"id": self.id, "code": self.code, "name": self.name}


class Position(db.Model):
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
