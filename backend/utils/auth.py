"""JWT และการตรวจสอบสิทธิ์"""
from datetime import datetime, timezone
from functools import wraps

import jwt
from flask import current_app, g, jsonify, request

from models import db, User


def create_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "role": user.role,
        "iat": now,
        "exp": now + current_app.config["JWT_EXPIRES"],
    }
    return jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm=current_app.config["JWT_ALGORITHM"])


def decode_token(token: str):
    return jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=[current_app.config["JWT_ALGORITHM"]])


def _get_token():
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header[7:].strip()
    # ใช้กับ <img src> และลิงก์ดาวน์โหลดไฟล์ ที่ส่ง header ไม่ได้
    return request.args.get("token")


def error(message, status=400, **extra):
    return jsonify({"success": False, "message": message, **extra}), status


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        token = _get_token()
        if not token:
            return error("กรุณาเข้าสู่ระบบ", 401)
        try:
            payload = decode_token(token)
        except jwt.ExpiredSignatureError:
            return error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่", 401)
        except jwt.InvalidTokenError:
            return error("Token ไม่ถูกต้อง", 401)
        user = db.session.get(User, int(payload["sub"]))
        if not user or not user.is_active:
            return error("บัญชีผู้ใช้ถูกระงับหรือไม่มีอยู่", 401)
        g.user = user
        return fn(*args, **kwargs)
    return wrapper


def permission_required(*perms):
    """ต้องมีสิทธิ์อย่างน้อยหนึ่งรายการจาก perms"""
    def decorator(fn):
        @wraps(fn)
        @login_required
        def wrapper(*args, **kwargs):
            if not any(g.user.has_permission(p) for p in perms):
                return error("คุณไม่มีสิทธิ์ใช้งานส่วนนี้", 403)
            return fn(*args, **kwargs)
        return wrapper
    return decorator
