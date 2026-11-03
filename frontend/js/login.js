/* หน้า Login */
(function () {
  const params = new URLSearchParams(location.search);
  const next = params.get('next');
  const safeNext = next && /^[\w-]+\.html(\?.*)?$/.test(next) && !next.startsWith('index.html') ? next : 'dashboard.html';

  // มี token ที่ยังไม่หมดอายุอยู่แล้ว → เข้าระบบเลย
  if (Auth.isValid()) { location.replace(safeNext); return; }

  document.getElementById('iUser').insertAdjacentHTML('afterbegin', Icons.user);
  document.getElementById('iPass').insertAdjacentHTML('afterbegin', Icons.lock);
  const toggle = document.getElementById('togglePass');
  toggle.innerHTML = Icons.eye;
  toggle.addEventListener('click', () => {
    const p = document.getElementById('password');
    p.type = p.type === 'password' ? 'text' : 'password';
  });
  document.getElementById('feat').innerHTML = [
    [Icons.users, 'จัดการข้อมูลและประวัติสมาชิก'],
    [Icons.award, 'ประวัติการดำรงตำแหน่งรายปี'],
    [Icons.report, 'รายงาน Excel / PDF'],
    [Icons.shield, 'กำหนดสิทธิ์การเข้าถึงรายบุคคล'],
  ].map(([i, t]) => `<div>${i}<span>${t}</span></div>`).join('');

  const msg = document.getElementById('loginMsg');
  const show = (text, ok) => {
    msg.hidden = false;
    msg.className = 'login-error';
    if (ok) msg.style.cssText = 'background:#E8F9EF;color:#15803D';
    msg.textContent = text;
  };
  if (params.get('expired')) show('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
  if (params.get('logout')) show('ออกจากระบบเรียบร้อยแล้ว', true);

  const form = document.getElementById('loginForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = form.username.value.trim();
    const password = form.password.value;
    if (!username || !password) return show('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
    const btn = document.getElementById('btnLogin');
    UI.setLoading(btn, true, 'กำลังเข้าสู่ระบบ...');
    try {
      const r = await API.post('/api/auth/login', { username, password });
      API.store.token = r.token;
      API.store.user = r.user;
      location.replace(safeNext);
    } catch (err) {
      show(err.message);
      form.password.value = '';
      form.password.focus();
      UI.setLoading(btn, false);
    }
  });
  form.username.focus();
})();
