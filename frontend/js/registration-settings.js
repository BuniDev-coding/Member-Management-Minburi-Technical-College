/* =====================================================================
   หน้าตั้งค่าข้อมูลการสมัคร
   - ตัวเลือกในดรอปดาวน์ของแบบฟอร์มสมัคร (คำนำหน้า เพศ กรุ๊ปเลือด ระดับชั้น ระดับสมาชิก)
   - ข้อมูลที่อยู่: จังหวัด → อำเภอ/เขต → ตำบล/แขวง + รหัสไปรษณีย์ (เพิ่ม / แก้ไข / ลบ)
   ===================================================================== */
(function () {
  const { esc, Fmt, toast, confirm } = UI;
  Layout.init({ active: 'registration-settings', title: 'ตั้งค่าข้อมูลการสมัคร',
    subtitle: 'ตัวเลือกในแบบฟอร์มสมัคร และข้อมูลจังหวัด อำเภอ ตำบล รหัสไปรษณีย์' });
  if (!Auth.require('settings')) return;

  const $ = (id) => document.getElementById(id);
  document.querySelectorAll('[data-icon]').forEach(e => { e.innerHTML = Icons[e.dataset.icon]; });
  document.querySelectorAll('[data-add]').forEach(b => { b.innerHTML = Icons.plus + 'เพิ่ม'; });

  // ---------------------------------------------------------------------
  // ตัวเลือกในดรอปดาวน์
  // ---------------------------------------------------------------------
  const NOTES = {
    member_type: 'ระดับสมาชิกใช้พิมพ์ช่อง "บันทึกของเจ้าหน้าที่" ในใบสมัครแบบ อวท.10 ด้วย — พิมพ์เป็น "ประเภท ระดับ" เช่น "สามัญ ระดับจังหวัด"',
    education_level: 'ระดับชั้นใช้เป็นตัวกรองในหน้าสมาชิกและรายงานด้วย',
  };
  let categories = [], activeCat = 'prefix';
  const cat = () => categories.find(c => c.key === activeCat) || categories[0];

  async function loadOptions() {
    try {
      categories = (await API.get('/api/options')).categories;
      renderOptions();
    } catch (e) { $('optBody').innerHTML = `<tr><td colspan="4">${UI.emptyHtml('โหลดข้อมูลไม่สำเร็จ', e.message)}</td></tr>`; }
  }

  function renderOptions() {
    const c = cat();
    $('optTabs').innerHTML = categories.map(x =>
      `<button type="button" class="tab ${x.key === c.key ? 'active' : ''}" data-cat="${x.key}">${esc(x.label)} (${x.items.length})</button>`).join('');
    $('btnAddOpt').innerHTML = Icons.plus + 'เพิ่ม' + esc(c.label);
    $('optNote').textContent = NOTES[c.key] || '';
    const n = c.items.length;
    $('optBody').innerHTML = c.items.map((o, i) => `<tr>
        <td class="num">${i + 1}</td>
        <td><b>${esc(o.name)}</b></td>
        <td class="center num">${o.member_count ? Fmt.number(o.member_count) + ' คน' : '<span class="text-muted">-</span>'}</td>
        <td><div class="flex" style="justify-content:flex-end;gap:6px;flex-wrap:nowrap">
          <button class="icon-btn sm" data-move="-1" data-i="${i}" ${i === 0 ? 'disabled' : ''} title="เลื่อนขึ้น" aria-label="เลื่อนขึ้น">${Icons.arrowUp}</button>
          <button class="icon-btn sm" data-move="1" data-i="${i}" ${i === n - 1 ? 'disabled' : ''} title="เลื่อนลง" aria-label="เลื่อนลง">${Icons.arrowDown}</button>
          <button class="icon-btn sm" data-edit="${i}" title="แก้ไข" aria-label="แก้ไข">${Icons.edit}</button>
          <button class="icon-btn sm danger" data-del="${i}" title="ลบ" aria-label="ลบ">${Icons.trash}</button>
        </div></td></tr>`).join('')
      || `<tr><td colspan="4">${UI.emptyHtml('ยังไม่มีตัวเลือก', 'ช่องนี้ในแบบฟอร์มสมัครจะไม่มีรายการให้เลือก')}</td></tr>`;
  }

  $('optTabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]'); if (!b) return;
    activeCat = b.dataset.cat; renderOptions();
  });
  $('optBody').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    const c = cat();
    if (b.dataset.move) moveOption(+b.dataset.i, +b.dataset.move);
    else if (b.dataset.edit) editOption(c.items[+b.dataset.edit]);
    else if (b.dataset.del) deleteOption(c.items[+b.dataset.del]);
  });
  $('btnAddOpt').addEventListener('click', () => editOption());

  async function moveOption(i, dir) {
    const c = cat(), j = i + dir;
    if (j < 0 || j >= c.items.length) return;
    [c.items[i], c.items[j]] = [c.items[j], c.items[i]];
    renderOptions();
    try { await API.post('/api/options/reorder', { category: c.key, ids: c.items.map(o => o.id) }); UI.getMeta(true); }
    catch (e) { toast(e.message, 'error'); loadOptions(); }
  }

  function editOption(o = {}) {
    const c = cat(), isNew = !o.id;
    UI.formModal({
      title: (isNew ? 'เพิ่ม' : 'แก้ไข') + c.label,
      subtitle: isNew ? 'เพิ่มตัวเลือกในช่อง "' + c.label + '" ของแบบฟอร์มสมัคร' : `แก้ไขตัวเลือก "${o.name}"`,
      icon: isNew ? 'plus' : 'edit', size: 'sm', submitText: isNew ? 'เพิ่มตัวเลือก' : 'บันทึกการแก้ไข',
      body: `<div class="field col-12"><label for="of_name">${esc(c.label)} <span class="req">*</span></label>
          <input class="input" id="of_name" name="name" value="${esc(o.name || '')}" maxlength="${c.max_length}">
          ${!isNew && o.member_count ? `<span class="hint">สมาชิก ${Fmt.number(o.member_count)} คนที่ใช้ตัวเลือกนี้จะถูกเปลี่ยนตามชื่อใหม่</span>` : ''}</div>`,
      onSubmit: async (f, m) => {
        if (!f.name.value.trim()) return m.invalid({ name: 'กรุณากรอก' + c.label });
        const r = isNew ? await API.post('/api/options', { category: c.key, name: f.name.value })
          : await API.put('/api/options/' + o.id, { name: f.name.value });
        toast(r.message); UI.getMeta(true); loadOptions();
      },
    });
  }

  function deleteOption(o) {
    const c = cat();
    confirm('ต้องการลบตัวเลือกนี้หรือไม่?', {
      title: 'ลบ' + c.label, okText: 'ลบตัวเลือก', item: o.name,
      itemSub: o.member_count ? `มีสมาชิกใช้ตัวเลือกนี้ ${Fmt.number(o.member_count)} คน` : 'ยังไม่มีสมาชิกใช้ตัวเลือกนี้',
      detail: o.member_count ? 'ข้อมูลของสมาชิกที่เลือกไว้แล้วจะไม่เปลี่ยน แต่จะเลือกตัวเลือกนี้กับสมาชิกรายอื่นไม่ได้อีก' : 'ตัวเลือกนี้จะหายไปจากแบบฟอร์มสมัคร',
      onConfirm: async () => {
        const r = await API.del('/api/options/' + o.id);
        toast(r.message); UI.getMeta(true); loadOptions();
      },
    });
  }

  // ---------------------------------------------------------------------
  // ข้อมูลที่อยู่
  // ---------------------------------------------------------------------
  const BKK = 'กรุงเทพมหานคร';
  let provinces = [], districts = [], subdistricts = [];
  let pvId = null, dsId = null;
  const pv = () => provinces.find(p => p.id === pvId);
  const ds = () => districts.find(d => d.id === dsId);
  const isBkk = () => (pv() || {}).name === BKK;
  const words = () => (isBkk() ? { district: 'เขต', subdistrict: 'แขวง' } : { district: 'อำเภอ', subdistrict: 'ตำบล' });
  const match = (q, ...vals) => !q || vals.some(v => String(v || '').includes(q));
  const hint = (text) => `<div class="addr-empty">${esc(text)}</div>`;
  const row = (kind, o, selected, sub, right = '') => `
    <div class="addr-item ${selected ? 'selected' : ''}" data-kind="${kind}" data-id="${o.id}" ${kind === 'subdistrict' ? '' : 'tabindex="0" role="button"'}>
      <div class="grow"><b>${esc(o.name)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>${right}
      <button class="icon-btn sm" data-menu aria-label="ตัวเลือก">${Icons.more}</button></div>`;

  function renderProvinces() {
    const q = $('pvSearch').value.trim();
    const list = provinces.filter(p => match(q, p.name));
    $('pvCount').textContent = Fmt.number(provinces.length);
    $('pvList').innerHTML = list.map(p => row('province', p, p.id === pvId, `${Fmt.number(p.district_count)} อำเภอ/เขต`)).join('')
      || hint(q ? 'ไม่พบจังหวัดที่ค้นหา' : 'ยังไม่มีจังหวัด');
  }
  function renderDistricts() {
    const w = words(), p = pv();
    $('dsTitle').textContent = p ? `${w.district}ใน${p.name}` : 'อำเภอ / เขต';
    $('dsCount').textContent = p ? Fmt.number(districts.length) : '';
    document.querySelector('[data-add="district"]').disabled = !p;
    if (!p) { $('dsList').innerHTML = hint('เลือกจังหวัดทางซ้ายก่อน'); return; }
    const q = $('dsSearch').value.trim();
    const list = districts.filter(d => match(q, d.name, ...d.postal_codes));
    $('dsList').innerHTML = list.map(d => row('district', d, d.id === dsId,
      `${Fmt.number(d.subdistrict_count)} ${w.subdistrict}${d.postal_codes.length ? ' · ' + d.postal_codes.join(', ') : ''}`)).join('')
      || hint(q ? 'ไม่พบรายการที่ค้นหา' : `ยังไม่มี${w.district} — กด "เพิ่ม"`);
  }
  function renderSubdistricts() {
    const w = words(), d = ds();
    $('sdTitle').textContent = d ? `${w.subdistrict}ใน${d.prefix || ''}${d.name}` : 'ตำบล / แขวง';
    $('sdCount').textContent = d ? Fmt.number(subdistricts.length) : '';
    document.querySelector('[data-add="subdistrict"]').disabled = !d;
    if (!d) { $('sdList').innerHTML = hint(pv() ? `เลือก${w.district}ก่อน` : 'เลือกจังหวัดและอำเภอ/เขตก่อน'); return; }
    const q = $('sdSearch').value.trim();
    const list = subdistricts.filter(s => match(q, s.name, s.postal_code));
    $('sdList').innerHTML = list.map(s => row('subdistrict', s, false, '', `<span class="badge mono" title="รหัสไปรษณีย์">${esc(s.postal_code)}</span>`)).join('')
      || hint(q ? 'ไม่พบรายการที่ค้นหา' : `ยังไม่มี${w.subdistrict} — กด "เพิ่ม" พร้อมรหัสไปรษณีย์`);
  }

  async function loadProvinces() {
    provinces = (await API.get('/api/address/provinces')).items;
    if (pvId && !pv()) { pvId = null; dsId = null; districts = []; subdistricts = []; }
    renderProvinces();
  }
  async function loadDistricts() {
    districts = pvId ? (await API.get('/api/address/districts', { province_id: pvId })).items : [];
    if (dsId && !ds()) { dsId = null; subdistricts = []; }
    renderDistricts();
  }
  async function loadSubdistricts() {
    subdistricts = dsId ? (await API.get('/api/address/subdistricts', { district_id: dsId })).items : [];
    renderSubdistricts();
  }
  /** โหลดใหม่ตั้งแต่ระดับที่เปลี่ยนลงไป (จำนวนของระดับบนเปลี่ยนตามด้วย) */
  async function reload() {
    try { await loadProvinces(); await loadDistricts(); await loadSubdistricts(); }
    catch (e) { toast(e.message, 'error'); }
  }

  async function selectProvince(id) {
    pvId = id; dsId = null; subdistricts = [];
    $('dsSearch').value = ''; $('sdSearch').value = '';
    renderProvinces();
    $('dsList').innerHTML = UI.loadingHtml();
    try { await loadDistricts(); renderSubdistricts(); } catch (e) { $('dsList').innerHTML = hint(e.message); }
  }
  async function selectDistrict(id) {
    dsId = id; $('sdSearch').value = '';
    renderDistricts();
    $('sdList').innerHTML = UI.loadingHtml();
    try { await loadSubdistricts(); } catch (e) { $('sdList').innerHTML = hint(e.message); }
  }

  const KIND = {
    province: { api: '/api/address/provinces', word: () => 'จังหวัด', find: (id) => provinces.find(x => x.id === id) },
    district: { api: '/api/address/districts', word: () => words().district, find: (id) => districts.find(x => x.id === id) },
    subdistrict: { api: '/api/address/subdistricts', word: () => words().subdistrict, find: (id) => subdistricts.find(x => x.id === id) },
  };

  function editAddress(kind, o = {}) {
    const k = KIND[kind], word = k.word(), isNew = !o.id, isSub = kind === 'subdistrict';
    const p = pv(), d = ds();
    const where = kind === 'district' ? `ใน${isBkk() ? '' : 'จังหวัด'}${p.name}`
      : isSub ? `ใน${d.prefix || ''}${d.name} ${p.name}` : (isNew ? 'เพิ่มจังหวัดที่ไม่มีในรายการ' : '');
    // รหัสไปรษณีย์ตั้งต้นของตำบลใหม่ = รหัสของอำเภอ (ถ้าอำเภอนั้นมีรหัสเดียว)
    const zip = isSub ? (o.postal_code || (d.postal_codes.length === 1 ? d.postal_codes[0] : '')) : '';
    UI.formModal({
      title: (isNew ? 'เพิ่ม' : 'แก้ไข') + word, subtitle: where, icon: isNew ? 'plus' : 'edit', size: 'sm',
      submitText: isNew ? 'เพิ่ม' + word : 'บันทึกการแก้ไข',
      body: `
        <div class="field col-12"><label for="af_name">ชื่อ${word} <span class="req">*</span></label>
          <input class="input" id="af_name" name="name" maxlength="100" value="${esc(o.name || '')}">
          <span class="hint">ไม่ต้องพิมพ์คำว่า "${word}" นำหน้า</span></div>
        ${isSub ? `<div class="field col-12"><label for="af_postal_code">รหัสไปรษณีย์ <span class="req">*</span></label>
          <input class="input mono" id="af_postal_code" name="postal_code" inputmode="numeric" maxlength="5" value="${esc(zip)}" placeholder="5 หลัก"></div>` : ''}`,
      onReady: (f) => {
        if (isSub) f.postal_code.addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5); });
      },
      onSubmit: async (f, m) => {
        const errors = {};
        if (!f.name.value.trim()) errors.name = 'กรุณากรอกชื่อ' + word;
        if (isSub && !/^\d{5}$/.test(f.postal_code.value)) errors.postal_code = 'รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก';
        if (Object.keys(errors).length) return m.invalid(errors);
        const body = { name: f.name.value };
        if (isSub) body.postal_code = f.postal_code.value;
        if (isNew && kind === 'district') body.province_id = pvId;
        if (isNew && isSub) body.district_id = dsId;
        const r = isNew ? await API.post(k.api, body) : await API.put(`${k.api}/${o.id}`, body);
        toast(r.message, r.existing ? 'warning' : 'success');
        if (isNew && kind === 'province') { pvId = r.item.id; dsId = null; }
        if (isNew && kind === 'district') dsId = r.item.id;
        await reload();
        const sel = document.querySelector(`.addr-item[data-kind="${kind}"][data-id="${r.item.id}"]`);
        if (sel) sel.scrollIntoView({ block: 'nearest' });
      },
    });
  }

  function deleteAddress(kind, o) {
    const k = KIND[kind], word = k.word(), w = words();
    const sub = kind === 'province' ? `${Fmt.number(o.district_count)} อำเภอ/เขต`
      : kind === 'district' ? `${Fmt.number(o.subdistrict_count)} ${w.subdistrict}` : 'รหัสไปรษณีย์ ' + o.postal_code;
    const children = kind === 'province' ? o.district_count : kind === 'district' ? o.subdistrict_count : 0;
    confirm(`ต้องการลบ${word}นี้หรือไม่?`, {
      title: 'ลบ' + word, okText: 'ลบ' + word, item: (o.prefix || (kind === 'province' ? '' : word)) + o.name, itemSub: sub,
      detail: (children ? (kind === 'province' ? 'อำเภอและตำบลทั้งหมดในจังหวัดนี้จะถูกลบไปด้วย — ' : `${w.subdistrict}ทั้งหมดใน${word}นี้จะถูกลบไปด้วย — `) : '')
        + 'ลบไม่ได้ถ้ามีสมาชิกใช้ที่อยู่นี้ และการลบไม่สามารถย้อนกลับได้',
      onConfirm: async () => {
        const r = await API.del(`${k.api}/${o.id}`);
        toast(r.message);
        if (kind === 'province' && o.id === pvId) { pvId = null; dsId = null; }
        if (kind === 'district' && o.id === dsId) dsId = null;
        await reload();
      },
    });
  }

  const cols = document.querySelector('.addr-cols');
  cols.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) { if (!add.disabled) editAddress(add.dataset.add); return; }
    const item = e.target.closest('.addr-item'); if (!item) return;
    const kind = item.dataset.kind, id = +item.dataset.id, o = KIND[kind].find(id);
    const menu = e.target.closest('[data-menu]');
    if (menu) {
      UI.popMenu(menu, [
        { label: 'แก้ไข', icon: Icons.edit, onClick: () => editAddress(kind, o) },
        '-',
        { label: 'ลบ', icon: Icons.trash, danger: true, onClick: () => deleteAddress(kind, o) },
      ]);
      return;
    }
    if (kind === 'province') selectProvince(id);
    if (kind === 'district') selectDistrict(id);
  });
  cols.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('addr-item')) { e.preventDefault(); e.target.click(); }
  });
  $('pvSearch').addEventListener('input', renderProvinces);
  $('dsSearch').addEventListener('input', renderDistricts);
  $('sdSearch').addEventListener('input', renderSubdistricts);

  loadOptions();
  $('pvList').innerHTML = UI.loadingHtml();
  renderDistricts(); renderSubdistricts();
  loadProvinces().catch(e => { $('pvList').innerHTML = hint(e.message); });
})();
