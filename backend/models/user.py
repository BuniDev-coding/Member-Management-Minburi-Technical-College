from datetime import datetime

import bcrypt

from . import db

# สิทธิ์การเข้าถึงทั้งหมดในระบบ
ALL_PERMISSIONS = {
    "members.view": "ดู/สืบค้นข้อมูลสมาชิก",
    "members.edit": "เพิ่ม/แก้ไขสมาชิก",
    "members.delete": "ลบสมาชิก",
    "settings": "จัดการตำแหน่ง ปีการศึกษา แผนกวิชา",
    "reports": "ดูรายงานและส่งออกไฟล์",
    "users": "จัดการผู้ใช้งาน",
    "backup": "สำรองข้อมูล",
}

# สิทธิ์เริ่มต้นตามบทบาท (superadmin ได้ทุกสิทธิ์เสมอ)
ROLE_PERMISSIONS = {
    "superadmin": list(ALL_PERMISSIONS),
    "admin": ["members.view", "members.edit", "members.delete", "settings", "reports", "backup"],
    "staff": ["members.view", "reports"],
}


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    full_name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120))
    role = db.Column(db.String(20), nullable=False, default="staff")
    permissions = db.Column(db.Text, nullable=False, default="")
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    last_login = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.now)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)

    __table_args__ = (
        db.CheckConstraint("role IN ('superadmin','admin','staff')", name="ck_users_role"),
    )

    # ---- รหัสผ่าน --------------------------------------------------------
    def set_password(self, raw: str):
        self.password_hash = bcrypt.hashpw(raw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    def check_password(self, raw: str) -> bool:
        try:
            return bcrypt.checkpw(raw.encode("utf-8"), self.password_hash.encode("utf-8"))
        except ValueError:
            return False

    # ---- สิทธิ์ ----------------------------------------------------------
    @property
    def permission_list(self):
        if self.role == "superadmin":
            return list(ALL_PERMISSIONS)
        return [p for p in (self.permissions or "").split(",") if p in ALL_PERMISSIONS]

    def set_permissions(self, perms):
        self.permissions = ",".join(p for p in (perms or []) if p in ALL_PERMISSIONS)

    def has_permission(self, perm: str) -> bool:
        return perm in self.permission_list

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "full_name": self.full_name,
            "email": self.email,
            "role": self.role,
            "permissions": self.permission_list,
            "is_active": self.is_active,
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
