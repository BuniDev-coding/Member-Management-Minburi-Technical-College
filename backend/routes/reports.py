"""รายงานสมาชิกตามปีและตำแหน่ง

GET /api/reports/members?year_id=&position_id=&department_id=&status=&format=json|xlsx|pdf
GET /api/reports/summary?year_id=      สรุปจำนวนตามตำแหน่ง x แผนกวิชา
"""
import io
from datetime import datetime

from flask import Blueprint, current_app, g, jsonify, request, send_file

from models import db, AcademicYear, Position, Department, Member, MemberPosition, STATUSES
from routes.members import build_member_query
from utils.auth import error, permission_required
from utils.validators import parse_int

bp = Blueprint("reports", __name__, url_prefix="/api/reports")

COLUMNS = [("no", "ลำดับ"), ("member_no", "เลขสมาชิก"), ("full_name", "ชื่อ-นามสกุล"), ("position", "ตำแหน่ง"),
           ("department", "แผนกวิชา"), ("education_level", "ระดับชั้น"), ("academic_year", "ปีการศึกษา"),
           ("status_label", "สถานะ"), ("phone", "เบอร์ติดต่อ")]


def _report_rows(args):
    year_id = parse_int(args.get("year_id"))
    members = build_member_query(args).all()
    rows = []
    for m in members:
        r = m.to_summary()
        if year_id:
            mp = next((p for p in m.positions if p.academic_year_id == year_id), None)
            if mp:
                r.update(position=mp.position.name, position_level=mp.position.level)
            else:
                r.update(position="สมาชิกทั่วไป", position_level=99)
        rows.append(r)
    rows.sort(key=lambda r: (r["position_level"], r["member_no"]))
    for i, r in enumerate(rows, 1):
        r["no"] = i
    return rows


def _title(args):
    parts = ["รายงานรายชื่อสมาชิก"]
    year = db.session.get(AcademicYear, parse_int(args.get("year_id")) or 0)
    pos = db.session.get(Position, parse_int(args.get("position_id")) or 0)
    dept = db.session.get(Department, parse_int(args.get("department_id")) or 0)
    parts.append(f"ตำแหน่ง{pos.name}" if pos else "ทุกตำแหน่ง")
    parts.append(year.name if year else "ทุกปีการศึกษา")
    if dept:
        parts.append(f"แผนกวิชา{dept.name}")
    if args.get("status") in STATUSES:
        parts.append(f"สถานะ{STATUSES[args['status']]}")
    return " ".join(parts)


def _summary(year_id):
    """ตารางสรุป: แถว = แผนกวิชา, คอลัมน์ = ตำแหน่ง"""
    positions = Position.query.order_by(Position.level, Position.id).all()
    general = Position.general()
    q = Member.query
    if year_id:
        from routes.members import in_year_clause
        q = q.filter(in_year_clause(year_id))
    table = {}
    for m in q.all():
        if year_id:
            mp = next((p for p in m.positions if p.academic_year_id == year_id), None)
        else:
            mp = m.current_position()
        pid = mp.position_id if mp else (general.id if general else None)
        dept = m.department.name if m.department else "ไม่ระบุแผนก"
        row = table.setdefault(dept, {p.id: 0 for p in positions})
        if pid in row:
            row[pid] += 1
    rows = [{"department": d, "counts": [c[p.id] for p in positions], "total": sum(c.values())}
            for d, c in sorted(table.items())]
    totals = [sum(r["counts"][i] for r in rows) for i in range(len(positions))]
    return {"positions": [p.name for p in positions], "rows": rows, "totals": totals, "grand_total": sum(totals)}


@bp.get("/summary")
@permission_required("reports")
def summary():
    return jsonify({"success": True, **_summary(parse_int(request.args.get("year_id")))})


@bp.get("/members")
@permission_required("reports")
def members_report():
    args = request.args
    fmt = args.get("format", "json")
    rows = _report_rows(args)
    title = _title(args)
    if fmt == "json":
        return jsonify({"success": True, "title": title, "items": rows, "total": len(rows),
                        "summary": _summary(parse_int(args.get("year_id")))})
    stamp = datetime.now().strftime("%Y%m%d_%H%M")
    if fmt == "xlsx":
        return send_file(_excel(rows, title, parse_int(args.get("year_id"))), as_attachment=True,
                         download_name=f"member_report_{stamp}.xlsx",
                         mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    if fmt == "pdf":
        return send_file(_pdf(rows, title), as_attachment=True, download_name=f"member_report_{stamp}.pdf",
                         mimetype="application/pdf")
    return error("รูปแบบไฟล์ไม่รองรับ")


# =====================================================================
# Excel (openpyxl)
# =====================================================================
def _excel(rows, title, year_id):
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.utils import get_column_letter

    wb = Workbook()
    ws = wb.active
    ws.title = "รายชื่อสมาชิก"
    thin = Side(style="thin", color="C9D7F0")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    head_fill = PatternFill("solid", fgColor="1F4FB5")
    font = "TH Sarabun New"

    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(COLUMNS))
    ws["A1"] = current_app.config["ORG_NAME"]
    ws["A1"].font = Font(name=font, size=18, bold=True, color="1F4FB5")
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=len(COLUMNS))
    ws["A2"] = title
    ws["A2"].font = Font(name=font, size=16, bold=True)
    ws.merge_cells(start_row=3, start_column=1, end_row=3, end_column=len(COLUMNS))
    ws["A3"] = f"พิมพ์เมื่อ {_thai_datetime()}  โดย {g.user.full_name}  จำนวน {len(rows)} คน"
    ws["A3"].font = Font(name=font, size=14, color="777777")
    for c in ("A1", "A2", "A3"):
        ws[c].alignment = Alignment(horizontal="center")

    for col, (_, label) in enumerate(COLUMNS, 1):
        cell = ws.cell(row=5, column=col, value=label)
        cell.font = Font(name=font, size=14, bold=True, color="FFFFFF")
        cell.fill = head_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = border
    for i, r in enumerate(rows):
        for col, (key, _) in enumerate(COLUMNS, 1):
            cell = ws.cell(row=6 + i, column=col, value=r.get(key) if r.get(key) is not None else "-")
            cell.font = Font(name=font, size=14)
            cell.border = border
            if key in ("no", "member_no", "academic_year", "education_level", "status_label"):
                cell.alignment = Alignment(horizontal="center")
            if i % 2:
                cell.fill = PatternFill("solid", fgColor="F2F6FC")
    for col, w in enumerate([8, 15, 30, 16, 26, 11, 12, 12, 14], 1):
        ws.column_dimensions[get_column_letter(col)].width = w
    ws.freeze_panes = "A6"

    # ---- ชีตสรุป ----
    s = _summary(year_id)
    ws2 = wb.create_sheet("สรุปตามตำแหน่ง")
    headers = ["แผนกวิชา"] + s["positions"] + ["รวม"]
    ws2.append([title.replace("รายงานรายชื่อสมาชิก", "สรุปจำนวนสมาชิก")])
    ws2["A1"].font = Font(name=font, size=16, bold=True, color="1F4FB5")
    ws2.append([])
    ws2.append(headers)
    for col in range(1, len(headers) + 1):
        c = ws2.cell(row=3, column=col)
        c.font = Font(name=font, size=14, bold=True, color="FFFFFF")
        c.fill = head_fill
        c.alignment = Alignment(horizontal="center")
        c.border = border
    for r in s["rows"]:
        ws2.append([r["department"]] + r["counts"] + [r["total"]])
    ws2.append(["รวมทั้งหมด"] + s["totals"] + [s["grand_total"]])
    for row in ws2.iter_rows(min_row=4, max_row=ws2.max_row):
        for c in row:
            c.font = Font(name=font, size=14, bold=(row[0].value == "รวมทั้งหมด"))
            c.border = border
            if c.column > 1:
                c.alignment = Alignment(horizontal="center")
    ws2.column_dimensions["A"].width = 30
    for col in range(2, len(headers) + 1):
        ws2.column_dimensions[get_column_letter(col)].width = 14

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


# =====================================================================
# PDF (reportlab + ฟอนต์ภาษาไทย)
# =====================================================================
def _pdf(rows, title):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    from utils.thai_font import register_thai_font

    regular, bold = register_thai_font(current_app.config["FONT_FOLDER"])
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), leftMargin=12 * mm, rightMargin=12 * mm,
                            topMargin=12 * mm, bottomMargin=14 * mm, title=title)
    purple = colors.HexColor("#1F4FB5")
    st_title = ParagraphStyle("t", fontName=bold, fontSize=16, leading=24, alignment=1, textColor=purple)
    st_sub = ParagraphStyle("s", fontName=bold, fontSize=13, leading=20, alignment=1)
    st_info = ParagraphStyle("i", fontName=regular, fontSize=10, leading=15, alignment=1, textColor=colors.grey)
    st_cell = ParagraphStyle("c", fontName=regular, fontSize=10, leading=14)

    story = [
        Paragraph(current_app.config["ORG_NAME"], st_title),
        Paragraph(title, st_sub),
        Paragraph(f"พิมพ์เมื่อ {_thai_datetime()} โดย {g.user.full_name} | จำนวนทั้งหมด {len(rows)} คน", st_info),
        Spacer(1, 6 * mm),
    ]
    data = [[label for _, label in COLUMNS]]
    for r in rows:
        data.append([Paragraph(str(r.get(k) if r.get(k) is not None else "-"), st_cell) if k in ("full_name", "department")
                     else str(r.get(k) if r.get(k) is not None else "-") for k, _ in COLUMNS])
    if len(data) == 1:
        data.append(["-", "ไม่พบข้อมูล"] + [""] * (len(COLUMNS) - 2))
    widths = [12, 26, 58, 28, 52, 20, 20, 22, 28]
    t = Table(data, colWidths=[w * mm for w in widths], repeatRows=1)
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), regular),
        ("FONTNAME", (0, 0), (-1, 0), bold),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BACKGROUND", (0, 0), (-1, 0), purple),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("ALIGN", (0, 1), (1, -1), "CENTER"),
        ("ALIGN", (5, 1), (7, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#C9D7F0")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F2F6FC")]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t)

    def footer(canvas, doc_):
        canvas.saveState()
        canvas.setFont(regular, 9)
        canvas.setFillColor(colors.grey)
        canvas.drawRightString(landscape(A4)[0] - 12 * mm, 8 * mm, f"หน้า {doc_.page}")
        canvas.drawString(12 * mm, 8 * mm, "เอกสารภายใน — ระบบบริหารจัดการสมาชิกองค์การนักวิชาชีพในอนาคตแห่งประเทศไทย วิทยาลัยเทคนิคมีนบุรี")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    buf.seek(0)
    return buf


THAI_MONTHS = ["", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม",
               "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"]


def _thai_datetime(dt=None):
    dt = dt or datetime.now()
    return f"{dt.day} {THAI_MONTHS[dt.month]} {dt.year + 543} เวลา {dt:%H:%M} น."
