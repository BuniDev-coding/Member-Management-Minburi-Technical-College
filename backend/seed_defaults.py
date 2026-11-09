"""ข้อมูลพื้นฐานที่ระบบต้องมีเสมอ (เรียกอัตโนมัติตอนเริ่มระบบ)"""
import json
import os
import re
from datetime import date

from flask import current_app
from sqlalchemy import inspect, text

from models import db, Position, AcademicYear, User, Member, Province, District, Subdistrict, ROLE_PERMISSIONS

ADDRESS_DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "thai_address.json")

# คอลัมน์ที่เพิ่มภายหลัง — ฐานข้อมูลเดิมจะถูกเพิ่มคอลัมน์ให้อัตโนมัติ (create_all ไม่เพิ่มคอลัมน์ในตารางที่มีอยู่แล้ว)
MEMBER_NEW_COLUMNS = {
    "house_no": "VARCHAR(50)", "moo": "VARCHAR(10)", "village": "VARCHAR(120)", "soi": "VARCHAR(100)",
    "road": "VARCHAR(100)", "province_id": "INTEGER", "district_id": "INTEGER", "subdistrict_id": "INTEGER",
    "postal_code": "VARCHAR(5)",
    "father_name": "VARCHAR(150)", "mother_name": "VARCHAR(150)", "member_type": "VARCHAR(30)",
    "registration_no": "VARCHAR(30)", "registrar_name": "VARCHAR(150)", "registered_date": "DATE",
    "leave_reason": "VARCHAR(255)", "left_date": "DATE",
}

DEFAULT_POSITIONS = [
    # name, level, is_executive, is_committee, color
    ("ประธาน", 1, True, True, "#C62828"),
    ("รองประธาน", 2, True, True, "#1F4FB5"),
    ("กรรมการ", 3, False, True, "#0F8A78"),
    ("สมาชิกทั่วไป", 9, False, False, "#D98200"),
]


# ตำแหน่งคณะกรรมการดำเนินงานตามแบบ อวท.09 (เพิ่มให้ฐานข้อมูลเดิมครั้งเดียว)
COMMITTEE_POSITIONS = [
    # name, level, color — ลำดับตามแบบ อวท.09: ประธาน รองประธาน กรรมการ เหรัญญิก ปฏิคม นายทะเบียน ประชาสัมพันธ์ เลขานุการ
    ("เหรัญญิก", 4, "#B5761F"),
    ("ปฏิคม", 5, "#1F8FB5"),
    ("นายทะเบียน", 6, "#4A6B1F"),
    ("ประชาสัมพันธ์", 7, "#B51F7A"),
    ("เลขานุการ", 8, "#6A3FB5"),
]
# ลำดับที่ระบบเคยตั้งไว้ในรุ่นก่อน (ใช้ตรวจว่าผู้ใช้ยังไม่ได้ปรับเอง ก่อนเรียงใหม่ตามแบบฟอร์ม)
_OLD_LEVELS = {"เลขานุการ": 3, "เหรัญญิก": 4, "ปฏิคม": 5, "นายทะเบียน": 6, "ประชาสัมพันธ์": 7, "กรรมการ": 8}


def ensure_committee_positions():
    """เพิ่มตำแหน่งตาม อวท.09 ถ้ายังไม่มีเลยสักตำแหน่ง (ถ้าผู้ใช้ลบเองภายหลังจะไม่เพิ่มกลับ)
    และเรียงลำดับใหม่ตามแบบฟอร์ม ถ้ายังเป็นลำดับเดิมของระบบรุ่นก่อน"""
    names = [n for n, _, _ in COMMITTEE_POSITIONS]
    existing = {p.name: p for p in Position.query.filter(Position.name.in_(names + ["กรรมการ"]))}
    if not any(n in existing for n in names):
        committee = existing.get("กรรมการ")
        if committee and committee.level in (3, 8):
            committee.level = 3
        for name, level, color in COMMITTEE_POSITIONS:
            db.session.add(Position(name=name, level=level, is_executive=False, is_committee=True, color=color))
        db.session.commit()
        return True
    if all(n in existing and existing[n].level == lv for n, lv in _OLD_LEVELS.items()):
        existing["กรรมการ"].level = 3
        for name, level, _ in COMMITTEE_POSITIONS:
            existing[name].level = level
        db.session.commit()
        return True
    return False


def migrate_member_types():
    """ระดับสมาชิกรุ่นก่อน → ระดับตามแบบ อวท.10"""
    mapping = {"สามัญ": "สามัญ ระดับสถานศึกษา", "กิตติมศักดิ์": None}
    changed = 0
    for old, new in mapping.items():
        changed += Member.query.filter(Member.member_type == old).update({Member.member_type: new})
    if changed:
        db.session.commit()


def migrate_elections_table():
    """ตาราง elections รุ่นก่อน (ผู้รับรอง/ผู้อนุมัติ) → ผู้ลงนาม 5 คนตามแบบ อวท.08
    ถ้ายังไม่มีข้อมูล: สร้างตารางใหม่ / ถ้ามีข้อมูลแล้ว: เพิ่มคอลัมน์ใหม่ (คอลัมน์เดิมเก็บไว้ไม่ลบ)"""
    insp = inspect(db.engine)
    if "elections" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("elections")}
    if "director_name" in cols:
        return
    with db.engine.begin() as conn:
        count = conn.execute(text("SELECT COUNT(*) FROM elections")).scalar()
        if not count:
            conn.execute(text("DROP TABLE IF EXISTS election_candidates"))
            conn.execute(text("DROP TABLE elections"))
        else:
            for name, typ in (("report_date", "DATE"), ("reporter_name", "VARCHAR(150)"), ("advisor_name", "VARCHAR(150)"),
                              ("activity_head_name", "VARCHAR(150)"), ("deputy_name", "VARCHAR(150)"),
                              ("director_name", "VARCHAR(150)")):
                conn.execute(text(f"ALTER TABLE elections ADD COLUMN {name} {typ}"))
            conn.execute(text("UPDATE elections SET advisor_name = certifier_name, director_name = approver_name"))
    db.create_all()


def current_thai_academic_year(today=None):
    """ปีการศึกษาไทยเริ่ม พ.ค. — ก่อน พ.ค. ยังนับเป็นปีการศึกษาก่อนหน้า"""
    today = today or date.today()
    return today.year + 543 - (1 if today.month < 5 else 0)


def migrate_columns():
    cols = {c["name"] for c in inspect(db.engine).get_columns("members")}
    missing = {k: v for k, v in MEMBER_NEW_COLUMNS.items() if k not in cols}
    if not missing:
        return
    with db.engine.begin() as conn:
        for name, typ in missing.items():
            conn.execute(text(f"ALTER TABLE members ADD COLUMN {name} {typ}"))


def load_address_data():
    """นำเข้าข้อมูลจังหวัด/อำเภอ/ตำบล/รหัสไปรษณีย์ทั้งประเทศ (ครั้งแรกเท่านั้น)"""
    if db.session.query(Subdistrict.id).first():
        return False
    if not os.path.exists(ADDRESS_DATA):
        current_app.logger.warning("ไม่พบไฟล์ข้อมูลที่อยู่ %s — ช่องจังหวัด/อำเภอ/ตำบลจะว่าง", ADDRESS_DATA)
        return False
    with open(ADDRESS_DATA, encoding="utf-8") as f:
        data = json.load(f)
    db.session.query(Subdistrict).delete()
    db.session.query(District).delete()
    db.session.query(Province).delete()
    for model, key in ((Province, "provinces"), (District, "districts"), (Subdistrict, "subdistricts")):
        cols = data["columns"][key]
        db.session.execute(model.__table__.insert(), [dict(zip(cols, r)) for r in data[key]])
    db.session.commit()
    return True


# ---- แปลงที่อยู่แบบข้อความเดิม → ช่องย่อย ---------------------------------------
_PREFIX_RE = r"(?:ตำบล|ต\.|แขวง|อำเภอ|อ\.|เขต|จังหวัด|จ\.)\s*"


def _find(text_, names, prefixes):
    """หาชื่อที่ยาวที่สุดที่ปรากฏในข้อความ (ให้ความสำคัญกับชื่อที่มีคำนำหน้า เช่น 'แขวงมีนบุรี')"""
    best = None
    for obj, name in names:
        for pre in prefixes:
            if pre + name in text_ and (best is None or len(name) > len(best[1])):
                best = (obj, name)
                break
    return best[0] if best else None


def parse_legacy_address(addr):
    """แยก '12/3 หมู่ 4 ซอยสุขใจ ถนนสีหบุรานุกิจ แขวงมีนบุรี เขตมีนบุรี กรุงเทพมหานคร 10510' เป็นช่องย่อย"""
    t = " ".join((addr or "").split())
    t = re.sub(r"(?:กทม\.?|กรุงเทพฯ|กรุงเทพ(?!มหานคร))", "กรุงเทพมหานคร", t)
    out = {}
    m = re.search(r"(?<!\d)(\d{5})\s*$", t) or re.search(r"(?<!\d)(\d{5})(?!\d)", t)
    if m:
        out["postal_code"] = m.group(1)
    provinces = Province.query.all()
    if out.get("postal_code"):   # มีรหัสไปรษณีย์ → จำกัดจังหวัดที่เป็นไปได้
        ids = {s_.district.province_id for s_ in Subdistrict.query.filter_by(postal_code=out["postal_code"])}
        provinces = [p for p in provinces if p.id in ids] or provinces
    names = [(p, p.name_th) for p in provinces]
    pv = (_find(t, names, ["จังหวัด", "จ."]) or _find(t, names, [""])
          or (provinces[0] if out.get("postal_code") and len(provinces) == 1 else None))
    ds = sd = None
    if pv:
        names = [(d, d.name_th) for d in District.query.filter_by(province_id=pv.id)]
        ds = _find(t, names, ["อำเภอ", "อ.", "เขต"]) or _find(t, names, [""])
    if ds:
        names = [(x, x.name_th) for x in Subdistrict.query.filter_by(district_id=ds.id)]
        sd = _find(t, names, ["ตำบล", "ต.", "แขวง"]) or _find(t, names, [""])
    if not (pv or ds or sd):
        return None
    out.update(province=pv, district=ds, subdistrict=sd)
    if sd and not out.get("postal_code"):
        out["postal_code"] = sd.postal_code

    # ตัดส่วนจังหวัด/อำเภอ/ตำบล/รหัสไปรษณีย์ออก เหลือรายละเอียดบ้านเลขที่ ถนน ซอย
    rest = t
    for obj in (sd, ds, pv):
        if obj:
            new = re.sub(_PREFIX_RE + re.escape(obj.name_th), " ", rest, count=1)
            rest = new if new != rest else rest.replace(obj.name_th, " ", 1)
    if out.get("postal_code"):
        rest = rest.replace(out["postal_code"], " ")
    rest = re.sub(_PREFIX_RE + r"(?=\s|$)", " ", rest)
    stop = r"(?=\s+(?:ถนน|ถ\.|ซอย|ซ\.|หมู่ที่|หมู่|ม\.)|$)"
    for key, pat in (("moo", r"(?:หมู่ที่|หมู่|ม\.)\s*(\d+)"), ("road", r"(?:ถนน|ถ\.)\s*(.+?)" + stop),
                     ("soi", r"(?:ซอย|ซ\.)\s*(.+?)" + stop)):
        m = re.search(pat, rest)
        if m:
            out[key] = m.group(1).strip()
            rest = rest[:m.start()] + " " + rest[m.end():]
    rest = " ".join(rest.split())
    m = re.match(r"^(?:(?:บ้าน)?เลขที่\s*)?(\d+(?:/\d+)*)\s*", rest)
    if m:
        out["house_no"] = m.group(1)
        rest = rest[m.end():].strip()
    if rest:
        out["village"] = rest[:120]
    return out


def migrate_legacy_addresses():
    # แปลงเฉพาะที่อยู่แบบข้อความเดิมจริง ๆ = ทุกช่องย่อยยังว่าง (ไม่ทับข้อมูลที่ผู้ใช้กรอกเองบางช่อง)
    structured = (Member.house_no, Member.moo, Member.village, Member.soi, Member.road, Member.province_id,
                  Member.district_id, Member.subdistrict_id, Member.postal_code)
    q = Member.query.filter(Member.address.isnot(None), Member.address != "",
                            *[c.is_(None) for c in structured])
    changed = 0
    for m in q:
        r = parse_legacy_address(m.address)
        if not r:
            # แปลงไม่ได้ → เก็บข้อความเดิมไว้ในช่อง "หมู่บ้าน / อาคาร" ไม่ให้หายเมื่อแก้ไขแล้วบันทึก
            r = {"village": " ".join(m.address.split())[:120], "province": None, "district": None,
                 "subdistrict": None}
        for k in ("house_no", "moo", "village", "soi", "road", "postal_code"):
            setattr(m, k, r.get(k))
        m.province, m.district, m.subdistrict = r["province"], r["district"], r["subdistrict"]
        m.address = m.compose_address()
        changed += 1
    if changed:
        db.session.commit()
    return changed


def ensure_defaults():
    migrate_columns()
    migrate_elections_table()
    migrate_member_types()
    load_address_data()
    migrate_legacy_addresses()
    changed = False
    if Position.query.count() == 0:
        for name, level, exe, com, color in DEFAULT_POSITIONS:
            db.session.add(Position(name=name, level=level, is_executive=exe, is_committee=com, color=color))
        changed = True
    if AcademicYear.query.count() == 0:
        y = current_thai_academic_year()
        db.session.add(AcademicYear(year=y, name=f"ปีการศึกษา {y}", is_current=True,
                                    start_date=date(y - 543, 5, 16), end_date=date(y - 542, 3, 31)))
        changed = True
    if User.query.count() == 0:
        u = User(username="admin", full_name="ผู้ดูแลระบบ", role="superadmin")
        u.set_password("admin1234")
        u.set_permissions(ROLE_PERMISSIONS["superadmin"])
        db.session.add(u)
        changed = True
    if changed:
        db.session.commit()
    ensure_committee_positions()
