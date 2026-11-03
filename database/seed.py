"""สร้างข้อมูลตัวอย่าง

    python database/seed.py            เพิ่มข้อมูลตัวอย่าง (ถ้ายังไม่มีสมาชิก)
    python database/seed.py --reset    ลบฐานข้อมูลเดิมแล้วสร้างใหม่ทั้งหมด

บัญชีเริ่มต้น:
    admin  / admin1234   (ผู้ดูแลระบบสูงสุด)
    staff  / staff1234   (เจ้าหน้าที่ — ดูและสืบค้นข้อมูล, รายงาน)
"""
import os
import random
import sys
from datetime import date, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "backend"))

from config import Config  # noqa: E402

if "--reset" in sys.argv and Config.SQLALCHEMY_DATABASE_URI.startswith("sqlite"):
    if os.path.exists(Config.SQLITE_PATH):
        os.remove(Config.SQLITE_PATH)
        print("ลบฐานข้อมูลเดิมแล้ว")

from app import create_app  # noqa: E402
from models import (db, User, AcademicYear, Department, Position, Member, MemberPosition,  # noqa: E402
                    MemberEducation, MemberActivity, ROLE_PERMISSIONS)
from seed_defaults import current_thai_academic_year  # noqa: E402

random.seed(90)

DEPARTMENTS = [
    ("AUTO", "ช่างยนต์"), ("POWER", "ช่างไฟฟ้ากำลัง"), ("ELEC", "ช่างอิเล็กทรอนิกส์"),
    ("MECH", "ช่างกลโรงงาน"), ("WELD", "ช่างเชื่อมโลหะ"), ("CONST", "ช่างก่อสร้าง"),
    ("ACC", "การบัญชี"), ("BC", "คอมพิวเตอร์ธุรกิจ"), ("IT", "เทคโนโลยีสารสนเทศ"), ("MKT", "การตลาด"),
]
MALE = ["ธนพล", "กิตติพัฒน์", "ณัฐวุฒิ", "ภานุวัฒน์", "ศุภกร", "อนุชา", "วรเมธ", "ชยพล", "ปิยะพงษ์", "ธีรภัทร",
        "พีรพัฒน์", "สิทธิชัย", "จิรายุ", "นพดล", "เกียรติศักดิ์", "อภิสิทธิ์", "ภูริ", "ทักษิณ", "รัชพล", "กฤษดา"]
FEMALE = ["ณัฐธิดา", "พิมพ์ชนก", "กมลชนก", "ศิริพร", "ปวีณา", "อรอุมา", "ธนพร", "สุภาวดี", "วริศรา", "ชนิดา",
          "จิราพร", "เบญจมาศ", "ปาริชาต", "รุ่งนภา", "สุนิสา"]
LAST = ["ใจดี", "ศรีสุข", "บุญมา", "ทองคำ", "แสงทอง", "วงศ์ใหญ่", "สมบูรณ์", "พึ่งบุญ", "รักษ์ไทย", "มั่นคง",
        "สุขสวัสดิ์", "เพชรรัตน์", "อินทร์แก้ว", "จันทร์เพ็ญ", "ประเสริฐศรี", "ศักดิ์สิทธิ์", "นาคสวัสดิ์", "พรหมมา",
        "กิจเจริญ", "ทรัพย์มาก", "เรืองศรี", "วิเศษสุวรรณ", "ชัยมงคล", "ปัญญาดี"]
NICK = ["บอส", "ต้น", "แบงค์", "ฟ้า", "มายด์", "ปอนด์", "เจมส์", "ไอซ์", "พลอย", "แพรว", "ภูมิ", "นิว", "เฟิร์น", "ออม"]
ACTIVITIES = [
    ("activity", "ค่ายพัฒนาผู้นำองค์การนักวิชาชีพแห่งประเทศไทย", "ผู้เข้าร่วม", "องค์การนักวิชาชีพแห่งประเทศไทย วิทยาลัยเทคนิคมีนบุรี"),
    ("activity", "กิจกรรมจิตอาสาพัฒนาชุมชนมีนบุรี", "ผู้ประสานงาน", "สำนักงานเขตมีนบุรี"),
    ("activity", "งานประชุมวิชาการองค์การนักวิชาชีพแห่งประเทศไทย ระดับหน่วย", "คณะทำงาน", "องค์การนักวิชาชีพแห่งประเทศไทย วิทยาลัยเทคนิคมีนบุรี"),
    ("achievement", "การแข่งขันทักษะวิชาชีพ ระดับภาค", "รางวัลเหรียญทอง", "องค์การนักวิชาชีพแห่งประเทศไทย ภาคกลาง"),
    ("achievement", "การประกวดสิ่งประดิษฐ์คนรุ่นใหม่", "รางวัลชมเชย", "สำนักงานคณะกรรมการการอาชีวศึกษา"),
    ("achievement", "นักเรียนนักศึกษารางวัลพระราชทาน ระดับสถานศึกษา", "ได้รับคัดเลือก", "วิทยาลัยเทคนิคมีนบุรี"),
    ("work", "ฝึกประสบการณ์วิชาชีพ", "นักศึกษาฝึกงาน", "บริษัท ไทยออโต้พาร์ท จำกัด"),
    ("work", "งานพาร์ทไทม์ช่วงปิดภาคเรียน", "พนักงานบริการ", "ห้างสรรพสินค้าในเขตมีนบุรี"),
]


def make_member(no, year, depts, created_by):
    male = random.random() < 0.65
    first = random.choice(MALE if male else FEMALE)
    last = random.choice(LAST)
    level = random.choice(["ปวช.1", "ปวช.2", "ปวช.3", "ปวส.1", "ปวส.2"])
    complete = random.random() < 0.8
    birth_y = year.year - 543 - random.randint(15, 20)
    m = Member(
        member_no=no,
        academic_year_id=year.id,
        department_id=random.choice(depts).id if complete or random.random() < .5 else None,
        education_level=level,
        class_group=f"{random.randint(1, 3)}",
        status=random.choices(["active", "pending", "inactive"], [80, 12, 8])[0],
        joined_date=date(year.year - 543, 5, 20) + timedelta(days=random.randint(0, 40)),
        student_id=f"{str(year.year)[2:]}{random.randint(10, 99)}{random.randint(10000, 99999)}" if complete else None,
        prefix="นาย" if male else "นางสาว",
        first_name=first, last_name=last, nickname=random.choice(NICK),
        gender="ชาย" if male else "หญิง",
        birth_date=date(birth_y, random.randint(1, 12), random.randint(1, 28)),
        nationality="ไทย", religion="พุทธ", blood_type=random.choice(["A", "B", "O", "AB"]),
        phone=f"0{random.choice([6, 8, 9])}{random.randint(10000000, 99999999)}" if complete or random.random() < .5 else None,
        email=f"student{no[-4:]}@mtc.ac.th",
        line_id=f"{NICK[0]}{no[-3:]}",
        address=f"{random.randint(1, 199)}/{random.randint(1, 99)} ถนนสีหบุรานุกิจ แขวงมีนบุรี เขตมีนบุรี กรุงเทพมหานคร 10510" if complete else None,
        parent_name=f"{'นาย' if random.random() < .5 else 'นาง'}{random.choice(MALE + FEMALE)} {last}",
        parent_phone=f"08{random.randint(10000000, 99999999)}",
        biography=(f"{first} เป็นนักศึกษาระดับชั้น {level} มีความสนใจด้านวิชาชีพและกิจกรรมองค์การ "
                   f"เป็นคนมีความรับผิดชอบ ทำงานร่วมกับผู้อื่นได้ดี และมุ่งมั่นพัฒนาตนเองอย่างสม่ำเสมอ") if complete else None,
        skills=random.choice(["การพูดในที่สาธารณะ, ดนตรีไทย", "ฟุตบอล, การซ่อมบำรุงเครื่องยนต์",
                              "ออกแบบกราฟิก, ตัดต่อวิดีโอ", "เขียนโปรแกรม, หุ่นยนต์", "พิธีกร, ภาษาอังกฤษ"]),
        created_by=created_by,
    )
    m.educations.append(MemberEducation(level="มัธยมศึกษาตอนต้น (ม.3)", institution="โรงเรียนมีนบุรี",
                                        graduated_year=year.year - (1 if level.startswith("ปวช") else 3),
                                        gpa=f"{random.uniform(2.5, 3.9):.2f}", sort_order=0))
    if level.startswith("ปวส"):
        m.educations.append(MemberEducation(level="ปวช.", institution="วิทยาลัยเทคนิคมีนบุรี",
                                            major=m.department.name if m.department else None,
                                            graduated_year=year.year - 1, gpa=f"{random.uniform(2.5, 3.9):.2f}",
                                            sort_order=1))
    for i, (cat, title, role, org) in enumerate(random.sample(ACTIVITIES, random.randint(0, 4))):
        m.activities.append(MemberActivity(category=cat, title=title, role=role, organization=org, sort_order=i,
                                           activity_date=date(year.year - 543, random.randint(6, 12), random.randint(1, 28)),
                                           description="ได้รับประสบการณ์และพัฒนาทักษะการทำงานเป็นทีม"))
    return m


def main():
    app = create_app()
    with app.app_context():
        db.create_all()
        if not User.query.filter_by(username="staff").first():
            s = User(username="staff", full_name="เจ้าหน้าที่ฝ่ายกิจกรรม", role="staff")
            s.set_password("staff1234")
            s.set_permissions(ROLE_PERMISSIONS["staff"])
            db.session.add(s)
        admin = User.query.filter_by(username="admin").first()

        if Member.query.count():
            db.session.commit()
            print("มีข้อมูลสมาชิกอยู่แล้ว — ข้าม (ใช้ --reset เพื่อสร้างใหม่)")
            return

        for code, name in DEPARTMENTS:
            if not Department.query.filter_by(name=name).first():
                db.session.add(Department(code=code, name=name))

        cur = current_thai_academic_year()
        years = []
        for y in (cur - 2, cur - 1, cur):
            ay = AcademicYear.query.filter_by(year=y).first() or AcademicYear(year=y)
            ay.name, ay.is_current = f"ปีการศึกษา {y}", (y == cur)
            ay.start_date, ay.end_date = date(y - 543, 5, 16), date(y - 542, 3, 31)
            db.session.add(ay)
            years.append(ay)
        db.session.flush()

        depts = Department.query.all()
        pos = {p.name: p for p in Position.query.all()}
        count = {2: 14, 1: 18, 0: 26}   # จำนวนสมาชิกใหม่แต่ละปี (ย้อนหลัง 2, 1, ปีปัจจุบัน)
        all_members = []
        for idx, ay in enumerate(years):
            for n in range(1, count[2 - idx] + 1):
                m = make_member(f"{ay.year}{n:06d}", ay, depts, admin.id if admin else None)
                db.session.add(m)
                all_members.append(m)
        db.session.flush()

        # ---- ประวัติตำแหน่ง: ทุกคนเริ่มเป็นสมาชิกทั่วไปในปีที่สมัคร และอยู่ต่อในปีถัดไป ----
        for m in all_members:
            start = next(i for i, y in enumerate(years) if y.id == m.academic_year_id)
            for y in years[start:]:
                if m.status == "inactive" and y.year == cur and start < 2:
                    continue
                db.session.add(MemberPosition(member_id=m.id, academic_year_id=y.id, position_id=pos["สมาชิกทั่วไป"].id,
                                              start_date=y.start_date, end_date=y.end_date))
        db.session.flush()

        # ---- คณะกรรมการแต่ละปี: ประธาน 1, รองประธาน 2, กรรมการ 6 ----
        for y in years:
            cands = [mp for mp in MemberPosition.query.filter_by(academic_year_id=y.id).all()
                     if mp.member.status == "active"]
            random.shuffle(cands)
            plan = ["ประธาน"] + ["รองประธาน"] * 2 + ["กรรมการ"] * 6
            for mp, pname in zip(cands, plan):
                mp.position_id = pos[pname].id
                if pname in ("ประธาน", "รองประธาน"):
                    mp.member.profile_template = "executive"
                    mp.member.vision = "มุ่งมั่นพัฒนาองค์การให้เป็นศูนย์รวมของนักวิชาชีพที่มีคุณภาพ คุณธรรม และจิตอาสา"
                elif random.random() < .5:
                    mp.member.profile_template = random.choice(["biography", "portfolio"])
        db.session.commit()
        print(f"สร้างข้อมูลตัวอย่างเรียบร้อย: สมาชิก {Member.query.count()} คน, "
              f"ประวัติตำแหน่ง {MemberPosition.query.count()} รายการ, ปีการศึกษา {[y.year for y in years]}")
        print("บัญชีเข้าสู่ระบบ: admin / admin1234  และ  staff / staff1234")


if __name__ == "__main__":
    main()
