/* หน้าจัดการปีการศึกษา — เพิ่ม แก้ไข และดูสมาชิกแยกตามปี */
(function () {
  const { esc, Fmt, toast, modal, confirm, avatar, statusHtml, posBadge, setLoading } = UI;
  Layout.init({ active: 'years', title: 'ปีการศึกษา', subtitle: 'จัดการปีการศึกษาและดูข้อมูลสมาชิกแยกตามปี' });

  const canEdit = Auth.can('settings');
  document.querySelectorAll('[data-icon]').forEach(e => { e.innerHTML = Icons[e.dataset.icon]; });
  const btnAdd = document.getElementById('btnAdd');
  btnAdd.innerHTML = Icons.plus + 'เพิ่มปีการศึกษา';
  btnAdd.hidden = !canEdit;
  btnAdd.addEventListener('click', () => edit());

  let years = [], viewing = null, viewMode = 'position';

  async function load() {
    const body = document.getElementById('yearBody');
    try {
      years = (await API.get('/api/years')).items;
      body.innerHTML = years.map(y => `<tr>
        <td><b style="font-size:17px">${y.year}</b><div class="text-muted text-sm">${esc(y.name)}</div></td>
        <td>${y.start_date ? Fmt.date(y.start_date) + ' – ' + Fmt.date(y.end_date) : '-'}</td>
        <td class="center"><b style="color:var(--primary);font-size:18px">${Fmt.number(y.member_count)}</b></td>
        <td class="center num">${Fmt.number(y.registered_count)}</td>
        <td>${y.is_current ? '<span class="badge green">ปีการศึกษาปัจจุบัน</span>' : '<span class="badge gray">-</span>'}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn btn-sm" data-view="${y.id}">${Icons.eye}ดูสมาชิก</button>
          ${canEdit ? `<button class="icon-btn sm" data-menu="${y.id}" aria-label="ตัวเลือก">${Icons.more}</button>` : ''}
        </td></tr>`).join('') || `<tr><td colspan="6">${UI.emptyHtml('ยังไม่มีปีการศึกษา')}</td></tr>`;
      body.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => showMembers(+b.dataset.view)));
      body.querySelectorAll('[data-menu]').forEach(b => b.addEventListener('click', () => {
        const y = years.find(x => x.id === +b.dataset.menu);
        const items = [{ label: 'แก้ไข', icon: Icons.edit, onClick: () => edit(y) }];
        if (!y.is_current) items.push({ label: 'ตั้งเป็นปีปัจจุบัน', icon: Icons.check, onClick: () => setCurrent(y) });
        items.push('-', { label: 'ลบ', icon: Icons.trash, danger: true, onClick: () => remove(y) });
        UI.popMenu(b, items);
      }));
      if (!viewing && years.length) showMembers((years.find(y => y.is_current) || years[0]).id, false);
    } catch (e) { body.innerHTML = `<tr><td colspan="6">${UI.emptyHtml('โหลดข้อมูลไม่สำเร็จ', e.message)}</td></tr>`; }
  }

  async function showMembers(id, scroll = true) {
    viewing = id;
    const y = years.find(x => x.id === id);
    const card = document.getElementById('yearMembers');
    card.hidden = false;
    document.getElementById('ymTitle').innerHTML = `สมาชิก${esc(y.name)}<div class="card-sub">ทั้งหมด ${Fmt.number(y.member_count)} คน</div>`;
    const tabs = document.getElementById('ymTabs');
    tabs.innerHTML = `<button class="tab ${viewMode === 'position' ? 'active' : ''}" data-m="position">แยกตามตำแหน่ง</button><button class="tab ${viewMode === 'department' ? 'active' : ''}" data-m="department">แยกตามแผนก</button>`;
    tabs.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => { viewMode = b.dataset.m; showMembers(id, false); }));
    const body = document.getElementById('ymBody');
    if (!Auth.can('members.view')) { body.innerHTML = UI.emptyHtml('ไม่มีสิทธิ์ดูรายชื่อสมาชิก'); return; }
    body.innerHTML = UI.loadingHtml();
    if (scroll) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      const r = await API.get('/api/members', { year_id: id, per_page: 500, sort: 'position' });
      const groups = {};
      r.items.forEach(m => {
        const k = viewMode === 'position' ? m.position : (m.department || 'ไม่ระบุแผนก');
        (groups[k] = groups[k] || []).push(m);
      });
      // ตารางเดียว + แถวหัวกลุ่ม เพื่อให้คอลัมน์ทุกกลุ่มตรงกัน
      const byPos = viewMode === 'position';
      body.innerHTML = Object.keys(groups).length ? `<div class="table-wrap"><table class="table group-table">
        <colgroup><col style="width:34%"><col style="width:15%"><col style="width:21%"><col style="width:14%"><col style="width:16%"></colgroup>
        <thead><tr><th>ชื่อ - นามสกุล</th><th>เลขสมาชิก</th><th>${byPos ? 'แผนกวิชา' : 'ตำแหน่ง'}</th><th>สถานะ</th><th>เบอร์ติดต่อ</th></tr></thead>
        ${Object.entries(groups).map(([k, list]) => `<tbody>
          <tr class="group-row"><td colspan="5"><div class="flex">${byPos ? posBadge(k, list[0].position_color) : esc(k)}<span class="badge gray">${list.length} คน</span></div></td></tr>
          ${list.map(m => `<tr>
            <td><div class="person">${avatar(m)}<div><a class="p-main" href="member-view.html?id=${m.id}">${esc(m.full_name)}</a><div class="p-sub">${esc(m.education_level || '')}</div></div></div></td>
            <td class="num">${esc(m.member_no)}</td>
            <td>${byPos ? esc(m.department || '-') : posBadge(m.position, m.position_color)}</td>
            <td>${statusHtml(m.status)}</td><td class="num">${Fmt.phone(m.phone)}</td></tr>`).join('')}
        </tbody>`).join('')}</table></div>`
        : UI.emptyHtml('ยังไม่มีสมาชิกในปีการศึกษานี้');
    } catch (e) { body.innerHTML = UI.emptyHtml('โหลดข้อมูลไม่สำเร็จ', e.message); }
  }

  function edit(y = {}) {
    const isNew = !y.id;
    const next = years.length ? Math.max(...years.map(x => x.year)) + 1 : new Date().getFullYear() + 543;
    UI.formModal({
      title: isNew ? 'เพิ่มปีการศึกษา' : 'แก้ไขปีการศึกษา',
      subtitle: isNew ? 'กรอกปี พ.ศ. ระบบจะเติมวันเริ่มต้นและสิ้นสุดให้' : `แก้ไขข้อมูล${y.name}`,
      icon: 'calendar', submitText: isNew ? 'เพิ่มปีการศึกษา' : 'บันทึกการแก้ไข',
      body: `
        <div class="field col-4"><label for="yf_year">ปีการศึกษา (พ.ศ.) <span class="req">*</span></label><input class="input mono" id="yf_year" name="year" inputmode="numeric" maxlength="4" value="${esc(y.year || next)}"></div>
        <div class="field col-8"><label for="yf_name">ชื่อเรียก</label><input class="input" id="yf_name" name="name" value="${esc(y.name || '')}" placeholder="ปีการศึกษา ${esc(y.year || next)}"></div>
        <div class="field col-6"><label for="yf_start">วันเริ่มต้น</label><input class="input" id="yf_start" type="date" name="start_date" value="${esc(y.start_date || '')}"></div>
        <div class="field col-6"><label for="yf_end">วันสิ้นสุด</label><input class="input" id="yf_end" type="date" name="end_date" value="${esc(y.end_date || '')}"></div>
        <div class="field col-12"><label for="yf_note">หมายเหตุ</label><input class="input" id="yf_note" name="note" value="${esc(y.note || '')}"></div>
        <div class="col-12"><label class="check option-box"><input type="checkbox" name="is_current" ${y.is_current ? 'checked' : ''}>
          <span><b>ตั้งเป็นปีการศึกษาปัจจุบัน</b><small>ใช้เป็นค่าเริ่มต้นใน Dashboard ฟอร์มรับสมาชิก และรายงาน</small></span></label></div>`,
      onReady: (f) => {
        const fill = () => {
          f.year.value = f.year.value.replace(/\D/g, '');
          if (isNew && f.year.value.length === 4) {
            const ce = +f.year.value - 543;
            f.start_date.value = `${ce}-05-16`;
            f.end_date.value = `${ce + 1}-03-31`;
            f.name.placeholder = 'ปีการศึกษา ' + f.year.value;
          }
        };
        f.year.addEventListener('input', fill);
        if (isNew) fill();
      },
      onSubmit: async (f, m) => {
        if (!/^\d{4}$/.test(f.year.value) || +f.year.value < 2400) return m.invalid({ year: 'กรอกปี พ.ศ. 4 หลัก เช่น 2569' });
        if (f.start_date.value && f.end_date.value && f.end_date.value < f.start_date.value) return m.invalid({ end_date: 'วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น' });
        const body = { year: f.year.value, name: f.name.value, start_date: f.start_date.value, end_date: f.end_date.value, note: f.note.value, is_current: f.is_current.checked };
        const r = isNew ? await API.post('/api/years', body) : await API.put('/api/years/' + y.id, body);
        toast(r.message); UI.getMeta(true); load();
      },
    });
  }

  function setCurrent(y) {
    confirm(`ตั้ง ${y.name} เป็นปีการศึกษาปัจจุบันหรือไม่?`, {
      title: 'เปลี่ยนปีการศึกษาปัจจุบัน', variant: 'info', icon: 'calendar', okText: 'ตั้งเป็นปีปัจจุบัน',
      detail: 'Dashboard ฟอร์มรับสมาชิก และรายงาน จะใช้ปีนี้เป็นค่าเริ่มต้น',
      onConfirm: async () => {
        const r = await API.post(`/api/years/${y.id}/set-current`);
        toast(r.message); UI.getMeta(true); load();
      },
    });
  }
  function remove(y) {
    confirm('ต้องการลบปีการศึกษานี้หรือไม่?', {
      title: 'ลบปีการศึกษา', okText: 'ลบปีการศึกษา', item: y.name,
      itemSub: y.member_count ? `มีสมาชิก ${y.member_count} คน` : 'ยังไม่มีสมาชิก',
      detail: 'ลบได้เฉพาะปีที่ยังไม่มีสมาชิกหรือประวัติตำแหน่ง',
      onConfirm: async () => {
        const r = await API.del('/api/years/' + y.id);
        toast(r.message);
        if (viewing === y.id) { viewing = null; document.getElementById('yearMembers').hidden = true; }
        UI.getMeta(true); load();
      },
    });
  }

  load();
})();
