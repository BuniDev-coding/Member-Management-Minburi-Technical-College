/* =====================================================================
   ฟอร์มรับสมาชิก / แก้ไขสมาชิก
   - แบ่งการ์ดตามกลุ่มข้อมูล: ส่วนตัว / สมาชิก / ตำแหน่ง / ประวัติ / รูปแบบการแสดงผล
   - ตรวจสอบเลขสมาชิก 10 หลัก และตรวจซ้ำกับเซิร์ฟเวอร์แบบทันที
   ===================================================================== */
(function () {
  const { esc, options, toast, confirm, setLoading, showFieldErrors, debounce } = UI;
  const id = new URLSearchParams(location.search).get('id');
  const isEdit = !!id;
  Layout.init({ active: isEdit ? 'members' : 'member-form', title: isEdit ? 'แก้ไขข้อมูลสมาชิก' : 'รับสมาชิกใหม่',
    subtitle: isEdit ? 'ปรับปรุงข้อมูลและประวัติสมาชิก' : 'กรอกข้อมูลตามแบบฟอร์มใบสมัครสมาชิกองค์การนักวิชาชีพแห่งประเทศไทย' });
  if (!Auth.require('members.edit')) return;

  const form = document.getElementById('memberForm');
  const MEMBER_NO_RE = /^\d{10}$/;
  const PREFIXES = ['นาย', 'นางสาว', 'นาง', 'เด็กชาย', 'เด็กหญิง'];
  const TPL_DESC = {
    card: ['รูปภาพ ชื่อ และตำแหน่ง แบบการ์ดกระชับ', '<i class="c p" style="left:38%;top:12px;width:24%;height:34px"></i><i style="left:25%;top:52px;width:50%;height:6px"></i><i style="left:33%;top:63px;width:34%;height:5px"></i>'],
    biography: ['รูปภาพพร้อมประวัติส่วนตัว', '<i class="p" style="left:8px;top:8px;width:30%;height:62px"></i><i style="left:42%;top:12px;width:50%;height:7px"></i><i style="left:42%;top:26px;width:48%;height:4px"></i><i style="left:42%;top:35px;width:44%;height:4px"></i><i style="left:42%;top:44px;width:46%;height:4px"></i>'],
    executive: ['ข้อมูลประธาน/รองประธานแบบละเอียด', '<i class="p" style="left:0;top:0;width:100%;height:36px;border-radius:0"></i><i class="c" style="left:10px;top:20px;width:30px;height:30px;background:#fff;border:2px solid #1F4FB5"></i><i style="left:48px;top:44px;width:40%;height:6px"></i><i style="left:10px;top:60px;width:80%;height:4px"></i>'],
    portfolio: ['ประวัติ ผลงาน และกิจกรรม', '<i class="c p" style="left:8px;top:8px;width:22px;height:22px"></i><i style="left:36px;top:14px;width:40%;height:6px"></i><i style="left:8px;top:38px;width:27%;height:32px"></i><i style="left:37%;top:38px;width:27%;height:32px"></i><i style="left:66%;top:38px;width:27%;height:32px"></i>'],
  };

  let meta, member = null, photoFile = null, removePhoto = false, galleryFiles = [];
  let numberState = { ok: false, checking: false };

  init();

  async function init() {
    try {
      meta = await UI.getMeta();
      if (isEdit) member = (await API.get('/api/members/' + id)).member;
      render();
      if (!isEdit) suggestNumber(false);
    } catch (e) {
      form.innerHTML = `<div class="card">${UI.emptyHtml('โหลดข้อมูลไม่สำเร็จ', e.message)}</div>`;
    }
  }

  const v = (k, d = '') => (member && member[k] !== null && member[k] !== undefined ? member[k] : d);
  const field = (name, label, { col = 'col-4', type = 'text', req = false, attrs = '', hint = '', half = true } = {}) => `
    <div class="field ${col} ${half ? 'half' : ''}"><label for="f_${name}">${label}${req ? ' <span class="req">*</span>' : ''}</label>
      <input class="input" id="f_${name}" name="${name}" type="${type}" value="${esc(v(name))}" ${req ? 'required' : ''} ${attrs}>
      ${hint ? `<span class="hint" data-hint="${name}">${hint}</span>` : ''}</div>`;
  const select = (name, label, opts, { col = 'col-4', req = false, half = true } = {}) => `
    <div class="field ${col} ${half ? 'half' : ''}"><label for="f_${name}">${label}${req ? ' <span class="req">*</span>' : ''}</label>
      <select class="select" id="f_${name}" name="${name}" ${req ? 'required' : ''}>${opts}</select></div>`;
  const cardHead = (icon, title, sub, extra = '') => `<div class="card-head"><div class="card-title"><span class="ic">${Icons[icon]}</span><div>${title}<div class="card-sub">${sub}</div></div></div>${extra}</div>`;

  function render() {
    const curYear = meta.current_year_id;
    form.innerHTML = `
      <!-- 1. ข้อมูลส่วนตัว -->
      <div class="card">
        ${cardHead('user', 'ข้อมูลส่วนตัว', 'ชื่อ-นามสกุล รูปถ่าย และข้อมูลบุคคล')}
        <div class="photo-upload" style="margin-bottom:20px">
          <div class="photo-preview" id="photoPreview">${member && member.photo_path ? `<img src="${API.fileUrl(member.photo_path)}" alt="รูปถ่าย">` : Icons.camera}</div>
          <div>
            <div class="label" style="margin-bottom:6px">รูปถ่ายสมาชิก</div>
            <div class="hint" style="margin-bottom:10px">ไฟล์ JPG, PNG, WEBP ขนาดไม่เกิน 5 MB (แนะนำรูปหน้าตรง 3:4)</div>
            <div class="flex">
              <label class="btn btn-sm" for="photoInput">${Icons.upload}เลือกรูปภาพ</label>
              <input type="file" id="photoInput" accept="image/*" hidden>
              <button type="button" class="btn btn-sm btn-light" id="btnRemovePhoto" ${member && member.photo_path ? '' : 'hidden'}>${Icons.trash}ลบรูป</button>
            </div>
          </div>
        </div>
        <div class="form-grid">
          ${select('prefix', 'คำนำหน้า', options(PREFIXES, { selected: v('prefix'), placeholder: '-- เลือก --' }), { col: 'col-2' })}
          ${field('first_name', 'ชื่อ', { req: true, col: 'col-4', attrs: 'maxlength="100"' })}
          ${field('last_name', 'นามสกุล', { req: true, col: 'col-4', attrs: 'maxlength="100"' })}
          ${field('nickname', 'ชื่อเล่น', { col: 'col-2' })}
          ${field('first_name_en', 'ชื่อ (ภาษาอังกฤษ)', { col: 'col-4' })}
          ${field('last_name_en', 'นามสกุล (ภาษาอังกฤษ)', { col: 'col-4' })}
          ${select('gender', 'เพศ', options(['ชาย', 'หญิง', 'อื่น ๆ'], { selected: v('gender'), placeholder: '-- เลือก --' }), { col: 'col-2' })}
          ${field('birth_date', 'วันเกิด', { type: 'date', col: 'col-2' })}
          ${field('national_id', 'เลขประจำตัวประชาชน', { col: 'col-4', attrs: 'inputmode="numeric" maxlength="13" pattern="\\d{13}"', hint: '13 หลัก' })}
          ${field('nationality', 'สัญชาติ', { col: 'col-2' })}
          ${field('religion', 'ศาสนา', { col: 'col-3' })}
          ${select('blood_type', 'กรุ๊ปเลือด', options(['A', 'B', 'O', 'AB'], { selected: v('blood_type'), placeholder: '-' }), { col: 'col-3' })}
        </div>
        <h4 style="margin:26px 0 14px;font-size:15px;color:var(--text-2)">ข้อมูลติดต่อ</h4>
        <div class="form-grid">
          ${field('phone', 'เบอร์โทรศัพท์', { type: 'tel', col: 'col-4', attrs: 'inputmode="tel" maxlength="12" placeholder="0812345678"' })}
          ${field('email', 'อีเมล', { type: 'email', col: 'col-4' })}
          ${field('line_id', 'LINE ID', { col: 'col-2' })}
          ${field('facebook', 'Facebook', { col: 'col-2' })}
          <div class="field col-12"><label for="f_address">ที่อยู่ปัจจุบัน</label><textarea class="textarea" id="f_address" name="address" rows="2" style="min-height:70px">${esc(v('address'))}</textarea></div>
          ${field('parent_name', 'ชื่อผู้ปกครอง', { col: 'col-6' })}
          ${field('parent_phone', 'เบอร์โทรผู้ปกครอง', { type: 'tel', col: 'col-6', attrs: 'inputmode="tel" maxlength="12"' })}
        </div>
      </div>

      <!-- 2. ข้อมูลสมาชิก -->
      <div class="card">
        ${cardHead('flag', 'ข้อมูลสมาชิก', 'เลขสมาชิก ปีการศึกษา แผนกวิชา และสถานะ')}
        <div class="form-grid">
          <div class="field col-4"><label for="f_member_no">เลขสมาชิก (10 หลัก) <span class="req">*</span></label>
            <div class="input-group">
              <input class="input mono" id="f_member_no" name="member_no" value="${esc(v('member_no'))}" inputmode="numeric" maxlength="10" required autocomplete="off">
              <button type="button" class="btn btn-light" id="btnGen" title="สร้างเลขสมาชิกถัดไปอัตโนมัติ">${Icons.refresh}</button>
            </div>
            <span class="hint" id="noHint">ตัวเลข 10 หลัก ห้ามซ้ำ (รูปแบบแนะนำ: ปี พ.ศ. + ลำดับ 6 หลัก)</span>
          </div>
          ${field('student_id', 'เลขประจำตัวนักเรียน/นักศึกษา', { col: 'col-4', attrs: 'inputmode="numeric" maxlength="20"' })}
          ${select('academic_year_id', 'ปีการศึกษา', options(meta.years, { label: 'name', selected: v('academic_year_id', curYear), placeholder: '-- เลือกปีการศึกษา --' }), { col: 'col-4', req: true })}
          ${select('department_id', 'แผนกวิชา', options(meta.departments, { selected: v('department_id'), placeholder: '-- เลือกแผนกวิชา --' }), { col: 'col-4' })}
          ${select('education_level', 'ระดับชั้น', options(meta.levels, { selected: v('education_level'), placeholder: '-- เลือกระดับชั้น --' }), { col: 'col-2' })}
          ${field('class_group', 'กลุ่ม/ห้อง', { col: 'col-2' })}
          ${select('status', 'สถานะสมาชิก', options(Object.entries(meta.statuses).map(([k, l]) => ({ id: k, name: l })), { selected: v('status', 'pending') }), { col: 'col-2' })}
          ${field('joined_date', 'วันที่สมัคร', { type: 'date', col: 'col-2' })}
        </div>
      </div>

      <!-- 3. ตำแหน่ง -->
      <div class="card">
        ${cardHead('award', 'ข้อมูลตำแหน่ง', 'ประวัติการดำรงตำแหน่ง (1 ปีการศึกษา ได้ 1 ตำแหน่ง) — ถ้าไม่ระบุ ระบบจะตั้งเป็นสมาชิกทั่วไป',
          `<button type="button" class="btn btn-sm" data-add="pos">${Icons.plus}เพิ่มตำแหน่ง</button>`)}
        <div class="repeat-list" id="posList"></div>
      </div>

      <!-- 4. ประวัติ -->
      <div class="card">
        ${cardHead('book', 'ประวัติบุคคล', 'ประวัติส่วนตัว ความสามารถ ประวัติการศึกษา ผลงานและกิจกรรม')}
        <div class="form-grid">
          <div class="field col-12"><label for="f_biography">ประวัติส่วนตัว</label><textarea class="textarea" id="f_biography" name="biography" placeholder="แนะนำตัว ความสนใจ เป้าหมาย...">${esc(v('biography'))}</textarea></div>
          <div class="field col-6"><label for="f_skills">ผลงานและความสามารถพิเศษ</label><textarea class="textarea" id="f_skills" name="skills" style="min-height:80px" placeholder="คั่นแต่ละความสามารถด้วยเครื่องหมาย , ">${esc(v('skills'))}</textarea></div>
          <div class="field col-6"><label for="f_vision">วิสัยทัศน์ / คติประจำใจ <span class="hint">(แสดงใน Executive Profile)</span></label><textarea class="textarea" id="f_vision" name="vision" style="min-height:80px">${esc(v('vision'))}</textarea></div>
        </div>
        <div class="flex between" style="margin:26px 0 12px"><h4 style="font-size:15px;color:var(--text-2)">ประวัติการศึกษา</h4><button type="button" class="btn btn-sm" data-add="edu">${Icons.plus}เพิ่ม</button></div>
        <div class="repeat-list" id="eduList"></div>
        <div class="flex between" style="margin:26px 0 12px"><h4 style="font-size:15px;color:var(--text-2)">ประวัติการทำงาน / กิจกรรม / ผลงาน</h4><button type="button" class="btn btn-sm" data-add="act">${Icons.plus}เพิ่ม</button></div>
        <div class="repeat-list" id="actList"></div>
        <div class="flex between" style="margin:26px 0 12px"><h4 style="font-size:15px;color:var(--text-2)">รูปภาพประกอบ</h4>
          <label class="btn btn-sm" for="galleryInput">${Icons.image}เพิ่มรูปภาพ</label><input type="file" id="galleryInput" accept="image/*" multiple hidden></div>
        <div class="gallery-grid" id="gallery"></div>
      </div>

      <!-- 5. รูปแบบการแสดงผล -->
      <div class="card">
        ${cardHead('layout', 'รูปแบบการแสดงประวัติ', 'เลือกรูปแบบที่ใช้เมื่อเปิดดูประวัติสมาชิกจากการสืบค้น')}
        <div class="tpl-picker">${Object.entries(meta.templates).map(([k, l]) => `
          <label class="tpl-option"><input type="radio" name="profile_template" value="${k}" ${v('profile_template', 'card') === k ? 'checked' : ''}>
            <div class="box"><div class="thumb">${TPL_DESC[k][1]}</div><strong>${esc(l)}</strong><small>${TPL_DESC[k][0]}</small></div></label>`).join('')}
        </div>
      </div>

      <div class="save-bar">
        <span class="msg" id="saveMsg">${isEdit ? 'แก้ไขล่าสุด ' + UI.Fmt.datetime(member.updated_at) : 'ช่องที่มี <span class="req">*</span> จำเป็นต้องกรอก'}</span>
        <a class="btn btn-light" href="${isEdit ? 'member-view.html?id=' + id : 'members.html'}">ยกเลิก</a>
        <button type="submit" class="btn btn-primary" id="btnSave">${Icons.check}${isEdit ? 'บันทึกการแก้ไข' : 'บันทึกรับสมาชิก'}</button>
      </div>`;

    // ---- ข้อมูลที่ทำซ้ำได้ ----
    (member ? member.positions : []).forEach(p => addRow('pos', p));
    if (!member || !member.positions.length) addRow('pos', { academic_year_id: curYear, position_id: (meta.positions.find(p => p.name === 'สมาชิกทั่วไป') || {}).id });
    (member ? member.educations : []).forEach(e => addRow('edu', e));
    (member ? member.activities : []).forEach(a => addRow('act', a));
    ['edu', 'act'].forEach(updateEmpty);
    renderGallery();
    bind();
    if (isEdit) checkNumber();
  }

  // ---------------------------------------------------------------------
  // แถวข้อมูล: ตำแหน่ง / การศึกษา / ผลงาน
  // ---------------------------------------------------------------------
  const ROW = {
    pos: { list: 'posList', cls: 'rows-pos', html: (d) => `
      <div><span class="mini-label">ปีการศึกษา</span><select class="select" data-k="academic_year_id">${options(meta.years, { label: 'name', selected: d.academic_year_id, placeholder: '-- ปี --' })}</select></div>
      <div><span class="mini-label">ตำแหน่ง</span><select class="select" data-k="position_id">${options(meta.positions, { selected: d.position_id, placeholder: '-- ตำแหน่ง --' })}</select></div>
      <div><span class="mini-label">เริ่มดำรงตำแหน่ง</span><input class="input" type="date" data-k="start_date" value="${esc(d.start_date || '')}"></div>
      <div><span class="mini-label">สิ้นสุด</span><input class="input" type="date" data-k="end_date" value="${esc(d.end_date || '')}"></div>` },
    edu: { list: 'eduList', cls: 'rows-edu', html: (d) => `
      <div><span class="mini-label">ระดับการศึกษา</span><input class="input" data-k="level" value="${esc(d.level || '')}" placeholder="เช่น ม.3, ปวช."></div>
      <div><span class="mini-label">สถานศึกษา</span><input class="input" data-k="institution" value="${esc(d.institution || '')}"></div>
      <div><span class="mini-label">สาขาวิชา</span><input class="input" data-k="major" value="${esc(d.major || '')}"></div>
      <div><span class="mini-label">ปีที่จบ (พ.ศ.)</span><input class="input" data-k="graduated_year" inputmode="numeric" maxlength="4" value="${esc(d.graduated_year || '')}"></div>
      <div><span class="mini-label">เกรดเฉลี่ย</span><input class="input" data-k="gpa" value="${esc(d.gpa || '')}"></div>` },
    act: { list: 'actList', cls: 'rows-act', html: (d) => `
      <div><span class="mini-label">ประเภท</span><select class="select" data-k="category">${options(Object.entries(meta.activity_categories).map(([k, l]) => ({ id: k, name: l })), { selected: d.category || 'activity' })}</select></div>
      <div><span class="mini-label">ชื่อกิจกรรม / ผลงาน / งาน</span><input class="input" data-k="title" value="${esc(d.title || '')}"></div>
      <div><span class="mini-label">บทบาท / รางวัล</span><input class="input" data-k="role" value="${esc(d.role || '')}"></div>
      <div><span class="mini-label">หน่วยงาน</span><input class="input" data-k="organization" value="${esc(d.organization || '')}"></div>
      <div><span class="mini-label">วันที่</span><input class="input" type="date" data-k="activity_date" value="${esc(d.activity_date || '')}"></div>
      <div style="grid-column:1/-1"><input class="input" data-k="description" value="${esc(d.description || '')}" placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"></div>` },
  };

  function addRow(type, data = {}) {
    const cfg = ROW[type];
    const row = document.createElement('div');
    row.className = 'repeat-row ' + cfg.cls;
    row.dataset.type = type;
    row.innerHTML = cfg.html(data) + `<button type="button" class="icon-btn sm danger remove" aria-label="ลบแถว">${Icons.trash}</button>`;
    row.querySelector('.remove').addEventListener('click', () => { row.remove(); updateEmpty(type); });
    document.getElementById(cfg.list).appendChild(row);
    updateEmpty(type);
    return row;
  }
  function updateEmpty(type) {
    const list = document.getElementById(ROW[type].list);
    const has = list.querySelector('.repeat-row');
    let e = list.querySelector('.empty-row');
    if (!has && !e) list.insertAdjacentHTML('beforeend', '<div class="empty-row">ยังไม่มีข้อมูล — กดปุ่ม "เพิ่ม" เพื่อเพิ่มรายการ</div>');
    if (has && e) e.remove();
  }
  const collect = (type) => [...document.querySelectorAll(`#${ROW[type].list} .repeat-row`)].map(r => {
    const o = {}; r.querySelectorAll('[data-k]').forEach(i => { o[i.dataset.k] = i.value.trim(); }); return o;
  });

  // ---------------------------------------------------------------------
  // รูปภาพประกอบ
  // ---------------------------------------------------------------------
  function renderGallery() {
    const g = document.getElementById('gallery');
    const existing = (member ? member.images : []).map(i => `<div class="gallery-item"><img src="${API.fileUrl(i.image_path)}" alt="${esc(i.caption || '')}">
      <button type="button" class="icon-btn sm danger" data-del-img="${i.id}" aria-label="ลบรูป">${Icons.trash}</button></div>`);
    const fresh = galleryFiles.map((f, i) => `<div class="gallery-item"><img src="${URL.createObjectURL(f)}" alt=""><span class="badge" style="position:absolute;left:6px;bottom:6px">ใหม่</span>
      <button type="button" class="icon-btn sm danger" data-del-new="${i}" aria-label="นำออก">${Icons.x}</button></div>`);
    g.innerHTML = existing.concat(fresh).join('') || '<div class="empty-row" style="grid-column:1/-1">ยังไม่มีรูปภาพประกอบ</div>';
    g.querySelectorAll('[data-del-new]').forEach(b => b.addEventListener('click', () => { galleryFiles.splice(+b.dataset.delNew, 1); renderGallery(); }));
    g.querySelectorAll('[data-del-img]').forEach(b => b.addEventListener('click', () => {
      confirm('ต้องการลบรูปภาพประกอบนี้หรือไม่?', {
        title: 'ลบรูปภาพ', okText: 'ลบรูปภาพ', icon: 'image',
        detail: 'รูปจะถูกลบออกจากระบบทันที แม้ยังไม่กดบันทึกฟอร์ม',
        onConfirm: async () => {
          await API.del(`/api/members/${id}/images/${b.dataset.delImg}`);
          member.images = member.images.filter(i => String(i.id) !== b.dataset.delImg);
          renderGallery(); toast('ลบรูปภาพแล้ว');
        },
      });
    }));
  }

  const validImage = (f) => {
    if (!/^image\/(jpeg|png|gif|webp)$/.test(f.type)) { toast(`${f.name}: อนุญาตเฉพาะไฟล์ JPG, PNG, GIF, WEBP`, 'error'); return false; }
    if (f.size > 5 * 1024 * 1024) { toast(`${f.name}: ขนาดไฟล์เกิน 5 MB`, 'error'); return false; }
    return true;
  };

  // ---------------------------------------------------------------------
  // เลขสมาชิก: ตรวจรูปแบบ (JS) + ตรวจซ้ำกับเซิร์ฟเวอร์
  // ---------------------------------------------------------------------
  function setHint(state, text) {
    const input = form.member_no, hint = document.getElementById('noHint');
    input.classList.toggle('invalid', state === 'error');
    input.classList.toggle('valid', state === 'ok');
    hint.className = 'hint' + (state === 'error' ? ' error' : state === 'ok' ? ' ok' : '');
    hint.textContent = text;
  }
  async function checkNumber() {
    const no = form.member_no.value.trim();
    if (!MEMBER_NO_RE.test(no)) {
      numberState = { ok: false };
      setHint(no ? 'error' : '', no ? `เลขสมาชิกต้องเป็นตัวเลข 10 หลัก (ตอนนี้ ${no.length} หลัก)` : 'ตัวเลข 10 หลัก ห้ามซ้ำ');
      return false;
    }
    numberState = { ok: false, checking: true };
    setHint('', 'กำลังตรวจสอบเลขสมาชิก...');
    try {
      const r = await API.get('/api/members/check-number', { member_no: no, exclude_id: id || '' });
      if (form.member_no.value.trim() !== no) return false;   // ผู้ใช้พิมพ์ต่อแล้ว
      numberState = { ok: r.available };
      setHint(r.available ? 'ok' : 'error', r.available ? '✓ ใช้เลขสมาชิกนี้ได้' : '✗ เลขสมาชิกนี้ถูกใช้แล้ว กรุณาใช้เลขอื่น');
      return r.available;
    } catch (e) { numberState = { ok: false }; setHint('error', e.message); return false; }
  }
  async function suggestNumber(showToast = true) {
    const yid = form.academic_year_id.value;
    const y = meta.years.find(x => String(x.id) === String(yid));
    try {
      const r = await API.get('/api/members/next-number', { year: y ? y.year : '' });
      form.member_no.value = r.member_no;
      checkNumber();
      if (showToast) toast('สร้างเลขสมาชิกอัตโนมัติแล้ว');
    } catch (e) { toast(e.message, 'error'); }
  }

  // ---------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------
  function bind() {
    form.member_no.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
      debouncedCheck();
    });
    const debouncedCheck = debounce(checkNumber, 400);
    document.getElementById('btnGen').addEventListener('click', () => suggestNumber(true));
    ['national_id', 'student_id', 'phone', 'parent_phone'].forEach(n => form[n].addEventListener('input', (e) => { e.target.value = e.target.value.replace(/[^\d]/g, ''); }));

    document.getElementById('photoInput').addEventListener('change', (e) => {
      const f = e.target.files[0]; if (!f || !validImage(f)) { e.target.value = ''; return; }
      photoFile = f; removePhoto = false;
      document.getElementById('photoPreview').innerHTML = `<img src="${URL.createObjectURL(f)}" alt="ตัวอย่างรูป">`;
      document.getElementById('btnRemovePhoto').hidden = false;
    });
    document.getElementById('btnRemovePhoto').addEventListener('click', (e) => {
      photoFile = null; removePhoto = true;
      document.getElementById('photoInput').value = '';
      document.getElementById('photoPreview').innerHTML = Icons.camera;
      e.currentTarget.hidden = true;
    });
    document.getElementById('galleryInput').addEventListener('change', (e) => {
      [...e.target.files].filter(validImage).forEach(f => galleryFiles.push(f));
      e.target.value = ''; renderGallery();
    });
    form.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => {
      const t = b.dataset.add;
      const row = addRow(t, t === 'pos' ? { academic_year_id: form.academic_year_id.value } : {});
      const first = row.querySelector('input, select'); first && first.focus();
    }));
    form.querySelectorAll('.input, .select, .textarea').forEach(el => el.addEventListener('input', () => {
      if (el.name !== 'member_no') { el.classList.remove('invalid'); const fe = el.closest('.field') && el.closest('.field').querySelector('.field-error'); fe && fe.remove(); }
    }));
    form.addEventListener('submit', submit);
  }

  function validate() {
    const errors = {};
    if (!form.first_name.value.trim()) errors.first_name = 'กรุณากรอกชื่อ';
    if (!form.last_name.value.trim()) errors.last_name = 'กรุณากรอกนามสกุล';
    if (!form.academic_year_id.value) errors.academic_year_id = 'กรุณาเลือกปีการศึกษา';
    const no = form.member_no.value.trim();
    if (!MEMBER_NO_RE.test(no)) errors.member_no = 'เลขสมาชิกต้องเป็นตัวเลข 10 หลัก';
    const nid = form.national_id.value.trim();
    if (nid && !/^\d{13}$/.test(nid)) errors.national_id = 'เลขประจำตัวประชาชนต้องเป็นตัวเลข 13 หลัก';
    const email = form.email.value.trim();
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = 'รูปแบบอีเมลไม่ถูกต้อง';
    const phone = form.phone.value.trim();
    if (phone && !/^0\d{8,9}$/.test(phone)) errors.phone = 'เบอร์โทรศัพท์ต้องขึ้นต้นด้วย 0 และมี 9-10 หลัก';
    const years = collect('pos').filter(p => p.academic_year_id && p.position_id).map(p => p.academic_year_id);
    if (new Set(years).size !== years.length) errors._pos = 'ในหนึ่งปีการศึกษาดำรงตำแหน่งได้เพียง 1 ตำแหน่ง';
    return errors;
  }

  async function submit(e) {
    e.preventDefault();
    const errors = validate();
    showFieldErrors(form, errors);
    if (errors.member_no) setHint('error', errors.member_no);
    if (Object.keys(errors).length) {
      toast(errors._pos || 'กรุณาตรวจสอบข้อมูลที่ไม่ถูกต้อง', 'error');
      return;
    }
    if (!numberState.ok && !(await checkNumber())) {
      form.member_no.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return toast('เลขสมาชิกนี้ถูกใช้แล้ว หรือไม่ถูกต้อง', 'error');
    }

    const data = {};
    new FormData(form).forEach((val, k) => { if (typeof val === 'string') data[k] = val.trim(); });
    data.positions = collect('pos').filter(p => p.academic_year_id && p.position_id);
    data.educations = collect('edu').filter(x => x.institution);
    data.activities = collect('act').filter(x => x.title);
    data.remove_photo = removePhoto;

    const fd = new FormData();
    fd.append('data', JSON.stringify(data));
    if (photoFile) fd.append('photo', photoFile);
    galleryFiles.forEach(f => fd.append('gallery', f));

    const btn = document.getElementById('btnSave');
    setLoading(btn, true, 'กำลังบันทึก...');
    try {
      const r = isEdit ? await API.put('/api/members/' + id, fd) : await API.post('/api/members', fd);
      toast(r.message);
      setTimeout(() => { Nav.go('member-view.html?id=' + r.member.id); }, 500);
    } catch (err) {
      setLoading(btn, false);
      toast(err.message, 'error', 5000);
      if (err.data && err.data.errors) {
        showFieldErrors(form, err.data.errors);
        if (err.data.errors.member_no) { numberState.ok = false; setHint('error', err.data.errors.member_no); }
      }
    }
  }
})();
