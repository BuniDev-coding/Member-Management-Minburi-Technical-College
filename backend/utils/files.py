"""จัดการไฟล์อัปโหลด (เก็บไฟล์ใน backend/uploads และเก็บ path ในฐานข้อมูล)"""
import os
import uuid
from datetime import datetime

from flask import current_app

from .validators import ValidationError


def allowed_image(filename: str) -> bool:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return ext in current_app.config["ALLOWED_IMAGE_EXT"]


def save_image(file_storage, subfolder="members") -> str:
    """บันทึกรูปและคืน path แบบสัมพัทธ์ เช่น members/2026/11/abc.jpg"""
    if not file_storage or not file_storage.filename:
        return None
    if not allowed_image(file_storage.filename):
        raise ValidationError({"photo": "อนุญาตเฉพาะไฟล์รูปภาพ jpg, png, gif, webp"})
    limit_mb = current_app.config.get("MAX_UPLOAD_MB", 5)
    file_storage.stream.seek(0, os.SEEK_END)
    size = file_storage.stream.tell()
    file_storage.stream.seek(0)
    if size > limit_mb * 1024 * 1024:
        raise ValidationError({"photo": f"ไฟล์ {file_storage.filename} มีขนาดเกิน {limit_mb} MB"})
    ext =file_storage.filename.rsplit(".", 1)[-1].lower()
    now = datetime.now()
    rel_dir = f"{subfolder}/{now:%Y}/{now:%m}"
    abs_dir = os.path.join(current_app.config["UPLOAD_FOLDER"], *rel_dir.split("/"))
    os.makedirs(abs_dir, exist_ok=True)
    name = f"{uuid.uuid4().hex}.{ext}"
    file_storage.save(os.path.join(abs_dir, name))
    return f"{rel_dir}/{name}"


def delete_file(rel_path: str):
    if not rel_path:
        return
    root = os.path.realpath(current_app.config["UPLOAD_FOLDER"])
    path = os.path.realpath(os.path.join(root, rel_path))
    if path.startswith(root + os.sep) and os.path.isfile(path):
        try:
            os.remove(path)
        except OSError:
            pass
