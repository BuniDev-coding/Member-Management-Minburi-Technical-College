"""สำรองข้อมูล (SQLite)

GET    /api/backups               รายการไฟล์สำรอง
POST   /api/backups               สำรอง app.db -> database/backups/app_YYYYMMDD_HHMMSS.db
GET    /api/backups/<name>        ดาวน์โหลดไฟล์สำรอง
DELETE /api/backups/<name>        ลบไฟล์สำรอง
"""
import os
import re
import sqlite3
from datetime import datetime

from flask import Blueprint, current_app, jsonify, send_from_directory

from models import db
from utils.auth import error, permission_required

bp = Blueprint("backup", __name__, url_prefix="/api/backups")
NAME_RE = re.compile(r"^app_\d{8}_\d{6}\.db$")


def _folder():
    return current_app.config["BACKUP_FOLDER"]


@bp.get("")
@permission_required("backup")
def list_backups():
    items = []
    folder = _folder()
    if os.path.isdir(folder):
        for name in sorted(os.listdir(folder), reverse=True):
            if NAME_RE.match(name):
                st = os.stat(os.path.join(folder, name))
                items.append({"name": name, "size": st.st_size,
                              "created_at": datetime.fromtimestamp(st.st_mtime).isoformat()})
    return jsonify({"success": True, "items": items})


@bp.post("")
@permission_required("backup")
def create_backup():
    if db.engine.url.get_backend_name() != "sqlite":
        return error("การสำรองด้วยปุ่มนี้รองรับเฉพาะ SQLite (ฐานข้อมูลอื่นให้ใช้ pg_dump / mysqldump)", 400)
    src_path = db.engine.url.database
    os.makedirs(_folder(), exist_ok=True)
    name = f"app_{datetime.now():%Y%m%d_%H%M%S}.db"
    dst_path = os.path.join(_folder(), name)
    # ใช้ SQLite Online Backup API — ปลอดภัยแม้ระบบกำลังใช้งาน
    src = sqlite3.connect(src_path)
    dst = sqlite3.connect(dst_path)
    try:
        src.backup(dst)
    finally:
        dst.close()
        src.close()
    return jsonify({"success": True, "message": f"สำรองข้อมูลเรียบร้อย: {name}",
                    "item": {"name": name, "size": os.path.getsize(dst_path),
                             "created_at": datetime.now().isoformat()}}), 201


@bp.get("/<name>")
@permission_required("backup")
def download_backup(name):
    if not NAME_RE.match(name):
        return error("ชื่อไฟล์ไม่ถูกต้อง", 400)
    return send_from_directory(_folder(), name, as_attachment=True, download_name=name)


@bp.delete("/<name>")
@permission_required("backup")
def delete_backup(name):
    path = os.path.join(_folder(), name)
    if not NAME_RE.match(name) or not os.path.isfile(path):
        return error("ไม่พบไฟล์สำรอง", 404)
    os.remove(path)
    return jsonify({"success": True, "message": "ลบไฟล์สำรองแล้ว"})
