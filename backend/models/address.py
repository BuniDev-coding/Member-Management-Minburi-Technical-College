"""ข้อมูลที่อยู่ประเทศไทย: จังหวัด → อำเภอ/เขต → ตำบล/แขวง (+ รหัสไปรษณีย์)

ข้อมูลตั้งต้นอยู่ที่ backend/data/thai_address.json และถูกนำเข้าอัตโนมัติตอนเริ่มระบบ (seed_defaults.py)
"""
from . import db, BaseModel


class Province(BaseModel):
    __tablename__ = "provinces"

    id = db.Column(db.Integer, primary_key=True, autoincrement=False)
    name_th = db.Column(db.String(100), nullable=False, index=True)
    name_en = db.Column(db.String(100))

    def to_dict(self):
        return {"id": self.id, "name": self.name_th, "name_en": self.name_en}


class District(BaseModel):
    """อำเภอ (ต่างจังหวัด) / เขต (กรุงเทพมหานคร)"""
    __tablename__ = "districts"

    id = db.Column(db.Integer, primary_key=True, autoincrement=False)
    province_id = db.Column(db.Integer, db.ForeignKey("provinces.id", ondelete="CASCADE"), nullable=False, index=True)
    name_th = db.Column(db.String(100), nullable=False)
    name_en = db.Column(db.String(100))
    prefix = db.Column(db.String(20))          # "อำเภอ" หรือ "เขต"

    province = db.relationship("Province", lazy="joined")

    def to_dict(self):
        return {"id": self.id, "province_id": self.province_id, "name": self.name_th,
                "name_en": self.name_en, "prefix": self.prefix}


class Subdistrict(BaseModel):
    """ตำบล (ต่างจังหวัด) / แขวง (กรุงเทพมหานคร)"""
    __tablename__ = "subdistricts"

    id = db.Column(db.Integer, primary_key=True, autoincrement=False)
    district_id = db.Column(db.Integer, db.ForeignKey("districts.id", ondelete="CASCADE"), nullable=False, index=True)
    name_th = db.Column(db.String(100), nullable=False)
    name_en = db.Column(db.String(100))
    prefix = db.Column(db.String(20))          # "ตำบล" หรือ "แขวง"
    postal_code = db.Column(db.String(5), nullable=False, index=True)

    district = db.relationship("District", lazy="joined")

    def to_dict(self):
        return {"id": self.id, "district_id": self.district_id, "name": self.name_th,
                "name_en": self.name_en, "prefix": self.prefix, "postal_code": self.postal_code}
