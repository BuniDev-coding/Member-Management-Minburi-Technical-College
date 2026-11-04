# ER Diagram — ระบบบริหารจัดการสมาชิกองค์การนักวิชาชีพแห่งประเทศไทย วิทยาลัยเทคนิคมีนบุรี

```mermaid
erDiagram
    users ||--o{ members : "created_by"
    academic_years ||--o{ members : "ปีที่สมัคร"
    departments ||--o{ members : "แผนกวิชา"
    members ||--o{ member_positions : "ประวัติตำแหน่ง"
    positions ||--o{ member_positions : ""
    academic_years ||--o{ member_positions : "ปีที่ดำรงตำแหน่ง"
    members ||--o{ member_educations : "ประวัติการศึกษา"
    members ||--o{ member_activities : "ผลงาน/กิจกรรม/การทำงาน"
    members ||--o{ member_images : "รูปภาพประกอบ"
    provinces ||--o{ districts : "อำเภอ/เขต"
    districts ||--o{ subdistricts : "ตำบล/แขวง"
    provinces ||--o{ members : "จังหวัด"
    districts ||--o{ members : "อำเภอ/เขต"
    subdistricts ||--o{ members : "ตำบล/แขวง"

    users {
        int id PK
        varchar username UK
        varchar password_hash "bcrypt"
        varchar full_name
        varchar role "superadmin|admin|staff"
        text permissions
        bool is_active
        datetime last_login
    }
    academic_years {
        int id PK
        int year UK "พ.ศ."
        varchar name
        date start_date
        date end_date
        bool is_current
    }
    departments {
        int id PK
        varchar code UK
        varchar name UK
    }
    positions {
        int id PK
        varchar name UK
        int level
        bool is_executive
        bool is_committee
        varchar color
    }
    members {
        int id PK
        char member_no UK "10 หลัก"
        varchar student_id UK
        varchar prefix
        varchar first_name
        varchar last_name
        int academic_year_id FK
        int department_id FK
        varchar education_level
        varchar status "active|pending|inactive"
        varchar profile_template "card|biography|executive|portfolio"
        varchar photo_path
        varchar phone
        text biography
        text skills
        varchar house_no "บ้านเลขที่"
        varchar moo "หมู่ที่"
        varchar soi
        varchar road
        int province_id FK
        int district_id FK
        int subdistrict_id FK
        char postal_code "5 หลัก"
        text address "ประกอบอัตโนมัติ"
    }
    provinces {
        int id PK
        varchar name_th
        varchar name_en
    }
    districts {
        int id PK
        int province_id FK
        varchar name_th
        varchar prefix "อำเภอ|เขต"
    }
    subdistricts {
        int id PK
        int district_id FK
        varchar name_th
        varchar prefix "ตำบล|แขวง"
        char postal_code
    }
    member_positions {
        int id PK
        int member_id FK
        int position_id FK
        int academic_year_id FK
        date start_date
        date end_date
    }
    member_educations {
        int id PK
        int member_id FK
        varchar level
        varchar institution
        int graduated_year
        varchar gpa
    }
    member_activities {
        int id PK
        int member_id FK
        varchar category "activity|achievement|work"
        varchar title
        varchar role
        date activity_date
        varchar image_path
    }
    member_images {
        int id PK
        int member_id FK
        varchar image_path
        varchar caption
    }
```

## หลักการออกแบบ

| ประเด็น | การออกแบบ |
|---|---|
| เลขสมาชิก 10 หลัก ห้ามซ้ำ | `UNIQUE` + `CHECK(length=10, ตัวเลขล้วน)` ในฐานข้อมูล, ตรวจซ้ำใน Python และ JavaScript |
| ประวัติตำแหน่งหลายปี | ตาราง `member_positions` แยก, `UNIQUE(member_id, academic_year_id)` = ปีละ 1 ตำแหน่ง |
| ตำแหน่งปัจจุบันของสมาชิก | ระเบียน `member_positions` ของปีการศึกษาล่าสุด (ถ้าไม่มี = สมาชิกทั่วไป) |
| ลบสมาชิก | `ON DELETE CASCADE` ลบประวัติตำแหน่ง/การศึกษา/ผลงาน/รูปภาพตามไปด้วย |
| ลบปีการศึกษา / ตำแหน่งที่ถูกใช้งาน | `ON DELETE RESTRICT` ป้องกันข้อมูลกำพร้า |
| รูปภาพ | เก็บไฟล์ใน `backend/uploads/` และเก็บเฉพาะ path ในฐานข้อมูล (เข้าถึงได้เมื่อมี token เท่านั้น) |
| ย้ายฐานข้อมูล | ใช้ SQLAlchemy ทั้งหมด เปลี่ยนแค่ `DATABASE_URL` ใน `config.py` |
