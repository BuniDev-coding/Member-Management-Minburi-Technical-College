/* =====================================================================
   api.js — เรียก REST API ด้วย fetch() และจัดการ token
   ===================================================================== */
(function () {
  // ถ้าเปิดหน้าเว็บผ่าน Flask (พอร์ต 5000) ใช้ origin เดียวกัน
  // ถ้าเปิดแยก (เช่น VS Code Live Server หรือไฟล์ตรง) จะชี้ไปที่ http://127.0.0.1:5000
  const sameOrigin = location.protocol.startsWith('http') && !['5500', '5501', '3000', '8080'].includes(location.port);
  const API_BASE = window.APP_API_BASE || (sameOrigin ? '' : 'http://127.0.0.1:5000');
  const TOKEN_KEY = 'mtc_token';
  const USER_KEY = 'mtc_user';

  const store = {
    get token() { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } },
    set token(v) { try { v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ } },
    get user() { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (e) { return null; } },
    set user(v) { try { v ? localStorage.setItem(USER_KEY, JSON.stringify(v)) : localStorage.removeItem(USER_KEY); } catch (e) { /* ignore */ } },
  };

  class ApiError extends Error {
    constructor(message, status, data) { super(message); this.status = status; this.data = data || {}; }
  }

  function qs(params) {
    if (!params) return '';
    const p = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.append(k, v); });
    const s = p.toString();
    return s ? '?' + s : '';
  }

  async function request(method, path, { body, params, raw } = {}) {
    const headers = {};
    if (store.token) headers.Authorization = 'Bearer ' + store.token;
    let payload = body;
    if (body && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch(API_BASE + path + qs(params), { method, headers, body: payload });
    } catch (e) {
      throw new ApiError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบว่าเปิด Backend แล้ว', 0);
    }
    if (res.status === 401 && !path.startsWith('/api/auth/login')) {
      store.token = null; store.user = null;
      const next = encodeURIComponent(location.pathname.split('/').pop() + location.search);
      location.href = 'index.html?expired=1&next=' + next;
      throw new ApiError('เซสชันหมดอายุ', 401);
    }
    if (raw) {
      if (!res.ok) {
        let msg = 'ดาวน์โหลดไม่สำเร็จ';
        try { msg = (await res.json()).message || msg; } catch (e) { /* ignore */ }
        throw new ApiError(msg, res.status);
      }
      return res;
    }
    let data = {};
    try { data = await res.json(); } catch (e) { /* ไม่ใช่ JSON */ }
    if (!res.ok || data.success === false) {
      throw new ApiError(data.message || `เกิดข้อผิดพลาด (${res.status})`, res.status, data);
    }
    return data;
  }

  /** ดาวน์โหลดไฟล์ที่ต้องใช้ token (Excel / PDF / ไฟล์สำรอง) */
  async function download(path, params, fallbackName) {
    const f = await fetchFile(path, params, fallbackName);
    saveBlob(f.blob, f.name);
  }

  /** ดึงไฟล์ที่ต้องใช้ token มาเป็น Blob (ใช้แสดงตัวอย่าง / สั่งพิมพ์ / บันทึก) → { blob, name } */
  async function fetchFile(path, params, fallbackName) {
    const res = await request('GET', path, { params, raw: true });
    const blob = await res.blob();
    let name = fallbackName || 'download';
    const cd = res.headers.get('Content-Disposition') || '';
    const m = cd.match(/filename\*=UTF-8''([^;]+)/i) || cd.match(/filename="?([^";]+)"?/i);
    if (m) name = decodeURIComponent(m[1]);
    return { blob, name };
  }

  function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /** URL รูปภาพที่อัปโหลด (แนบ token เพราะ <img> ส่ง header ไม่ได้) */
  function fileUrl(path) {
    if (!path) return '';
    return `${API_BASE}/api/files/${path.split('/').map(encodeURIComponent).join('/')}?token=${encodeURIComponent(store.token || '')}`;
  }

  window.API = {
    base: API_BASE,
    store,
    ApiError,
    get: (path, params) => request('GET', path, { params }),
    post: (path, body) => request('POST', path, { body }),
    put: (path, body) => request('PUT', path, { body }),
    patch: (path, body) => request('PATCH', path, { body }),
    del: (path) => request('DELETE', path),
    download,
    fetchFile,
    saveBlob,
    fileUrl,
  };
})();
