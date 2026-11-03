"""การตั้งค่าระบบ — อ่านค่าจากไฟล์ .env ที่โฟลเดอร์หลักของโปรเจกต์

- แก้ค่าที่ไฟล์ .env (ดูตัวอย่างและคำอธิบายใน .env.example)
- ถ้ายังไม่มี .env ระบบจะสร้างจาก .env.example ให้อัตโนมัติ พร้อมสุ่ม SECRET_KEY
- ค่าที่ตั้งเป็น environment variable ของระบบปฏิบัติการจะมีผลเหนือค่าในไฟล์ .env

ย้ายฐานข้อมูลไป PostgreSQL / MySQL ได้โดยแก้แค่ DATABASE_URL ใน .env เช่น
    postgresql+psycopg2://user:pass@localhost:5432/managemember
    mysql+pymysql://user:pass@localhost:3306/managemember?charset=utf8mb4
"""
import os
import secrets
from datetime import timedelta

from dotenv import load_dotenv

BASE_DIR = os.path.abspath(os.path.dirname(__file__))          # backend/
PROJECT_DIR = os.path.dirname(BASE_DIR)                          # โฟลเดอร์โปรเจกต์
ENV_FILE = os.path.join(PROJECT_DIR, ".env")
ENV_EXAMPLE = os.path.join(PROJECT_DIR, ".env.example")


def _create_env_file():
    """สร้าง .env จาก .env.example ครั้งแรก และใส่ SECRET_KEY แบบสุ่ม"""
    if os.path.exists(ENV_FILE) or not os.path.exists(ENV_EXAMPLE):
        return
    with open(ENV_EXAMPLE, encoding="utf-8") as f:
        lines = f.read().splitlines()
    out = [f"SECRET_KEY={secrets.token_hex(32)}" if ln.startswith("SECRET_KEY=") else ln for ln in lines]
    with open(ENV_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")
    print(f"สร้างไฟล์ตั้งค่า {ENV_FILE} เรียบร้อย (สุ่ม SECRET_KEY ให้แล้ว)")


_create_env_file()
load_dotenv(ENV_FILE, encoding="utf-8")   # ไม่ทับค่าที่มีอยู่แล้วใน environment


# ---- ตัวช่วยอ่านค่า -----------------------------------------------------
def env_str(key, default=""):
    v = os.environ.get(key)
    return v.strip() if v is not None and v.strip() != "" else default


def env_int(key, default):
    try:
        return int(env_str(key, str(default)))
    except ValueError:
        return default


def env_bool(key, default=False):
    v = env_str(key, "")
    return default if v == "" else v.lower() in ("1", "true", "yes", "on")


def env_path(key, default):
    """path แบบสัมพัทธ์จะนับจากโฟลเดอร์หลักของโปรเจกต์"""
    p = env_str(key, default)
    return p if os.path.isabs(p) else os.path.normpath(os.path.join(PROJECT_DIR, p))


# ---- ฐานข้อมูล ---------------------------------------------------------
def _database_url():
    url = env_str("DATABASE_URL", "sqlite:///database/app.db")
    # sqlite แบบ path สัมพัทธ์ (sqlite:///database/app.db) → แปลงเป็น path เต็มจากโฟลเดอร์โปรเจกต์
    if url.startswith("sqlite:///") and not url.startswith("sqlite:////"):
        path = url[len("sqlite:///"):]
        if path and path != ":memory:" and not os.path.isabs(path):
            url = "sqlite:///" + os.path.normpath(os.path.join(PROJECT_DIR, path)).replace("\\", "/")
    return url


DATABASE_URL = _database_url()
SQLITE_PATH = DATABASE_URL[len("sqlite:///"):] if DATABASE_URL.startswith("sqlite:///") else None
DATABASE_DIR = os.path.join(PROJECT_DIR, "database")


class Config:
    # ---- ความปลอดภัย ---------------------------------------------------
    SECRET_KEY = env_str("SECRET_KEY") or secrets.token_hex(32)   # ไม่ตั้ง = สุ่มใหม่ทุกครั้งที่รัน (ต้อง login ใหม่)
    SECRET_KEY_FROM_ENV = bool(env_str("SECRET_KEY"))

    # ---- ฐานข้อมูล -----------------------------------------------------
    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}
    SQLITE_PATH = SQLITE_PATH

    # ---- JWT -----------------------------------------------------------
    JWT_ALGORITHM = "HS256"
    JWT_EXPIRES = timedelta(hours=env_int("JWT_EXPIRES_HOURS", 8))

    # ---- เซิร์ฟเวอร์ ----------------------------------------------------
    HOST = env_str("HOST", "127.0.0.1")
    PORT = env_int("PORT", 5000)
    DEBUG = env_bool("FLASK_DEBUG", False)
    CORS_ORIGINS = env_str("CORS_ORIGINS", "*")   # กรณีเปิด frontend แยกพอร์ต (คั่นหลายค่าด้วย ,)

    # ---- ไฟล์ ----------------------------------------------------------
    UPLOAD_FOLDER = env_path("UPLOAD_FOLDER", "backend/uploads")
    BACKUP_FOLDER = env_path("BACKUP_FOLDER", "database/backups")
    FONT_FOLDER = os.path.join(BASE_DIR, "fonts")
    FRONTEND_FOLDER = os.path.join(PROJECT_DIR, "frontend")
    MAX_UPLOAD_MB = env_int("MAX_UPLOAD_MB", 5)                       # ต่อไฟล์
    MAX_CONTENT_LENGTH = env_int("MAX_REQUEST_MB", 20) * 1024 * 1024  # รวมต่อคำขอ
    ALLOWED_IMAGE_EXT = {"jpg", "jpeg", "png", "gif", "webp"}

    # ---- ข้อมูลองค์กร (หัวรายงาน Excel / PDF) ----------------------------
    ORG_NAME = env_str("ORG_NAME", "องค์การนักวิชาชีพแห่งประเทศไทย วิทยาลัยเทคนิคมีนบุรี")
