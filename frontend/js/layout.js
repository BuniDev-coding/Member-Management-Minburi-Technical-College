/* =====================================================================
   layout.js — Sidebar, Header, ไอคอน และ UI helpers ที่ใช้ร่วมกันทุกหน้า
   ===================================================================== */
(function () {
  const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;

  const Icons = {
    dashboard: svg('<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>'),
    users: svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
    userPlus: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>'),
    user: svg('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'),
    award: svg('<circle cx="12" cy="8" r="6"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>'),
    calendar: svg('<rect x="3" y="4" width="18" height="18" rx="3"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'),
    report: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>'),
    shield: svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>'),
    logout: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>'),
    more: svg('<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>'),
    edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
    trash: svg('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>'),
    filter: svg('<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>'),
    eye: svg('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'),
    bell: svg('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'),
    alert: svg('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'),
    download: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
    upload: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>'),
    plus: svg('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'),
    x: svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
    check: svg('<polyline points="20 6 9 17 4 12"/>'),
    checkCircle: svg('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'),
    database: svg('<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>'),
    image: svg('<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>'),
    printer: svg('<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>'),
    arrowLeft: svg('<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>'),
    phone: svg('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>'),
    mail: svg('<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>'),
    message: svg('<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>'),
    map: svg('<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>'),
    book: svg('<path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>'),
    star: svg('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
    briefcase: svg('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>'),
    flag: svg('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>'),
    layout: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>'),
    key: svg('<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>'),
    lock: svg('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
    refresh: svg('<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>'),
    grid: svg('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>'),
    list: svg('<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>'),
    building: svg('<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>'),
    excel: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13l4 5M12 13l-4 5"/>'),
    pdf: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15h1.5a1.5 1.5 0 0 0 0-3H9v6"/>'),
    camera: svg('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>'),
    quote: svg('<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>'),
  };

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------
  const esc = (v) => (v === null || v === undefined ? '' : String(v))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const nl2br = (v) => esc(v).replace(/\n/g, '<br>');

  const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const TH_MONTHS_S = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const TH_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

  function parseDate(v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T00:00:00') : new Date(v);
    return isNaN(d) ? null : d;
  }
  const Fmt = {
    date(v, long = false) {
      const d = parseDate(v); if (!d) return '-';
      return `${d.getDate()} ${(long ? TH_MONTHS : TH_MONTHS_S)[d.getMonth()]} ${d.getFullYear() + 543}`;
    },
    datetime(v) {
      const d = parseDate(v); if (!d) return '-';
      return `${Fmt.date(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} น.`;
    },
    today() {
      const d = new Date();
      return `วัน${TH_DAYS[d.getDay()]}ที่ ${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
    },
    age(v) {
      const d = parseDate(v); if (!d) return null;
      const n = new Date(); let a = n.getFullYear() - d.getFullYear();
      if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--;
      return a;
    },
    phone(v) {
      if (!v) return '-';
      const s = String(v);
      if (s.length === 10) return `${s.slice(0, 3)}-${s.slice(3, 6)}-${s.slice(6)}`;
      if (s.length === 9) return `${s.slice(0, 2)}-${s.slice(2, 5)}-${s.slice(5)}`;
      return s;
    },
    number(n) { return (Number(n) || 0).toLocaleString('th-TH'); },
    size(b) { return b > 1048576 ? (b / 1048576).toFixed(2) + ' MB' : (b / 1024).toFixed(1) + ' KB'; },
  };

  const AVATAR_COLORS = ['#1F4FB5', '#13306B', '#0F8A78', '#B5651D', '#5B6B85', '#2E6FD8', '#8A3B52', '#3B7A57'];
  function avatar(m, cls = '') {
    const name = m.first_name || m.full_name || m.name || '?';
    const color = AVATAR_COLORS[(m.id || name.charCodeAt(0)) % AVATAR_COLORS.length];
    if (m.photo_path) {
      return `<span class="avatar ${cls}"><img src="${API.fileUrl(m.photo_path)}" alt="${esc(name)}" loading="lazy" onerror="this.parentNode.textContent='${esc(name.charAt(0))}'"></span>`;
    }
    return `<span class="avatar ${cls}" style="background:${color}">${esc(name.charAt(0))}</span>`;
  }
  const STATUS_LABEL = { active: 'ปกติ', pending: 'รอตรวจสอบ', inactive: 'พ้นสภาพ' };
  const statusHtml = (s) => `<span class="status ${esc(s)}">${STATUS_LABEL[s] || esc(s)}</span>`;
  const posBadge = (name, color) => `<span class="pos-badge"><i style="background:${esc(color || '#B9C5D6')}"></i>${esc(name || 'สมาชิกทั่วไป')}</span>`;

  function debounce(fn, ms = 300) {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  // ---- Toast ----
  function toast(message, type = 'success', ms = 3500) {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.setAttribute('role', 'status');
    el.innerHTML = (type === 'error' ? Icons.alert : type === 'warning' ? Icons.alert : Icons.checkCircle) + `<span>${esc(message)}</span>`;
    wrap.appendChild(el);
    setTimeout(() => { el.classList.add('hide'); setTimeout(() => el.remove(), 300); }, ms);
  }

  // ---------------------------------------------------------------------
  // Modal
  //   modal({ title, subtitle, icon, body, footer, size: 'sm'|'lg', static, onClose })
  //   - static: true หรือฟังก์ชัน → คลิกนอกกล่อง / กด Esc จะไม่ปิด (กล่องสั่นเตือนแทน)
  //   - คืนค่า { el, body, close, setError, clearError, shake }
  // ---------------------------------------------------------------------
  const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const topModal = () => { const all = document.querySelectorAll('.modal-backdrop:not(.closing)'); return all[all.length - 1]; };
  const uid = (p) => p + Math.random().toString(36).slice(2, 9);

  function modal({ title, subtitle = '', icon = '', body = '', footer, size = '', className = '', static: isStatic = false, onClose, onBlocked } = {}) {
    const prevFocus = document.activeElement;
    const tid = uid('mt-');
    const bd = document.createElement('div');
    bd.className = 'modal-backdrop';
    bd.innerHTML = `<div class="modal ${size} ${className}" role="dialog" aria-modal="true" ${title != null ? `aria-labelledby="${tid}"` : ''}>
      ${title != null ? `<div class="modal-head">
        ${icon ? `<span class="modal-icon">${Icons[icon] || icon}</span>` : ''}
        <div class="modal-titles"><h3 id="${tid}">${esc(title)}</h3>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>
        <button type="button" class="icon-btn sm modal-x" data-close aria-label="ปิด">${Icons.x}</button>
      </div>` : ''}
      <div class="modal-body">${body}</div>
      ${footer === false ? '' : `<div class="modal-foot">${footer || '<button type="button" class="btn btn-light" data-close>ปิด</button>'}</div>`}
    </div>`;
    const box = bd.querySelector('.modal');
    const blocked = () => (typeof isStatic === 'function' ? isStatic() : isStatic);
    let closed = false;

    const api = {
      el: bd,
      get body() { return bd.querySelector('.modal-body'); },
      close() {
        if (closed) return;
        closed = true;
        bd.classList.add('closing');
        document.removeEventListener('keydown', onKey, true);
        setTimeout(() => {
          bd.remove();
          if (!document.querySelector('.modal-backdrop')) document.body.classList.remove('modal-open');
        }, 150);
        if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
        onClose && onClose();
      },
      shake() {
        box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
        onBlocked && onBlocked();
      },
      setError(msg) {
        let a = bd.querySelector('.modal-alert');
        if (!a) { a = document.createElement('div'); a.className = 'modal-alert'; a.setAttribute('role', 'alert'); api.body.prepend(a); }
        a.innerHTML = `${Icons.alert}<span>${esc(msg)}</span>`;
        a.hidden = false;
        a.scrollIntoView({ block: 'nearest' });
      },
      clearError() { const a = bd.querySelector('.modal-alert'); if (a) a.hidden = true; },
    };
    const tryClose = () => (blocked() ? api.shake() : api.close());

    function onKey(e) {
      if (bd !== topModal()) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); tryClose(); return; }
      if (e.key === 'Tab') {   // ให้ Tab วนอยู่ภายในกล่อง
        const items = [...box.querySelectorAll(FOCUSABLE)].filter(x => x.offsetParent !== null);
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        else if (!box.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      }
    }
    // ปิดเมื่อกดและปล่อยเมาส์บนพื้นหลังเท่านั้น (กันปิดตอนลากเลือกข้อความออกนอกกล่อง)
    let downOnBackdrop = false;
    bd.addEventListener('mousedown', (e) => { downOnBackdrop = e.target === bd; });
    bd.addEventListener('mouseup', (e) => { if (downOnBackdrop && e.target === bd) tryClose(); downOnBackdrop = false; });
    bd.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) api.close(); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(bd);
    document.body.classList.add('modal-open');
    document.querySelectorAll('.menu-pop').forEach(p => p.remove());

    const first = box.querySelector('[autofocus]') || box.querySelector('.modal-body input:not([type=hidden]):not([readonly]), .modal-body select, .modal-body textarea');
    setTimeout(() => (first || box.querySelector('.modal-x') || box).focus({ preventScroll: true }), 30);
    return api;
  }

  /**
   * กล่องยืนยัน
   *   confirm(message, { title, okText, cancelText, variant: 'danger'|'warning'|'info',
   *                      item, itemSub, detail, onConfirm })
   *   - item: ชื่อรายการที่จะถูกกระทำ (แสดงในกรอบให้เห็นชัด)
   *   - onConfirm: ฟังก์ชัน async — ทำงานในกล่อง แสดงสถานะกำลังดำเนินการ ถ้า error แสดงในกล่อง
   *   คืนค่า Promise<boolean>
   */
  const CONFIRM_VARIANTS = {
    danger: { icon: 'trash', btn: 'btn-danger-solid' },
    warning: { icon: 'alert', btn: 'btn-warning' },
    info: { icon: 'alert', btn: 'btn-primary' },
  };
  function confirmDialog(message, opts = {}) {
    const { title = 'ยืนยันการทำรายการ', okText = 'ยืนยัน', cancelText = 'ยกเลิก', detail = '', item = '', itemSub = '', onConfirm } = opts;
    const variant = opts.variant || (opts.danger === false ? 'info' : 'danger');
    const v = CONFIRM_VARIANTS[variant] || CONFIRM_VARIANTS.danger;
    const tid = uid('ct-');
    return new Promise((resolve) => {
      let ok = false, busy = false;
      const m = modal({
        title: null, size: 'sm', className: `confirm confirm-${variant}`,
        static: () => busy,
        body: `<button type="button" class="icon-btn sm modal-x confirm-x" data-close aria-label="ปิด">${Icons.x}</button>
          <div class="confirm-icon">${Icons[opts.icon || v.icon]}</div>
          <h3 class="confirm-title" id="${tid}">${esc(title)}</h3>
          <p class="confirm-msg">${esc(message)}</p>
          ${item ? `<div class="confirm-item">${esc(item)}${itemSub ? `<small>${esc(itemSub)}</small>` : ''}</div>` : ''}
          ${detail ? `<p class="confirm-detail">${Icons.alert}<span>${esc(detail)}</span></p>` : ''}
          <div class="modal-alert" role="alert" hidden></div>`,
        footer: `<button type="button" class="btn btn-light" data-cancel>${esc(cancelText)}</button>
                 <button type="button" class="btn ${v.btn}" data-ok>${esc(okText)}</button>`,
        onClose: () => resolve(ok),
      });
      const box = m.el.querySelector('.modal');
      box.setAttribute('role', variant === 'danger' ? 'alertdialog' : 'dialog');
      box.setAttribute('aria-labelledby', tid);
      const btnOk = m.el.querySelector('[data-ok]'), btnCancel = m.el.querySelector('[data-cancel]');
      btnCancel.addEventListener('click', () => { if (!busy) m.close(); });
      btnOk.addEventListener('click', async () => {
        if (busy) return;
        if (!onConfirm) { ok = true; m.close(); return; }
        busy = true; m.clearError();
        btnCancel.disabled = true; m.el.querySelector('.confirm-x').disabled = true;
        setLoading(btnOk, true, 'กำลังดำเนินการ...');
        try {
          await onConfirm();
          ok = true; busy = false; m.close();
        } catch (e) {
          busy = false; btnCancel.disabled = false; m.el.querySelector('.confirm-x').disabled = false;
          setLoading(btnOk, false);
          m.setError(e.message || 'ทำรายการไม่สำเร็จ');
        }
      });
      // การลบ: โฟกัสปุ่มยกเลิกไว้ก่อน กันกด Enter แล้วลบโดยไม่ตั้งใจ
      setTimeout(() => (variant === 'danger' ? btnCancel : btnOk).focus({ preventScroll: true }), 40);
    });
  }

  /**
   * ฟอร์มในกล่อง (เพิ่ม / แก้ไขข้อมูล)
   *   formModal({ title, subtitle, icon, body, submitText, size, onSubmit(form, m), onReady(form, m) })
   *   - onSubmit คืน false = ยังไม่ปิด (เช่น ข้อมูลไม่ครบ), throw error = แสดงข้อความในกล่อง
   *   - m.invalid({ field: 'ข้อความ' }) → ทำเครื่องหมายช่องที่ผิดและคืน false
   *   - ถ้าแก้ไขข้อมูลแล้ว คลิกนอกกล่อง/กด Esc จะไม่ปิด (กันข้อมูลหาย)
   */
  function formModal({ title, subtitle = '', icon = 'edit', body = '', submitText = 'บันทึก', size = '', note = true, onSubmit, onReady } = {}) {
    let dirty = false, busy = false;
    const fid = uid('fm-');
    const NOTE = note ? 'ช่องที่มี <span class="req">*</span> จำเป็นต้องกรอก' : '';
    const m = modal({
      title, subtitle, icon, size,
      static: () => dirty || busy,
      onBlocked: () => {
        const n = m.el.querySelector('.foot-note');
        if (n && dirty && !busy) { n.classList.add('warn'); n.textContent = 'มีข้อมูลที่ยังไม่บันทึก — กด "ยกเลิก" หากต้องการปิด'; }
      },
      body: `<form id="${fid}" class="form-grid" novalidate autocomplete="off">${body}</form>`,
      footer: `<span class="foot-note">${NOTE}</span>
        <button type="button" class="btn btn-light" data-close>ยกเลิก</button>
        <button type="submit" form="${fid}" class="btn btn-primary" data-save>${Icons.check}${esc(submitText)}</button>`,
    });
    const f = m.el.querySelector('form');
    const markDirty = (e) => {
      dirty = true;
      const el = e.target;
      if (el.classList) el.classList.remove('invalid');
      const fe = el.closest && el.closest('.field') && el.closest('.field').querySelector('.field-error');
      if (fe) fe.remove();
    };
    f.addEventListener('input', markDirty);
    f.addEventListener('change', markDirty);
    m.form = f;
    m.invalid = (errors) => { showFieldErrors(f, errors); return false; };
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy) return;
      m.clearError();
      f.querySelectorAll('.field-error').forEach(x => x.remove());
      f.querySelectorAll('.invalid').forEach(x => x.classList.remove('invalid'));
      const btn = m.el.querySelector('[data-save]');
      busy = true;
      setLoading(btn, true, 'กำลังบันทึก...');
      try {
        const res = await onSubmit(f, m);
        if (res !== false) { dirty = false; busy = false; m.close(); return; }
      } catch (err) {
        m.setError(err.message || 'บันทึกไม่สำเร็จ');
        if (err.data && err.data.errors) showFieldErrors(f, err.data.errors);
      }
      busy = false;
      if (document.contains(btn)) setLoading(btn, false);
    });
    onReady && onReady(f, m);
    return m;
  }

  /** เมนู ⋮ แบบลอย */
  function popMenu(anchor, items) {
    document.querySelectorAll('.menu-pop').forEach(m => m.remove());
    const pop = document.createElement('div');
    pop.className = 'menu-pop';
    pop.innerHTML = items.map((it, i) => it === '-' ? '<hr>' :
      `<button data-i="${i}" class="${it.danger ? 'danger' : ''}">${it.icon || ''}<span>${esc(it.label)}</span></button>`).join('');
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let left = r.right - w, top = r.bottom + 6;
    if (top + h > window.innerHeight - 10) top = r.top - h - 6;
    pop.style.left = Math.max(10, left) + 'px';
    pop.style.top = Math.max(10, top) + 'px';
    pop.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-i]'); if (!b) return;
      pop.remove(); items[+b.dataset.i].onClick();
    });
    const off = (e) => { if (!pop.contains(e.target) && e.target !== anchor) { pop.remove(); cleanup(); } };
    const cleanup = () => { document.removeEventListener('mousedown', off); window.removeEventListener('scroll', rm, true); };
    const rm = () => { pop.remove(); cleanup(); };
    setTimeout(() => { document.addEventListener('mousedown', off); window.addEventListener('scroll', rm, true); });
  }

  function setLoading(btn, on, text) {
    if (!btn) return;
    if (on) { btn.dataset.html = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spinner"></span>${text ? esc(text) : ''}`; }
    else { btn.disabled = false; if (btn.dataset.html) btn.innerHTML = btn.dataset.html; }
  }
  const loadingHtml = (t = 'กำลังโหลดข้อมูล...') => `<div class="loading"><span class="spinner"></span>${esc(t)}</div>`;
  const emptyHtml = (title = 'ไม่พบข้อมูล', sub = '') => `<div class="empty">${Icons.search}<h4>${esc(title)}</h4>${sub ? `<p>${esc(sub)}</p>` : ''}</div>`;

  /** แสดง error ของฟอร์มจาก API (errors: {field: msg}) */
  function showFieldErrors(form, errors) {
    form.querySelectorAll('.field-error').forEach(e => e.remove());
    form.querySelectorAll('.invalid').forEach(e => e.classList.remove('invalid'));
    let first = null;
    Object.entries(errors || {}).forEach(([k, msg]) => {
      const input = form.querySelector(`[name="${k}"]`);
      if (!input) return;
      input.classList.add('invalid');
      const div = document.createElement('div'); div.className = 'field-error'; div.textContent = msg;
      (input.closest('.field') || input.parentNode).appendChild(div);
      first = first || input;
    });
    if (first) { first.scrollIntoView({ behavior: 'smooth', block: 'center' }); first.focus({ preventScroll: true }); }
  }

  function options(list, { value = 'id', label = 'name', selected, placeholder } = {}) {
    return (placeholder !== undefined ? `<option value="">${esc(placeholder)}</option>` : '') +
      list.map(o => {
        const v = typeof o === 'object' ? o[value] : o;
        const l = typeof o === 'object' ? (typeof label === 'function' ? label(o) : o[label]) : o;
        return `<option value="${esc(v)}" ${String(v) === String(selected ?? '') ? 'selected' : ''}>${esc(l)}</option>`;
      }).join('');
  }

  /** ข้อมูลประกอบ (ปี ตำแหน่ง แผนก) — cache ไว้ระหว่างหน้า */
  let metaPromise = null;
  const getMeta = (force) => { if (!metaPromise || force) metaPromise = API.get('/api/meta'); return metaPromise; };

  // ---------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------
  const MENU = [
    { key: 'dashboard', label: 'Dashboard', href: 'dashboard.html', icon: 'dashboard' },
    { key: 'members', label: 'สมาชิก', href: 'members.html', icon: 'users', perm: 'members.view' },
    { key: 'member-form', label: 'รับสมาชิก', href: 'member-form.html', icon: 'userPlus', perm: 'members.edit' },
    { key: 'search', label: 'สืบค้น', href: 'search.html', icon: 'search', perm: 'members.view' },
    { key: 'positions', label: 'ตำแหน่ง', href: 'positions.html', icon: 'award' },
    { key: 'years', label: 'ปีการศึกษา', href: 'years.html', icon: 'calendar' },
    { key: 'reports', label: 'รายงาน', href: 'reports.html', icon: 'report', perm: 'reports' },
    { key: 'users', label: 'ผู้ใช้งาน', href: 'users.html', icon: 'shield', perms: ['users', 'backup'] },
  ];
  const ROLE_LABEL = { superadmin: 'ผู้ดูแลระบบสูงสุด', admin: 'ผู้ดูแลระบบ', staff: 'เจ้าหน้าที่' };

  let sidebarKey = null;   // สิทธิ์ที่ใช้สร้างเมนูล่าสุด — ถ้าไม่เปลี่ยนจะอัปเดตแค่เมนูที่เลือก
  function renderSidebar(active) {
    const el = document.getElementById('sidebar');
    if (!el) return;
    const key = JSON.stringify((Auth.user || {}).permissions || []) + (Auth.user || {}).role;
    if (sidebarKey === key && el.querySelector('nav')) {
      el.querySelectorAll('.nav-item[href]').forEach(a => a.classList.toggle('active', a.getAttribute('href') === (MENU.find(m => m.key === active) || {}).href));
      return;
    }
    sidebarKey = key;
    el.className = 'sidebar';
    const items = MENU.filter(m => (!m.perm || Auth.can(m.perm)) && (!m.perms || Auth.canAny(...m.perms)));
    el.innerHTML = `<a class="brand" href="dashboard.html" title="วิทยาลัยเทคนิคมีนบุรี"><img src="img/logo.png" alt="ตราวิทยาลัยเทคนิคมีนบุรี"></a>
      <nav aria-label="เมนูหลัก">${items.map(m =>
        `<a class="nav-item ${m.key === active ? 'active' : ''}" href="${m.href}" data-tip="${m.label}" aria-label="${m.label}">${Icons[m.icon]}</a>`).join('')}
        <button class="nav-item nav-logout" data-tip="ออกจากระบบ" aria-label="ออกจากระบบ" id="btnLogout">${Icons.logout}</button>
      </nav>`;
    el.querySelector('#btnLogout').addEventListener('click', async () => {
      if (await confirmDialog('ต้องการออกจากระบบหรือไม่? งานที่ยังไม่บันทึกจะหายไป', { okText: 'ออกจากระบบ', variant: 'info', icon: 'logout', title: 'ออกจากระบบ' })) Auth.logout();
    });
  }

  function renderHeader(title, subtitle, opts) {
    const el = document.getElementById('header');
    if (!el) return;
    el.className = 'header';
    const u = Auth.user || {};
    el.innerHTML = `
      <h1 class="page-title">${esc(title)}${subtitle ? `<small>${esc(subtitle)}</small>` : ''}</h1>
      ${opts.search === false ? '<div style="flex:1"></div>' : `<form class="header-search" id="globalSearch" role="search">
        ${Icons.search}<input type="search" name="q" placeholder="ค้นหาสมาชิก ชื่อ-นามสกุล หรือเลขสมาชิก..." autocomplete="off" aria-label="ค้นหาสมาชิก">
      </form>`}
      <div class="header-right">
        <div class="header-date">${Icons.calendar}<span>${Fmt.today()}</span></div>
        <div class="profile-wrap" id="profileWrap">
          <button class="profile-btn" id="profileBtn" aria-haspopup="true">
            ${avatar({ first_name: u.full_name || u.username || 'A', id: u.id })}
            <span class="p-text"><span class="p-name">${esc(u.full_name || u.username || '')}</span><span class="p-role">${ROLE_LABEL[u.role] || ''}</span></span>
          </button>
          <div class="dropdown" id="profileMenu">
            <div style="padding:10px 12px 6px"><strong>${esc(u.full_name || '')}</strong><div class="text-muted text-sm">@${esc(u.username || '')}</div></div>
            <hr>
            <button type="button" data-act="password">${Icons.key}เปลี่ยนรหัสผ่าน</button>
            <hr>
            <button type="button" class="danger" data-act="logout">${Icons.logout}ออกจากระบบ</button>
          </div>
        </div>
      </div>`;
    const gs = el.querySelector('#globalSearch');
    if (gs) {
      const q = new URLSearchParams(location.search).get('q');
      if (q && opts.active === 'search') gs.q.value = q;
      gs.addEventListener('submit', (e) => {
        e.preventDefault();
        const v = gs.q.value.trim();
        if (opts.onSearch) opts.onSearch(v);
        else Nav.go('search.html' + (v ? '?q=' + encodeURIComponent(v) : ''));
      });
    }
    const menu = el.querySelector('#profileMenu');
    el.querySelector('#profileBtn').addEventListener('click', () => menu.classList.toggle('open'));
    menu.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]');
      if (!act) return;
      menu.classList.remove('open');
      if (act.dataset.act === 'logout') Auth.logout();
      if (act.dataset.act === 'password') changePasswordDialog();
    });
  }
  // ปิดเมนูโปรไฟล์เมื่อคลิกที่อื่น (ลงทะเบียนครั้งเดียว ใช้ได้ทุกหน้า)
  document.addEventListener('click', (e) => {
    const wrap = document.getElementById('profileWrap');
    if (wrap && !wrap.contains(e.target)) wrap.querySelector('.dropdown').classList.remove('open');
  });

  function changePasswordDialog() {
    formModal({
      title: 'เปลี่ยนรหัสผ่าน', subtitle: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร', icon: 'key', size: 'sm', submitText: 'เปลี่ยนรหัสผ่าน',
      body: `
        <div class="field col-12"><label for="pw_old">รหัสผ่านเดิม <span class="req">*</span></label><input class="input" id="pw_old" type="password" name="old_password" autocomplete="current-password"></div>
        <div class="field col-12"><label for="pw_new">รหัสผ่านใหม่ <span class="req">*</span></label><input class="input" id="pw_new" type="password" name="new_password" autocomplete="new-password"></div>
        <div class="field col-12"><label for="pw_cf">ยืนยันรหัสผ่านใหม่ <span class="req">*</span></label><input class="input" id="pw_cf" type="password" name="confirm" autocomplete="new-password"></div>`,
      onSubmit: async (f, m) => {
        if (!f.old_password.value) return m.invalid({ old_password: 'กรุณากรอกรหัสผ่านเดิม' });
        if (f.new_password.value.length < 8) return m.invalid({ new_password: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' });
        if (f.new_password.value !== f.confirm.value) return m.invalid({ confirm: 'ยืนยันรหัสผ่านไม่ตรงกัน' });
        const r = await API.post('/api/auth/change-password', { old_password: f.old_password.value, new_password: f.new_password.value });
        toast(r.message);
      },
    });
  }

  /**
   * Layout.init({ active, title, subtitle, search, onSearch })
   * สร้าง Sidebar + Header และรีเฟรชข้อมูลผู้ใช้จากเซิร์ฟเวอร์
   */
  function init(opts) {
    renderSidebar(opts.active);
    renderHeader(opts.title, opts.subtitle, opts);
    document.title = `${opts.title} | ระบบสมาชิก วิทยาลัยเทคนิคมีนบุรี`;
    // ตรวจ token กับเซิร์ฟเวอร์ และอัปเดตสิทธิ์ล่าสุด
    return Auth.refresh().then((u) => { renderSidebar(opts.active); return u; }).catch(() => Auth.user);
  }

  // ---------------------------------------------------------------------
  // Nav — เปลี่ยนหน้าโดยไม่รีโหลดทั้งหน้า
  // โหลด HTML ของหน้าใหม่ แทนที่เฉพาะ <main> แล้วรันสคริปต์ของหน้านั้น
  // (Sidebar / ไฟล์หลัก api.js auth.js layout.js ไม่ต้องโหลดซ้ำ)
  // ---------------------------------------------------------------------
  const CORE_SCRIPTS = ['js/api.js', 'js/auth.js', 'js/layout.js'];
  const Nav = {
    current: null,
    supported: !!(window.fetch && window.DOMParser && window.history && history.pushState),

    internalUrl(href) {
      let u;
      try { u = new URL(href, location.href); } catch (e) { return null; }
      if (u.origin !== location.origin) return null;
      const file = u.pathname.split('/').pop() || 'index.html';
      if (!/\.html$/.test(file) || file === 'index.html') return null;
      return u;
    },

    progress(p) {
      let bar = document.querySelector('.nav-progress');
      if (!bar) { bar = document.createElement('div'); bar.className = 'nav-progress'; document.body.appendChild(bar); }
      bar.style.opacity = '1';
      bar.style.width = p + '%';
      if (p >= 100) setTimeout(() => { bar.style.opacity = '0'; setTimeout(() => { bar.style.width = '0'; }, 300); }, 150);
    },

    loadScript(src, markPage) {
      return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        if (markPage) s.dataset.pageScript = '1';
        s.onload = resolve;
        s.onerror = () => reject(new Error('โหลดสคริปต์ไม่สำเร็จ: ' + src));
        document.body.appendChild(s);
      });
    },

    loadStyle(href) {
      return new Promise((resolve) => {
        const l = document.createElement('link');
        l.rel = 'stylesheet'; l.href = href;
        l.onload = l.onerror = resolve;
        setTimeout(resolve, 1500);
        document.head.appendChild(l);
      });
    },

    async go(href, { push = true } = {}) {
      const u = this.internalUrl(href);
      const main = document.querySelector('main.main');
      if (!u || !this.supported || !main) { location.href = href; return; }
      const ticket = this.current = {};
      main.classList.add('is-loading');
      this.progress(30);
      try {
        const res = await fetch(u.pathname, { credentials: 'same-origin' });
        if (!res.ok) throw new Error(res.status);
        const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        const newMain = doc.querySelector('main.main');
        if (!newMain) throw new Error('no main');
        if (ticket !== this.current) return;   // ผู้ใช้กดไปหน้าอื่นแล้ว
        this.progress(65);

        // CSS เพิ่มเติมของหน้าใหม่ (เช่น profile-templates.css)
        const haveCss = new Set([...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.getAttribute('href')));
        await Promise.all([...doc.querySelectorAll('link[rel=stylesheet]')]
          .map(l => l.getAttribute('href')).filter(h => !haveCss.has(h)).map(h => this.loadStyle(h)));
        if (ticket !== this.current) return;

        // เก็บกวาดหน้าเดิม
        document.querySelectorAll('.modal-backdrop, .menu-pop, .lightbox').forEach(e => e.remove());
        if (window.Chart && Chart.instances) Object.values(Chart.instances).forEach(c => c.destroy());
        document.querySelectorAll('script[data-page-script]').forEach(s => s.remove());

        // สลับเนื้อหา
        main.innerHTML = newMain.innerHTML;
        main.classList.remove('is-loading');
        document.title = doc.title;
        if (push) history.pushState({ nav: true }, '', u.pathname.split('/').pop() + u.search + u.hash);
        window.scrollTo(0, 0);
        const content = main.querySelector('.content');
        if (content) { content.classList.remove('page-enter'); void content.offsetWidth; content.classList.add('page-enter'); }

        // รันสคริปต์ของหน้าใหม่ตามลำดับ
        for (const s of doc.querySelectorAll('body script[src]')) {
          const src = s.getAttribute('src');
          if (CORE_SCRIPTS.includes(src)) continue;
          if (/^https?:/.test(src)) {   // ไลบรารีภายนอก โหลดครั้งเดียว
            if (!document.querySelector(`script[src="${src}"]`)) await this.loadScript(src, false);
          } else {
            await this.loadScript(src, true);
          }
        }
        this.progress(100);
      } catch (e) {
        location.href = href;   // ถ้ามีปัญหา ใช้การโหลดหน้าแบบปกติแทน
      }
    },
  };

  // ดักการคลิกลิงก์ภายในระบบ
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!a || a.target || a.hasAttribute('download')) return;
    const raw = a.getAttribute('href');
    if (!raw || raw.startsWith('#') || /^(javascript|blob|mailto|tel):/.test(raw)) return;
    if (!Nav.internalUrl(a.href) || !document.querySelector('main.main')) return;
    e.preventDefault();
    Nav.go(a.href);
  });
  // ปุ่มย้อนกลับ / ไปข้างหน้า ของเบราว์เซอร์
  window.addEventListener('popstate', () => { if (document.querySelector('main.main')) Nav.go(location.href, { push: false }); });

  window.Icons = Icons;
  window.UI = { esc, nl2br, Fmt, avatar, statusHtml, posBadge, STATUS_LABEL, debounce, toast, modal, confirm: confirmDialog, formModal, popMenu, setLoading, loadingHtml, emptyHtml, showFieldErrors, options, getMeta };
  window.Layout = { init, ROLE_LABEL };
  window.Nav = Nav;
})();
