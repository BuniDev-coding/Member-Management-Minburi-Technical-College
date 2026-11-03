"""จัดการผู้ใช้งาน (Admin)

GET    /api/users               รายการผู้ใช้
GET    /api/users/permissions   รายการสิทธิ์และสิทธิ์เริ่มต้นตามบทบาท
POST   /api/users               เพิ่มผู้ใช้
PUT    /api/users/<id>          แก้ไข (ส่ง password เพื่อรีเซ็ตรหัสผ่าน)
DELETE /api/users/<id>          ลบ
"""
from flask import Blueprint, g, jsonify, request

from models import db, User, ALL_PERMISSIONS, ROLE_PERMISSIONS
from utils.auth import error, permission_required
from utils.validators import clean_str, parse_bool, EMAIL_RE

bp = Blueprint("users", __name__, url_prefix="/api/users")
ROLES = {"superadmin": "ผู้ดูแลระบบสูงสุด", "admin": "ผู้ดูแลระบบ", "staff": "เจ้าหน้าที่"}


@bp.get("")
@permission_required("users")
def list_users():
    return jsonify({"success": True, "items": [u.to_dict() for u in User.query.order_by(User.id)]})


@bp.get("/permissions")
@permission_required("users")
def permissions():
    return jsonify({"success": True, "permissions": ALL_PERMISSIONS, "roles": ROLES, "role_defaults": ROLE_PERMISSIONS})


def _superadmins_left(exclude_id):
    return User.query.filter(User.role == "superadmin", User.is_active.is_(True), User.id != exclude_id).count()


def _apply(u: User, data, is_new):
    username = clean_str(data.get("username"), 50)
    if is_new or username:
        if not username or len(username) < 3 or not username.replace("_", "").replace(".", "").isalnum():
            return "ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัว (a-z, 0-9, _ .)"
        dup = User.query.filter(User.username == username, User.id != (u.id or 0)).first()
        if dup:
            return "ชื่อผู้ใช้นี้ถูกใช้แล้ว"
        u.username = username
    full_name = clean_str(data.get("full_name"), 120)
    if not full_name:
        return "กรุณากรอกชื่อ-นามสกุล"
    u.full_name = full_name
    u.email = clean_str(data.get("email"), 120)
    if u.email and not EMAIL_RE.match(u.email):
        return "รูปแบบอีเมลไม่ถูกต้อง"
    role = data.get("role") or "staff"
    if role not in ROLES:
        return "บทบาทไม่ถูกต้อง"
    if role == "superadmin" and g.user.role != "superadmin":
        return "เฉพาะผู้ดูแลระบบสูงสุดเท่านั้นที่กำหนดบทบาทนี้ได้"
    if not is_new and u.role == "superadmin" and role != "superadmin" and not _superadmins_left(u.id):
        return "ต้องมีผู้ดูแลระบบสูงสุดอย่างน้อย 1 บัญชี"
    u.role = role
    perms = data.get("permissions")
    u.set_permissions(perms if isinstance(perms, list) else ROLE_PERMISSIONS[role])
    if "is_active" in data:
        active = parse_bool(data["is_active"])
        if not active and u.id == g.user.id:
            return "ไม่สามารถระงับบัญชีของตนเองได้"
        if not active and u.role == "superadmin" and not _superadmins_left(u.id or 0):
            return "ต้องมีผู้ดูแลระบบสูงสุดที่ใช้งานได้อย่างน้อย 1 บัญชี"
        u.is_active = active
    password = data.get("password") or ""
    if is_new or password:
        if len(password) < 8:
            return "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"
        u.set_password(password)
    return None


@bp.post("")
@permission_required("users")
def create_user():
    u = User()
    msg = _apply(u, request.get_json(silent=True) or {}, True)
    if msg:
        return error(msg, 422)
    db.session.add(u)
    db.session.commit()
    return jsonify({"success": True, "message": "เพิ่มผู้ใช้งานแล้ว", "item": u.to_dict()}), 201


@bp.put("/<int:uid>")
@permission_required("users")
def update_user(uid):
    u = db.get_or_404(User, uid, description="ไม่พบผู้ใช้งาน")
    if u.role == "superadmin" and g.user.role != "superadmin":
        return error("ไม่มีสิทธิ์แก้ไขบัญชีผู้ดูแลระบบสูงสุด", 403)
    with db.session.no_autoflush:
        msg = _apply(u, request.get_json(silent=True) or {}, False)
    if msg:
        db.session.rollback()
        return error(msg, 422)
    db.session.commit()
    return jsonify({"success": True, "message": "บันทึกแล้ว", "item": u.to_dict()})


@bp.delete("/<int:uid>")
@permission_required("users")
def delete_user(uid):
    u = db.get_or_404(User, uid, description="ไม่พบผู้ใช้งาน")
    if u.id == g.user.id:
        return error("ไม่สามารถลบบัญชีของตนเองได้", 409)
    if u.role == "superadmin" and (g.user.role != "superadmin" or not _superadmins_left(u.id)):
        return error("ไม่สามารถลบบัญชีผู้ดูแลระบบสูงสุดนี้ได้", 409)
    db.session.delete(u)
    db.session.commit()
    return jsonify({"success": True, "message": "ลบผู้ใช้งานแล้ว"})
