"""POST /api/auth/login, GET /api/auth/me, POST /api/auth/change-password"""
from datetime import datetime

from flask import Blueprint, g, jsonify, request

from models import db, User
from utils.auth import create_token, error, login_required

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    if not username or not password:
        return error("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน")
    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", 401)
    if not user.is_active:
        return error("บัญชีนี้ถูกระงับการใช้งาน", 403)
    user.last_login = datetime.now()
    db.session.commit()
    return jsonify({"success": True, "token": create_token(user), "user": user.to_dict()})


@bp.get("/me")
@login_required
def me():
    return jsonify({"success": True, "user": g.user.to_dict()})


@bp.post("/change-password")
@login_required
def change_password():
    data = request.get_json(silent=True) or {}
    if not g.user.check_password(data.get("old_password") or ""):
        return error("รหัสผ่านเดิมไม่ถูกต้อง")
    new = data.get("new_password") or ""
    if len(new) < 8:
        return error("รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร")
    g.user.set_password(new)
    db.session.commit()
    return jsonify({"success": True, "message": "เปลี่ยนรหัสผ่านเรียบร้อย"})
