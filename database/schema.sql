-- =====================================================================
--  ระบบบริหารจัดการสมาชิกองค์การนักวิชาชีพในอนาคตแห่งประเทศไทย
--  วิทยาลัยเทคนิคมีนบุรี  —  Database Schema (SQLite)
--  (Membership Management System for the Association of Future Thai Professionals, Minburi Technical College)
--
--  หมายเหตุ:
--   * ระบบสร้างตารางอัตโนมัติจาก SQLAlchemy models (backend/models) เมื่อรันครั้งแรก
--     ไฟล์นี้ใช้เป็นเอกสารอ้างอิง หรือสร้างฐานข้อมูลด้วยมือ:
--         sqlite3 database/app.db < database/schema.sql
--   * ต้องเปิด Foreign Key ทุกครั้งที่เชื่อมต่อ (ระบบทำให้อัตโนมัติ)
-- =====================================================================
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- 1) ผู้ใช้งานระบบ (Admin / เจ้าหน้าที่)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    username        VARCHAR(50)  NOT NULL UNIQUE,
    password_hash   VARCHAR(128) NOT NULL,              -- bcrypt hash
    full_name       VARCHAR(120) NOT NULL,
    email           VARCHAR(120),
    role            VARCHAR(20)  NOT NULL DEFAULT 'staff'
                    CHECK (role IN ('superadmin','admin','staff')),
    permissions     TEXT         NOT NULL DEFAULT '',   -- คั่นด้วย , เช่น members.view,reports
    is_active       BOOLEAN      NOT NULL DEFAULT 1,
    last_login      DATETIME,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 2) ปีการศึกษา
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS academic_years (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    year            INTEGER      NOT NULL UNIQUE,       -- พ.ศ. เช่น 2569
    name            VARCHAR(100),                       -- เช่น "ปีการศึกษา 2569"
    start_date      DATE,
    end_date        DATE,
    is_current      BOOLEAN      NOT NULL DEFAULT 0,
    note            TEXT,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 3) แผนกวิชา
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    code            VARCHAR(20)  UNIQUE,
    name            VARCHAR(120) NOT NULL UNIQUE,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 4) ตำแหน่ง (ประธาน / รองประธาน / กรรมการ / สมาชิกทั่วไป)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS positions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            VARCHAR(100) NOT NULL UNIQUE,
    level           INTEGER      NOT NULL DEFAULT 99,   -- ลำดับความสำคัญ (น้อย = สูง)
    is_executive    BOOLEAN      NOT NULL DEFAULT 0,    -- ผู้บริหาร (ใช้กับ Executive Profile)
    is_committee    BOOLEAN      NOT NULL DEFAULT 0,    -- นับเป็นคณะกรรมการ
    color           VARCHAR(20)  DEFAULT '#1F4FB5',
    description     TEXT,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 4.0) ตัวเลือกดรอปดาวน์ของแบบฟอร์มสมัคร (แก้ไขได้ที่หน้า "ตั้งค่าข้อมูลการสมัคร")
--      category: prefix / gender / blood_type / education_level / member_type
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS form_options (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    category        VARCHAR(30)  NOT NULL,
    name            VARCHAR(100) NOT NULL,
    sort_order      INTEGER      NOT NULL DEFAULT 0,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_form_options_category_name UNIQUE (category, name)
);
CREATE INDEX IF NOT EXISTS ix_form_options_category ON form_options(category);

-- ---------------------------------------------------------------------
-- 4.1) ข้อมูลที่อยู่ประเทศไทย (นำเข้าอัตโนมัติจาก backend/data/thai_address.json)
--      77 จังหวัด / 930 อำเภอ-เขต / 7,436 ตำบล-แขวง พร้อมรหัสไปรษณีย์
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS provinces (
    id              INTEGER PRIMARY KEY,                -- รหัสจังหวัด
    name_th         VARCHAR(100) NOT NULL,
    name_en         VARCHAR(100)
);
CREATE TABLE IF NOT EXISTS districts (
    id              INTEGER PRIMARY KEY,                -- รหัสอำเภอ/เขต
    province_id     INTEGER      NOT NULL REFERENCES provinces(id) ON DELETE CASCADE,
    name_th         VARCHAR(100) NOT NULL,
    name_en         VARCHAR(100),
    prefix          VARCHAR(20)                         -- อำเภอ / เขต
);
CREATE INDEX IF NOT EXISTS ix_districts_province ON districts(province_id);
CREATE TABLE IF NOT EXISTS subdistricts (
    id              INTEGER PRIMARY KEY,                -- รหัสตำบล/แขวง
    district_id     INTEGER      NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
    name_th         VARCHAR(100) NOT NULL,
    name_en         VARCHAR(100),
    prefix          VARCHAR(20),                        -- ตำบล / แขวง
    postal_code     CHAR(5)      NOT NULL               -- รหัสไปรษณีย์
);
CREATE INDEX IF NOT EXISTS ix_subdistricts_district ON subdistricts(district_id);
CREATE INDEX IF NOT EXISTS ix_subdistricts_postal   ON subdistricts(postal_code);

-- ---------------------------------------------------------------------
-- 5) สมาชิก  (อ้างอิงฟอร์มใบสมัครสมาชิกองค์การนักวิชาชีพในอนาคตแห่งประเทศไทย)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS members (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    -- ข้อมูลสมาชิก
    member_no           CHAR(10)     NOT NULL UNIQUE
                        CHECK (length(member_no) = 10 AND member_no NOT GLOB '*[^0-9]*'),
    academic_year_id    INTEGER      NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
    department_id       INTEGER      REFERENCES departments(id) ON DELETE SET NULL,
    education_level     VARCHAR(20),                    -- ปวช.1 ... ปวส.2
    class_group         VARCHAR(20),                    -- กลุ่ม/ห้อง
    status              VARCHAR(20)  NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('active','pending','inactive')),
    joined_date         DATE,
    profile_template    VARCHAR(20)  NOT NULL DEFAULT 'card'
                        CHECK (profile_template IN ('card','biography','executive','portfolio')),
    -- ข้อมูลส่วนตัว
    student_id          VARCHAR(20)  UNIQUE,            -- เลขประจำตัวนักเรียน/นักศึกษา
    prefix              VARCHAR(20),                    -- นาย / นางสาว / ...
    first_name          VARCHAR(100) NOT NULL,
    last_name           VARCHAR(100) NOT NULL,
    first_name_en       VARCHAR(100),
    last_name_en        VARCHAR(100),
    nickname            VARCHAR(50),
    gender              VARCHAR(10),
    birth_date          DATE,
    national_id         VARCHAR(13),
    nationality         VARCHAR(50)  DEFAULT 'ไทย',
    religion            VARCHAR(50),
    blood_type          VARCHAR(5),
    photo_path          VARCHAR(255),                   -- path ในโฟลเดอร์ uploads/
    -- ข้อมูลติดต่อ
    phone               VARCHAR(20),
    email               VARCHAR(120),
    line_id             VARCHAR(50),
    facebook            VARCHAR(120),
    address             TEXT,                           -- ที่อยู่เต็ม (ระบบประกอบจากช่องด้านล่าง)
    house_no            VARCHAR(50),                    -- บ้านเลขที่
    moo                 VARCHAR(10),                    -- หมู่ที่
    village             VARCHAR(120),                   -- หมู่บ้าน / อาคาร
    soi                 VARCHAR(100),                   -- ซอย
    road                VARCHAR(100),                   -- ถนน
    province_id         INTEGER      REFERENCES provinces(id)    ON DELETE SET NULL,
    district_id         INTEGER      REFERENCES districts(id)    ON DELETE SET NULL,
    subdistrict_id      INTEGER      REFERENCES subdistricts(id) ON DELETE SET NULL,
    postal_code         CHAR(5),                        -- รหัสไปรษณีย์
    father_name         VARCHAR(150),                   -- ชื่อบิดา (อวท.10)
    mother_name         VARCHAR(150),                   -- ชื่อมารดา (อวท.10)
    member_type         VARCHAR(30),                    -- ระดับสมาชิก: สามัญ ระดับสถานศึกษา/จังหวัด/ภาค/ชาติ, วิสามัญ
    registration_no     VARCHAR(30),                    -- ทะเบียนเลขที่ เช่น 69/6921010001 (แยกจาก member_no)
    registrar_name      VARCHAR(150),                   -- นายทะเบียนผู้รับสมัคร
    registered_date     DATE,                           -- วันที่ลงทะเบียน
    leave_reason        VARCHAR(255),                   -- พ้นสภาพสมาชิกด้วยเหตุ (อวท.10)
    left_date           DATE,                           -- วันที่พ้นสภาพ
    parent_name         VARCHAR(150),
    parent_phone        VARCHAR(20),
    -- ประวัติบุคคล
    biography           TEXT,                           -- ประวัติส่วนตัว
    skills              TEXT,                           -- ความสามารถพิเศษ
    vision              TEXT,                           -- วิสัยทัศน์/คติประจำใจ (Executive)
    note                TEXT,
    created_by          INTEGER      REFERENCES users(id) ON DELETE SET NULL,
    created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_members_name   ON members(first_name, last_name);
CREATE INDEX IF NOT EXISTS ix_members_year   ON members(academic_year_id);
CREATE INDEX IF NOT EXISTS ix_members_status ON members(status);
CREATE INDEX IF NOT EXISTS ix_members_registration_no ON members(registration_no);

-- ---------------------------------------------------------------------
-- 6) ประวัติการดำรงตำแหน่ง (1 สมาชิก : หลายปี)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS member_positions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id           INTEGER NOT NULL REFERENCES members(id)        ON DELETE CASCADE,
    position_id         INTEGER NOT NULL REFERENCES positions(id)      ON DELETE RESTRICT,
    academic_year_id    INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
    start_date          DATE,
    end_date            DATE,
    note                VARCHAR(255),
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (member_id, academic_year_id)       -- 1 ปีการศึกษา ดำรงได้ 1 ตำแหน่ง
);
CREATE INDEX IF NOT EXISTS ix_mp_year     ON member_positions(academic_year_id);
CREATE INDEX IF NOT EXISTS ix_mp_position ON member_positions(position_id);

-- ---------------------------------------------------------------------
-- 7) ประวัติการศึกษา
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS member_educations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id       INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    level           VARCHAR(50),           -- ประถมศึกษา / ม.3 / ปวช. ...
    institution     VARCHAR(200) NOT NULL,
    major           VARCHAR(120),
    graduated_year  INTEGER,               -- พ.ศ.
    gpa             VARCHAR(10),
    sort_order      INTEGER DEFAULT 0
);

-- ---------------------------------------------------------------------
-- 8) ผลงาน / กิจกรรม / ประวัติการทำงาน
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS member_activities (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id       INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    category        VARCHAR(20) NOT NULL DEFAULT 'activity'
                    CHECK (category IN ('activity','achievement','work')),
    title           VARCHAR(200) NOT NULL,
    role            VARCHAR(120),          -- บทบาท/ระดับรางวัล
    organization    VARCHAR(200),
    activity_date   DATE,
    description     TEXT,
    image_path      VARCHAR(255),
    sort_order      INTEGER DEFAULT 0
);

-- ---------------------------------------------------------------------
-- 9) รูปภาพประกอบ (Gallery)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS member_images (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id       INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    image_path      VARCHAR(255) NOT NULL,
    caption         VARCHAR(255),
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 10) การเลือกตั้ง (แบบ อวท.08 — รายงานผลการเลือกตั้งประธานชมรมวิชาชีพ)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS elections (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    academic_year_id    INTEGER      NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
    position_id         INTEGER      NOT NULL REFERENCES positions(id)      ON DELETE RESTRICT,
    department_id       INTEGER      REFERENCES departments(id) ON DELETE SET NULL,   -- ชมรม (ถ้ามี)
    title               VARCHAR(200) NOT NULL,
    election_date       DATE,
    eligible_voters     INTEGER,                        -- ผู้มีสิทธิ์เลือกตั้ง
    spoiled_ballots     INTEGER,                        -- บัตรเสีย
    no_vote             INTEGER,                        -- ไม่ประสงค์ลงคะแนน
    report_date         DATE,                           -- วันที่ของหนังสือรายงาน
    reporter_name       VARCHAR(150),                   -- ประธานชมรมวิชาชีพ (ผู้รายงาน)
    advisor_name        VARCHAR(150),                   -- ครูที่ปรึกษาชมรมวิชาชีพ
    activity_head_name  VARCHAR(150),                   -- หัวหน้างานกิจกรรมนักเรียน นักศึกษา
    deputy_name         VARCHAR(150),                   -- รองผู้อำนวยการฝ่ายพัฒนากิจการนักเรียน นักศึกษา
    director_name       VARCHAR(150),                   -- ผู้อำนวยการวิทยาลัย
    note                TEXT,
    appointed_at        DATETIME,                       -- แต่งตั้งผู้ชนะเข้าตำแหน่งแล้วเมื่อ
    created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_elections_year ON elections(academic_year_id);

CREATE TABLE IF NOT EXISTS election_candidates (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    election_id         INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    member_id           INTEGER NOT NULL REFERENCES members(id)   ON DELETE RESTRICT,  -- ผู้สมัครลบไม่ได้
    candidate_no        INTEGER NOT NULL,               -- หมายเลขผู้สมัคร
    votes               INTEGER NOT NULL DEFAULT 0,     -- คะแนนเสียง (ลำดับคำนวณจากคะแนน)
    note                VARCHAR(255),
    UNIQUE (election_id, member_id),
    UNIQUE (election_id, candidate_no)
);
CREATE INDEX IF NOT EXISTS ix_candidates_member ON election_candidates(member_id);

-- ---------------------------------------------------------------------
-- ข้อมูลพื้นฐานเริ่มต้น (ตำแหน่ง)
-- ---------------------------------------------------------------------
INSERT OR IGNORE INTO positions (name, level, is_executive, is_committee, color) VALUES
  ('ประธาน',       1, 1, 1, '#C62828'),
  ('รองประธาน',    2, 1, 1, '#1F4FB5'),
  ('กรรมการ',      3, 0, 1, '#0F8A78'),     -- ลำดับตามแบบ อวท.09
  ('เหรัญญิก',      4, 0, 1, '#B5761F'),
  ('ปฏิคม',        5, 0, 1, '#1F8FB5'),
  ('นายทะเบียน',    6, 0, 1, '#4A6B1F'),
  ('ประชาสัมพันธ์',  7, 0, 1, '#B51F7A'),
  ('เลขานุการ',     8, 0, 1, '#6A3FB5'),
  ('สมาชิกทั่วไป',  9, 0, 0, '#D98200');
