"""ลงทะเบียนฟอนต์ภาษาไทยสำหรับ reportlab

ลำดับการค้นหา: backend/fonts (Sarabun / THSarabunNew) -> ฟอนต์ระบบ Windows / Linux / macOS
"""
import os

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

_registered = None

CANDIDATES = [
    # (regular, bold) — ชื่อไฟล์ในโฟลเดอร์ backend/fonts
    ("Sarabun-Regular.ttf", "Sarabun-Bold.ttf"),
    ("THSarabunNew.ttf", "THSarabunNew Bold.ttf"),
]
SYSTEM_CANDIDATES = [
    (r"C:\Windows\Fonts\LeelawUI.ttf", r"C:\Windows\Fonts\LeelaUIb.ttf"),
    (r"C:\Windows\Fonts\tahoma.ttf", r"C:\Windows\Fonts\tahomabd.ttf"),
    ("/usr/share/fonts/truetype/tlwg/Sarabun.ttf", "/usr/share/fonts/truetype/tlwg/Sarabun-Bold.ttf"),
    ("/usr/share/fonts/truetype/noto/NotoSansThai-Regular.ttf", "/usr/share/fonts/truetype/noto/NotoSansThai-Bold.ttf"),
    ("/usr/share/fonts/truetype/tlwg/Loma.ttf", "/usr/share/fonts/truetype/tlwg/Loma-Bold.ttf"),
    ("/System/Library/Fonts/Supplemental/Thonburi.ttc", "/System/Library/Fonts/Supplemental/Thonburi.ttc"),
]


def register_thai_font(font_folder: str):
    """คืน (ชื่อฟอนต์ปกติ, ชื่อฟอนต์ตัวหนา)"""
    global _registered
    if _registered:
        return _registered
    pairs = [(os.path.join(font_folder, r), os.path.join(font_folder, b)) for r, b in CANDIDATES] + SYSTEM_CANDIDATES
    for regular, bold in pairs:
        if os.path.isfile(regular):
            try:
                pdfmetrics.registerFont(TTFont("ThaiFont", regular))
                pdfmetrics.registerFont(TTFont("ThaiFont-Bold", bold if os.path.isfile(bold) else regular))
                from reportlab.lib.fonts import addMapping
                addMapping("ThaiFont", 0, 0, "ThaiFont")
                addMapping("ThaiFont", 1, 0, "ThaiFont-Bold")
                _registered = ("ThaiFont", "ThaiFont-Bold")
                return _registered
            except Exception:  # noqa: BLE001 — ลองไฟล์ถัดไป
                continue
    _registered = ("Helvetica", "Helvetica-Bold")
    return _registered
