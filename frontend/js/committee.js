/* หน้าคณะกรรมการดำเนินงาน (แบบ อวท.09) — แต่งตั้ง/ถอดถอน แยกตามปีการศึกษา และพิมพ์ประกาศแต่งตั้ง */
(function () {
  const { esc, toast, options, avatar, confirm, setLoading } = UI;
  Layout.init({ active: 'committee', title: 'คณะกรรมการ', subtitle: 'คณะกรรมการดำเนินงานชมรมวิชาชีพ ตามแบบ อวท.09' });
  if (!Auth.require('members.view')) return;

  const canEdit = Auth.can('members.edit');
  document.querySelectorAll('[data-icon]').forEach(e => { e.innerHTML = Icons[e.dataset.icon]; });
  document.querySelectorAll('[data-perm]').forEach(e => { e.hidden = !Auth.can(e.dataset.perm); });
  const btnAppoint = document.getElementById('btnAppoint'), btnDoc = document.getElementById('btnDoc');
  btnAppoint.innerHTML = Icons.plus + 'แต่งตั้งกรรมการ';
  btnDoc.innerHTML = Icons.pdf + 'ประกาศ อวท.09';
  const yearSel = document.getElementById('yearSel'), deptSel = document.getElementById('deptSel');
  let meta, data = null;

  UI.getMeta().then(m => {
    meta = m;
    yearSel.innerHTML = options(meta.years, { label: 'name', selected: meta.current_year_id });
    deptSel.innerHTML = options(meta.departments, { placeholder: 'ทุกแผนก (ระดับองค์การ)' });
    yearSel.addEventListener('change', load);
    deptSel.addEventListener('change', load);
    load();
  });

  async function load() {
    const body = document.getElementById('cmBody');
    body.innerHTML = UI.loadingHtml();
    try {
      data = await API.get('/api/committee', { year_id: yearSel.value, department_id: deptSel.value });
      document.getElementById('cmSub').textContent = `${data.year.name} — คณะกรรมการ ${data.total} คน`;
      body.innerHTML = `<div class="table-wrap"><table class="table group-table" style="min-width:640px">
        <colgroup><col style="width:38%"><col style="width:16%"><col style="width:30%"><col style="width:16%"></colgroup>
        <thead><tr><th>ชื่อ - นามสกุล</th><th>รหัสประจำตัว</th><th>ระดับชั้น / แผนกวิชา</th><th></th></tr></thead>
        ${data.items.map(p => `<tbody>
          <tr class="group-row"><td colspan="4"><div class="flex">${UI.posBadge(p.name, p.color)}<span class="badge gray">${p.holders.length} คน</span>${p.name === 'กรรมการ' && p.holders.length > 18 ? '<span class="badge red">เกิน 18 คนตามแบบ อวท.09</span>' : ''}
            ${canEdit ? `<button class="btn btn-sm btn-light" data-add="${p.id}" style="margin-left:auto">${Icons.plus}เพิ่ม</button>` : ''}</div></td></tr>
          ${p.holders.length ? p.holders.map(m => `<tr>
            <td><div class="person">${avatar(m)}<div><a class="p-main" href="member-view.html?id=${m.id}">${esc(m.full_name)}</a><div class="p-sub mono">${esc(m.member_no)}</div></div></div></td>
            <td class="num">${esc(m.student_id || '-')}</td>
            <td>${esc([m.education_level, m.department].filter(Boolean).join(' · ') || '-')}</td>
            <td style="text-align:right">${canEdit ? `<button class="btn btn-sm btn-light" data-remove="${m.mp_id}" data-name="${esc(m.full_name)}" data-pos="${esc(p.name)}">${Icons.x}ถอดถอน</button>` : ''}</td></tr>`).join('')
            : '<tr><td colspan="4" class="text-muted text-sm" style="padding:12px 14px">ยังไม่มีผู้ดำรงตำแหน่ง</td></tr>'}
        </tbody>`).join('')}</table></div>`;
      body.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => appoint(+b.dataset.add)));
      body.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => remove(b.dataset)));
    } catch (e) { body.innerHTML = UI.emptyHtml('โหลดข้อมูลไม่สำเร็จ', e.message); }
  }

  function appoint(positionId) {
    if (!data) return;
    const committeePositions = data ? data.items : [];
    let picked = null;
    const m = UI.formModal({
      title: 'แต่งตั้งคณะกรรมการ', subtitle: data ? data.year.name : '', icon: 'briefcase', submitText: 'แต่งตั้ง',
      body: `
        <div class="field col-12"><label for="cf_member">สมาชิก <span class="req">*</span></label>
          <input class="input" id="cf_member" name="member_q" placeholder="พิมพ์ชื่อ เลขสมาชิก หรือรหัสประจำตัว"></div>
        <div class="field col-12"><label for="cf_pos">ตำแหน่ง <span class="req">*</span></label>
          <select class="select" id="cf_pos" name="position_id">${options(committeePositions, { selected: positionId, placeholder: '-- เลือกตำแหน่ง --' })}</select>
          <span class="hint">ในหนึ่งปีการศึกษาดำรงได้ 1 ตำแหน่ง — ถ้ามีตำแหน่งอยู่แล้วจะถูกเปลี่ยนเป็นตำแหน่งนี้</span></div>
        <div class="field col-6"><label for="cf_start">เริ่มดำรงตำแหน่ง</label><input class="input" type="date" id="cf_start" name="start_date" value="${esc(data.year.start_date || '')}"></div>
        <div class="field col-6"><label for="cf_end">สิ้นสุด</label><input class="input" type="date" id="cf_end" name="end_date" value="${esc(data.year.end_date || '')}"></div>`,
      onReady: (f) => {
        MemberPicker.attach(f.querySelector('#cf_member'), { onPick: (mm) => { picked = mm; } });
        setTimeout(() => f.querySelector('#cf_member').focus(), 50);
      },
      onSubmit: async (f, mm) => {
        if (!picked) return mm.invalid({ member_q: 'กรุณาค้นหาและเลือกสมาชิกจากรายการ' });
        if (!f.position_id.value) return mm.invalid({ position_id: 'กรุณาเลือกตำแหน่ง' });
        const r = await API.post('/api/committee', { academic_year_id: yearSel.value, position_id: f.position_id.value,
          member_id: picked.id, start_date: f.start_date.value, end_date: f.end_date.value });
        toast(r.message); load();
      },
    });
    return m;
  }

  function remove(d) {
    confirm(`ถอด ${d.name} ออกจากตำแหน่ง${d.pos}หรือไม่?`, {
      title: 'ถอดถอนกรรมการ', okText: 'ถอดถอน', icon: 'briefcase',
      detail: 'สมาชิกยังอยู่ในปีการศึกษานี้ในฐานะสมาชิกทั่วไป',
      onConfirm: async () => { const r = await API.del('/api/committee/' + d.remove); toast(r.message); load(); },
    });
  }

  btnAppoint.addEventListener('click', () => appoint(''));
  btnDoc.addEventListener('click', () => {
    const dept = meta.departments.find(x => String(x.id) === deptSel.value);
    const today = new Date().toISOString().slice(0, 10);
    UI.formModal({
      title: 'ประกาศแต่งตั้งคณะกรรมการ (อวท.09)', subtitle: data ? data.year.name : '', icon: 'pdf', submitText: 'สร้างเอกสาร', note: false,
      body: `
        <div class="field col-12"><label for="df_club">ชื่อชมรมวิชาชีพ</label><input class="input" id="df_club" name="club" value="${esc(dept ? dept.name : '')}" placeholder="เว้นว่าง = ชมรมวิชาชีพ........../ชมรม.......... (เขียนด้วยมือ)"></div>
        <div class="field col-6"><label for="df_ad">ประกาศ ณ วันที่</label><input class="input" type="date" id="df_ad" name="announce_date" value="${today}"></div>
        <div class="field col-6"><label for="df_sn">ผู้อำนวยการวิทยาลัย (ผู้ลงนาม)</label><input class="input" id="df_sn" name="signer_name" placeholder="เว้นว่าง = เขียนด้วยมือ"></div>
        <div class="field col-12"><span class="label">รูปแบบไฟล์</span><div class="flex">
          <label class="check"><input type="radio" name="format" value="pdf" checked> PDF (ประกาศ)</label>
          <label class="check"><input type="radio" name="format" value="xlsx"> Excel (รายชื่อ)</label></div></div>`,
      onSubmit: async (f) => {
        const fmt = f.querySelector('[name=format]:checked').value;
        await API.download('/api/committee/document', { year_id: yearSel.value, department_id: deptSel.value, club: f.club.value,
          announce_date: f.announce_date.value, signer_name: f.signer_name.value, format: fmt }, `avt09.${fmt}`);
        toast('สร้างเอกสารเรียบร้อย');
      },
    });
  });
})();
