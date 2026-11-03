/* หน้าจัดการตำแหน่ง และแผนกวิชา */
(function () {
  const { esc, Fmt, toast, modal, confirm, options, avatar, statusHtml, setLoading } = UI;
  Layout.init({ active: 'positions', title: 'จัดการตำแหน่ง', subtitle: 'ประธาน รองประธาน กรรมการ สมาชิกทั่วไป' });

  const canEdit = Auth.can('settings');
  document.querySelectorAll('[data-icon]').forEach(e => { e.innerHTML = Icons[e.dataset.icon]; });
  document.querySelectorAll('[data-perm]').forEach(e => { e.hidden = !Auth.can(e.dataset.perm); });
  document.getElementById('btnAddPos').innerHTML = Icons.plus + 'เพิ่มตำแหน่ง';
  document.getElementById('btnAddDept').innerHTML = Icons.plus + 'เพิ่มแผนกวิชา';
  if (innerWidth < 1000) document.getElementById('posGrid').style.gridTemplateColumns = 'minmax(0,1fr)';

  const yearSel = document.getElementById('yearSel');
  let positions = [], selected = null;

  UI.getMeta().then(meta => {
    yearSel.innerHTML = options(meta.years, { label: 'name', selected: meta.current_year_id });
    yearSel.addEventListener('change', () => { loadPositions(); });
    loadPositions(); loadDepts();
  });

  // ---------------------------------------------------------------------
  // ตำแหน่ง
  // ---------------------------------------------------------------------
  async function loadPositions() {
    const list = document.getElementById('posList');
    try {
      const r = await API.get('/api/positions', { year_id: yearSel.value });
      positions = r.items;
      list.innerHTML = positions.map(p => `
        <div class="list-item" style="cursor:pointer;border-radius:12px;padding:12px 10px;${selected === p.id ? 'background:var(--primary-soft)' : ''}" data-pid="${p.id}">
          <span class="color-chip" style="background:${esc(p.color)}">${Icons.award}</span>
          <div class="grow"><b>${esc(p.name)}</b>
            <div class="text-muted text-sm">ลำดับ ${p.level}${p.is_executive ? ' · ผู้บริหาร' : ''}${p.is_committee ? ' · คณะกรรมการ' : ''}</div></div>
          <div style="text-align:right"><b style="font-size:20px;color:var(--primary)">${Fmt.number(p.count)}</b><div class="text-muted text-sm">คน</div></div>
          ${canEdit ? `<button class="icon-btn sm" data-menu="${p.id}" aria-label="ตัวเลือก">${Icons.more}</button>` : ''}
        </div>`).join('') || UI.emptyHtml('ยังไม่มีตำแหน่ง');
      list.querySelectorAll('[data-pid]').forEach(el => el.addEventListener('click', (e) => {
        if (e.target.closest('[data-menu]')) return;
        selected = +el.dataset.pid; loadPositions();
      }));
      list.querySelectorAll('[data-menu]').forEach(b => b.addEventListener('click', () => {
        const p = positions.find(x => x.id === +b.dataset.menu);
        UI.popMenu(b, [
          { label: 'แก้ไข', icon: Icons.edit, onClick: () => editPosition(p) },
          '-',
          { label: 'ลบ', icon: Icons.trash, danger: true, onClick: () => deletePosition(p) },
        ]);
      }));
      if (!selected && positions.length) { selected = positions[0].id; loadPositions(); return; }
      loadHolders();
    } catch (e) { list.innerHTML = UI.emptyHtml('โหลดข้อมูลไม่สำเร็จ', e.message); }
  }

  async function loadHolders() {
    const p = positions.find(x => x.id === selected);
    const box = document.getElementById('holders');
    if (!p) { box.innerHTML = ''; return; }
    const yearText = yearSel.options[yearSel.selectedIndex].text;
    document.getElementById('holderTitle').innerHTML = `ผู้ดำรงตำแหน่ง${esc(p.name)}<div class="card-sub">${esc(yearText)}</div>`;
    box.innerHTML = UI.loadingHtml();
    if (!Auth.can('members.view')) { box.innerHTML = UI.emptyHtml('ไม่มีสิทธิ์ดูรายชื่อสมาชิก'); return; }
    try {
      const r = await API.get('/api/members', { position_id: p.id, year_id: yearSel.value, per_page: 200, sort: 'name' });
      box.innerHTML = r.items.length ? `<div class="list">${r.items.map(m => `
        <a class="list-item" href="member-view.html?id=${m.id}" style="color:inherit">${avatar(m)}
          <div class="grow"><b>${esc(m.full_name)}</b><div class="text-muted text-sm"><span class="mono">${esc(m.member_no)}</span> · ${esc(m.department || '-')}</div></div>
          ${statusHtml(m.status)}</a>`).join('')}</div>` : UI.emptyHtml('ไม่มีผู้ดำรงตำแหน่งนี้ในปีการศึกษาที่เลือก');
    } catch (e) { box.innerHTML = UI.emptyHtml('โหลดข้อมูลไม่สำเร็จ', e.message); }
  }

  function editPosition(p = {}) {
    const isNew = !p.id;
    UI.formModal({
      title: isNew ? 'เพิ่มตำแหน่ง' : 'แก้ไขตำแหน่ง',
      subtitle: isNew ? 'กำหนดชื่อ ลำดับ และประเภทของตำแหน่ง' : `แก้ไขข้อมูลตำแหน่ง "${p.name}"`,
      icon: 'award', submitText: isNew ? 'เพิ่มตำแหน่ง' : 'บันทึกการแก้ไข',
      body: `
        <div class="field col-8"><label for="pf_name">ชื่อตำแหน่ง <span class="req">*</span></label><input class="input" id="pf_name" name="name" value="${esc(p.name || '')}" maxlength="100" placeholder="เช่น เหรัญญิก"></div>
        <div class="field col-4"><label for="pf_level">ลำดับการแสดง</label><input class="input" id="pf_level" name="level" type="number" min="1" value="${esc(p.level || 5)}"><span class="hint">เลขน้อย = ตำแหน่งสูง</span></div>
        <div class="field col-4"><label for="pf_color">สีประจำตำแหน่ง</label><input class="input" id="pf_color" name="color" type="color" value="${esc(p.color || '#1F4FB5')}" style="padding:4px;cursor:pointer"></div>
        <div class="field col-8"><span class="label">ประเภท</span>
          <div class="check-stack">
            <label class="check"><input type="checkbox" name="is_executive" ${p.is_executive ? 'checked' : ''}> ผู้บริหาร <span class="hint">(ใช้รูปแบบ Executive Profile)</span></label>
            <label class="check"><input type="checkbox" name="is_committee" ${p.is_committee ? 'checked' : ''}> นับเป็นคณะกรรมการ</label>
          </div></div>
        <div class="field col-12"><label for="pf_desc">รายละเอียด / หน้าที่</label><textarea class="textarea" id="pf_desc" name="description" style="min-height:80px">${esc(p.description || '')}</textarea></div>`,
      onSubmit: async (f, m) => {
        if (!f.name.value.trim()) return m.invalid({ name: 'กรุณากรอกชื่อตำแหน่ง' });
        const body = { name: f.name.value, level: f.level.value, color: f.color.value, description: f.description.value,
          is_executive: f.is_executive.checked, is_committee: f.is_committee.checked };
        const r = isNew ? await API.post('/api/positions', body) : await API.put('/api/positions/' + p.id, body);
        toast(r.message); UI.getMeta(true); loadPositions();
      },
    });
  }

  function deletePosition(p) {
    confirm('ต้องการลบตำแหน่งนี้หรือไม่?', {
      title: 'ลบตำแหน่ง', okText: 'ลบตำแหน่ง', item: p.name,
      itemSub: p.total_records ? `มีประวัติการดำรงตำแหน่ง ${p.total_records} รายการ` : 'ยังไม่เคยมีผู้ดำรงตำแหน่ง',
      detail: p.total_records ? 'ตำแหน่งที่มีประวัติการดำรงตำแหน่งจะลบไม่ได้ เพื่อรักษาข้อมูลย้อนหลัง' : 'การลบไม่สามารถย้อนกลับได้',
      onConfirm: async () => {
        const r = await API.del('/api/positions/' + p.id);
        toast(r.message); selected = null; UI.getMeta(true); loadPositions();
      },
    });
  }
  document.getElementById('btnAddPos').addEventListener('click', () => editPosition());

  // ---------------------------------------------------------------------
  // แผนกวิชา
  // ---------------------------------------------------------------------
  async function loadDepts() {
    const body = document.getElementById('deptBody');
    try {
      const r = await API.get('/api/departments');
      body.innerHTML = r.items.map(d => `<tr>
        <td class="num">${esc(d.code || '-')}</td><td>${esc(d.name)}</td><td class="center num">${Fmt.number(d.member_count)}</td>
        <td class="col-act">${canEdit ? `<button class="icon-btn sm" data-dmenu="${d.id}" aria-label="ตัวเลือก">${Icons.more}</button>` : ''}</td></tr>`).join('')
        || `<tr><td colspan="4">${UI.emptyHtml('ยังไม่มีแผนกวิชา')}</td></tr>`;
      body.querySelectorAll('[data-dmenu]').forEach(b => b.addEventListener('click', () => {
        const d = r.items.find(x => x.id === +b.dataset.dmenu);
        UI.popMenu(b, [
          { label: 'แก้ไข', icon: Icons.edit, onClick: () => editDept(d) },
          '-',
          { label: 'ลบ', icon: Icons.trash, danger: true, onClick: () => deleteDept(d) },
        ]);
      }));
    } catch (e) { body.innerHTML = `<tr><td colspan="4">${UI.emptyHtml('โหลดข้อมูลไม่สำเร็จ', e.message)}</td></tr>`; }
  }

  function editDept(d = {}) {
    const isNew = !d.id;
    UI.formModal({
      title: isNew ? 'เพิ่มแผนกวิชา' : 'แก้ไขแผนกวิชา',
      subtitle: isNew ? 'แผนกวิชาที่ใช้เลือกในข้อมูลสมาชิกและรายงาน' : `แก้ไขข้อมูลแผนก "${d.name}"`,
      icon: 'building', size: 'sm', submitText: isNew ? 'เพิ่มแผนกวิชา' : 'บันทึกการแก้ไข',
      body: `
        <div class="field col-12"><label for="df_name">ชื่อแผนกวิชา <span class="req">*</span></label><input class="input" id="df_name" name="name" value="${esc(d.name || '')}" maxlength="120" placeholder="เช่น ช่างยนต์"></div>
        <div class="field col-12"><label for="df_code">รหัสแผนก</label><input class="input" id="df_code" name="code" value="${esc(d.code || '')}" maxlength="20" placeholder="ไม่บังคับ เช่น AUTO"></div>`,
      onSubmit: async (f, m) => {
        if (!f.name.value.trim()) return m.invalid({ name: 'กรุณากรอกชื่อแผนกวิชา' });
        const body = { code: f.code.value, name: f.name.value };
        const r = isNew ? await API.post('/api/departments', body) : await API.put('/api/departments/' + d.id, body);
        toast(r.message); UI.getMeta(true); loadDepts();
      },
    });
  }

  function deleteDept(d) {
    confirm('ต้องการลบแผนกวิชานี้หรือไม่?', {
      title: 'ลบแผนกวิชา', okText: 'ลบแผนกวิชา', item: d.name, itemSub: d.code ? 'รหัส ' + d.code : '',
      detail: d.member_count ? `แผนกนี้มีสมาชิก ${d.member_count} คน จะลบไม่ได้จนกว่าจะย้ายสมาชิกออก` : 'การลบไม่สามารถย้อนกลับได้',
      onConfirm: async () => {
        const r = await API.del('/api/departments/' + d.id);
        toast(r.message); UI.getMeta(true); loadDepts();
      },
    });
  }
  document.getElementById('btnAddDept').addEventListener('click', () => editDept());
})();
