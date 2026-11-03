"""GET /api/dashboard?year_id= — สถิติสำหรับหน้า Dashboard"""
from flask import Blueprint, jsonify, request
from sqlalchemy import func, or_

from models import db, Member, MemberPosition, Position, AcademicYear, Department, STATUSES
from routes.members import in_year_clause
from utils.auth import login_required
from utils.validators import parse_int

bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")


@bp.get("")
@login_required
def dashboard():
    year_id = parse_int(request.args.get("year_id"))
    year = db.session.get(AcademicYear, year_id) if year_id else AcademicYear.current()

    total = Member.query.count()
    in_year = Member.query.filter(in_year_clause(year.id)).count() if year else 0

    # ---- จำนวนสมาชิกแต่ละปีการศึกษา ----
    by_year = []
    for y in AcademicYear.query.order_by(AcademicYear.year).all():
        by_year.append({"id": y.id, "year": y.year, "count": Member.query.filter(in_year_clause(y.id)).count()})

    # ---- จำนวนตามตำแหน่ง (ปีที่เลือก) ----
    by_position = []
    if year:
        counts = dict(db.session.query(MemberPosition.position_id, func.count(MemberPosition.id))
                      .filter(MemberPosition.academic_year_id == year.id)
                      .group_by(MemberPosition.position_id).all())
        # สมาชิกในปีนี้ที่ยังไม่มีประวัติตำแหน่ง นับเป็นสมาชิกทั่วไป
        no_pos = Member.query.filter(Member.academic_year_id == year.id,
                                     ~Member.positions.any(MemberPosition.academic_year_id == year.id)).count()
        general = Position.general()
        if general and no_pos:
            counts[general.id] = counts.get(general.id, 0) + no_pos
        for p in Position.query.order_by(Position.level, Position.id).all():
            by_position.append({"id": p.id, "name": p.name, "color": p.color, "count": counts.get(p.id, 0),
                                "is_committee": p.is_committee})
    committee = sum(p["count"] for p in by_position if p["is_committee"])

    # ---- สถานะ / แผนก ----
    by_status = {k: 0 for k in STATUSES}
    for st, c in db.session.query(Member.status, func.count(Member.id)).group_by(Member.status):
        by_status[st] = c
    by_department = [{"name": n or "ไม่ระบุ", "count": c} for n, c in
                     db.session.query(Department.name, func.count(Member.id))
                     .select_from(Member).outerjoin(Department).group_by(Department.name)
                     .order_by(func.count(Member.id).desc()).all()]

    incomplete = Member.query.filter(or_(
        Member.photo_path.is_(None), Member.phone.is_(None), Member.student_id.is_(None),
        Member.department_id.is_(None), Member.biography.is_(None), Member.address.is_(None))).count()

    recent = [m.to_summary() for m in Member.query.order_by(Member.created_at.desc(), Member.id.desc()).limit(8)]

    return jsonify({
        "success": True,
        "year": year.to_dict() if year else None,
        "stats": {"total": total, "current_year": in_year, "committee": committee,
                  "pending": by_status["pending"], "incomplete": incomplete},
        "by_year": by_year,
        "by_position": by_position,
        "by_status": [{"status": k, "label": STATUSES[k], "count": v} for k, v in by_status.items()],
        "by_department": by_department,
        "recent": recent,
    })
