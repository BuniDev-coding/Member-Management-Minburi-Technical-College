"""การเลือกตั้ง (แบบ อวท.08 — รายงานผลการเลือกตั้งประธานชมรมวิชาชีพ)"""
from datetime import datetime

from . import db, BaseModel
from .lookup import _d

# ผู้ลงนามในแบบ อวท.08
SIGNER_FIELDS = ("reporter_name", "advisor_name", "activity_head_name", "deputy_name", "director_name")


class Election(BaseModel):
    __tablename__ = "elections"

    id = db.Column(db.Integer, primary_key=True)
    academic_year_id = db.Column(db.Integer, db.ForeignKey("academic_years.id", ondelete="RESTRICT"),
                                 nullable=False, index=True)
    position_id = db.Column(db.Integer, db.ForeignKey("positions.id", ondelete="RESTRICT"), nullable=False)
    department_id = db.Column(db.Integer, db.ForeignKey("departments.id", ondelete="SET NULL"))  # ชมรม (ถ้ามี)
    title = db.Column(db.String(200), nullable=False)
    election_date = db.Column(db.Date)
    eligible_voters = db.Column(db.Integer)          # ผู้มีสิทธิ์เลือกตั้ง
    spoiled_ballots = db.Column(db.Integer)          # บัตรเสีย
    no_vote = db.Column(db.Integer)                  # ไม่ประสงค์ลงคะแนน
    report_date = db.Column(db.Date)                 # วันที่ของหนังสือรายงาน
    # ผู้ลงนามตามแบบ อวท.08
    reporter_name = db.Column(db.String(150))        # ประธานชมรมวิชาชีพ (ผู้รายงาน)
    advisor_name = db.Column(db.String(150))         # ครูที่ปรึกษาชมรมวิชาชีพ
    activity_head_name = db.Column(db.String(150))   # หัวหน้างานกิจกรรมนักเรียน นักศึกษา
    deputy_name = db.Column(db.String(150))          # รองผู้อำนวยการฝ่ายพัฒนากิจการนักเรียน นักศึกษา
    director_name = db.Column(db.String(150))        # ผู้อำนวยการวิทยาลัย
    note = db.Column(db.Text)
    appointed_at = db.Column(db.DateTime)            # แต่งตั้งผู้ชนะเข้าตำแหน่งแล้วเมื่อ
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.now)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)

    academic_year = db.relationship("AcademicYear", lazy="joined")
    position = db.relationship("Position", lazy="joined")
    department = db.relationship("Department", lazy="joined")
    candidates = db.relationship("ElectionCandidate", back_populates="election", cascade="all, delete-orphan",
                                 passive_deletes=True, order_by="ElectionCandidate.candidate_no")

    def ranked(self):
        """เรียงตามคะแนน (มาก → น้อย) และคำนวณลำดับ — คะแนนเท่ากันได้ลำดับเดียวกัน"""
        rows = sorted(self.candidates, key=lambda c: (-(c.votes or 0), c.candidate_no or 0))
        out, rank, prev = [], 0, None
        for i, c in enumerate(rows, 1):
            if c.votes != prev:
                rank, prev = i, c.votes
            out.append((rank, c))
        return out

    def winner(self):
        """ผู้ชนะ (คืน None ถ้ายังไม่มีคะแนน หรือคะแนนสูงสุดเท่ากัน)"""
        r = self.ranked()
        if not r or not (r[0][1].votes or 0):
            return None
        if len(r) > 1 and r[1][0] == 1:
            return None
        return r[0][1]

    def to_dict(self, full=False):
        total_votes = sum(c.votes or 0 for c in self.candidates)
        w = self.winner()
        d = {
            "id": self.id,
            "academic_year_id": self.academic_year_id,
            "academic_year": self.academic_year.year if self.academic_year else None,
            "position_id": self.position_id,
            "position": self.position.name if self.position else None,
            "department_id": self.department_id,
            "department": self.department.name if self.department else None,
            "title": self.title,
            "election_date": _d(self.election_date),
            "candidate_count": len(self.candidates),
            "total_votes": total_votes,
            "winner": w.member.full_name if w and w.member else None,
            "winner_member_id": w.member_id if w else None,
            "appointed_at": self.appointed_at.isoformat() if self.appointed_at else None,
        }
        if full:
            d.update({
                "eligible_voters": self.eligible_voters,
                "spoiled_ballots": self.spoiled_ballots,
                "no_vote": self.no_vote,
                "report_date": _d(self.report_date),
                "reporter_name": self.reporter_name,
                "advisor_name": self.advisor_name,
                "activity_head_name": self.activity_head_name,
                "deputy_name": self.deputy_name,
                "director_name": self.director_name,
                "note": self.note,
                "candidates": [dict(c.to_dict(), rank=rank) for rank, c in self.ranked()],
            })
        return d


class ElectionCandidate(BaseModel):
    __tablename__ = "election_candidates"

    id = db.Column(db.Integer, primary_key=True)
    election_id = db.Column(db.Integer, db.ForeignKey("elections.id", ondelete="CASCADE"), nullable=False,
                            index=True)
    member_id = db.Column(db.Integer, db.ForeignKey("members.id", ondelete="RESTRICT"), nullable=False,
                          index=True)   # สมาชิกที่เป็นผู้สมัครลบไม่ได้ (รักษาผลการเลือกตั้งย้อนหลัง)
    candidate_no = db.Column(db.Integer, nullable=False)   # หมายเลขผู้สมัคร
    votes = db.Column(db.Integer, nullable=False, default=0)
    note = db.Column(db.String(255))

    election = db.relationship("Election", back_populates="candidates")
    member = db.relationship("Member", lazy="joined")

    __table_args__ = (
        db.UniqueConstraint("election_id", "member_id", name="uq_election_member"),
        db.UniqueConstraint("election_id", "candidate_no", name="uq_election_candidate_no"),
    )

    def to_dict(self):
        m = self.member
        return {
            "id": self.id,
            "member_id": self.member_id,
            "candidate_no": self.candidate_no,
            "votes": self.votes or 0,
            "note": self.note,
            "full_name": m.full_name if m else None,
            "student_id": m.student_id if m else None,
            "member_no": m.member_no if m else None,
            "education_level": m.education_level if m else None,
            "class_group": m.class_group if m else None,
            "department": m.department.name if m and m.department else None,
            "photo_path": m.photo_path if m else None,
        }
