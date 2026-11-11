"""ระบบบริหารจัดการสมาชิกองค์การนักวิชาชีพในอนาคตแห่งประเทศไทย วิทยาลัยเทคนิคมีนบุรี
(Membership Management System for the Association of Future Thai Professionals, Minburi Technical College)
— Flask REST API

รัน:  python app.py   แล้วเปิด http://localhost:5000
"""
import os

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.exceptions import HTTPException, RequestEntityTooLarge

from config import Config
from models import db


def create_app(config_class=Config):
    app = Flask(__name__, static_folder=None)
    app.config.from_object(config_class)
    app.json.ensure_ascii = False
    app.json.sort_keys = False

    folders = [app.config["UPLOAD_FOLDER"], app.config["BACKUP_FOLDER"]]
    if app.config.get("SQLITE_PATH"):
        folders.append(os.path.dirname(app.config["SQLITE_PATH"]))
    for folder in folders:
        os.makedirs(folder, exist_ok=True)

    if not app.config.get("SECRET_KEY_FROM_ENV"):
        app.logger.warning("ยังไม่ได้ตั้ง SECRET_KEY ในไฟล์ .env — ระบบสุ่มให้ชั่วคราว ผู้ใช้ต้อง login ใหม่ทุกครั้งที่รีสตาร์ต")

    origins = app.config["CORS_ORIGINS"]
    origins = [o.strip() for o in origins.split(",")] if "," in origins else origins
    CORS(app, resources={r"/api/*": {"origins": origins}}, expose_headers=["Content-Disposition"])
    db.init_app(app)

    # ---- API ---------------------------------------------------------
    from routes.auth import bp as auth_bp
    from routes.dashboard import bp as dashboard_bp
    from routes.members import bp as members_bp
    from routes.settings import bp as settings_bp
    from routes.reports import bp as reports_bp
    from routes.users import bp as users_bp
    from routes.backup import bp as backup_bp
    from routes.files import bp as files_bp
    from routes.address import bp as address_bp
    from routes.committee import bp as committee_bp
    from routes.elections import bp as elections_bp

    for bp in (auth_bp, dashboard_bp, members_bp, settings_bp, reports_bp, users_bp, backup_bp, files_bp, address_bp,
               committee_bp, elections_bp):
        app.register_blueprint(bp)

    # ---- สร้างตารางอัตโนมัติเมื่อรันครั้งแรก ----------------------------
    with app.app_context():
        db.create_all()
        from seed_defaults import ensure_defaults
        ensure_defaults()

    # ---- จัดการ error ให้ตอบเป็น JSON -----------------------------------
    @app.errorhandler(RequestEntityTooLarge)
    def too_large(_e):
        mb = app.config["MAX_CONTENT_LENGTH"] // (1024 * 1024)
        return jsonify({"success": False, "message": f"ไฟล์มีขนาดใหญ่เกินไป (รวมไม่เกิน {mb} MB ต่อครั้ง)"}), 413

    @app.errorhandler(HTTPException)
    def http_error(e):
        from flask import request
        if request.path.startswith("/api/"):
            return jsonify({"success": False, "message": e.description}), e.code
        return e

    @app.errorhandler(Exception)
    def server_error(e):
        app.logger.exception(e)
        db.session.rollback()
        return jsonify({"success": False, "message": "เกิดข้อผิดพลาดภายในระบบ"}), 500

    # ---- เสิร์ฟหน้า Frontend (ไฟล์ HTML/CSS/JS เท่านั้น ข้อมูลทั้งหมดต้องผ่าน API + token) --
    frontend = app.config["FRONTEND_FOLDER"]

    @app.route("/")
    def index():
        return send_from_directory(frontend, "index.html")

    @app.route("/<path:filename>")
    def frontend_files(filename):
        return send_from_directory(frontend, filename)

    return app


app = create_app()

if __name__ == "__main__":
    # ค่าทั้งหมดอ่านจากไฟล์ .env (HOST, PORT, FLASK_DEBUG)
    app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)
