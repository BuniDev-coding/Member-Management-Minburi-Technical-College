"""API ข้อมูลที่อยู่ (จังหวัด / อำเภอ-เขต / ตำบล-แขวง / รหัสไปรษณีย์)

GET /api/address/provinces                         รายชื่อจังหวัดทั้งหมด
GET /api/address/districts?province_id=            อำเภอ/เขต ในจังหวัด (พร้อมรหัสไปรษณีย์ที่ใช้ในอำเภอนั้น)
GET /api/address/subdistricts?district_id=         ตำบล/แขวง ในอำเภอ (พร้อมรหัสไปรษณีย์)
GET /api/address/postal/<code>                     ค้นจากรหัสไปรษณีย์ 5 หลัก → ตำบล อำเภอ จังหวัด ที่ตรงกัน
POST /api/address/provinces     {name}                           เพิ่มจังหวัดเอง
POST /api/address/districts     {province_id, name}              เพิ่มอำเภอ/เขตเอง
POST /api/address/subdistricts  {district_id, name, postal_code} เพิ่มตำบล/แขวงเอง (พร้อมรหัสไปรษณีย์)
PUT|DELETE /api/address/provinces/<id>     แก้ไขชื่อ / ลบจังหวัด (รวมอำเภอ-ตำบลในจังหวัด)
PUT|DELETE /api/address/districts/<id>     แก้ไขชื่อ / ลบอำเภอ (รวมตำบลในอำเภอ)
PUT|DELETE /api/address/subdistricts/<id>  แก้ไขชื่อ-รหัสไปรษณีย์ / ลบตำบล
"""
import re
from collections import defaultdict

from flask import Blueprint, jsonify, request

from models import db, Member, Province, District, Subdistrict
from utils.auth import error, login_required, permission_required
from utils.validators import clean_str, parse_int

bp = Blueprint("address", __name__, url_prefix="/api/address")

_LEADING_VOWELS = "เแโใไ"


def thai_key(name):
    """เรียงตามพจนานุกรมไทย: สระหน้า (เ แ โ ใ ไ) ไม่นับเป็นตัวแรก เช่น 'เชียงใหม่' อยู่หมวด ช"""
    if len(name) > 1 and name[0] in _LEADING_VOWELS:
        return name[1] + name[0] + name[2:]
    return name


@bp.get("/provinces")
@login_required
def provinces():
    rows = sorted(Province.query.all(), key=lambda p: (p.name_th != "กรุงเทพมหานคร", thai_key(p.name_th)))
    counts = dict(db.session.query(District.province_id, db.func.count(District.id))
                  .group_by(District.province_id).all())
    return jsonify({"success": True, "items": [{**p.to_dict(), "district_count": counts.get(p.id, 0)} for p in rows]})


@bp.get("/districts")
@login_required
def districts():
    pid = parse_int(request.args.get("province_id"))
    if not pid:
        return error("กรุณาระบุจังหวัด")
    rows = sorted(District.query.filter_by(province_id=pid), key=lambda d: thai_key(d.name_th))
    zips, counts = defaultdict(set), defaultdict(int)
    for did, code in (db.session.query(Subdistrict.district_id, Subdistrict.postal_code)
                      .join(District).filter(District.province_id == pid)):
        zips[did].add(code)
        counts[did] += 1
    items = []
    for d in rows:
        x = d.to_dict()
        x["postal_codes"] = sorted(zips[d.id])
        x["subdistrict_count"] = counts[d.id]
        items.append(x)
    return jsonify({"success": True, "items": items})


@bp.get("/subdistricts")
@login_required
def subdistricts():
    did = parse_int(request.args.get("district_id"))
    if not did:
        return error("กรุณาระบุอำเภอ/เขต")
    rows = sorted(Subdistrict.query.filter_by(district_id=did), key=lambda x: thai_key(x.name_th))
    return jsonify({"success": True, "items": [s.to_dict() for s in rows]})


@bp.get("/postal/<code>")
@login_required
def by_postal(code):
    if not (len(code) == 5 and code.isdigit()):
        return error("รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก")
    rows = Subdistrict.query.filter_by(postal_code=code).order_by(Subdistrict.name_th).all()
    items = [{
        "subdistrict_id": s.id, "subdistrict": s.name_th, "subdistrict_prefix": s.prefix,
        "district_id": s.district_id, "district": s.district.name_th, "district_prefix": s.district.prefix,
        "province_id": s.district.province_id, "province": s.district.province.name_th,
        "postal_code": s.postal_code,
    } for s in rows]
    return jsonify({"success": True, "items": items})


# ---------------------------------------------------------------------------
# เพิ่มข้อมูลที่อยู่เอง (กรณีไม่มีในฐานข้อมูลตั้งต้น เช่น ตำบล/อำเภอตั้งใหม่)
# ---------------------------------------------------------------------------
CUSTOM_ID_START = 9_000_000    # id ของรายการที่ผู้ใช้เพิ่มเอง — แยกช่วงจากข้อมูลตั้งต้นเพื่อไม่ให้ชนกัน
BANGKOK = "กรุงเทพมหานคร"


def _next_id(model):
    top = db.session.query(db.func.max(model.id)).scalar() or 0
    return max(top, CUSTOM_ID_START - 1) + 1


def _clean_name(value, prefixes):
    """ตัดคำนำหน้าที่ผู้ใช้อาจพิมพ์ติดมา เช่น 'ตำบลบ้านใหม่' → 'บ้านใหม่'"""
    name = " ".join((clean_str(value, 100) or "").split())
    m = re.match(r"(?:%s)\s*(.+)" % "|".join(re.escape(p) for p in prefixes), name)
    return m.group(1) if m else name


def _created(obj, label, existing=False):
    msg = f"มี{label}นี้อยู่แล้ว" if existing else f"เพิ่ม{label}เรียบร้อย"
    return jsonify({"success": True, "message": msg, "item": obj.to_dict(), "existing": existing}), 200 if existing else 201


@bp.post("/provinces")
@permission_required("members.edit", "settings")
def create_province():
    data = request.get_json(silent=True) or {}
    name = _clean_name(data.get("name"), ("จังหวัด", "จ."))
    if not name:
        return error("กรุณากรอกชื่อจังหวัด", errors={"name": "กรุณากรอกชื่อจังหวัด"})
    found = Province.query.filter_by(name_th=name).first()
    if found:
        return _created(found, "จังหวัด", True)
    pv = Province(id=_next_id(Province), name_th=name)
    db.session.add(pv)
    db.session.commit()
    return _created(pv, "จังหวัด")


@bp.post("/districts")
@permission_required("members.edit", "settings")
def create_district():
    data = request.get_json(silent=True) or {}
    pv = db.session.get(Province, parse_int(data.get("province_id")) or 0)
    if not pv:
        return error("กรุณาเลือกจังหวัดก่อน")
    name = _clean_name(data.get("name"), ("อำเภอ", "อ.", "เขต"))
    if not name:
        return error("กรุณากรอกชื่ออำเภอ/เขต", errors={"name": "กรุณากรอกชื่ออำเภอ/เขต"})
    found = District.query.filter_by(province_id=pv.id, name_th=name).first()
    if found:
        return _created(found, "อำเภอ/เขต", True)
    ds = District(id=_next_id(District), province_id=pv.id, name_th=name,
                  prefix="เขต" if pv.name_th == BANGKOK else "อำเภอ")
    db.session.add(ds)
    db.session.commit()
    return _created(ds, "อำเภอ/เขต")


@bp.post("/subdistricts")
@permission_required("members.edit", "settings")
def create_subdistrict():
    data = request.get_json(silent=True) or {}
    ds = db.session.get(District, parse_int(data.get("district_id")) or 0)
    if not ds:
        return error("กรุณาเลือกอำเภอ/เขตก่อน")
    name = _clean_name(data.get("name"), ("ตำบล", "ต.", "แขวง"))
    code = (clean_str(data.get("postal_code")) or "").replace(" ", "")
    errors = {}
    if not name:
        errors["name"] = "กรุณากรอกชื่อตำบล/แขวง"
    if not (len(code) == 5 and code.isdigit()):
        errors["postal_code"] = "รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก"
    if errors:
        return error("กรุณาตรวจสอบข้อมูล", errors=errors)
    found = Subdistrict.query.filter_by(district_id=ds.id, name_th=name).first()
    if found:
        return _created(found, "ตำบล/แขวง", True)
    sd = Subdistrict(id=_next_id(Subdistrict), district_id=ds.id, name_th=name, postal_code=code,
                     prefix="แขวง" if ds.prefix == "เขต" else "ตำบล")
    db.session.add(sd)
    db.session.commit()
    return _created(sd, "ตำบล/แขวง")


# ---------------------------------------------------------------------------
# แก้ไข / ลบ ข้อมูลที่อยู่ (หน้า "ตั้งค่าข้อมูลการสมัคร")
# ---------------------------------------------------------------------------
def _refresh_addresses(column, obj_id):
    """เปลี่ยนชื่อจังหวัด/อำเภอ/ตำบล → ประกอบที่อยู่เต็มของสมาชิกที่ใช้รายการนั้นใหม่"""
    for m in Member.query.filter(column == obj_id):
        m.address = m.compose_address()


def _saved(obj):
    db.session.commit()
    return jsonify({"success": True, "message": "บันทึกแล้ว", "item": obj.to_dict()})


def _in_use(count):
    return error(f"ลบไม่ได้ เนื่องจากมีสมาชิก {count} คนใช้ที่อยู่นี้", 409)


@bp.put("/provinces/<int:pid>")
@permission_required("settings")
def update_province(pid):
    pv = db.get_or_404(Province, pid, description="ไม่พบจังหวัด")
    name = _clean_name((request.get_json(silent=True) or {}).get("name"), ("จังหวัด", "จ."))
    if not name:
        return error("กรุณากรอกชื่อจังหวัด", errors={"name": "กรุณากรอกชื่อจังหวัด"})
    if Province.query.filter(Province.name_th == name, Province.id != pid).first():
        return error("มีจังหวัดนี้อยู่แล้ว", 409, errors={"name": "มีจังหวัดนี้อยู่แล้ว"})
    pv.name_th = name
    _refresh_addresses(Member.province_id, pid)
    return _saved(pv)


@bp.delete("/provinces/<int:pid>")
@permission_required("settings")
def delete_province(pid):
    pv = db.get_or_404(Province, pid, description="ไม่พบจังหวัด")
    used = Member.query.filter_by(province_id=pid).count()
    if used:
        return _in_use(used)
    dids = [d for (d,) in db.session.query(District.id).filter_by(province_id=pid)]
    if dids:
        Subdistrict.query.filter(Subdistrict.district_id.in_(dids)).delete(synchronize_session=False)
        District.query.filter_by(province_id=pid).delete(synchronize_session=False)
    db.session.delete(pv)
    db.session.commit()
    return jsonify({"success": True, "message": "ลบจังหวัดแล้ว"})


@bp.put("/districts/<int:did>")
@permission_required("settings")
def update_district(did):
    ds = db.get_or_404(District, did, description="ไม่พบอำเภอ/เขต")
    name = _clean_name((request.get_json(silent=True) or {}).get("name"), ("อำเภอ", "อ.", "เขต"))
    if not name:
        return error("กรุณากรอกชื่ออำเภอ/เขต", errors={"name": "กรุณากรอกชื่ออำเภอ/เขต"})
    if District.query.filter(District.province_id == ds.province_id, District.name_th == name,
                             District.id != did).first():
        return error("มีอำเภอ/เขตนี้อยู่แล้ว", 409, errors={"name": "มีอำเภอ/เขตนี้อยู่แล้วในจังหวัดนี้"})
    ds.name_th = name
    _refresh_addresses(Member.district_id, did)
    return _saved(ds)


@bp.delete("/districts/<int:did>")
@permission_required("settings")
def delete_district(did):
    ds = db.get_or_404(District, did, description="ไม่พบอำเภอ/เขต")
    used = Member.query.filter_by(district_id=did).count()
    if used:
        return _in_use(used)
    Subdistrict.query.filter_by(district_id=did).delete(synchronize_session=False)
    db.session.delete(ds)
    db.session.commit()
    return jsonify({"success": True, "message": "ลบอำเภอ/เขตแล้ว"})


@bp.put("/subdistricts/<int:sid>")
@permission_required("settings")
def update_subdistrict(sid):
    sd = db.get_or_404(Subdistrict, sid, description="ไม่พบตำบล/แขวง")
    data = request.get_json(silent=True) or {}
    name = _clean_name(data.get("name"), ("ตำบล", "ต.", "แขวง"))
    code = (clean_str(data.get("postal_code")) or "").replace(" ", "")
    errors = {}
    if not name:
        errors["name"] = "กรุณากรอกชื่อตำบล/แขวง"
    elif Subdistrict.query.filter(Subdistrict.district_id == sd.district_id, Subdistrict.name_th == name,
                                  Subdistrict.id != sid).first():
        errors["name"] = "มีตำบล/แขวงนี้อยู่แล้วในอำเภอนี้"
    if not (len(code) == 5 and code.isdigit()):
        errors["postal_code"] = "รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก"
    if errors:
        return error("กรุณาตรวจสอบข้อมูล", errors=errors)
    sd.name_th, sd.postal_code = name, code   # รหัสไปรษณีย์ที่บันทึกไว้กับสมาชิกแต่ละคนไม่ถูกแก้ตาม
    _refresh_addresses(Member.subdistrict_id, sid)
    return _saved(sd)


@bp.delete("/subdistricts/<int:sid>")
@permission_required("settings")
def delete_subdistrict(sid):
    sd = db.get_or_404(Subdistrict, sid, description="ไม่พบตำบล/แขวง")
    used = Member.query.filter_by(subdistrict_id=sid).count()
    if used:
        return _in_use(used)
    db.session.delete(sd)
    db.session.commit()
    return jsonify({"success": True, "message": "ลบตำบล/แขวงแล้ว"})
