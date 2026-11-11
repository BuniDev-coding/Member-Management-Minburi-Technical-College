"""สร้างเอกสาร PDF ตามแบบฟอร์มขององค์การนักวิชาชีพในอนาคตแห่งประเทศไทย (อวท.)

- form10(member, registrar)    ใบสมัครสมาชิก (แบบ อวท.10)
- form09(year, rows, ...)      ประกาศแต่งตั้งคณะกรรมการดำเนินงานชมรมวิชาชีพ (แบบ อวท.09)
- form08(election)             รายงานผลการเลือกตั้งประธานชมรมวิชาชีพ (แบบ อวท.08)

จัดหน้าตามต้นฉบับแบบฟอร์ม: ข้อความคงที่เหมือนต้นฉบับ ข้อมูลที่มีในระบบจะเติมพร้อมขีดเส้นใต้
ช่องที่ไม่มีข้อมูลจะเป็นจุดไข่ปลาให้เขียนด้วยมือ
"""
import io
import os
import re

from flask import current_app
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Flowable, Image, Paragraph, SimpleDocTemplate, Spacer, Table

from utils.thai_font import register_thai_font

THAI_MONTHS = ["", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม",
               "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"]
_THAI_DIGITS = str.maketrans("0123456789", "๐๑๒๓๔๕๖๗๘๙")
FULL_W = 170 * mm   # ความกว้างพื้นที่พิมพ์ (A4 ขอบซ้าย-ขวา 20 มม.)
FRAME_W = FULL_W - 12   # ความกว้างที่ข้อความใช้ได้จริง (กรอบของ reportlab เว้นขอบในข้างละ 6pt)
BODY_SIZE, BODY_LEADING = 12.5, 18.5   # ขนาดใกล้เคียง TH Sarabun 16 ของต้นฉบับ
FORM09_LABELS = {"ประธาน": "ประธานชมรม", "รองประธาน": "รองประธานชมรม"}   # ชื่อตำแหน่งที่ใช้ในแบบฟอร์ม


def th(v):
    """แปลงตัวเลขอารบิกเป็นเลขไทย"""
    return str(v).translate(_THAI_DIGITS)


def _x(v):
    return str(v).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


_FONT = {"name": "Helvetica", "size": BODY_SIZE}


def dots(w_mm):
    """จุดไข่ปลายาวประมาณ w_mm มิลลิเมตร (ตามฟอนต์ที่ใช้จริง)"""
    from reportlab.pdfbase.pdfmetrics import stringWidth
    one = stringWidth(".", _FONT["name"], _FONT["size"]) or 1
    return "." * max(int(w_mm * mm / one), 3)


def fill(value, w=20):
    """ช่องกรอก: มีค่า = ขีดเส้นใต้ / ไม่มีค่า = จุดไข่ปลายาว w มม."""
    if value in (None, ""):
        return dots(w)
    return f"<u>&nbsp;&nbsp;{_x(value).replace(' ', '&nbsp;')}&nbsp;&nbsp;</u>"   # ไม่ตัดบรรทัดกลางค่า


def fit_line(parts, avail=None):
    """ต่อข้อความกับช่องกรอกให้พอดี 1 บรรทัด — parts: ข้อความ (str) หรือ (ค่า, ความกว้างช่อง มม.)
    ช่องที่ยังไม่มีค่าจะยืด/หดจุดไข่ปลาตามที่ว่างที่เหลือ บรรทัดจึงไม่ล้นไปขึ้นบรรทัดใหม่"""
    from reportlab.pdfbase.pdfmetrics import stringWidth

    def sw(t):
        return stringWidth(t, _FONT["name"], _FONT["size"])

    def blank(p):
        return p[0] in (None, "")
    avail = FRAME_W if avail is None else avail
    fixed = sum(sw(re.sub(r"<[^>]+>", "", p).replace("&nbsp;", " ").replace("&amp;", "&")) if isinstance(p, str)
                else (0 if blank(p) else sw(f"  {p[0]}  ")) for p in parts)
    want = sum(p[1] for p in parts if not isinstance(p, str) and blank(p)) * mm
    k = max(avail - fixed - 2 * mm, 0) / want if want else 1
    return "".join(p if isinstance(p, str) else fill(p[0], p[1] * k) for p in parts)


def date_parts(d):
    """(วัน, เดือน, ปี พ.ศ.) หรือ (None, None, None)"""
    if not d:
        return None, None, None
    return d.day, THAI_MONTHS[d.month], d.year + 543


def club_text(club):
    """'ชมรมวิชาชีพ......./ชมรม.......' ตามแบบฟอร์ม — ระบุชื่อแล้วจะแทนช่องว่าง"""
    return f"ชมรมวิชาชีพ{fill(club)}" if club else f"ชมรมวิชาชีพ{dots(14)}/ชมรม{dots(14)}"


class CheckBox(Flowable):
    """ช่องสี่เหลี่ยม ☐ / ☑ (วาดเอง เพราะฟอนต์ไทยไม่มีสัญลักษณ์นี้)"""

    def __init__(self, checked=False, size=4 * mm):
        super().__init__()
        self.checked, self.size = checked, size
        self.width = self.height = size

    def draw(self):
        c, s = self.canv, self.size
        c.setLineWidth(0.8)
        c.rect(0, 0, s, s)
        if self.checked:
            c.setLineWidth(1.4)
            c.lines([(s * .18, s * .5, s * .42, s * .2), (s * .42, s * .2, s * .95, s * 1.05)])


_NOPAD = [("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
          ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]


class _Doc:
    def __init__(self, title, code_th):
        cfg = current_app.config
        self.avt, self.college = cfg["AVT_NAME"], cfg["COLLEGE_NAME"]
        self.college_short = self.college.replace("วิทยาลัย", "", 1)   # "เทคนิคมีนบุรี" ต่อท้ายคำว่า วิทยาลัย
        self.logo = cfg.get("AVT_LOGO")
        if not (self.logo and os.path.isfile(self.logo)):   # ไม่มีไฟล์ตราที่ตั้งค่าไว้ → ใช้โลโก้ของระบบ
            self.logo = os.path.join(cfg["FRONTEND_FOLDER"], "img", "logo.png")
        self.regular, self.bold = register_thai_font(cfg["FONT_FOLDER"])
        _FONT["name"] = self.regular
        self.buf = io.BytesIO()
        self.code = code_th
        self.doc = SimpleDocTemplate(self.buf, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm,
                                     topMargin=12 * mm, bottomMargin=12 * mm, title=title)
        R, B = self.regular, self.bold

        def st(name, font=R, size=BODY_SIZE, leading=BODY_LEADING, **kw):
            return ParagraphStyle(name, fontName=font, fontSize=size, leading=leading, **kw)
        self.st = {
            "code": st("code", alignment=2),
            "title": st("title", B, 13.5, 20, alignment=1),
            "center": st("center", alignment=1),
            "right": st("right", leftIndent=78 * mm),
            "body": st("body"),
            "indent": st("indent", firstLineIndent=20 * mm),
            "sign": st("sign", alignment=1),
            "list": st("list", size=BODY_SIZE - 1, leading=BODY_LEADING),
        }
        self.story = []

    def p(self, text, style="body"):
        self.story.append(Paragraph(text, self.st[style]))

    def space(self, h=3):
        self.story.append(Spacer(1, h * mm))

    def code_and_logo(self, size=26, align="CENTER"):
        self.p(f"แบบ {self.code}", "code")
        if self.logo and os.path.isfile(self.logo):
            try:
                img = Image(self.logo, width=size * mm, height=size * mm, kind="proportional")
                img.hAlign = align
                self.story.append(img)
                return
            except Exception:  # noqa: BLE001 — ไฟล์รูปเสีย: เว้นที่ว่าง
                pass
        self.space(size * 0.45)

    def signature(self, lines, width=85):
        """บล็อกลายเซ็น: lines = ["ลงชื่อ....", "( ชื่อ )", "ตำแหน่ง", ...]"""
        return Table([[Paragraph(x, self.st["sign"])] for x in lines], colWidths=[width * mm], style=_NOPAD)

    def place(self, flowable, left_mm):
        """วางบล็อกโดยเว้นด้านซ้าย left_mm"""
        self.story.append(Table([["", flowable]], colWidths=[left_mm * mm, FULL_W - left_mm * mm], style=_NOPAD))

    def center(self, flowable):
        self.story.append(Table([[flowable]], colWidths=[FULL_W], style=_NOPAD + [("ALIGN", (0, 0), (-1, -1), "CENTER")]))

    def build(self):
        self.doc.build(self.story)
        self.buf.seek(0)
        return self.buf


def _name(n, w=55):
    return f"( {fill(n)} )" if n else f"({dots(w)})"


# =====================================================================
# แบบ อวท.10 — ใบสมัครสมาชิก
# =====================================================================
def form10(m, member_types, registrar=None):
    d = _Doc(f"ใบสมัครสมาชิก อวท.10 — {m.full_name}", "อวท.๑๐")
    d.code_and_logo(26)
    for t in ("ใบสมัคร", f"สมาชิก{d.avt}", d.college):
        d.p(_x(t), "title")
    d.space(4)
    day, month, year = date_parts(m.joined_date)
    for t in (d.avt, d.college):
        d.p(_x(t), "right")
    d.p("วันที่" + (f"<u>&nbsp;&nbsp;{day}&nbsp;&nbsp;{month}&nbsp;&nbsp;{year}&nbsp;&nbsp;</u>" if day else dots(45)), "right")

    sd, ds = m.subdistrict, m.district
    road_moo = " / ".join(x for x in (m.road, f"หมู่ {m.moo}" if m.moo else None) if x) or None
    house = " ".join(x for x in (m.house_no, m.village) if x) or None
    level = " ".join(x for x in (m.education_level, f"กลุ่ม {m.class_group}" if m.class_group else None) if x) or None
    bday, bmonth, byear = date_parts(m.birth_date)
    F = fit_line
    lines = [
        ("indent", F(["ข้าพเจ้า", (m.full_name, 128)], FRAME_W - 20 * mm)),
        ("body", F(["รหัสประจำตัวนักเรียน&nbsp;นักศึกษา", (m.student_id, 58),
                    "แผนกวิชา", (m.department.name if m.department else None, 50)])),
        ("body", F(["ระดับชั้น", (level, 18), f"{_x(d.college)}&nbsp;เกิดวันที่",
                    (f"{bday} {bmonth} {byear}" if bday else None, 72)])),
        ("body", F(["ที่อยู่ปัจจุบันบ้านเลขที่", (house, 48), "ตรอก/ซอย", (m.soi, 65)])),
        ("body", F(["ถนน/หมู่ที่", (road_moo, 64), "แขวง/ตำบล", (sd.name_th if sd else None, 64)])),
        ("body", F(["เขต/อำเภอ", (ds.name_th if ds else None, 33), "จังหวัด", (m.province.name_th if m.province else None, 30),
                    "รหัสไปรษณีย์", (m.postal_code, 20), "โทรศัพท์", (m.phone, 26)])),
        ("body", F(["ชื่อบิดา", (m.father_name, 68), "&nbsp;ชื่อมารดา", (m.mother_name, 68)])),
        ("body", f"ขอสมัครเป็นสมาชิก{_x(d.avt)}&nbsp;{_x(d.college)}"),
    ]
    for style, text in lines:
        d.p(text, style)
    d.space(4)
    d.place(d.signature([f"ลงชื่อ{dots(58)}ผู้สมัคร", _name(m.full_name, 55)], 100), 68)
    d.space(3)

    # ---- บันทึกของเจ้าหน้าที่ ----
    d.p("<b>บันทึกของเจ้าหน้าที่</b> ระดับสมาชิก")
    reg_date = m.registered_date or m.joined_date
    rows = []
    style = [("LEFTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0),
             ("BOTTOMPADDING", (0, 0), (-1, -1), 1), ("VALIGN", (0, 0), (-1, -1), "MIDDLE")]
    for t in member_types:
        checked = t == m.member_type
        kind, _, scope = t.partition(" ")
        rows.append([CheckBox(checked), Paragraph(f"สมาชิก{kind}", d.st["body"]), Paragraph(scope, d.st["body"])])
        dd, mo, yy = date_parts(reg_date) if checked else (None, None, None)
        reg = m.registration_no if checked else None
        rows.append([Paragraph(f"ทะเบียนเลขที่{fill(reg, 38)}วันที่{fill(dd, 16)}เดือน{fill(mo, 32)}พ.ศ.{fill(yy, 20)}",
                               d.st["body"]), "", ""])
        style.append(("SPAN", (0, len(rows) - 1), (2, len(rows) - 1)))
    d.place(Table(rows, colWidths=[8 * mm, 30 * mm, 122 * mm], style=style), 10)
    d.space(4)
    ld, lm, ly = date_parts(m.left_date)
    d.p(f"พ้นสภาพสมาชิกด้วยเหตุ{fill(m.leave_reason, 20)}&nbsp;เมื่อวันที่{fill(ld, 16)}เดือน{fill(lm, 30)}พ.ศ.{fill(ly, 20)}")
    d.space(4)
    d.place(d.signature([f"ลงชื่อ{dots(58)}นายทะเบียนองค์การ", _name(registrar, 55)], 110), 60)
    return d.build()


# =====================================================================
# แบบ อวท.09 — ประกาศแต่งตั้งคณะกรรมการดำเนินงานชมรมวิชาชีพ
# =====================================================================
def form09(year, sections, club="", announce_date=None, signer_name=None):
    """sections: [(position_name, [member, ...])] เรียงตามลำดับตำแหน่ง"""
    d = _Doc(f"ประกาศแต่งตั้งคณะกรรมการ {year.name}", "อวท. ๐๙")
    cs = d.college_short
    d.code_and_logo(26)
    d.p(f"ประกาศ{_x(d.avt)}&nbsp;วิทยาลัย{fill(cs, 35)}", "title")
    d.p(f"เรื่อง&nbsp;&nbsp;แต่งตั้งคณะกรรมการดำเนินงาน{club_text(club)}", "title")
    d.p(f"ประจำปีการศึกษา{fill(th(year.year), 45)}", "title")
    d.p(dots(60), "center")
    d.p(f"เพื่อให้การดำเนินงานของ{club_text(club)} ภายใต้{_x(d.avt)} วิทยาลัย{fill(cs, 45)} "
        f"สามารถดำเนินกิจกรรมตามวัตถุประสงค์ของชมรมที่วางไว้ อาศัยระเบียบสำนักงานคณะกรรมการการอาชีวศึกษา "
        f"ว่าด้วย{_x(d.avt)} พ.ศ. ๒๕๖๖ ข้อ ๑๖&nbsp;ข้อ ๑๙ ข้อ ๒๒ ข้อ ๒๔ (๑) และแนวปฏิบัติประกอบระเบียบ ข้อ ๒๙ (๖) "
        f"คณะกรรมการบริหาร{_x(d.avt)} วิทยาลัย{fill(cs, 35)} "
        f"จึงแต่งตั้งคณะกรรมการดำเนินงาน{club_text(club)} ประจำปีการศึกษา{fill(th(year.year), 25)} ประกอบด้วย", "indent")
    d.space(2)

    rows, n = [], 0
    for pos, members in sections:
        label = FORM09_LABELS.get(pos, pos)
        if not members:   # ยังไม่มีผู้ดำรงตำแหน่ง → เว้นบรรทัดให้เขียนเอง
            n += 1
            rows.append([f"{th(n)}.", "", label + (" (ไม่เกิน ๑๘ คน)" if pos == "กรรมการ" else "")])
        for m in members:
            n += 1
            rows.append([f"{th(n)}.", m.full_name, label])
    style = [("FONTNAME", (0, 0), (-1, -1), d.regular), ("FONTSIZE", (0, 0), (-1, -1), BODY_SIZE),
             ("VALIGN", (0, 0), (-1, -1), "BOTTOM"), ("TOPPADDING", (0, 0), (-1, -1), 2),
             ("BOTTOMPADDING", (0, 0), (-1, -1), 2), ("LEFTPADDING", (0, 0), (-1, -1), 3)]
    style += [("LINEBELOW", (1, i), (1, i), 0.6, colors.black, None, (1, 2)) for i in range(len(rows))]
    d.place(Table(rows, colWidths=[10 * mm, 82 * mm, 58 * mm], style=style), 20)
    d.space(4)
    dd, mo, yy = date_parts(announce_date)
    d.p(f"ประกาศ&nbsp;&nbsp;&nbsp;ณ&nbsp;&nbsp;วันที่{fill(th(dd) if dd else None, 18)}เดือน{fill(mo, 38)}"
        f"พ.ศ.{fill(th(yy) if yy else None, 20)}", "center")
    d.space(12)
    d.center(d.signature([f"ลงชื่อ{dots(60)}", _name(signer_name, 55), f"ผู้อำนวยการวิทยาลัย{fill(cs, 35)}",
                          f"ประธานกรรมการบริหาร{_x(d.avt)}", f"วิทยาลัย{fill(cs, 45)}"], 150))
    return d.build()


# =====================================================================
# แบบ อวท.08 — รายงานผลการเลือกตั้งประธานชมรมวิชาชีพ
# =====================================================================
def form08(e):
    d = _Doc(f"รายงานผลการเลือกตั้ง {e.title}", "อวท. ๐๘")
    cs = d.college_short
    club = e.department.name if e.department else ""
    pos = e.position.name if e.position else "ประธาน"
    pos_label = FORM09_LABELS.get(pos, pos).replace("ชมรม", "")
    year = th(e.academic_year.year) if e.academic_year else None
    club_tail = club_text(club).replace("ชมรมวิชาชีพ", "", 1)   # ส่วนหลัง "ชมรมวิชาชีพ"
    d.code_and_logo(24, "LEFT")
    rd, rm, ry = date_parts(e.report_date)
    for t in (club_text(club), _x(d.avt), f"วิทยาลัย{fill(cs, 55)}"):
        d.p(t, "right")
    d.p(f"วันที่{fill(th(rd) if rd else None, 10)}เดือน{fill(rm, 25)}พ.ศ.{fill(th(ry) if ry else None, 15)}", "right")
    d.space(3)
    d.p(f"เรื่อง&nbsp;&nbsp;&nbsp;รายงานผลการเลือกตั้ง{_x(pos_label)}{club_text(club)} ประจำปีการศึกษา{fill(year, 22)}")
    d.p(f"เรียน&nbsp;&nbsp;&nbsp;&nbsp;ประธานกรรมการบริหาร{_x(d.avt)} วิทยาลัย{fill(cs, 32)}")
    ed, em, ey = date_parts(e.election_date)
    d.p(f"ตามที่{club_text(club)} {_x(d.avt)} วิทยาลัย{fill(cs, 15)} "
        f"ได้จัดให้มีการเลือกตั้ง {_x(pos_label)}{club_text(club)} ประจำปีการศึกษา{fill(year, 18)} "
        f"ในวันที่{fill(th(ed) if ed else None, 8)}เดือน{fill(em, 12)}พ.ศ.{fill(th(ey) if ey else None, 8)}นั้น", "indent")
    d.p("บัดนี้ การเลือกตั้งได้เสร็จสิ้นลงเรียบร้อยแล้ว ซึ่งปรากฏผลตามลำดับ&nbsp;&nbsp;ดังนี้", "indent")

    ranked = e.ranked() or [(None, None)] * 3
    rows = []
    for i, (_, c) in enumerate(ranked, 1):
        m = c.member if c else None
        rows.append([Paragraph(
            f"{th(i)}.&nbsp;&nbsp;ชื่อ-สกุล{fill(m.full_name if m else None, 40)} "
            f"ผู้สมัครหมายเลข{fill(th(c.candidate_no) if c else None, 10)} "
            f"ชั้นปี{fill(th(m.education_level) if m and m.education_level else None, 22)} "
            f"ได้{fill(th(f'{c.votes:,}') if c else None, 12)}&nbsp;คะแนน", d.st["list"])])
    d.place(Table(rows, colWidths=[164 * mm], style=_NOPAD), 6)
    d.space(1)
    d.p("จึงเรียนมาเพื่อโปรดทราบและแจ้งผู้เกี่ยวข้องดำเนินการ ต่อไป", "indent")
    d.space(3)

    w1, w2 = 76, 94

    def opinion(w):
        return f"ความเห็น{dots(w - 18)}"

    def sign(w):
        return f"ลงชื่อ{dots(w - 14)}"
    left1 = d.signature([sign(w1 - 10), _name(e.reporter_name, w1 - 22), f"ประธานชมรมวิชาชีพ{club_tail}"], w1)
    right1 = d.signature([opinion(w2), sign(w2), _name(e.advisor_name, w2 - 18),
                          f"ครูที่ปรึกษาชมรมวิชาชีพ{club_tail}"], w2)
    left2 = d.signature([opinion(w1 - 4), sign(w1 - 10), _name(e.activity_head_name, w1 - 22),
                         "หัวหน้างานกิจกรรมนักเรียน นักศึกษา"], w1)
    right2 = d.signature([opinion(w2), sign(w2), _name(e.deputy_name, w2 - 18),
                          "รองผู้อำนวยการฝ่ายพัฒนากิจการนักเรียน&nbsp;นักศึกษา", "รองประธานกรรมการบริหารองค์การนักวิชาชีพ",
                          "ในอนาคตแห่งประเทศไทย", f"วิทยาลัย{fill(cs, 40)}"], w2)
    d.story.append(Table([[left1, right1], [left2, right2]], colWidths=[w1 * mm, w2 * mm],
                         style=_NOPAD + [("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 1), (-1, 1), 8)]))
    d.p(dots(150), "center")
    d.center(d.signature([sign(80), _name(e.director_name, 60), f"ผู้อำนวยการวิทยาลัย{fill(cs, 35)}",
                          f"ประธานกรรมการบริหาร{_x(d.avt)}", f"วิทยาลัย{fill(cs, 45)}"], 150))
    return d.build()
