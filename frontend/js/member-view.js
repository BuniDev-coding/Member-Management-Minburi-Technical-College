/* =====================================================================
   หน้าดูประวัติสมาชิก — แสดงตามรูปแบบที่ Admin เลือกไว้
   (Profile Card / Biography / Executive Profile / Portfolio)
   ===================================================================== */
(function () {
  const { esc, nl2br, Fmt, statusHtml, toast } = UI;
  const url = new URLSearchParams(location.search);
  const id = url.get('id');
  Layout.init({ active: 'search', title: 'ประวัติสมาชิก', subtitle: 'ข้อมูลภายใน — สำหรับเจ้าหน้าที่เท่านั้น' });
  if (!Auth.require('members.view')) return;

  const TPLS = { card: 'Profile Card', biography: 'Biography', executive: 'Executive Profile', portfolio: 'Portfolio' };
  const TPL_ICONS = { card: Icons.user, biography: Icons.book, executive: Icons.star, portfolio: Icons.briefcase };
  const stage = document.getElementById('profile');
  let m = null, tpl = null;

  const back = document.getElementById('btnBack');
  back.innerHTML = Icons.arrowLeft + 'กลับ';
  back.addEventListener('click', () => (document.referrer && history.length > 1 ? history.back() : Nav.go('search.html')));

  if (!id) { stage.innerHTML = `<div class="card">${UI.emptyHtml('ไม่ได้ระบุสมาชิก')}</div>`; return; }

  API.get('/api/members/' + id).then(r => {
    m = r.member;
    tpl = TPLS[url.get('tpl')] ? url.get('tpl') : m.profile_template;
    document.title = `${m.full_name} | ประวัติสมาชิก`;
    renderTabs(); renderActions(); draw();
  }).catch(e => { stage.innerHTML = `<div class="card">${UI.emptyHtml('ไม่พบข้อมูลสมาชิก', e.message)}</div>`; });

  function renderTabs() {
    const tabs = document.getElementById('tplTabs');
    tabs.innerHTML = Object.entries(TPLS).map(([k, l]) =>
      `<button class="tab ${k === tpl ? 'active' : ''}" data-tpl="${k}" role="tab" aria-selected="${k === tpl}" title="${k === m.profile_template ? 'รูปแบบหลักของสมาชิกนี้' : 'ดูตัวอย่าง'}">${TPL_ICONS[k]}${l}${k === m.profile_template ? ' ★' : ''}</button>`).join('');
    tabs.querySelectorAll('[data-tpl]').forEach(b => b.addEventListener('click', () => {
      tpl = b.dataset.tpl;
      history.replaceState(null, '', `?id=${id}&tpl=${tpl}`);
      renderTabs(); renderActions(); draw();
    }));
  }

  function renderActions() {
    const box = document.getElementById('viewActions');
    const canEdit = Auth.can('members.edit');
    box.innerHTML = `
      ${canEdit && tpl !== m.profile_template ? `<button class="btn" id="btnSetTpl">${Icons.check}ใช้รูปแบบนี้เป็นค่าหลัก</button>` : ''}
      <button class="btn btn-light" id="btnPrint">${Icons.printer}พิมพ์</button>
      <button class="btn btn-light" id="btnForm10" title="ดาวน์โหลดใบสมัครสมาชิกแบบ อวท.10">${Icons.pdf}ใบสมัคร อวท.10</button>
      ${canEdit ? `<a class="btn btn-primary" href="member-form.html?id=${m.id}">${Icons.edit}แก้ไขข้อมูล</a>` : ''}`;
    box.querySelector('#btnPrint').addEventListener('click', () => window.print());
    box.querySelector('#btnForm10').addEventListener('click', async (e) => {
      const b = e.currentTarget; UI.setLoading(b, true, 'กำลังสร้าง...');
      try { await API.download(`/api/members/${m.id}/form10`, null, `avt10_${m.member_no}.pdf`); }
      catch (err) { UI.toast(err.message, 'error'); } finally { UI.setLoading(b, false); }
    });
    const set = box.querySelector('#btnSetTpl');
    if (set) set.addEventListener('click', async () => {
      try {
        const r = await API.patch(`/api/members/${m.id}/template`, { profile_template: tpl });
        m.profile_template = tpl; toast(r.message); renderTabs(); renderActions();
      } catch (e) { toast(e.message, 'error'); }
    });
  }

  // ---------------------------------------------------------------------
  // ส่วนประกอบที่ใช้ร่วมกัน
  // ---------------------------------------------------------------------
  const photo = (cls = '') => `<div class="pf-photo ${cls}">${m.photo_path
    ? `<img src="${API.fileUrl(m.photo_path)}" alt="${esc(m.full_name)}">` : esc(m.first_name.charAt(0))}</div>`;
  const nameEn = () => [m.first_name_en, m.last_name_en].filter(Boolean).join(' ');
  const posColor = () => m.position_color || '#1F4FB5';
  const age = () => { const a = Fmt.age(m.birth_date); return a ? a + ' ปี' : '-'; };
  const val = (x) => (x ? esc(x) : '-');
  const acts = (cat) => m.activities.filter(a => !cat || a.category === cat);
  const skills = () => (m.skills || '').split(/[,\n]/).map(s => s.trim()).filter(Boolean);
  const curPos = () => m.positions.find(p => p.position === m.position) || m.positions[0];
  const empty = (t) => `<p class="pf-empty">${t}</p>`;

  function draw() {
    const html = { card: tplCard, biography: tplBio, executive: tplExec, portfolio: tplPortfolio }[tpl]();
    stage.innerHTML = `<div class="profile-stage">${html}</div>`;
    stage.querySelectorAll('[data-zoom]').forEach(img => img.addEventListener('click', () => {
      const lb = document.createElement('div'); lb.className = 'lightbox';
      lb.innerHTML = `<img src="${img.src}" alt="">`; lb.addEventListener('click', () => lb.remove());
      document.body.appendChild(lb);
    }));
    stage.querySelectorAll('.pt-filter button').forEach(b => b.addEventListener('click', () => {
      stage.querySelectorAll('.pt-filter button').forEach(x => x.classList.toggle('active', x === b));
      stage.querySelectorAll('.pt-work').forEach(w => { w.hidden = b.dataset.cat && !w.classList.contains(b.dataset.cat); });
    }));
  }

  // ---------------------------------------------------------------------
  // 1) Profile Card — รูปภาพ ชื่อ และตำแหน่ง
  // ---------------------------------------------------------------------
  function tplCard() {
    const cp = curPos();
    return `<div class="tpl-card"><div class="pc pf-box">
      <div class="pc-cover"><div class="pc-org">องค์การนักวิชาชีพในอนาคตแห่งประเทศไทย<br>วิทยาลัยเทคนิคมีนบุรี</div></div>
      ${photo()}
      <div class="pc-body">
        <h2>${esc(m.full_name)}</h2>
        <div class="pc-en">${esc(nameEn() || (m.nickname ? 'ชื่อเล่น ' + m.nickname : ''))}&nbsp;</div>
        <span class="pc-pos" style="background:${esc(posColor())}">${esc(m.position)}</span>
        <div class="pc-year">${cp ? 'ปีการศึกษา ' + cp.academic_year : ''}</div>
        <div class="pc-info">
          <div><small>เลขสมาชิก</small><b class="mono">${esc(m.member_no)}</b></div>
          <div><small>แผนกวิชา</small><b>${val(m.department)}</b></div>
          <div><small>ระดับชั้น</small><b>${val(m.education_level)}</b></div>
          <div><small>สถานะ</small><b>${statusHtml(m.status)}</b></div>
        </div>
        <div class="pc-contact">
          ${m.phone ? `<span>${Icons.phone}${Fmt.phone(m.phone)}</span>` : ''}
          ${m.email ? `<span>${Icons.mail}${esc(m.email)}</span>` : ''}
          ${m.line_id ? `<span>${Icons.message}${esc(m.line_id)}</span>` : ''}
        </div>
      </div>
    </div></div>`;
  }

  // ---------------------------------------------------------------------
  // 2) Biography — รูปภาพพร้อมประวัติส่วนตัว
  // ---------------------------------------------------------------------
  function tplBio() {
    const row = (l, v) => `<div class="row"><span>${l}</span><span>${v}</span></div>`;
    const paras = (m.biography || '').split(/\n+/).filter(Boolean);
    return `<div class="tpl-bio">
      <aside class="bio-side pf-box">${photo()}
        <div class="bio-facts">
          ${row('เลขสมาชิก', `<span class="mono">${esc(m.member_no)}</span>`)}
          ${row('ตำแหน่ง', esc(m.position))}
          ${row('ชื่อเล่น', val(m.nickname))}
          ${row('วันเกิด', m.birth_date ? Fmt.date(m.birth_date, true) : '-')}
          ${row('อายุ', age())}
          ${row('ศาสนา / สัญชาติ', `${val(m.religion)} / ${val(m.nationality)}`)}
          ${row('กรุ๊ปเลือด', val(m.blood_type))}
          ${row('เบอร์ติดต่อ', Fmt.phone(m.phone))}
          ${row('อีเมล', val(m.email))}
        </div>
      </aside>
      <article class="bio-main pf-box">
        <div class="bio-kicker">ประวัติส่วนตัว</div>
        <h2>${esc(m.full_name)}</h2>
        <div class="bio-sub">${esc(nameEn())}${nameEn() ? ' · ' : ''}${val(m.education_level)} แผนกวิชา${val(m.department)} · ปีการศึกษา ${val(m.academic_year)}</div>
        ${paras.length ? paras.map(p => `<p class="bio-text">${esc(p)}</p>`).join('') : empty('ยังไม่มีข้อมูลประวัติส่วนตัว')}
        ${skills().length ? `<h3>ความสามารถพิเศษ</h3><div class="pf-tags">${skills().map(s => `<span class="pf-tag">${esc(s)}</span>`).join('')}</div>` : ''}
        <h3>ประวัติการศึกษา</h3>
        ${m.educations.length ? `<div class="timeline">${m.educations.map(e => `<div class="tl-item"><b>${esc(e.institution)}</b>
          <small>${[e.level, e.major, e.graduated_year ? 'ปี ' + e.graduated_year : '', e.gpa ? 'GPA ' + e.gpa : ''].filter(Boolean).map(esc).join(' · ')}</small></div>`).join('')}</div>` : empty('ยังไม่มีข้อมูล')}
        <h3>ที่อยู่ และผู้ปกครอง</h3>
        <p style="margin:0;line-height:1.8;color:var(--text-2)">${m.address ? nl2br(m.address) : '-'}<br>บิดา: ${val(m.father_name)} · มารดา: ${val(m.mother_name)}<br>ผู้ปกครอง: ${val(m.parent_name)} ${m.parent_phone ? '(' + Fmt.phone(m.parent_phone) + ')' : ''}</p>
        <h3>ทะเบียนสมาชิก (อวท.10)</h3>
        <p style="margin:0;line-height:1.8;color:var(--text-2)">ทะเบียนเลขที่: ${val(m.registration_no)} · ระดับ: ${m.member_type ? 'สมาชิก' + esc(m.member_type) : '-'}<br>นายทะเบียน: ${val(m.registrar_name)} · วันที่ลงทะเบียน: ${m.registered_date ? Fmt.date(m.registered_date) : '-'}${m.leave_reason || m.left_date ? `<br>พ้นสภาพสมาชิกด้วยเหตุ: ${val(m.leave_reason)} · เมื่อ ${m.left_date ? Fmt.date(m.left_date) : '-'}` : ''}</p>
      </article>
    </div>`;
  }

  // ---------------------------------------------------------------------
  // 3) Executive Profile — ประธาน / รองประธาน แบบละเอียด
  // ---------------------------------------------------------------------
  function tplExec() {
    // ใช้ตำแหน่งผู้บริหารล่าสุดที่เคยดำรง (ถ้ามี) แทนตำแหน่งปัจจุบัน
    const execPos = m.positions.find(p => p.is_executive);
    const isExec = !!execPos;
    const cp = execPos || curPos();
    const title = cp ? cp.position : m.position;
    const achievements = acts('achievement');
    const info = (l, v) => `<div><small>${l}</small><b>${v}</b></div>`;
    return `<div class="tpl-exec">
      ${!isExec ? `<div class="ex-note">${Icons.alert.replace('<svg', '<svg style="width:16px;vertical-align:-3px"')} สมาชิกนี้ไม่ได้ดำรงตำแหน่งประธาน/รองประธาน — รูปแบบนี้เหมาะสำหรับผู้บริหารองค์การ</div>` : ''}
      <section class="ex-hero">
        ${photo()}
        <div>
          <span class="ex-badge">${Icons.star}คณะผู้บริหารองค์การ</span>
          <h2>${esc(m.full_name)}</h2>
          <div class="ex-title"><b>${esc(title)}</b> องค์การนักวิชาชีพในอนาคตแห่งประเทศไทย วิทยาลัยเทคนิคมีนบุรี</div>
          <div class="ex-meta">
            <div><small>ปีการศึกษา</small><b>${cp ? cp.academic_year : val(m.academic_year)}</b></div>
            <div><small>เลขสมาชิก</small><b>${esc(m.member_no)}</b></div>
            <div><small>แผนกวิชา</small><b>${val(m.department)}</b></div>
            <div><small>ระดับชั้น</small><b>${val(m.education_level)}</b></div>
          </div>
        </div>
      </section>
      ${m.vision ? `<div class="ex-vision">${Icons.quote}<small>วิสัยทัศน์ / คติประจำใจ</small>“${esc(m.vision)}”</div>` : ''}
      <div class="ex-grid">
        <div class="ex-col">
          <div class="ex-card"><h3><span class="ic">${Icons.user}</span>ประวัติส่วนตัว</h3>
            ${m.biography ? `<p style="margin:0 0 18px;line-height:1.85;color:var(--text-2)">${nl2br(m.biography)}</p>` : ''}
            <div class="ex-info">
              ${info('ชื่อ (ภาษาอังกฤษ)', val(nameEn()))}${info('ชื่อเล่น', val(m.nickname))}
              ${info('วันเกิด / อายุ', `${m.birth_date ? Fmt.date(m.birth_date, true) : '-'} (${age()})`)}${info('เลขประจำตัวนักศึกษา', val(m.student_id))}
              ${info('เบอร์ติดต่อ', Fmt.phone(m.phone))}${info('อีเมล', val(m.email))}
              ${info('LINE', val(m.line_id))}${info('Facebook', val(m.facebook))}
            </div>
          </div>
          <div class="ex-card"><h3><span class="ic">${Icons.star}</span>ผลงานและรางวัล</h3>
            ${achievements.length ? `<div class="ex-ach">${achievements.map(a => `<div><b>${esc(a.title)}</b><small>${[a.role, a.organization, a.activity_date ? Fmt.date(a.activity_date) : ''].filter(Boolean).map(esc).join(' · ')}</small></div>`).join('')}</div>` : empty('ยังไม่มีข้อมูลผลงาน')}
            ${skills().length ? `<div class="pf-tags" style="margin-top:16px">${skills().map(s => `<span class="pf-tag">${esc(s)}</span>`).join('')}</div>` : ''}
          </div>
        </div>
        <div class="ex-col">
          <div class="ex-card"><h3><span class="ic">${Icons.award}</span>ประวัติการดำรงตำแหน่ง</h3>
            ${m.positions.length ? m.positions.map(p => `<div class="ex-term ${p.is_executive ? 'exec' : ''}"><div class="yr">${p.academic_year}</div>
              <div><b>${esc(p.position)}</b><div class="text-muted text-sm">${p.start_date ? Fmt.date(p.start_date) + ' – ' + Fmt.date(p.end_date) : 'ปีการศึกษา ' + p.academic_year}</div></div></div>`).join('') : empty('ยังไม่มีข้อมูล')}
          </div>
          <div class="ex-card"><h3><span class="ic">${Icons.flag}</span>กิจกรรมที่ร่วม</h3>
            ${acts('activity').length ? acts('activity').map(a => `<div class="ex-term"><div><b>${esc(a.title)}</b><div class="text-muted text-sm">${[a.role, a.activity_date ? Fmt.date(a.activity_date) : ''].filter(Boolean).map(esc).join(' · ')}</div></div></div>`).join('') : empty('ยังไม่มีข้อมูล')}
          </div>
          <div class="ex-card"><h3><span class="ic">${Icons.book}</span>ประวัติการศึกษา</h3>
            ${m.educations.length ? m.educations.map(e => `<div class="ex-term"><div><b>${esc(e.institution)}</b><div class="text-muted text-sm">${[e.level, e.major, e.graduated_year].filter(Boolean).map(esc).join(' · ')}</div></div></div>`).join('') : empty('ยังไม่มีข้อมูล')}
          </div>
        </div>
      </div>
    </div>`;
  }

  // ---------------------------------------------------------------------
  // 4) Portfolio — ประวัติ ผลงาน และกิจกรรม
  // ---------------------------------------------------------------------
  function tplPortfolio() {
    const ICON = { activity: Icons.flag, achievement: Icons.star, work: Icons.briefcase };
    const all = acts();
    return `<div class="tpl-port">
      <section class="pt-head pf-box">
        ${photo()}
        <div><h2>${esc(m.full_name)}</h2>
          <div class="sub">${esc(m.position)} · ${val(m.department)} · <span class="mono">${esc(m.member_no)}</span></div>
          <div style="margin-top:8px">${statusHtml(m.status)}</div></div>
        <div class="pt-stats">
          <div><b>${acts('achievement').length}</b><small>ผลงาน/รางวัล</small></div>
          <div><b>${acts('activity').length}</b><small>กิจกรรม</small></div>
          <div><b>${m.positions.length}</b><small>ปีที่ดำรงตำแหน่ง</small></div>
        </div>
      </section>
      <div class="pt-grid">
        <div class="pt-col">
          <div class="pt-card pf-box"><h3>เกี่ยวกับ</h3>${m.biography ? `<p class="pt-about">${nl2br(m.biography)}</p>` : empty('ยังไม่มีข้อมูลประวัติ')}</div>
          <div class="pt-card pf-box"><h3>ความสามารถพิเศษ</h3>${skills().length ? `<div class="pf-tags">${skills().map(s => `<span class="pf-tag">${esc(s)}</span>`).join('')}</div>` : empty('ยังไม่มีข้อมูล')}</div>
          <div class="pt-card pf-box pt-edu"><h3>ประวัติการศึกษา</h3>${m.educations.length ? m.educations.map(e => `<div><b>${esc(e.institution)}</b><small>${[e.level, e.major, e.graduated_year, e.gpa ? 'GPA ' + e.gpa : ''].filter(Boolean).map(esc).join(' · ')}</small></div>`).join('') : empty('ยังไม่มีข้อมูล')}</div>
          <div class="pt-card pf-box pt-edu"><h3>ประวัติตำแหน่ง</h3>${m.positions.map(p => `<div><b>${esc(p.position)}</b><small>ปีการศึกษา ${p.academic_year}</small></div>`).join('') || empty('-')}</div>
        </div>
        <div class="pt-col">
          <div class="pt-card pf-box"><h3>ผลงานและกิจกรรม</h3>
            ${all.length ? `<div class="pt-filter"><button class="active" data-cat="">ทั้งหมด (${all.length})</button>
              <button data-cat="achievement">ผลงาน/รางวัล</button><button data-cat="activity">กิจกรรม</button><button data-cat="work">การทำงาน</button></div>
              <div class="pt-works">${all.map(a => `<div class="pt-work ${a.category}"><span class="ic">${ICON[a.category]}${esc(a.category_label)}</span>
                <b>${esc(a.title)}</b>${a.role ? `<span class="role">${esc(a.role)}</span>` : ''}
                <small>${[a.organization, a.activity_date ? Fmt.date(a.activity_date) : ''].filter(Boolean).map(esc).join(' · ')}</small>
                ${a.description ? `<small>${esc(a.description)}</small>` : ''}</div>`).join('')}</div>` : empty('ยังไม่มีข้อมูลผลงานหรือกิจกรรม')}
          </div>
          <div class="pt-card pf-box"><h3>รูปภาพประกอบ</h3>
            ${m.images.length ? `<div class="pt-gallery">${m.images.map(i => `<img src="${API.fileUrl(i.image_path)}" alt="${esc(i.caption || '')}" data-zoom loading="lazy">`).join('')}</div>` : empty('ยังไม่มีรูปภาพประกอบ')}
          </div>
        </div>
      </div>
    </div>`;
  }
})();
