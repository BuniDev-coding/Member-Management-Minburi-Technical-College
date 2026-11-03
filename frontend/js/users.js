/* หน้าจัดการผู้ใช้งาน และสำรองข้อมูล */
(function () {
  const { esc, Fmt, toast, modal, confirm, avatar, setLoading, options } = UI;
  Layout.init({ active: 'users', title: 'ผู้ใช้งาน', subtitle: 'บัญชี Admin สิทธิ์การเข้าถึง และการสำรองข้อมูล' });
  if (!Auth.canAny('users', 'backup')) { Auth.require('users'); return; }

  document.querySelectorAll('[data-icon]').forEach(e => { e.innerHTML = Icons[e.dataset.icon]; });
  let permInfo = null, users = [];

  // =====================================================================
  // ผู้ใช้งาน
  // =====================================================================
  if (Auth.can('users')) {
    document.getElementById('usersCard').hidden = false;
    const add = document.getElementById('btnAddUser');
    add.innerHTML = Icons.userPlus + 'เพิ่มผู้ใช้งาน';
    add.addEventListener('click', () => edit());
    API.get('/api/users/permissions').then(r => { permInfo = r; loadUsers(); });
  }

  async function loadUsers() {
    const body = document.getElementById('userBody');
    try {
      users = (await API.get('/api/users')).items;
      const me = Auth.user || {};
      body.innerHTML = users.map(u => `<tr>
        <td><div class="person">${avatar({ first_name: u.full_name, id: u.id })}<div><div class="p-main">${esc(u.full_name)}${u.id === me.id ? ' <span class="badge">คุณ</span>' : ''}</div><div class="p-sub">@${esc(u.username)}${u.email ? ' · ' + esc(u.email) : ''}</div></div></div></td>
        <td><span class="badge ${u.role === 'superadmin' ? '' : u.role === 'admin' ? 'green' : 'gray'}">${esc(permInfo.roles[u.role])}</span></td>
        <td style="max-width:320px"><div class="flex" style="gap:5px">${u.permissions.map(p => `<span class="badge gray" title="${esc(permInfo.permissions[p])}">${esc(permInfo.permissions[p])}</span>`).join('') || '-'}</div></td>
        <td class="text-sm">${u.last_login ? Fmt.datetime(u.last_login) : '<span class="text-muted">ยังไม่เคยเข้าระบบ</span>'}</td>
        <td><span class="status ${u.is_active ? 'active' : 'inactive'}">${u.is_active ? 'ใช้งาน' : 'ระงับ'}</span></td>
        <td class="col-act"><button class="icon-btn sm" data-menu="${u.id}" aria-label="ตัวเลือก">${Icons.more}</button></td></tr>`).join('');
      body.querySelectorAll('[data-menu]').forEach(b => b.addEventListener('click', () => {
        const u = users.find(x => x.id === +b.dataset.menu);
        const items = [{ label: 'แก้ไข / กำหนดสิทธิ์', icon: Icons.edit, onClick: () => edit(u) }];
        if (u.id !== me.id) items.push('-', { label: 'ลบผู้ใช้งาน', icon: Icons.trash, danger: true, onClick: () => remove(u) });
        UI.popMenu(b, items);
      }));
    } catch (e) { body.innerHTML = `<tr><td colspan="6">${UI.emptyHtml('โหลดข้อมูลไม่สำเร็จ', e.message)}</td></tr>`; }
  }

  function edit(u = null) {
    const isNew = !u;
    u = u || { role: 'staff', permissions: permInfo.role_defaults.staff, is_active: true };
    const roles = Object.entries(permInfo.roles)
      .filter(([k]) => k !== 'superadmin' || (Auth.user && Auth.user.role === 'superadmin'))
      .map(([k, v]) => ({ id: k, name: v }));
    UI.formModal({
      title: isNew ? 'เพิ่มผู้ใช้งาน' : 'แก้ไขผู้ใช้งาน', size: 'lg', icon: isNew ? 'userPlus' : 'shield',
      subtitle: isNew ? 'สร้างบัญชีเจ้าหน้าที่และกำหนดสิทธิ์การเข้าถึง' : `บัญชี @${u.username}`,
      submitText: isNew ? 'เพิ่มผู้ใช้งาน' : 'บันทึกการแก้ไข',
      body: `
        <div class="col-12 form-section mt-0">ข้อมูลบัญชี</div>
        <div class="field col-6"><label for="uf_user">ชื่อผู้ใช้ (สำหรับเข้าสู่ระบบ) <span class="req">*</span></label><input class="input" id="uf_user" name="username" value="${esc(u.username || '')}" ${isNew ? 'placeholder="เช่น somchai.j"' : 'readonly'}></div>
        <div class="field col-6"><label for="uf_name">ชื่อ-นามสกุล <span class="req">*</span></label><input class="input" id="uf_name" name="full_name" value="${esc(u.full_name || '')}"></div>
        <div class="field col-6"><label for="uf_email">อีเมล</label><input class="input" id="uf_email" type="email" name="email" value="${esc(u.email || '')}"></div>
        <div class="field col-6"><label for="uf_pass">${isNew ? 'รหัสผ่าน <span class="req">*</span>' : 'รีเซ็ตรหัสผ่าน'}</label><input class="input" id="uf_pass" type="password" name="password" autocomplete="new-password" placeholder="${isNew ? 'อย่างน้อย 8 ตัวอักษร' : 'เว้นว่างถ้าไม่เปลี่ยน'}"></div>
        <div class="field col-6"><label for="uf_role">บทบาท</label><select class="select" id="uf_role" name="role">${options(roles, { selected: u.role })}</select><span class="hint">เปลี่ยนบทบาทจะตั้งสิทธิ์เริ่มต้นให้ ปรับเพิ่มลดเองได้</span></div>
        <div class="field col-6"><span class="label">สถานะบัญชี</span><label class="check option-box"><span class="switch"><input type="checkbox" name="is_active" ${u.is_active ? 'checked' : ''}><span></span></span>
          <span><b>เปิดใช้งาน</b><small>ปิดเพื่อระงับการเข้าสู่ระบบชั่วคราว</small></span></label></div>
        <div class="col-12 form-section">สิทธิ์การเข้าถึง</div>
        <div class="col-12">
          <div class="perm-grid">${Object.entries(permInfo.permissions).map(([k, v]) =>
            `<label class="check"><input type="checkbox" name="perm" value="${k}" ${u.permissions.includes(k) ? 'checked' : ''}> ${esc(v)}</label>`).join('')}</div>
          <p class="hint" data-superhint ${u.role === 'superadmin' ? '' : 'hidden'} style="margin:8px 0 0">ผู้ดูแลระบบสูงสุดได้รับทุกสิทธิ์โดยอัตโนมัติ</p>
        </div>`,
      onReady: (f) => {
        const syncSuper = () => {
          const sup = f.role.value === 'superadmin';
          f.querySelectorAll('[name=perm]').forEach(c => { c.disabled = sup; if (sup) c.checked = true; });
          f.querySelector('[data-superhint]').hidden = !sup;
        };
        f.role.addEventListener('change', () => {   // ตั้งสิทธิ์เริ่มต้นตามบทบาท
          const defs = permInfo.role_defaults[f.role.value] || [];
          f.querySelectorAll('[name=perm]').forEach(c => { c.checked = defs.includes(c.value); });
          syncSuper();
        });
        syncSuper();
      },
      onSubmit: async (f, m) => {
        const errs = {};
        if (isNew && !/^[\w.]{3,}$/.test(f.username.value.trim())) errs.username = 'อย่างน้อย 3 ตัว ใช้ได้เฉพาะ a-z, 0-9, _ และ .';
        if (!f.full_name.value.trim()) errs.full_name = 'กรุณากรอกชื่อ-นามสกุล';
        if (f.email.value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.value)) errs.email = 'รูปแบบอีเมลไม่ถูกต้อง';
        if ((isNew || f.password.value) && f.password.value.length < 8) errs.password = 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
        if (Object.keys(errs).length) return m.invalid(errs);
        const body = { username: f.username.value.trim(), full_name: f.full_name.value, email: f.email.value, role: f.role.value,
          is_active: f.is_active.checked, password: f.password.value,
          permissions: [...f.querySelectorAll('[name=perm]:checked')].map(c => c.value) };
        const r = isNew ? await API.post('/api/users', body) : await API.put('/api/users/' + u.id, body);
        toast(r.message); loadUsers();
        if (!isNew && Auth.user && u.id === Auth.user.id) Auth.refresh().then(() => location.reload());
      },
    });
  }

  function remove(u) {
    confirm('ต้องการลบบัญชีผู้ใช้งานนี้หรือไม่?', {
      title: 'ลบผู้ใช้งาน', okText: 'ลบผู้ใช้งาน', item: u.full_name, itemSub: '@' + u.username,
      detail: 'ผู้ใช้นี้จะเข้าสู่ระบบไม่ได้อีก หากต้องการระงับชั่วคราว ให้ปิดการใช้งานบัญชีแทน',
      onConfirm: async () => { const r = await API.del('/api/users/' + u.id); toast(r.message); loadUsers(); },
    });
  }

  // =====================================================================
  // สำรองข้อมูล
  // =====================================================================
  if (Auth.can('backup')) {
    document.getElementById('backupCard').hidden = false;
    const btn = document.getElementById('btnBackup');
    btn.innerHTML = Icons.database + 'สำรองข้อมูลตอนนี้';
    btn.addEventListener('click', async () => {
      setLoading(btn, true, 'กำลังสำรองข้อมูล...');
      try { const r = await API.post('/api/backups'); toast(r.message); loadBackups(); }
      catch (e) { toast(e.message, 'error'); } finally { setLoading(btn, false); }
    });
    loadBackups();
  }

  async function loadBackups() {
    const body = document.getElementById('backupBody');
    try {
      const items = (await API.get('/api/backups')).items;
      body.innerHTML = items.map(b => `<tr>
        <td class="num">${Icons.database.replace('<svg', '<svg style="width:16px;vertical-align:-3px;color:var(--primary);margin-right:6px"')}${esc(b.name)}</td>
        <td>${Fmt.datetime(b.created_at)}</td><td class="num">${Fmt.size(b.size)}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn btn-sm" data-dl="${esc(b.name)}">${Icons.download}ดาวน์โหลด</button>
          <button class="icon-btn sm danger" data-del="${esc(b.name)}" aria-label="ลบไฟล์สำรอง">${Icons.trash}</button>
        </td></tr>`).join('') || `<tr><td colspan="4">${UI.emptyHtml('ยังไม่มีไฟล์สำรอง', 'กดปุ่ม "สำรองข้อมูลตอนนี้" เพื่อสร้างไฟล์สำรองแรก')}</td></tr>`;
      body.querySelectorAll('[data-dl]').forEach(b => b.addEventListener('click', async () => {
        setLoading(b, true);
        try { await API.download('/api/backups/' + b.dataset.dl, null, b.dataset.dl); } catch (e) { toast(e.message, 'error'); } finally { setLoading(b, false); }
      }));
      body.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
        const it = items.find(x => x.name === b.dataset.del) || {};
        confirm('ต้องการลบไฟล์สำรองนี้หรือไม่?', {
          title: 'ลบไฟล์สำรอง', okText: 'ลบไฟล์', item: b.dataset.del,
          itemSub: it.created_at ? `สำรองเมื่อ ${Fmt.datetime(it.created_at)} · ${Fmt.size(it.size)}` : '',
          detail: 'ถ้าลบแล้วจะกู้คืนข้อมูลจากไฟล์นี้ไม่ได้',
          onConfirm: async () => { const r = await API.del('/api/backups/' + b.dataset.del); toast(r.message); loadBackups(); },
        });
      }));
    } catch (e) { body.innerHTML = `<tr><td colspan="4">${UI.emptyHtml('โหลดข้อมูลไม่สำเร็จ', e.message)}</td></tr>`; }
  }
})();
