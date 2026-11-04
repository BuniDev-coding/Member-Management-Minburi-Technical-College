"""API ข้อมูลที่อยู่ (จังหวัด / อำเภอ-เขต / ตำบล-แขวง / รหัสไปรษณีย์)

GET /api/address/provinces                         รายชื่อจังหวัดทั้งหมด
GET /api/address/districts?province_id=            อำเภอ/เขต ในจังหวัด (พร้อมรหัสไปรษณีย์ที่ใช้ในอำเภอนั้น)
GET /api/address/subdistricts?district_id=         ตำบล/แขวง ในอำเภอ (พร้อมรหัสไปรษณีย์)
GET /api/address/postal/<code>                     ค้นจากรหัสไปรษณีย์ 5 หลัก → ตำบล อำเภอ จังหวัด ที่ตรงกัน
"""
from collections import defaultdict

from flask import Blueprint, jsonify, request

from models import db, Province, District, Subdistrict
from utils.auth import error, login_required
from utils.validators import parse_int

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
    return jsonify({"success": True, "items": [p.to_dict() for p in rows]})


@bp.get("/districts")
@login_required
def districts():
    pid = parse_int(request.args.get("province_id"))
    if not pid:
        return error("กรุณาระบุจังหวัด")
    rows = sorted(District.query.filter_by(province_id=pid), key=lambda d: thai_key(d.name_th))
    zips = defaultdict(set)
    for did, code in (db.session.query(Subdistrict.district_id, Subdistrict.postal_code)
                      .join(District).filter(District.province_id == pid)):
        zips[did].add(code)
    items = []
    for d in rows:
        x = d.to_dict()
        x["postal_codes"] = sorted(zips[d.id])
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
