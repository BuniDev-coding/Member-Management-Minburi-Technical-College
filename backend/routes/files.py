"""GET /api/files/<path> — ส่งรูปภาพที่อัปโหลด (ต้องมี token เท่านั้น ไม่เปิดสาธารณะ)"""
from flask import Blueprint, current_app, send_from_directory

from utils.auth import login_required

bp = Blueprint("files", __name__, url_prefix="/api/files")


@bp.get("/<path:filename>")
@login_required
def get_file(filename):
    resp = send_from_directory(current_app.config["UPLOAD_FOLDER"], filename)
    resp.headers["Cache-Control"] = "private, max-age=3600"
    return resp
