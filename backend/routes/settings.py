"""ข้อมูลตั้งค่า: ตำแหน่ง ปีการศึกษา แผนกวิชา

GET  /api/meta                         ข้อมูลประกอบฟอร์ม (ปี ตำแหน่ง แผนก สถานะ ระดับชั้น รูปแบบ)
GET|POST        /api/positions         รายการ / เพิ่ม
PUT|DELETE      /api/positions/<id>    แก้ไข / ลบ
GET|POST        /api/years             รายการ (พร้อมจำนวนสมาชิก) / เพิ่ม
PUT|DELETE      /api/years/<id>        แก้ไข / ลบ
POST            /api/years/<id>/set-current   ตั้งเป็นปีการศึกษาปัจจุบัน
GET|POST        /api/departments       รายการ / เพิ่ม
PUT|DELETE      /api/departments/<id>  แก้ไข / ลบ
GET|POST        /api/options           ตัวเลือกดรอปดาวน์ของแบบฟอร์มสมัคร (คำนำหน้า เพศ ฯลฯ) / เพิ่ม
PUT|DELETE      /api/options/<id>      แก้ไข / ลบ
POST            /api/options/reorder   จัดลำดับ {category, ids: [...]}
"""
from flask import Blueprint, jsonify, request
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from models import (db, Position, AcademicYear, Department, Member, MemberPosition, FormOption,
                    OPTION_CATEGORIES, STATUSES, TEMPLATES)
from models.member import ACTIVITY_CATEGORIES
from routes.members import in_year_clause
from utils.auth import error, login_required, permission_required
from utils.validators import ValidationError, clean_str, parse_bool, parse_date, parse_int

bp = Blueprint("settings", __name__, url_prefix="/api")


def _commit(msg_conflict):
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return error(msg_conflict, 409)
    return None


@bp.get("/meta")
@login_required
def meta():
    cur = AcademicYear.current()
    return jsonify({
        "success": True,
        "years": [y.to_dict() for y in AcademicYear.query.order_by(AcademicYear.year.desc())],
        "current_year_id": cur.id if cur else None,
        "positions": [p.to_dict() for p in Position.query.order_by(Position.level, Position.id)],
        "departments": [d.to_dict() for d in Department.query.order_by(Department.name)],
        "statuses": STATUSES,
        "templates": TEMPLATES,
        "levels": FormOption.names("education_level"),
        "member_types": FormOption.names("member_type"),
        "prefixes": FormOption.names("prefix"),
        "genders": FormOption.names("gender"),
        "blood_types": FormOption.names("blood_type"),
        "activity_categories": ACTIVITY_CATEGORIES,
    })


# =====================================================================
# ตำแหน่ง
# =====================================================================
@bp.get("/positions")
@login_required
def list_positions():
    year_id = parse_int(request.args.get("year_id")) or (AcademicYear.current().id if AcademicYear.current() else None)
    counts = dict(db.session.query(MemberPosition.position_id, func.count(MemberPosition.id))
                  .filter(MemberPosition.academic_year_id == year_id).group_by(MemberPosition.position_id).all())
    total_counts = dict(db.session.query(MemberPosition.position_id, func.count(MemberPosition.id))
                        .group_by(MemberPosition.position_id).all())
    items = []
    for p in Position.query.order_by(Position.level, Position.id):
        d = p.to_dict()
        d["count"] = counts.get(p.id, 0)
        d["total_records"] = total_counts.get(p.id, 0)
        items.append(d)
    return jsonify({"success": True, "items": items, "year_id": year_id})


def _position_from(p: Position, data):
    name = clean_str(data.get("name"), 100)
    if not name:
        raise ValidationError({"name": "กรุณากรอกชื่อตำแหน่ง"})
    p.name = name
    p.level = parse_int(data.get("level")) or 99
    p.is_executive = parse_bool(data.get("is_executive", False))
    p.is_committee = parse_bool(data.get("is_committee", False))
    p.color = clean_str(data.get("color"), 20) or "#1F4FB5"
    p.description = clean_str(data.get("description"))


@bp.post("/positions")
@permission_required("settings")
def create_position():
    p = Position()
    try:
        _position_from(p, request.get_json(silent=True) or {})
    except ValidationError as e:
        return error(str(e), 422)
    db.session.add(p)
    return _commit("มีชื่อตำแหน่งนี้อยู่แล้ว") or (jsonify({"success": True, "message": "เพิ่มตำแหน่งแล้ว",
                                                           "item": p.to_dict()}), 201)


@bp.put("/positions/<int:pid>")
@permission_required("settings")
def update_position(pid):
    p = db.get_or_404(Position, pid, description="ไม่พบตำแหน่ง")
    try:
        _position_from(p, request.get_json(silent=True) or {})
    except ValidationError as e:
        return error(str(e), 422)
    return _commit("มีชื่อตำแหน่งนี้อยู่แล้ว") or jsonify({"success": True, "message": "บันทึกแล้ว", "item": p.to_dict()})


@bp.delete("/positions/<int:pid>")
@permission_required("settings")
def delete_position(pid):
    p = db.get_or_404(Position, pid, description="ไม่พบตำแหน่ง")
    used = MemberPosition.query.filter_by(position_id=pid).count()
    if used:
        return error(f"ลบไม่ได้ เนื่องจากมีประวัติการดำรงตำแหน่งนี้ {used} รายการ", 409)
    db.session.delete(p)
    db.session.commit()
    return jsonify({"success": True, "message": "ลบตำแหน่งแล้ว"})


# =====================================================================
# ปีการศึกษา
# =====================================================================
@bp.get("/years")
@login_required
def list_years():
    items = []
    for y in AcademicYear.query.order_by(AcademicYear.year.desc()):
        d = y.to_dict()
        d["member_count"] = Member.query.filter(in_year_clause(y.id)).count()
        d["registered_count"] = Member.query.filter_by(academic_year_id=y.id).count()
        items.append(d)
    return jsonify({"success": True, "items": items})


def _year_from(y: AcademicYear, data):
    year = parse_int(data.get("year"))
    if not year or not (2400 <= year <= 2700):
        raise ValidationError({"year": "กรุณากรอกปีการศึกษาเป็นปี พ.ศ. (เช่น 2569)"})
    y.year = year
    y.name = clean_str(data.get("name"), 100) or f"ปีการศึกษา {year}"
    y.start_date = parse_date(data.get("start_date"))
    y.end_date = parse_date(data.get("end_date"))
    if y.start_date and y.end_date and y.end_date < y.start_date:
        raise ValidationError({"end_date": "วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น"})
    y.note = clean_str(data.get("note"))


def _set_current(y: AcademicYear):
    AcademicYear.query.update({AcademicYear.is_current: False})
    y.is_current = True


@bp.post("/years")
@permission_required("settings")
def create_year():
    data = request.get_json(silent=True) or {}
    y = AcademicYear()
    try:
        _year_from(y, data)
    except ValidationError as e:
        return error(str(e), 422)
    db.session.add(y)
    if parse_bool(data.get("is_current", False)) or AcademicYear.query.count() == 0:
        db.session.flush()
        _set_current(y)
    return _commit("มีปีการศึกษานี้อยู่แล้ว") or (jsonify({"success": True, "message": "เพิ่มปีการศึกษาแล้ว",
                                                          "item": y.to_dict()}), 201)


@bp.put("/years/<int:yid>")
@permission_required("settings")
def update_year(yid):
    y = db.get_or_404(AcademicYear, yid, description="ไม่พบปีการศึกษา")
    data = request.get_json(silent=True) or {}
    try:
        _year_from(y, data)
    except ValidationError as e:
        return error(str(e), 422)
    if parse_bool(data.get("is_current", False)):
        _set_current(y)
    return _commit("มีปีการศึกษานี้อยู่แล้ว") or jsonify({"success": True, "message": "บันทึกแล้ว", "item": y.to_dict()})


@bp.post("/years/<int:yid>/set-current")
@permission_required("settings")
def set_current_year(yid):
    y = db.get_or_404(AcademicYear, yid, description="ไม่พบปีการศึกษา")
    _set_current(y)
    db.session.commit()
    return jsonify({"success": True, "message": f"ตั้ง {y.name} เป็นปีการศึกษาปัจจุบันแล้ว"})


@bp.delete("/years/<int:yid>")
@permission_required("settings")
def delete_year(yid):
    y = db.get_or_404(AcademicYear, yid, description="ไม่พบปีการศึกษา")
    used = Member.query.filter_by(academic_year_id=yid).count() + MemberPosition.query.filter_by(academic_year_id=yid).count()
    if used:
        return error("ลบไม่ได้ เนื่องจากมีสมาชิกหรือประวัติตำแหน่งในปีการศึกษานี้", 409)
    db.session.delete(y)
    db.session.commit()
    return jsonify({"success": True, "message": "ลบปีการศึกษาแล้ว"})


# =====================================================================
# แผนกวิชา
# =====================================================================
@bp.get("/departments")
@login_required
def list_departments():
    counts = dict(db.session.query(Member.department_id, func.count(Member.id)).group_by(Member.department_id).all())
    items = [{**d.to_dict(), "member_count": counts.get(d.id, 0)} for d in Department.query.order_by(Department.name)]
    return jsonify({"success": True, "items": items})


def _dept_from(d: Department, data):
    name = clean_str(data.get("name"), 120)
    if not name:
        raise ValidationError({"name": "กรุณากรอกชื่อแผนกวิชา"})
    d.name = name
    d.code = clean_str(data.get("code"), 20)


@bp.post("/departments")
@permission_required("settings")
def create_department():
    d = Department()
    try:
        _dept_from(d, request.get_json(silent=True) or {})
    except ValidationError as e:
        return error(str(e), 422)
    db.session.add(d)
    return _commit("ชื่อหรือรหัสแผนกวิชาซ้ำ") or (jsonify({"success": True, "message": "เพิ่มแผนกวิชาแล้ว",
                                                          "item": d.to_dict()}), 201)


@bp.put("/departments/<int:did>")
@permission_required("settings")
def update_department(did):
    d = db.get_or_404(Department, did, description="ไม่พบแผนกวิชา")
    try:
        _dept_from(d, request.get_json(silent=True) or {})
    except ValidationError as e:
        return error(str(e), 422)
    return _commit("ชื่อหรือรหัสแผนกวิชาซ้ำ") or jsonify({"success": True, "message": "บันทึกแล้ว", "item": d.to_dict()})


@bp.delete("/departments/<int:did>")
@permission_required("settings")
def delete_department(did):
    d = db.get_or_404(Department, did, description="ไม่พบแผนกวิชา")
    used = Member.query.filter_by(department_id=did).count()
    if used:
        return error(f"ลบไม่ได้ เนื่องจากมีสมาชิกในแผนกนี้ {used} คน", 409)
    db.session.delete(d)
    db.session.commit()
    return jsonify({"success": True, "message": "ลบแผนกวิชาแล้ว"})


# =====================================================================
# ตัวเลือกดรอปดาวน์ของแบบฟอร์มสมัคร (คำนำหน้า เพศ กรุ๊ปเลือด ระดับชั้น ระดับสมาชิก)
# =====================================================================
def _option_column(category):
    return getattr(Member, OPTION_CATEGORIES[category][1])


@bp.get("/options")
@login_required
def list_options():
    categories = []
    for cat, (label, _col, max_len, _defaults) in OPTION_CATEGORIES.items():
        col = _option_column(cat)
        used = dict(db.session.query(col, func.count(Member.id)).filter(col.isnot(None)).group_by(col).all())
        items = [{**o.to_dict(), "member_count": used.get(o.name, 0)}
                 for o in FormOption.query.filter_by(category=cat).order_by(FormOption.sort_order, FormOption.id)]
        categories.append({"key": cat, "label": label, "max_length": max_len, "items": items})
    return jsonify({"success": True, "categories": categories})


def _option_name(category, data):
    label, _col, max_len, _defaults = OPTION_CATEGORIES[category]
    name = " ".join((clean_str(data.get("name")) or "").split())
    if not name:
        raise ValidationError({"name": f"กรุณากรอก{label}"})
    if len(name) > max_len:
        raise ValidationError({"name": f"{label}ยาวได้ไม่เกิน {max_len} ตัวอักษร"})
    return name


@bp.post("/options")
@permission_required("settings")
def create_option():
    data = request.get_json(silent=True) or {}
    cat = data.get("category")
    if cat not in OPTION_CATEGORIES:
        return error("ไม่พบหมวดตัวเลือก")
    try:
        name = _option_name(cat, data)
    except ValidationError as e:
        return error(str(e), 422, errors=e.errors)
    last = db.session.query(func.max(FormOption.sort_order)).filter(FormOption.category == cat).scalar() or 0
    o = FormOption(category=cat, name=name, sort_order=last + 1)
    db.session.add(o)
    return _commit("มีตัวเลือกนี้อยู่แล้ว") or (jsonify({"success": True, "message": "เพิ่มตัวเลือกแล้ว",
                                                       "item": o.to_dict()}), 201)


@bp.put("/options/<int:oid>")
@permission_required("settings")
def update_option(oid):
    o = db.get_or_404(FormOption, oid, description="ไม่พบตัวเลือก")
    try:
        name = _option_name(o.category, request.get_json(silent=True) or {})
    except ValidationError as e:
        return error(str(e), 422, errors=e.errors)
    old, changed = o.name, 0
    if name != old:
        if FormOption.query.filter(FormOption.category == o.category, FormOption.name == name,
                                   FormOption.id != o.id).first():
            return error("มีตัวเลือกนี้อยู่แล้ว", 409)
        o.name = name
        # เปลี่ยนชื่อตัวเลือก → ปรับข้อมูลสมาชิกที่ใช้ค่าเดิมให้ตรงกัน
        col = _option_column(o.category)
        changed = Member.query.filter(col == old).update({col: name}, synchronize_session=False)
    msg = "บันทึกแล้ว" + (f" (ปรับข้อมูลสมาชิก {changed} คนให้ตรงกัน)" if changed else "")
    return _commit("มีตัวเลือกนี้อยู่แล้ว") or jsonify({"success": True, "message": msg, "item": o.to_dict()})


@bp.delete("/options/<int:oid>")
@permission_required("settings")
def delete_option(oid):
    o = db.get_or_404(FormOption, oid, description="ไม่พบตัวเลือก")
    db.session.delete(o)   # สมาชิกที่เคยเลือกค่านี้ยังเก็บค่าเดิมไว้ ไม่ถูกลบตาม
    db.session.commit()
    return jsonify({"success": True, "message": "ลบตัวเลือกแล้ว"})


@bp.post("/options/reorder")
@permission_required("settings")
def reorder_options():
    data = request.get_json(silent=True) or {}
    cat = data.get("category")
    if cat not in OPTION_CATEGORIES:
        return error("ไม่พบหมวดตัวเลือก")
    rows = {o.id: o for o in FormOption.query.filter_by(category=cat)}
    ids = [i for i in (parse_int(x) for x in (data.get("ids") or [])) if i in rows]
    for order, oid in enumerate(ids, 1):
        rows[oid].sort_order = order
    db.session.commit()
    return jsonify({"success": True, "message": "จัดลำดับแล้ว"})
