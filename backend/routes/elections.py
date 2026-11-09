"""การเลือกตั้ง (แบบ อวท.08 — รายงานผลการเลือกตั้งประธานชมรมวิชาชีพ)

GET    /api/elections?year_id=                     รายการการเลือกตั้ง
GET    /api/elections/<id>                         รายละเอียด + ผู้สมัคร (เรียงตามคะแนน พร้อมลำดับ)
POST   /api/elections                              สร้าง {academic_year_id, position_id, title, election_date, ...,
                                                         candidates: [{member_id, candidate_no, votes, note}]}
PUT    /api/elections/<id>                         แก้ไข (ส่ง candidates = แทนที่รายชื่อผู้สมัครทั้งหมด)
DELETE /api/elections/<id>                         ลบ
POST   /api/elections/<id>/appoint                 แต่งตั้งผู้ชนะเข้าตำแหน่งในปีการศึกษานั้น
GET    /api/elections/<id>/document                รายงานผลการเลือกตั้ง PDF (อวท.08)
"""
from datetime import datetime

from flask import Blueprint, jsonify, request, send_file

from models import db, AcademicYear, Department, Election, ElectionCandidate, Member, Position
from models.election import SIGNER_FIELDS
from routes.committee import appoint_member
from utils.auth import error, permission_required
from utils.validators import ValidationError, clean_str, parse_date, parse_int

bp = Blueprint("elections", __name__, url_prefix="/api/elections")


def _nonneg(v, field, errors):
    if v in (None, ""):
        return None
    n = parse_int(v)
    if n is None or n < 0:
        errors[field] = "ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป"
        return None
    return n


@bp.get("")
@permission_required("members.view")
def list_elections():
    q = Election.query
    yid = parse_int(request.args.get("year_id"))
    if yid:
        q = q.filter(Election.academic_year_id == yid)
    rows = q.order_by(Election.election_date.desc(), Election.id.desc()).all()
    return jsonify({"success": True, "items": [e.to_dict() for e in rows]})


@bp.get("/<int:eid>")
@permission_required("members.view")
def get_election(eid):
    e = db.get_or_404(Election, eid, description="ไม่พบข้อมูลการเลือกตั้ง")
    return jsonify({"success": True, "election": e.to_dict(full=True)})


def _apply(e, data, is_new):
    errors = {}
    year = db.session.get(AcademicYear, parse_int(data.get("academic_year_id")) or 0)
    pos = db.session.get(Position, parse_int(data.get("position_id")) or 0)
    if not year:
        errors["academic_year_id"] = "กรุณาเลือกปีการศึกษา"
    if not pos:
        errors["position_id"] = "กรุณาเลือกตำแหน่งที่เลือกตั้ง"
    did = parse_int(data.get("department_id"))
    dept = db.session.get(Department, did) if did else None
    if did and not dept:
        errors["department_id"] = "ไม่พบแผนกวิชา"
    title = clean_str(data.get("title"), 200)
    if not title and pos:
        title = f"การเลือกตั้ง{pos.name}ชมรมวิชาชีพ{dept.name if dept else ''}".strip()
    try:
        edate = parse_date(data.get("election_date"))
    except ValidationError as ex:
        errors.update({"election_date": str(ex)})
        edate = None

    e.academic_year_id = year.id if year else None
    e.position_id = pos.id if pos else None
    e.department_id = dept.id if dept else None
    e.title = title
    e.election_date = edate
    e.eligible_voters = _nonneg(data.get("eligible_voters"), "eligible_voters", errors)
    e.spoiled_ballots = _nonneg(data.get("spoiled_ballots"), "spoiled_ballots", errors)
    e.no_vote = _nonneg(data.get("no_vote"), "no_vote", errors)
    for f in SIGNER_FIELDS:
        setattr(e, f, clean_str(data.get(f), 150))
    try:
        e.report_date = parse_date(data.get("report_date"))
    except ValidationError as ex:
        errors["report_date"] = str(ex)
    e.note = clean_str(data.get("note"))

    if "candidates" in data or is_new:
        rows, seen_m, seen_no = [], set(), set()
        for i, c in enumerate(data.get("candidates") or []):
            mid = parse_int(c.get("member_id"))
            if not mid:
                continue
            m = db.session.get(Member, mid)
            no = parse_int(c.get("candidate_no"))
            votes = _nonneg(c.get("votes"), f"candidates.{i}", errors) or 0
            if not m:
                errors[f"candidates.{i}"] = "ไม่พบสมาชิก"
            elif mid in seen_m:
                errors[f"candidates.{i}"] = f"{m.full_name} อยู่ในรายชื่อผู้สมัครซ้ำ"
            elif not no or no < 1:
                errors[f"candidates.{i}"] = f"กรุณาระบุหมายเลขผู้สมัครของ {m.full_name}"
            elif no in seen_no:
                errors[f"candidates.{i}"] = f"หมายเลขผู้สมัคร {no} ซ้ำ"
            seen_m.add(mid)
            seen_no.add(no)
            rows.append(dict(member_id=mid, candidate_no=no, votes=votes, note=clean_str(c.get("note"), 255)))
        if not errors:
            existing = {c.member_id: c for c in e.candidates}
            keep = set()
            # เลี่ยงหมายเลขชนกันระหว่างอัปเดต: ย้ายหมายเลขเดิมออกไปก่อน
            for c in existing.values():
                c.candidate_no = -c.id
            db.session.flush()
            for r in rows:
                c = existing.get(r["member_id"])
                if c:
                    for k, v in r.items():
                        setattr(c, k, v)
                else:
                    e.candidates.append(ElectionCandidate(**r))
                keep.add(r["member_id"])
            for mid, c in existing.items():
                if mid not in keep:
                    e.candidates.remove(c)
    if errors:
        raise ValidationError(errors)


def _save(e, is_new):
    data = request.get_json(silent=True) or {}
    try:
        with db.session.no_autoflush:
            _apply(e, data, is_new)
    except ValidationError as ex:
        db.session.rollback()
        first = next(iter(ex.errors.values()))
        return error(f"ข้อมูลไม่ถูกต้อง: {first}", 400, errors=ex.errors)
    if is_new:
        db.session.add(e)
    db.session.commit()
    return jsonify({"success": True, "message": "บันทึกข้อมูลการเลือกตั้งเรียบร้อย", "election": e.to_dict(full=True)})


@bp.post("")
@permission_required("members.edit")
def create_election():
    return _save(Election(), True)


@bp.put("/<int:eid>")
@permission_required("members.edit")
def update_election(eid):
    return _save(db.get_or_404(Election, eid, description="ไม่พบข้อมูลการเลือกตั้ง"), False)


@bp.delete("/<int:eid>")
@permission_required("members.edit")
def delete_election(eid):
    e = db.get_or_404(Election, eid, description="ไม่พบข้อมูลการเลือกตั้ง")
    db.session.delete(e)
    db.session.commit()
    return jsonify({"success": True, "message": "ลบข้อมูลการเลือกตั้งแล้ว"})


@bp.post("/<int:eid>/appoint")
@permission_required("members.edit")
def appoint_winner(eid):
    e = db.get_or_404(Election, eid, description="ไม่พบข้อมูลการเลือกตั้ง")
    w = e.winner()
    if not w:
        return error("ยังสรุปผู้ชนะไม่ได้ (ยังไม่มีคะแนน หรือคะแนนสูงสุดเท่ากัน)", 409)
    appoint_member(w.member, e.position, e.academic_year)
    e.appointed_at = datetime.now()
    db.session.commit()
    return jsonify({"success": True, "message": f"แต่งตั้ง {w.member.full_name} เป็น{e.position.name} "
                                               f"{e.academic_year.name} เรียบร้อย",
                    "election": e.to_dict(full=True)})


@bp.get("/<int:eid>/document")
@permission_required("reports")
def document(eid):
    e = db.get_or_404(Election, eid, description="ไม่พบข้อมูลการเลือกตั้ง")
    from utils.documents import form08
    stamp = datetime.now().strftime("%Y%m%d_%H%M")
    return send_file(form08(e), as_attachment=True, download_name=f"avt08_{e.id}_{stamp}.pdf",
                     mimetype="application/pdf")
