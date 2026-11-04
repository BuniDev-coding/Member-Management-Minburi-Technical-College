# ระบบบริหารจัดการสมาชิก องค์การนักวิชาชีพแห่งประเทศไทย วิทยาลัยเทคนิคมีนบุรี

ระบบ Admin สำหรับเจ้าหน้าที่เท่านั้น ไม่มีหน้าเว็บสาธารณะ ข้อมูลและรูปภาพสมาชิกเปิดดูได้ผ่านระบบหลัง Login เท่านั้น
(แม้แต่ไฟล์รูปภาพก็ต้องมี token จึงจะเปิดได้)

| ส่วน | เทคโนโลยี |
|---|---|
| Frontend | HTML, CSS, Vanilla JavaScript (`fetch()`), Chart.js |
| Backend | Python Flask (REST API), JWT, bcrypt |
| Database | SQLite (`database/app.db`) ผ่าน Flask-SQLAlchemy ย้ายไป PostgreSQL/MySQL ได้ |
| รายงาน | openpyxl (Excel), reportlab + ฟอนต์ Sarabun (PDF ภาษาไทย) |

---

## 1. การติดตั้ง

ต้องมี **Python 3.10 ขึ้นไป**

```bash
cd managemember

# สร้าง virtual environment
python -m venv backend/.venv

# เปิดใช้งาน venv
backend\.venv\Scripts\activate          # Windows
source backend/.venv/bin/activate       # macOS / Linux

# ติดตั้งแพ็กเกจ
pip install -r backend/requirements.txt
```

ฐานข้อมูลจะถูกสร้างอัตโนมัติเมื่อรันระบบครั้งแรก (พร้อมข้อมูลจังหวัด/อำเภอ/ตำบล/รหัสไปรษณีย์ทั้งประเทศ และบัญชี `admin`)

## 2. การรันระบบ

```bash
cd backend
python app.py
```

เปิดเบราว์เซอร์ที่ **http://127.0.0.1:5000**

บน Windows ดับเบิลคลิก `run.bat` ได้เลย (สคริปต์จะสร้าง venv, ติดตั้งแพ็กเกจ, และเปิดเซิร์ฟเวอร์ให้)

### บัญชีเริ่มต้น

| ชื่อผู้ใช้ | รหัสผ่าน | บทบาท |
|---|---|---|
| `admin` | `admin1234` | ผู้ดูแลระบบสูงสุด (ทุกสิทธิ์) |

> ⚠️ **เปลี่ยนรหัสผ่านทันทีหลังติดตั้ง** (เมนูโปรไฟล์มุมขวาบน → เปลี่ยนรหัสผ่าน) (ไฟล์ `.env` สุ่ม `SECRET_KEY` ให้แล้วตอนรันครั้งแรก)

### คำสั่งที่ใช้บ่อย

| คำสั่ง | ผล |
|---|---|
| `sqlite3 database/app.db < database/schema.sql` | สร้างฐานข้อมูลเปล่าจาก SQL (ไม่บังคับ ระบบสร้างตารางเองเมื่อรันครั้งแรก) |

### ไฟล์ตั้งค่า `.env`

ค่าตั้งค่าทั้งหมดอยู่ในไฟล์ **`.env`** ที่โฟลเดอร์หลักของโปรเจกต์
- รันครั้งแรกถ้ายังไม่มีไฟล์ ระบบจะสร้างจาก [.env.example](.env.example) ให้อัตโนมัติ และ**สุ่ม `SECRET_KEY` ให้**
- แก้ค่าแล้วต้องรีสตาร์ตเซิร์ฟเวอร์
- **ห้ามนำ `.env` ขึ้น Git หรือส่งต่อ** (อยู่ใน `.gitignore` แล้ว) ให้ใช้ `.env.example` เป็นแม่แบบแทน

| ตัวแปร | ค่าเริ่มต้น | ความหมาย |
|---|---|---|
| `SECRET_KEY` | (สุ่มให้ตอนสร้างไฟล์) | กุญแจเซ็น token — ถ้าเปลี่ยน ผู้ใช้ทุกคนต้อง login ใหม่ |
| `JWT_EXPIRES_HOURS` | `8` | อายุการเข้าสู่ระบบ (ชั่วโมง) |
| `DATABASE_URL` | `sqlite:///database/app.db` | ที่อยู่ฐานข้อมูล (path สัมพัทธ์นับจากโฟลเดอร์หลัก) |
| `HOST` / `PORT` | `127.0.0.1` / `5000` | ที่อยู่เซิร์ฟเวอร์ (ให้เครื่องอื่นใน LAN เข้าได้ใช้ `HOST=0.0.0.0`) |
| `FLASK_DEBUG` | `0` | `1` = โหมดพัฒนา, `0` = ใช้งานจริง |
| `CORS_ORIGINS` | `*` | โดเมนที่เรียก API ได้ กรณีเปิด frontend แยกพอร์ต (คั่นด้วย `,`) |
| `UPLOAD_FOLDER` / `BACKUP_FOLDER` | `backend/uploads` / `database/backups` | โฟลเดอร์รูปภาพ / ไฟล์สำรอง |
| `MAX_UPLOAD_MB` / `MAX_REQUEST_MB` | `5` / `20` | ขนาดรูปสูงสุดต่อไฟล์ / ขนาดรวมต่อการบันทึก 1 ครั้ง |
| `ORG_NAME` | ชื่อองค์การ | ชื่อหัวรายงาน Excel/PDF |

ค่าที่ตั้งเป็น environment variable ของระบบปฏิบัติการ (เช่นบนเซิร์ฟเวอร์จริง) จะมีผลเหนือค่าในไฟล์ `.env`

### ย้ายไป PostgreSQL / MySQL

แก้ `DATABASE_URL` ในไฟล์ `.env` แล้วติดตั้งไดรเวอร์:

```bash
pip install psycopg2-binary   # postgresql+psycopg2://user:pass@localhost:5432/managemember
pip install PyMySQL           # mysql+pymysql://user:pass@localhost:3306/managemember?charset=utf8mb4
```

โค้ดทั้งหมดใช้ SQLAlchemy จึงไม่ต้องแก้ส่วนอื่น (ปุ่มสำรองข้อมูลในระบบรองรับเฉพาะ SQLite ฐานข้อมูลอื่นให้ใช้ `pg_dump` / `mysqldump`)

### ใช้งานจริง (Production)

```bash
pip install waitress
cd backend
waitress-serve --host=0.0.0.0 --port=5000 app:app
```

ก่อนใช้งานจริงตรวจในไฟล์ `.env` ว่า `FLASK_DEBUG=0` และ `SECRET_KEY` เป็นค่าสุ่มยาว ๆ

---

## 3. โครงสร้างโปรเจกต์

```
managemember/
├─ frontend/
│  ├─ index.html            หน้า Login
│  ├─ dashboard.html        Dashboard (สถิติ กราฟ ตารางสมาชิก การ์ดสรุปตำแหน่ง)
│  ├─ members.html          จัดการสมาชิก (ตาราง เรียง/กรอง ลบหลายรายการ ตรวจสอบ)
│  ├─ member-form.html      รับสมาชิก / แก้ไขสมาชิก
│  ├─ search.html           สืบค้นข้อมูลสมาชิก
│  ├─ member-view.html      ดูประวัติสมาชิกตามรูปแบบที่เลือก
│  ├─ positions.html        จัดการตำแหน่ง + แผนกวิชา
│  ├─ years.html            จัดการปีการศึกษา + ดูสมาชิกแยกตามปี
│  ├─ reports.html          รายงาน + ส่งออก Excel / PDF
│  ├─ users.html            จัดการผู้ใช้งาน สิทธิ์ และสำรองข้อมูล
│  ├─ css/  style.css, profile-templates.css
│  └─ js/   api.js, auth.js, layout.js, member-table.js และไฟล์ JS แยกตามหน้า
├─ backend/
│  ├─ app.py                สร้าง Flask app, ลงทะเบียน API, เสิร์ฟ frontend
│  ├─ config.py             อ่านค่าตั้งค่าจากไฟล์ .env
│  ├─ seed_defaults.py      ข้อมูลพื้นฐานที่สร้างอัตโนมัติ (ตำแหน่ง, ปีปัจจุบัน, admin)
│  ├─ models/               SQLAlchemy models
│  ├─ routes/               REST API แยกตามโมดูล
│  ├─ utils/                JWT/สิทธิ์, ตรวจสอบข้อมูล, ไฟล์, ฟอนต์ไทย
│  ├─ fonts/                Sarabun (สำหรับ PDF)
│  ├─ uploads/              รูปภาพที่อัปโหลด (เก็บ path ในฐานข้อมูล)
│  └─ requirements.txt
├─ database/
│  ├─ schema.sql            SQL Schema (SQLite)
│  ├─ app.db                สร้างอัตโนมัติเมื่อรันครั้งแรก
│  └─ backups/              ไฟล์สำรอง app_YYYYMMDD_HHMMSS.db
├─ docs/ER-diagram.md       ER Diagram และหลักการออกแบบ
├─ .env                     ไฟล์ตั้งค่า (สร้างอัตโนมัติ — ห้ามขึ้น Git)
└─ .env.example             แม่แบบไฟล์ตั้งค่า
```

---

## 4. Database Schema

ดู ER Diagram ฉบับเต็มที่ [docs/ER-diagram.md](docs/ER-diagram.md) และ SQL ที่ [database/schema.sql](database/schema.sql)

| ตาราง | เก็บข้อมูล |
|---|---|
| `users` | บัญชี Admin, รหัสผ่าน bcrypt, บทบาท, สิทธิ์ |
| `academic_years` | ปีการศึกษา (พ.ศ.), ปีปัจจุบัน |
| `departments` | แผนกวิชา |
| `positions` | ประธาน / รองประธาน / กรรมการ / สมาชิกทั่วไป (+ ผู้บริหาร / กรรมการ / สี) |
| `members` | ข้อมูลส่วนตัว ติดต่อ ข้อมูลสมาชิก ประวัติ และรูปแบบการแสดงผล |
| `member_positions` | ประวัติการดำรงตำแหน่ง — 1 คนมีได้หลายปี (ปีละ 1 ตำแหน่ง) |
| `member_educations` | ประวัติการศึกษา |
| `member_activities` | ผลงาน/รางวัล, กิจกรรม, ประวัติการทำงาน |
| `member_images` | รูปภาพประกอบ |

**กติกาสำคัญ**
- เลขสมาชิก 10 หลัก ห้ามซ้ำ — ตรวจ 3 ชั้น: JavaScript (รูปแบบ + ถามเซิร์ฟเวอร์แบบทันที), Python, และฐานข้อมูล (`UNIQUE` + `CHECK`)
- เปิด `PRAGMA foreign_keys = ON` ทุกครั้งที่เชื่อมต่อ SQLite
- ลบสมาชิก → ลบประวัติตำแหน่ง/การศึกษา/ผลงาน/รูปตามไปด้วย (CASCADE) และลบไฟล์รูปออกจาก `uploads/`
- ลบตำแหน่ง/ปีการศึกษา/แผนกที่ยังถูกใช้งานไม่ได้

---

## 5. REST API

ทุก endpoint (ยกเว้น login) ต้องส่ง header `Authorization: Bearer <token>`
ตอบกลับเป็น JSON รูปแบบ `{ "success": true, ... }` หรือ `{ "success": false, "message": "...", "errors": {...} }`

### Auth
| Method | Path | คำอธิบาย |
|---|---|---|
| POST | `/api/auth/login` | `{username, password}` → `{token, user}` |
| GET | `/api/auth/me` | ข้อมูลผู้ใช้และสิทธิ์ปัจจุบัน |
| POST | `/api/auth/change-password` | `{old_password, new_password}` |

### Dashboard / ข้อมูลประกอบ
| Method | Path | คำอธิบาย |
|---|---|---|
| GET | `/api/dashboard?year_id=` | สถิติรวม, จำนวนต่อปี, ต่อตำแหน่ง, ต่อสถานะ/แผนก, ข้อมูลไม่ครบ |
| GET | `/api/meta` | ปีการศึกษา ตำแหน่ง แผนก สถานะ ระดับชั้น รูปแบบการแสดงผล |

### สมาชิก (สิทธิ์ `members.view` / `members.edit` / `members.delete`)
| Method | Path | คำอธิบาย |
|---|---|---|
| GET | `/api/members` | รายการ/สืบค้น: `q, name, member_no, year_id, position_id, department_id, status, level, incomplete, sort, order, page, per_page` |
| GET | `/api/members/<id>` | ข้อมูลและประวัติเต็ม |
| POST | `/api/members` | เพิ่มสมาชิก — `multipart/form-data`: `data` (JSON), `photo` (ไฟล์), `gallery` (หลายไฟล์) |
| PUT | `/api/members/<id>` | แก้ไขสมาชิก (รูปแบบเดียวกับ POST) |
| DELETE | `/api/members/<id>` | ลบสมาชิก |
| POST | `/api/members/bulk` | `{ids, action: "delete" \| "status", status}` |
| PATCH | `/api/members/<id>/status` | เปลี่ยนสถานะ/ตรวจสอบ `{status}` |
| PATCH | `/api/members/<id>/template` | เลือกรูปแบบการแสดงประวัติ `{profile_template}` |
| GET | `/api/members/check-number?member_no=&exclude_id=` | ตรวจเลขสมาชิกซ้ำ |
| GET | `/api/members/next-number?year=` | เลขสมาชิกถัดไป (ปี พ.ศ. + ลำดับ 6 หลัก) |
| POST | `/api/members/<id>/images` | เพิ่มรูปภาพประกอบ (`images`) |
| DELETE | `/api/members/<id>/images/<image_id>` | ลบรูปภาพประกอบ |

ตัวอย่าง `data` สำหรับเพิ่มสมาชิก:
```json
{
  "member_no": "2569000027", "prefix": "นาย", "first_name": "ธนพล", "last_name": "ใจดี",
  "academic_year_id": 1, "department_id": 3, "education_level": "ปวช.2", "status": "pending",
  "profile_template": "biography",
  "positions":  [{"academic_year_id": 1, "position_id": 3, "start_date": "2026-05-16"}],
  "educations": [{"level": "ม.3", "institution": "โรงเรียนมีนบุรี", "graduated_year": 2568}],
  "activities": [{"category": "achievement", "title": "แข่งขันทักษะวิชาชีพ", "role": "เหรียญทอง"}]
}
```

### ตั้งค่า (แก้ไขต้องมีสิทธิ์ `settings`)
| Method | Path | คำอธิบาย |
|---|---|---|
| GET / POST | `/api/positions` | รายการ (พร้อมจำนวนในปี `?year_id=`) / เพิ่ม |
| PUT / DELETE | `/api/positions/<id>` | แก้ไข / ลบ |
| GET / POST | `/api/years` | รายการ (พร้อมจำนวนสมาชิก) / เพิ่ม |
| PUT / DELETE | `/api/years/<id>` | แก้ไข / ลบ |
| POST | `/api/years/<id>/set-current` | ตั้งเป็นปีการศึกษาปัจจุบัน |
| GET / POST | `/api/departments` | รายการ / เพิ่ม |
| PUT / DELETE | `/api/departments/<id>` | แก้ไข / ลบ |

### รายงาน (สิทธิ์ `reports`)
| Method | Path | คำอธิบาย |
|---|---|---|
| GET | `/api/reports/members?year_id=&position_id=&department_id=&status=&format=json\|xlsx\|pdf` | รายงานรายชื่อ / ส่งออกไฟล์ |
| GET | `/api/reports/summary?year_id=` | ตารางสรุป ตำแหน่ง × แผนกวิชา |

### ผู้ใช้งาน (สิทธิ์ `users`) และสำรองข้อมูล (สิทธิ์ `backup`)
| Method | Path | คำอธิบาย |
|---|---|---|
| GET / POST | `/api/users` | รายการ / เพิ่มผู้ใช้ |
| PUT / DELETE | `/api/users/<id>` | แก้ไข (ส่ง `password` เพื่อรีเซ็ต) / ลบ |
| GET | `/api/users/permissions` | รายการสิทธิ์และสิทธิ์เริ่มต้นตามบทบาท |
| GET / POST | `/api/backups` | รายการไฟล์สำรอง / สำรอง `app.db` ตอนนี้ |
| GET / DELETE | `/api/backups/<name>` | ดาวน์โหลด / ลบไฟล์สำรอง |
| GET | `/api/files/<path>?token=` | เปิดรูปภาพที่อัปโหลด (ต้องมี token) |

### สิทธิ์การเข้าถึง

| สิทธิ์ | superadmin | admin | staff |
|---|:-:|:-:|:-:|
| `members.view` ดู/สืบค้น | ✓ | ✓ | ✓ |
| `members.edit` เพิ่ม/แก้ไข | ✓ | ✓ | |
| `members.delete` ลบ | ✓ | ✓ | |
| `settings` ตำแหน่ง/ปี/แผนก | ✓ | ✓ | |
| `reports` รายงาน | ✓ | ✓ | ✓ |
| `backup` สำรองข้อมูล | ✓ | ✓ | |
| `users` จัดการผู้ใช้ | ✓ | | |

สิทธิ์ข้างต้นเป็นค่าเริ่มต้น ปรับรายบุคคลได้ในหน้า "ผู้ใช้งาน"

---

## 6. รูปแบบการแสดงประวัติสมาชิก

เลือกได้ในฟอร์มสมาชิก หรือในหน้าดูประวัติ (ปุ่ม "ใช้รูปแบบนี้เป็นค่าหลัก") — CSS แยกแต่ละแบบใน [frontend/css/profile-templates.css](frontend/css/profile-templates.css)

| รูปแบบ | เนื้อหา |
|---|---|
| **Profile Card** | รูปภาพ ชื่อ ตำแหน่ง เลขสมาชิก แผนก ช่องทางติดต่อ |
| **Biography** | รูปภาพขนาดใหญ่ + ประวัติส่วนตัว ข้อมูลบุคคล ไทม์ไลน์การศึกษา |
| **Executive Profile** | สำหรับประธาน/รองประธาน: แบนเนอร์ วิสัยทัศน์ ประวัติตำแหน่ง ผลงาน กิจกรรม |
| **Portfolio** | ประวัติ ความสามารถ การ์ดผลงาน/กิจกรรม (กรองตามประเภท) และแกลเลอรีรูปภาพ |

---

## 7. หมายเหตุ

- **ฟอร์มปี 90**: ฟิลด์ข้อมูลสมาชิกออกแบบตามแบบฟอร์มใบสมัครสมาชิกทั่วไปขององค์การนักวิชาชีพแห่งประเทศไทย (ข้อมูลส่วนตัว ติดต่อ ผู้ปกครอง การศึกษา) หากแบบฟอร์มจริงมีช่องเพิ่มเติม เพิ่มคอลัมน์ใน `backend/models/member.py`, `SIMPLE_FIELDS` ใน `backend/routes/members.py` และช่องกรอกใน `frontend/js/member-form.js`
- เปิดหน้าเว็บผ่าน Flask (พอร์ต 5000) เพื่อใช้ origin เดียวกัน หากเปิดผ่าน VS Code Live Server (พอร์ต 5500) ระบบจะเรียก API ที่ `http://127.0.0.1:5000` ให้อัตโนมัติ
- Chart.js และฟอนต์ Google โหลดจาก CDN ถ้าเครื่องออฟไลน์ Dashboard จะแสดงเป็นตารางแทนกราฟ
- PDF ใช้ฟอนต์ใน `backend/fonts/` (Sarabun) ถ้าไม่มีจะใช้ฟอนต์ไทยของระบบ (Leelawadee/Tahoma บน Windows, Noto Sans Thai/Loma บน Linux)
# Member-Management-Minburi-Technical-College
