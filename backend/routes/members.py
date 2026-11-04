"""API สมาชิก

GET    /api/members                    รายการ/สืบค้น (q, member_no, year_id, position_id, department_id,
                                       status, level, incomplete, sort, order, page, per_page)
GET    /api/members/<id>               ข้อมูลและประวัติเต็ม
POST   /api/members                    เพิ่มสมาชิก (multipart: data=<JSON>, photo=<file>, gallery=<files>)
PUT    /api/members/<id>               แก้ไขสมาชิก (รูปแบบเดียวกับ POST)
DELETE /api/members/<id>               ลบสมาชิก
POST   /api/members/bulk               ทำรายการหลายคน {ids, action: delete|status, status}
PATCH  /api/members/<id>/status        เปลี่ยนสถานะ / ตรวจสอบข้อมูล
PATCH  /api/members/<id>/template      เลือกรูปแบบการแสดงประวัติ
GET    /api/members/check-number       ตรวจเลขสมาชิกซ้ำ (?member_no=&exclude_id=)
GET    /api/members/next-number        เสนอเลขสมาชิกถัดไป (?year=)
POST   /api/members/<id>/images        เพิ่มรูปภาพประกอบ
DELETE /api/members/<id>/images/<iid>  ลบรูปภาพประกอบ
"""
import json

from flask import Blueprint, g, jsonify, request
from sqlalchemy import or_, func
from sqlalchemy.exc import IntegrityError

from models import (db, Member, MemberPosition, MemberEducation, MemberActivity, MemberImage,
                    AcademicYear, Position, Department, Province, District, Subdistrict, STATUSES, TEMPLATES, EDUCATION_LEVELS)
from models.member import ACTIVITY_CATEGORIES
from utils.auth import error, permission_required
from utils.files import save_image, delete_file
from utils.validators import (ValidationError, is_valid_member_no, clean_str, clean_digits, parse_date,
                              parse_int, EMAIL_RE)

bp = Blueprint("members", __name__, url_prefix="/api/members")


# =====================================================================
# Query helper (ใช้ร่วมกับ dashboard / reports)
# =====================================================================
def in_year_clause(year_id):
    """สมาชิกที่อยู่ในปีการศึกษา = สมัครในปีนั้น หรือ มีประวัติตำแหน่งในปีนั้น"""
    return or_(Member.academic_year_id == year_id,
               Member.positions.any(MemberPosition.academic_year_id == year_id))


def build_member_query(args):
    q = Member.query
    text = clean_str(args.get("q"))
    if text:
        like = f"%{text}%"
        conds = [Member.first_name.ilike(like), Member.last_name.ilike(like), Member.nickname.ilike(like),
                 Member.member_no.like(like), Member.student_id.like(like),
                 (Member.first_name + " " + Member.last_name).ilike(like)]
        parts = text.split()
        if len(parts) >= 2:   # ค้นหา "ชื่อ นามสกุล"
            conds.append(Member.first_name.ilike(f"%{parts[0]}%") & Member.last_name.ilike(f"%{parts[-1]}%"))
        q = q.filter(or_(*conds))
    if clean_str(args.get("name")):
        like = f"%{args['name'].strip()}%"
        q = q.filter(or_(Member.first_name.ilike(like), Member.last_name.ilike(like),
                         (Member.first_name + " " + Member.last_name).ilike(like)))
    if clean_str(args.get("member_no")):
        q = q.filter(Member.member_no.like(f"%{args['member_no'].strip()}%"))

    year_id = parse_int(args.get("year_id"))
    position_id = parse_int(args.get("position_id"))
    if position_id:
        cond = MemberPosition.position_id == position_id
        if year_id:
            cond = cond & (MemberPosition.academic_year_id == year_id)
        q = q.filter(Member.positions.any(cond))
    elif year_id:
        q = q.filter(in_year_clause(year_id))

    for key, col in (("department_id", Member.department_id),):
        v = parse_int(args.get(key))
        if v:
            q = q.filter(col == v)
    if args.get("status") in STATUSES:
        q = q.filter(Member.status == args["status"])
    if clean_str(args.get("level")):
        q = q.filter(Member.education_level == args["level"])
    if args.get("incomplete") in ("1", "true"):
        q = q.filter(or_(Member.photo_path.is_(None), Member.phone.is_(None), Member.student_id.is_(None),
                         Member.department_id.is_(None), Member.biography.is_(None), Member.address.is_(None)))
    return q


SORTS = {
    "name": [Member.first_name, Member.last_name],
    "member_no": [Member.member_no],
    "student_id": [Member.student_id],
    "status": [Member.status],
    "phone": [Member.phone],
    "year": [Member.academic_year_id],
    "created": [Member.created_at],
}


@bp.get("")
@permission_required("members.view")
def list_members():
    args = request.args
    q = build_member_query(args)
    sort = args.get("sort", "member_no")
    desc = args.get("order") == "desc"
    page = max(parse_int(args.get("page")) or 1, 1)
    per_page = min(max(parse_int(args.get("per_page")) or 20, 1), 500)

    total = q.order_by(None).count()
    if sort in ("position", "department"):
        # เรียงในหน่วยความจำ (ตำแหน่งคำนวณจากประวัติตำแหน่งล่าสุด)
        rows = [m.to_summary() for m in q.all()]
        key = (lambda r: r["position_level"]) if sort == "position" else (lambda r: r["department"] or "฿")
        rows.sort(key=key, reverse=desc)
        items = rows[(page - 1) * per_page: page * per_page]
    else:
        cols = SORTS.get(sort, SORTS["member_no"])
        q = q.order_by(*[c.desc() if desc else c.asc() for c in cols], Member.id)
        items = [m.to_summary() for m in q.offset((page - 1) * per_page).limit(per_page).all()]

    year_id = parse_int(args.get("year_id"))
    if year_id:   # แสดงตำแหน่งของปีที่ค้นหา
        ids = [i["id"] for i in items]
        if ids:
            mps = MemberPosition.query.filter(MemberPosition.member_id.in_(ids),
                                              MemberPosition.academic_year_id == year_id).all()
            by_member = {mp.member_id: mp for mp in mps}
            for i in items:
                mp = by_member.get(i["id"])
                if mp:
                    i.update(position_id=mp.position_id, position=mp.position.name,
                             position_color=mp.position.color, position_level=mp.position.level)

    return jsonify({"success": True, "items": items, "total": total, "page": page, "per_page": per_page,
                    "pages": (total + per_page - 1) // per_page})


@bp.get("/<int:member_id>")
@permission_required("members.view")
def get_member(member_id):
    m = db.get_or_404(Member, member_id, description="ไม่พบข้อมูลสมาชิก")
    return jsonify({"success": True, "member": m.to_dict()})


@bp.get("/check-number")
@permission_required("members.view")
def check_number():
    no = (request.args.get("member_no") or "").strip()
    if not is_valid_member_no(no):
        return jsonify({"success": True, "valid": False, "available": False,
                        "message": "เลขสมาชิกต้องเป็นตัวเลข 10 หลัก"})
    q = Member.query.filter_by(member_no=no)
    ex = parse_int(request.args.get("exclude_id"))
    if ex:
        q = q.filter(Member.id != ex)
    taken = db.session.query(q.exists()).scalar()
    return jsonify({"success": True, "valid": True, "available": not taken,
                    "message": "เลขสมาชิกนี้ถูกใช้แล้ว" if taken else "ใช้เลขสมาชิกนี้ได้"})


@bp.get("/next-number")
@permission_required("members.edit")
def next_number():
    """รูปแบบ: ปี พ.ศ. 4 หลัก + ลำดับ 6 หลัก เช่น 2569000001"""
    year = parse_int(request.args.get("year"))
    if not year:
        cur = AcademicYear.current()
        year = cur.year if cur else 2569
    prefix = str(year)[:4]
    last = (db.session.query(func.max(Member.member_no)).filter(Member.member_no.like(f"{prefix}%")).scalar())
    seq = int(last[4:]) + 1 if last and last[4:].isdigit() else 1
    return jsonify({"success": True, "member_no": f"{prefix}{seq:06d}"})


# =====================================================================
# เพิ่ม / แก้ไข
# =====================================================================
def _payload():
    """รองรับทั้ง JSON และ multipart (field 'data' เป็น JSON string)"""
    if request.content_type and request.content_type.startswith("multipart/"):
        try:
            return json.loads(request.form.get("data") or "{}")
        except json.JSONDecodeError:
            raise ValidationError({"data": "รูปแบบข้อมูลไม่ถูกต้อง"})
    return request.get_json(silent=True) or {}


SIMPLE_FIELDS = {
    # field: max_len
    "prefix": 20, "first_name": 100, "last_name": 100, "first_name_en": 100, "last_name_en": 100,
    "nickname": 50, "gender": 10, "nationality": 50, "religion": 50, "blood_type": 5,
    "email": 120, "line_id": 50, "facebook": 120, "parent_name": 150,
    "house_no": 50, "moo": 10, "village": 120, "soi": 100, "road": 100,
    "class_group": 20, "biography": None, "skills": None, "vision": None, "note": None,
}


ADDRESS_KEYS = ("house_no", "moo", "village", "soi", "road", "province_id", "district_id", "subdistrict_id",
                "postal_code")


def _apply(member: Member, data: dict, is_new: bool):
    errors = {}
    for f, ln in SIMPLE_FIELDS.items():
        if f in data or is_new:
            setattr(member, f, clean_str(data.get(f), ln))

    if not member.first_name:
        errors["first_name"] = "กรุณากรอกชื่อ"
    if not member.last_name:
        errors["last_name"] = "กรุณากรอกนามสกุล"
    if member.email and not EMAIL_RE.match(member.email):
        errors["email"] = "รูปแบบอีเมลไม่ถูกต้อง"

    # ---- เลขสมาชิก 10 หลัก ห้ามซ้ำ ----
    if "member_no" in data or is_new:
        no = clean_digits(data.get("member_no")) or ""
        if not is_valid_member_no(no):
            errors["member_no"] = "เลขสมาชิกต้องเป็นตัวเลข 10 หลัก"
        else:
            dup = Member.query.filter(Member.member_no == no, Member.id != (member.id or 0)).first()
            if dup:
                errors["member_no"] = f"เลขสมาชิก {no} ถูกใช้แล้ว ({dup.full_name})"
            member.member_no = no

    if "student_id" in data or is_new:
        sid = clean_digits(data.get("student_id"))
        if sid:
            dup = Member.query.filter(Member.student_id == sid, Member.id != (member.id or 0)).first()
            if dup:
                errors["student_id"] = f"เลขประจำตัวนักศึกษานี้ถูกใช้แล้ว ({dup.full_name})"
        member.student_id = sid

    for f, ln in (("phone", 20), ("parent_phone", 20), ("national_id", 13)):
        if f in data or is_new:
            setattr(member, f, clean_digits(data.get(f)))
    if member.national_id and (len(member.national_id) != 13 or not member.national_id.isdigit()):
        errors["national_id"] = "เลขประจำตัวประชาชนต้องเป็นตัวเลข 13 หลัก"

    # ---- ที่อยู่: จังหวัด → อำเภอ/เขต → ตำบล/แขวง ต้องสัมพันธ์กัน ----
    if any(k in data for k in ("province_id", "district_id", "subdistrict_id", "postal_code")) or is_new:
        pv = db.session.get(Province, parse_int(data.get("province_id")) or 0)
        ds = db.session.get(District, parse_int(data.get("district_id")) or 0)
        sd = db.session.get(Subdistrict, parse_int(data.get("subdistrict_id")) or 0)
        if sd and not ds:
            ds = sd.district
        if ds and not pv:
            pv = ds.province
        if ds and ds.province_id != pv.id:
            errors["district_id"] = "อำเภอ/เขต ไม่อยู่ในจังหวัดที่เลือก"
        if sd and ds and sd.district_id != ds.id:
            errors["subdistrict_id"] = "ตำบล/แขวง ไม่อยู่ในอำเภอ/เขตที่เลือก"
        member.province, member.district, member.subdistrict = pv, ds, sd
        member.province_id, member.district_id, member.subdistrict_id = (
            pv.id if pv else None, ds.id if ds else None, sd.id if sd else None)
        zipc = clean_digits(data.get("postal_code"))
        if zipc and not (len(zipc) == 5 and zipc.isdigit()):
            errors["postal_code"] = "รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก"
        member.postal_code = zipc or (sd.postal_code if sd else None)
    if is_new or any(k in data for k in ADDRESS_KEYS):
        member.address = member.compose_address()

    if "academic_year_id" in data or is_new:
        yid = parse_int(data.get("academic_year_id"))
        if not yid or not db.session.get(AcademicYear, yid):
            errors["academic_year_id"] = "กรุณาเลือกปีการศึกษา"
        member.academic_year_id = yid
    if "department_id" in data or is_new:
        did = parse_int(data.get("department_id"))
        if did and not db.session.get(Department, did):
            errors["department_id"] = "ไม่พบแผนกวิชา"
        member.department_id = did
    if "education_level" in data or is_new:
        lv = clean_str(data.get("education_level"))
        member.education_level = lv if lv in EDUCATION_LEVELS else lv
    if "status" in data or is_new:
        st = data.get("status") or "pending"
        if st not in STATUSES:
            errors["status"] = "สถานะไม่ถูกต้อง"
        member.status = st
    if "profile_template" in data or is_new:
        tp = data.get("profile_template") or "card"
        if tp not in TEMPLATES:
            errors["profile_template"] = "รูปแบบการแสดงผลไม่ถูกต้อง"
        member.profile_template = tp
    try:
        if "birth_date" in data or is_new:
            member.birth_date = parse_date(data.get("birth_date"))
        if "joined_date" in data or is_new:
            member.joined_date = parse_date(data.get("joined_date"))
    except ValidationError as e:
        errors.update(e.errors)

    # ---- ประวัติตำแหน่ง (แทนที่ทั้งหมด) ----
    if "positions" in data or is_new:
        rows, seen = [], set()
        for i, p in enumerate(data.get("positions") or []):
            pid, yid = parse_int(p.get("position_id")), parse_int(p.get("academic_year_id"))
            if not pid or not yid:
                continue
            if not db.session.get(Position, pid) or not db.session.get(AcademicYear, yid):
                errors[f"positions.{i}"] = "ตำแหน่งหรือปีการศึกษาไม่ถูกต้อง"
                continue
            if yid in seen:
                errors[f"positions.{i}"] = "ในหนึ่งปีการศึกษาดำรงตำแหน่งได้เพียง 1 ตำแหน่ง"
                continue
            seen.add(yid)
            try:
                rows.append(dict(position_id=pid, academic_year_id=yid, start_date=parse_date(p.get("start_date")),
                                 end_date=parse_date(p.get("end_date")), note=clean_str(p.get("note"), 255)))
            except ValidationError as e:
                errors[f"positions.{i}"] = str(e)
        if not rows and member.academic_year_id:   # ค่าเริ่มต้น = สมาชิกทั่วไป ในปีที่สมัคร
            gen = Position.general()
            if gen:
                rows.append(dict(position_id=gen.id, academic_year_id=member.academic_year_id))
        existing = {mp.academic_year_id: mp for mp in member.positions}
        keep = set()
        for r in rows:
            mp = existing.get(r["academic_year_id"])
            if mp:
                for k, v in r.items():
                    setattr(mp, k, v)
            else:
                member.positions.append(MemberPosition(**r))
            keep.add(r["academic_year_id"])
        for yid, mp in existing.items():
            if yid not in keep:
                member.positions.remove(mp)

    # ---- ประวัติการศึกษา ----
    if "educations" in data:
        member.educations.clear()
        for i, e in enumerate(data.get("educations") or []):
            inst = clean_str(e.get("institution"), 200)
            if inst:
                member.educations.append(MemberEducation(
                    level=clean_str(e.get("level"), 50), institution=inst, major=clean_str(e.get("major"), 120),
                    graduated_year=parse_int(e.get("graduated_year")), gpa=clean_str(e.get("gpa"), 10),
                    sort_order=i))

    # ---- ผลงาน / กิจกรรม / การทำงาน ----
    if "activities" in data:
        member.activities.clear()
        for i, a in enumerate(data.get("activities") or []):
            title = clean_str(a.get("title"), 200)
            if not title:
                continue
            cat = a.get("category") if a.get("category") in ACTIVITY_CATEGORIES else "activity"
            try:
                d = parse_date(a.get("activity_date"))
            except ValidationError:
                d = None
            member.activities.append(MemberActivity(
                category=cat, title=title, role=clean_str(a.get("role"), 120),
                organization=clean_str(a.get("organization"), 200), activity_date=d,
                description=clean_str(a.get("description")), sort_order=i))

    if errors:
        raise ValidationError(errors)


def _save(member: Member, is_new: bool):
    data = _payload()
    with db.session.no_autoflush:   # ตรวจสอบให้ครบก่อน ค่อยเขียนลงฐานข้อมูล
        try:
            _apply(member, data, is_new)
        except ValidationError:
            db.session.rollback()
            raise

    new_files = []
    photo = request.files.get("photo")
    if photo and photo.filename:
        old = member.photo_path
        member.photo_path = save_image(photo, "members")
        new_files.append(member.photo_path)
        if old:
            member._old_photo = old
    elif data.get("remove_photo") and member.photo_path:
        member._old_photo = member.photo_path
        member.photo_path = None
    for f in request.files.getlist("gallery"):
        if f and f.filename:
            path = save_image(f, "gallery")
            new_files.append(path)
            member.images.append(MemberImage(image_path=path))

    if is_new:
        member.created_by = g.user.id
        db.session.add(member)
    try:
        db.session.commit()
    except IntegrityError as e:
        db.session.rollback()
        for p in new_files:
            delete_file(p)
        msg = str(e.orig).lower()
        if "member_no" in msg:
            raise ValidationError({"member_no": "เลขสมาชิกนี้ถูกใช้แล้ว"})
        if "student_id" in msg:
            raise ValidationError({"student_id": "เลขประจำตัวนักศึกษานี้ถูกใช้แล้ว"})
        raise ValidationError({"_": "ข้อมูลไม่ถูกต้องตามเงื่อนไขของฐานข้อมูล"})
    if getattr(member, "_old_photo", None):
        delete_file(member._old_photo)
    return member


@bp.post("")
@permission_required("members.edit")
def create_member():
    try:
        m = _save(Member(), True)
    except ValidationError as e:
        return error("ข้อมูลไม่ถูกต้อง: " + str(e), 422, errors=e.errors)
    return jsonify({"success": True, "message": "เพิ่มสมาชิกเรียบร้อย", "member": m.to_dict()}), 201


@bp.put("/<int:member_id>")
@permission_required("members.edit")
def update_member(member_id):
    m = db.get_or_404(Member, member_id, description="ไม่พบข้อมูลสมาชิก")
    try:
        _save(m, False)
    except ValidationError as e:
        return error("ข้อมูลไม่ถูกต้อง: " + str(e), 422, errors=e.errors)
    return jsonify({"success": True, "message": "บันทึกการแก้ไขเรียบร้อย", "member": m.to_dict()})


def _delete_member(m: Member):
    files = [m.photo_path] + [i.image_path for i in m.images] + [a.image_path for a in m.activities]
    db.session.delete(m)
    return [f for f in files if f]


@bp.delete("/<int:member_id>")
@permission_required("members.delete")
def delete_member(member_id):
    m = db.get_or_404(Member, member_id, description="ไม่พบข้อมูลสมาชิก")
    files = _delete_member(m)
    db.session.commit()
    for f in files:
        delete_file(f)
    return jsonify({"success": True, "message": "ลบสมาชิกเรียบร้อย"})


@bp.post("/bulk")
@permission_required("members.edit", "members.delete")
def bulk():
    data = request.get_json(silent=True) or {}
    ids = [parse_int(i) for i in data.get("ids") or [] if parse_int(i)]
    if not ids:
        return error("กรุณาเลือกสมาชิกอย่างน้อย 1 คน")
    members = Member.query.filter(Member.id.in_(ids)).all()
    action = data.get("action")
    if action == "delete":
        if not g.user.has_permission("members.delete"):
            return error("คุณไม่มีสิทธิ์ลบสมาชิก", 403)
        files = []
        for m in members:
            files += _delete_member(m)
        db.session.commit()
        for f in files:
            delete_file(f)
        return jsonify({"success": True, "message": f"ลบสมาชิก {len(members)} รายการเรียบร้อย"})
    if action == "status":
        if not g.user.has_permission("members.edit"):
            return error("คุณไม่มีสิทธิ์แก้ไขสมาชิก", 403)
        st = data.get("status")
        if st not in STATUSES:
            return error("สถานะไม่ถูกต้อง")
        for m in members:
            m.status = st
        db.session.commit()
        return jsonify({"success": True, "message": f"เปลี่ยนสถานะเป็น '{STATUSES[st]}' {len(members)} รายการ"})
    return error("ไม่รู้จักคำสั่ง")


@bp.patch("/<int:member_id>/status")
@permission_required("members.edit")
def set_status(member_id):
    m = db.get_or_404(Member, member_id, description="ไม่พบข้อมูลสมาชิก")
    st = (request.get_json(silent=True) or {}).get("status")
    if st not in STATUSES:
        return error("สถานะไม่ถูกต้อง")
    m.status = st
    db.session.commit()
    return jsonify({"success": True, "message": f"เปลี่ยนสถานะเป็น '{STATUSES[st]}' แล้ว", "member": m.to_summary()})


@bp.patch("/<int:member_id>/template")
@permission_required("members.edit")
def set_template(member_id):
    m = db.get_or_404(Member, member_id, description="ไม่พบข้อมูลสมาชิก")
    tp = (request.get_json(silent=True) or {}).get("profile_template")
    if tp not in TEMPLATES:
        return error("รูปแบบการแสดงผลไม่ถูกต้อง")
    m.profile_template = tp
    db.session.commit()
    return jsonify({"success": True, "message": f"ตั้งค่ารูปแบบ '{TEMPLATES[tp]}' เรียบร้อย"})


@bp.post("/<int:member_id>/images")
@permission_required("members.edit")
def add_images(member_id):
    m = db.get_or_404(Member, member_id, description="ไม่พบข้อมูลสมาชิก")
    added = []
    try:
        for f in request.files.getlist("images"):
            if f and f.filename:
                img = MemberImage(image_path=save_image(f, "gallery"), caption=clean_str(request.form.get("caption"), 255))
                m.images.append(img)
                added.append(img)
    except ValidationError as e:
        return error(str(e), 422)
    db.session.commit()
    return jsonify({"success": True, "images": [i.to_dict() for i in added]}), 201


@bp.delete("/<int:member_id>/images/<int:image_id>")
@permission_required("members.edit")
def delete_image(member_id, image_id):
    img = MemberImage.query.filter_by(id=image_id, member_id=member_id).first_or_404()
    path = img.image_path
    db.session.delete(img)
    db.session.commit()
    delete_file(path)
    return jsonify({"success": True, "message": "ลบรูปภาพแล้ว"})
