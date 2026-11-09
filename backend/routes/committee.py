"""คณะกรรมการดำเนินงาน (แบบ อวท.09) — แยกตามปีการศึกษา

GET    /api/committee?year_id=&department_id=        ตำแหน่งคณะกรรมการ + ผู้ดำรงตำแหน่งในปีนั้น
POST   /api/committee                                แต่งตั้ง {academic_year_id, position_id, member_id, start_date, end_date}
DELETE /api/committee/<mp_id>                        ถอดจากคณะกรรมการ (กลับเป็นสมาชิกทั่วไป)
GET    /api/committee/document?year_id=&format=pdf|xlsx&department_id=&club=&announce_date=&signer_name=
                                                     ประกาศแต่งตั้ง (อวท.09) — ผู้ลงนาม = ผู้อำนวยการวิทยาลัย
"""
import io
from datetime import datetime

from flask import Blueprint, current_app, jsonify, request, send_file

from models import db, AcademicYear, Department, Member, MemberPosition, Position
from utils.auth import error, login_required, permission_required
from utils.validators import ValidationError, clean_str, parse_date, parse_int

bp = Blueprint("committee", __name__, url_prefix="/api/committee")


def _year(year_id):
    return db.session.get(AcademicYear, year_id) if year_id else AcademicYear.current()


def committee_rows(year, department_id=None):
    """[(Position, [MemberPosition])] เฉพาะตำแหน่งที่นับเป็นคณะกรรมการ เรียงตามลำดับตำแหน่ง"""
    positions = Position.query.filter_by(is_committee=True).order_by(Position.level, Position.id).all()
    q = (MemberPosition.query.join(Member).filter(MemberPosition.academic_year_id == year.id,
                                                  MemberPosition.position_id.in_([p.id for p in positions])))
    if department_id:
        q = q.filter(Member.department_id == department_id)
    by_pos = {}
    for mp in q.order_by(Member.first_name, Member.last_name):
        by_pos.setdefault(mp.position_id, []).append(mp)
    return [(p, by_pos.get(p.id, [])) for p in positions]


@bp.get("")
@login_required
def list_committee():
    year = _year(parse_int(request.args.get("year_id")))
    if not year:
        return error("ยังไม่มีปีการศึกษา", 404)
    rows = committee_rows(year, parse_int(request.args.get("department_id")))
    items = []
    for p, mps in rows:
        d = p.to_dict()
        d["holders"] = [dict(mp.member.to_summary(), mp_id=mp.id, start_date=mp.start_date and mp.start_date.isoformat(),
                             end_date=mp.end_date and mp.end_date.isoformat()) for mp in mps]
        items.append(d)
    return jsonify({"success": True, "year": year.to_dict(), "items": items,
                    "total": sum(len(i["holders"]) for i in items)})


@bp.post("")
@permission_required("members.edit")
def appoint():
    data = request.get_json(silent=True) or {}
    year = db.session.get(AcademicYear, parse_int(data.get("academic_year_id")) or 0)
    pos = db.session.get(Position, parse_int(data.get("position_id")) or 0)
    m = db.session.get(Member, parse_int(data.get("member_id")) or 0)
    errors = {}
    if not year:
        errors["academic_year_id"] = "กรุณาเลือกปีการศึกษา"
    if not pos:
        errors["position_id"] = "กรุณาเลือกตำแหน่ง"
    if not m:
        errors["member_id"] = "กรุณาเลือกสมาชิก"
    try:
        start, end = parse_date(data.get("start_date")), parse_date(data.get("end_date"))
    except ValidationError as e:
        errors.update(e.errors)
        start = end = None
    if start and end and end < start:
        errors["end_date"] = "วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น"
    if errors:
        return error("ข้อมูลไม่ถูกต้อง", 400, errors=errors)
    mp = appoint_member(m, pos, year, start, end)
    db.session.commit()
    return jsonify({"success": True, "message": f"แต่งตั้ง {m.full_name} เป็น{pos.name} {year.name} เรียบร้อย",
                    "mp_id": mp.id})


def appoint_member(m, pos, year, start=None, end=None):
    """ตั้งตำแหน่งของสมาชิกในปีนั้น (ปีละ 1 ตำแหน่ง — มีอยู่แล้วจะเปลี่ยนตำแหน่งแทน)"""
    mp = MemberPosition.query.filter_by(member_id=m.id, academic_year_id=year.id).first()
    if not mp:
        mp = MemberPosition(member_id=m.id, academic_year_id=year.id, position_id=pos.id)
        db.session.add(mp)
    mp.position_id = pos.id
    mp.start_date = start or mp.start_date or year.start_date
    mp.end_date = end or mp.end_date or year.end_date
    db.session.flush()
    return mp


@bp.delete("/<int:mp_id>")
@permission_required("members.edit")
def remove(mp_id):
    mp = db.get_or_404(MemberPosition, mp_id, description="ไม่พบข้อมูลการดำรงตำแหน่ง")
    name, pos = mp.member.full_name, mp.position.name
    general = Position.general()
    if general and not general.is_committee:
        mp.position_id = general.id     # ยังเป็นสมาชิกในปีนั้น แต่ไม่อยู่ในคณะกรรมการ
    else:
        db.session.delete(mp)
    db.session.commit()
    return jsonify({"success": True, "message": f"ถอด {name} ออกจากตำแหน่ง{pos}แล้ว"})


# =====================================================================
# เอกสาร อวท.09
# =====================================================================
@bp.get("/document")
@permission_required("reports")
def document():
    args = request.args
    year = _year(parse_int(args.get("year_id")))
    if not year:
        return error("ไม่พบปีการศึกษา", 404)
    dept = db.session.get(Department, parse_int(args.get("department_id")) or 0)
    sections = [(p.name, [mp.member for mp in mps]) for p, mps in committee_rows(year, dept.id if dept else None)]
    rows = [(name, m) for name, ms in sections for m in ms]
    club = clean_str(args.get("club"), 120) or (dept.name if dept else "")
    stamp = datetime.now().strftime("%Y%m%d_%H%M")
    fmt = args.get("format", "pdf")
    if fmt == "xlsx":
        return send_file(_excel(year, rows, club), as_attachment=True, download_name=f"avt09_{year.year}_{stamp}.xlsx",
                         mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    try:
        announce = parse_date(args.get("announce_date"))
    except ValidationError:
        announce = None
    from utils.documents import form09
    buf = form09(year, sections, club=club, announce_date=announce, signer_name=clean_str(args.get("signer_name"), 150))
    return send_file(buf, as_attachment=True, download_name=f"avt09_{year.year}_{stamp}.pdf", mimetype="application/pdf")


def _excel(year, rows, club):
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

    wb = Workbook()
    ws = wb.active
    ws.title = "คณะกรรมการ"
    font = "TH Sarabun New"
    thin = Side(style="thin", color="999999")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    titles = [current_app.config["ORG_NAME"],
              f"รายชื่อคณะกรรมการดำเนินงานชมรมวิชาชีพ{club} ประจำปีการศึกษา {year.year} (แบบ อวท.09)"]  # noqa: E501
    for i, t in enumerate(titles, 1):
        ws.merge_cells(start_row=i, start_column=1, end_row=i, end_column=6)
        ws.cell(row=i, column=1, value=t).font = Font(name=font, size=16 if i == 1 else 14, bold=True)
        ws.cell(row=i, column=1).alignment = Alignment(horizontal="center")
    head = ["ลำดับ", "ตำแหน่ง", "ชื่อ-นามสกุล", "รหัสประจำตัว", "ระดับชั้น", "แผนกวิชา"]
    for c, h in enumerate(head, 1):
        cell = ws.cell(row=4, column=c, value=h)
        cell.font = Font(name=font, size=14, bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="1F4FB5")
        cell.alignment = Alignment(horizontal="center")
        cell.border = border
    for i, (pos, m) in enumerate(rows, 1):
        vals = [i, pos, m.full_name, m.student_id or "-", m.education_level or "-", m.department.name if m.department else "-"]
        for c, v in enumerate(vals, 1):
            cell = ws.cell(row=4 + i, column=c, value=v)
            cell.font = Font(name=font, size=14)
            cell.border = border
            if c in (1, 4, 5):
                cell.alignment = Alignment(horizontal="center")
    for col, w in zip("ABCDEF", (8, 18, 32, 16, 12, 26)):
        ws.column_dimensions[col].width = w
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf
