/* =====================================================================
   auth.js — ตรวจสอบการเข้าสู่ระบบ (ทุกหน้ายกเว้น index.html)
   ไม่มี token หรือ token หมดอายุ => กลับไปหน้า Login ทันที
   ===================================================================== */
(function () {
  function decode(token) {
    try {
      const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(decodeURIComponent(atob(b64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
    } catch (e) { return null; }
  }

  function isValid() {
    const t = API.store.token;
    if (!t) return false;
    const p = decode(t);
    return !!(p && p.exp && p.exp * 1000 > Date.now());
  }

  function redirectToLogin(reason) {
    API.store.token = null; API.store.user = null;
    const next = encodeURIComponent(location.pathname.split('/').pop() + location.search);
    location.replace('index.html?' + (reason ? reason + '=1&' : '') + 'next=' + next);
  }

  const Auth = {
    isValid,
    get user() { return API.store.user; },
    can(perm) {
      const u = API.store.user;
      if (!u) return false;
      return u.role === 'superadmin' || (u.permissions || []).includes(perm);
    },
    canAny(...perms) { return perms.some(p => Auth.can(p)); },
    logout() {
      API.store.token = null; API.store.user = null;
      location.replace('index.html?logout=1');
    },
    /** ดึงข้อมูลผู้ใช้ล่าสุดจากเซิร์ฟเวอร์ (สิทธิ์อาจถูกเปลี่ยน) */
    async refresh() {
      const r = await API.get('/api/auth/me');
      API.store.user = r.user;
      return r.user;
    },
    /** ใช้ในหน้าที่ต้องการสิทธิ์เฉพาะ */
    require(perm) {
      if (perm && !Auth.can(perm)) {
        const deny = () => {
          document.querySelector('.content').innerHTML = `
            <div class="card empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <h4>ไม่มีสิทธิ์เข้าถึงหน้านี้</h4><p>กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์</p>
            <a class="btn btn-primary" href="dashboard.html">กลับหน้าหลัก</a></div>`;
        };
        // หน้าที่โหลดผ่าน Nav จะมี DOM พร้อมแล้ว ทำได้ทันที
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', deny);
        else deny();
        return false;
      }
      return true;
    },
  };
  window.Auth = Auth;

  // ---- Guard: ทำงานทันทีที่โหลดสคริปต์ (ก่อนแสดงเนื้อหา) ----
  if (!window.PUBLIC_PAGE && !isValid()) {
    redirectToLogin(API.store.token ? 'expired' : '');
  }
})();
