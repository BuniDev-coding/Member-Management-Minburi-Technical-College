/* หน้าการเลือกตั้ง (แบบ อวท.08) — ผู้สมัคร คะแนนเสียง ลำดับผล ผู้รับรอง/ผู้อนุมัติ และแต่งตั้งผู้ชนะ */
(function () {
  const { esc, Fmt, toast, options, avatar, confirm, setLoading } = UI;
  Layout.init({ active: 'elections', title: 'การเลือกตั้ง', subtitle: 'รายงานผลการเลือกตั้งประธานชมรมวิชาชีพ ตามแบบ อวท.08' });
  if (!Auth.require('members.view')) return;

  const canEdit = Auth.can('members.edit'), canDoc = Auth.can('reports');
  document.querySelectorAll('[data-icon]').forEach(e => { e.innerHTML = Icons[e.dataset.icon]; });
  document.querySelectorAll('[data-perm]').forEach(e => { e.hidden = !Auth.can(e.dataset.perm); });
  const btnAdd = document.getElementById('btnAdd');
  btnAdd.innerHTML = Icons.plus + 'บันทึกการเลือกตั้ง';
  const yearSel = document.getElementById('yearSel');
  let meta, viewing = null;

  UI.getMeta().then(m => {
    meta = m;
    yearSel.innerHTML = options(meta.years, { label: 'name', selected: meta.current_year_id, placeholder: 'ทุกปีการศึกษา' });
    yearSel.addEventListener('change', () => { viewing = null; document.getElementById('elDetail').hidden = true; load(); });
    load();
  });

  async function load() {
    const box = document.getElementById('elList');
    box.innerHTML = UI.loadingHtml();
    try {
      const r = await API.get('/api/elections', { year_id: yearSel.value });
      box.innerHTML = r.items.length ? `<table class="table" style="min-width:720px">
        <thead><tr><th>การเลือกตั้ง</th><th class="center">ปีการศึกษา</th><th>วันที่เลือกตั้ง</th><th class="center">ผู้สมัคร</th><th class="center">คะแนนรวม</th><th>ผู้ได้รับเลือก</th><th></th></tr></thead>
        <tbody>${r.items.map(e => `<tr>
          <td><b>${esc(e.title)}</b><div class="text-muted text-sm">ตำแหน่ง${esc(e.position)}${e.department ? ' · ชมรม' + esc(e.department) : ''}</div></td>
          <td class="center num">${esc(e.academic_year)}</td>
          <td>${e.election_date ? Fmt.date(e.election_date) : '-'}</td>
          <td class="center num">${e.candidate_count}</td>
          <td class="center num">${Fmt.number(e.total_votes)}</td>
          <td>${e.winner ? `${esc(e.winner)}${e.appointed_at ? ' <span class="badge green">แต่งตั้งแล้ว</span>' : ''}` : '<span class="text-muted">ยังไม่สรุปผล</span>'}</td>
          <td style="text-align:right;white-space:nowrap"><button class="btn btn-sm" data-view="${e.id}">${Icons.eye}ดูผล</button>
            ${canEdit ? `<button class="icon-btn sm" data-menu="${e.id}" aria-label="ตัวเลือก">${Icons.more}</button>` : ''}</td></tr>`).join('')}</tbody></table>`
        : UI.emptyHtml('ยังไม่มีข้อมูลการเลือกตั้ง', canEdit ? 'กดปุ่ม "บันทึกการเลือกตั้ง" เพื่อเพิ่ม' : '');
      box.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => show(+b.dataset.view)));
      box.querySelectorAll('[data-menu]').forEach(b => b.addEventListener('click', () => {
        const id = +b.dataset.menu;
        UI.popMenu(b, [
          { label: 'แก้ไข', icon: Icons.edit, onClick: async () => edit((await API.get('/api/elections/' + id)).election) },
          '-',
          { label: 'ลบ', icon: Icons.trash, danger: true, onClick: () => remove(r.items.find(x => x.id === id)) },
        ]);
      }));
      if (viewing) show(viewing, false);
    } catch (e) { box.innerHTML = UI.emptyHtml('โหลดข้อมูลไม่สำเร็จ', e.message); }
  }

  async function show(id, scroll = true) {
    viewing = id;
    const card = document.getElementById('elDetail');
    card.hidden = false;
    card.innerHTML = UI.loadingHtml();
    if (scroll) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      const e = (await API.get('/api/elections/' + id)).election;
      const used = e.total_votes + (e.spoiled_ballots || 0) + (e.no_vote || 0);
      card.innerHTML = `
        <div class="card-head">
          <div class="card-title"><span class="ic">${Icons.award}</span><div>${esc(e.title)}
            <div class="card-sub">ปีการศึกษา ${esc(e.academic_year)} · วันที่เลือกตั้ง ${e.election_date ? Fmt.date(e.election_date) : '-'}</div></div></div>
          <div class="flex">
            ${canEdit && e.winner ? `<button class="btn btn-sm ${e.appointed_at ? 'btn-light' : 'btn-primary'}" id="btnAppointWin">${Icons.check}${e.appointed_at ? 'แต่งตั้งซ้ำ' : 'แต่งตั้งผู้ชนะ'}เป็น${esc(e.position)}</button>` : ''}
            ${canEdit ? `<button class="btn btn-sm btn-light" id="btnEdit">${Icons.edit}แก้ไข</button>` : ''}
            ${canDoc ? `<button class="btn btn-sm btn-danger" id="btnDoc">${Icons.pdf}รายงาน อวท.08</button>` : ''}
          </div>
        </div>
        <div class="flex" style="gap:22px;flex-wrap:wrap;margin-bottom:14px;color:var(--text-2)">
          <span>ผู้มีสิทธิ์: <b>${e.eligible_voters != null ? Fmt.number(e.eligible_voters) : '-'}</b></span>
          <span>มาใช้สิทธิ์: <b>${Fmt.number(used)}</b>${e.eligible_voters ? ` (${(used * 100 / e.eligible_voters).toFixed(2)}%)` : ''}</span>
          <span>บัตรดี: <b>${Fmt.number(e.total_votes)}</b></span>
          <span>บัตรเสีย: <b>${Fmt.number(e.spoiled_ballots || 0)}</b></span>
          <span>ไม่ประสงค์ลงคะแนน: <b>${Fmt.number(e.no_vote || 0)}</b></span>
        </div>
        ${e.candidates.length ? `<div class="table-wrap"><table class="table" style="min-width:640px">
          <thead><tr><th class="center">ลำดับ</th><th class="center">หมายเลข</th><th>ชื่อ - นามสกุล</th><th>เลขประจำตัว</th><th>ระดับชั้น</th><th class="center">คะแนน</th><th style="width:22%">สัดส่วน</th></tr></thead>
          <tbody>${e.candidates.map(c => {
            const pct = e.total_votes ? c.votes * 100 / e.total_votes : 0;
            return `<tr class="${c.rank === 1 && e.winner ? 'rank-1' : ''}">
              <td class="center"><b>${c.rank}</b>${c.rank === 1 && e.winner ? ' ' + Icons.award : ''}</td>
              <td class="center num">${c.candidate_no}</td>
              <td><div class="person">${avatar(c)}<a class="p-main" href="member-view.html?id=${c.member_id}">${esc(c.full_name)}</a></div></td>
              <td class="num">${esc(c.student_id || '-')}</td>
              <td>${esc([c.education_level, c.department].filter(Boolean).join(' · ') || '-')}</td>
              <td class="center num"><b>${Fmt.number(c.votes)}</b></td>
              <td><div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:8px;border-radius:4px;background:var(--border-soft)"><div style="width:${pct}%;height:100%;border-radius:4px;background:var(--primary)"></div></div><span class="text-sm num">${pct.toFixed(1)}%</span></div></td></tr>`;
          }).join('')}</tbody></table></div>` : UI.emptyHtml('ยังไม่มีผู้สมัคร')}
        <p style="margin:14px 0 0;color:var(--text-2)">${e.winner ? `ผู้ได้รับเลือก: <b>${esc(e.winner)}</b>${e.appointed_at ? ` · แต่งตั้งเข้าตำแหน่งแล้วเมื่อ ${Fmt.datetime(e.appointed_at)}` : ''}`
          : 'ยังสรุปผู้ได้รับเลือกไม่ได้ (ยังไม่มีคะแนน หรือคะแนนสูงสุดเท่ากัน)'}</p>
        <p class="text-sm text-muted" style="margin:6px 0 0">ผู้รายงาน (ประธานชมรม): ${esc(e.reporter_name || '-')} · ครูที่ปรึกษา: ${esc(e.advisor_name || '-')} · ผู้อำนวยการ: ${esc(e.director_name || '-')}</p>`;
      const be = card.querySelector('#btnEdit'); be && be.addEventListener('click', () => edit(e));
      const bd = card.querySelector('#btnDoc');
      bd && bd.addEventListener('click', async () => {
        setLoading(bd, true, 'กำลังสร้าง...');
        try { await API.download(`/api/elections/${e.id}/document`, null, `avt08_${e.id}.pdf`); toast('สร้างรายงานเรียบร้อย'); }
        catch (err) { toast(err.message, 'error'); } finally { setLoading(bd, false); }
      });
      const ba = card.querySelector('#btnAppointWin');
      ba && ba.addEventListener('click', () => confirm(`แต่งตั้ง ${e.winner} เป็น${e.position} ปีการศึกษา ${e.academic_year} หรือไม่?`, {
        title: 'แต่งตั้งผู้ชนะการเลือกตั้ง', okText: 'แต่งตั้ง', variant: 'info', icon: 'award',
        detail: 'ระบบจะบันทึกตำแหน่งนี้ในประวัติการดำรงตำแหน่งของสมาชิก (ถ้ามีตำแหน่งอื่นในปีนั้นอยู่แล้วจะถูกเปลี่ยน)',
        onConfirm: async () => { const r = await API.post(`/api/elections/${e.id}/appoint`); toast(r.message); load(); },
      }));
    } catch (err) { card.innerHTML = UI.emptyHtml('โหลดข้อมูลไม่สำเร็จ', err.message); }
  }

  // ---------------------------------------------------------------------
  // เพิ่ม / แก้ไข
  // ---------------------------------------------------------------------
  function edit(e = {}) {
    const isNew = !e.id;
    const chair = meta.positions.find(p => p.name === 'ประธาน') || meta.positions[0] || {};
    let cands = (e.candidates || []).slice().sort((a, b) => a.candidate_no - b.candidate_no);
    const n = (v) => (v === null || v === undefined ? '' : v);
    UI.formModal({
      title: isNew ? 'บันทึกการเลือกตั้ง' : 'แก้ไขข้อมูลการเลือกตั้ง', subtitle: 'แบบ อวท.08', icon: 'award', size: 'lg',
      submitText: isNew ? 'บันทึก' : 'บันทึกการแก้ไข',
      body: `
        <div class="field col-4"><label for="ef_year">ปีการศึกษา <span class="req">*</span></label><select class="select" id="ef_year" name="academic_year_id">${options(meta.years, { label: 'name', selected: e.academic_year_id || yearSel.value || meta.current_year_id })}</select></div>
        <div class="field col-4"><label for="ef_pos">ตำแหน่งที่เลือกตั้ง <span class="req">*</span></label><select class="select" id="ef_pos" name="position_id">${options(meta.positions, { selected: e.position_id || chair.id })}</select></div>
        <div class="field col-4"><label for="ef_dept">ชมรม (แผนกวิชา)</label><select class="select" id="ef_dept" name="department_id">${options(meta.departments, { selected: e.department_id, placeholder: 'ระดับองค์การ' })}</select></div>
        <div class="field col-8"><label for="ef_title">ชื่อการเลือกตั้ง</label><input class="input" id="ef_title" name="title" maxlength="200" value="${esc(e.title || '')}" placeholder="เว้นว่าง = การเลือกตั้ง{ตำแหน่ง}ชมรมวิชาชีพ"></div>
        <div class="field col-4"><label for="ef_date">วันที่เลือกตั้ง</label><input class="input" type="date" id="ef_date" name="election_date" value="${esc(e.election_date || '')}"></div>
        <div class="field col-4"><label for="ef_el">ผู้มีสิทธิ์เลือกตั้ง (คน)</label><input class="input num" id="ef_el" name="eligible_voters" inputmode="numeric" value="${n(e.eligible_voters)}"></div>
        <div class="field col-4"><label for="ef_sp">บัตรเสีย (ใบ)</label><input class="input num" id="ef_sp" name="spoiled_ballots" inputmode="numeric" value="${n(e.spoiled_ballots)}"></div>
        <div class="field col-4"><label for="ef_nv">ไม่ประสงค์ลงคะแนน (ใบ)</label><input class="input num" id="ef_nv" name="no_vote" inputmode="numeric" value="${n(e.no_vote)}"></div>

        <div class="col-12"><div class="flex between" style="margin:8px 0 6px"><b>ผู้สมัคร และคะแนนเสียง</b><span class="text-sm text-muted" id="candSum"></span></div>
          <div class="table-wrap"><table class="table cand-table" style="min-width:560px">
            <thead><tr><th style="width:90px">หมายเลข</th><th>ชื่อ - นามสกุล</th><th style="width:120px">คะแนน</th><th style="width:44px"></th></tr></thead>
            <tbody id="candBody"></tbody></table></div>
          <div class="field" style="margin-top:10px"><input class="input" id="candSearch" name="cand_q" placeholder="+ เพิ่มผู้สมัคร: พิมพ์ชื่อ เลขสมาชิก หรือรหัสประจำตัว"></div></div>

        <div class="col-12"><b>ผู้ลงนามในรายงาน (แบบ อวท.08)</b></div>
        <div class="field col-4"><label for="ef_rd">วันที่ของรายงาน</label><input class="input" type="date" id="ef_rd" name="report_date" value="${esc(e.report_date || '')}"></div>
        <div class="field col-8"><label for="ef_rp">ประธานชมรมวิชาชีพ (ผู้รายงาน)</label><input class="input" id="ef_rp" name="reporter_name" maxlength="150" value="${esc(e.reporter_name || '')}"></div>
        <div class="field col-6"><label for="ef_ad">ครูที่ปรึกษาชมรมวิชาชีพ</label><input class="input" id="ef_ad" name="advisor_name" maxlength="150" value="${esc(e.advisor_name || '')}"></div>
        <div class="field col-6"><label for="ef_ah">หัวหน้างานกิจกรรมนักเรียน นักศึกษา</label><input class="input" id="ef_ah" name="activity_head_name" maxlength="150" value="${esc(e.activity_head_name || '')}"></div>
        <div class="field col-6"><label for="ef_dp">รองผู้อำนวยการฝ่ายพัฒนากิจการนักเรียน นักศึกษา</label><input class="input" id="ef_dp" name="deputy_name" maxlength="150" value="${esc(e.deputy_name || '')}"></div>
        <div class="field col-6"><label for="ef_dr">ผู้อำนวยการวิทยาลัย</label><input class="input" id="ef_dr" name="director_name" maxlength="150" value="${esc(e.director_name || '')}"></div>
        <div class="col-12 hint">ช่องที่เว้นว่างจะพิมพ์เป็นจุดไข่ปลาให้เขียนด้วยมือ</div>
        <div class="field col-12"><label for="ef_note">หมายเหตุ</label><input class="input" id="ef_note" name="note" value="${esc(e.note || '')}"></div>`,
      onReady: (f) => {
        const body = f.querySelector('#candBody');
        const renderCands = () => {
          body.innerHTML = cands.length ? cands.map((c, i) => `<tr>
            <td><input class="input num" data-i="${i}" data-k="candidate_no" inputmode="numeric" value="${n(c.candidate_no)}"></td>
            <td><b>${esc(c.full_name)}</b><div class="text-sm text-muted">${esc([c.student_id, c.education_level].filter(Boolean).join(' · '))}</div></td>
            <td><input class="input num" data-i="${i}" data-k="votes" inputmode="numeric" value="${n(c.votes)}"></td>
            <td><button type="button" class="icon-btn sm danger" data-del="${i}" aria-label="นำออก">${Icons.trash}</button></td></tr>`).join('')
            : '<tr><td colspan="4" class="text-muted text-sm" style="padding:12px">ยังไม่มีผู้สมัคร — ค้นหาและเพิ่มด้านล่าง</td></tr>';
          body.querySelectorAll('[data-k]').forEach(inp => inp.addEventListener('input', () => {
            inp.value = inp.value.replace(/\D/g, '');
            cands[+inp.dataset.i][inp.dataset.k] = inp.value === '' ? '' : +inp.value;
            sum();
          }));
          body.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => { cands.splice(+b.dataset.del, 1); renderCands(); }));
          sum();
        };
        const sum = () => {
          const t = cands.reduce((a, c) => a + (+c.votes || 0), 0);
          f.querySelector('#candSum').textContent = `${cands.length} คน · คะแนนรวม ${Fmt.number(t)}`;
        };
        f.querySelectorAll('.num[name]').forEach(inp => inp.addEventListener('input', () => { inp.value = inp.value.replace(/\D/g, ''); }));
        const search = f.querySelector('#candSearch');
        const picker = MemberPicker.attach(search, {
          onPick: (m) => {
            if (!m) return;
            if (cands.some(c => c.member_id === m.id)) { toast(`${m.full_name} อยู่ในรายชื่อผู้สมัครแล้ว`, 'error'); picker.clear(); return; }
            const next = cands.reduce((a, c) => Math.max(a, +c.candidate_no || 0), 0) + 1;
            cands.push({ member_id: m.id, full_name: m.full_name, student_id: m.student_id, education_level: m.education_level, candidate_no: next, votes: 0 });
            renderCands(); picker.clear(); search.focus();
          },
        });
        renderCands();
      },
      onSubmit: async (f, m) => {
        const nos = cands.map(c => +c.candidate_no);
        if (nos.some(x => !x)) return m.invalid({ cand_q: 'กรุณาระบุหมายเลขผู้สมัครให้ครบทุกคน' });
        if (new Set(nos).size !== nos.length) return m.invalid({ cand_q: 'หมายเลขผู้สมัครซ้ำกัน' });
        const body = {};
        ['academic_year_id', 'position_id', 'department_id', 'title', 'election_date', 'eligible_voters', 'spoiled_ballots', 'no_vote',
          'report_date', 'reporter_name', 'advisor_name', 'activity_head_name', 'deputy_name', 'director_name', 'note'].forEach(k => { body[k] = f.elements[k].value.trim(); });   // ใช้ elements: f.title คือ attribute ของ <form>
        body.candidates = cands.map(c => ({ member_id: c.member_id, candidate_no: c.candidate_no, votes: c.votes || 0 }));
        const r = isNew ? await API.post('/api/elections', body) : await API.put('/api/elections/' + e.id, body);
        toast(r.message);
        viewing = r.election.id;
        if (String(yearSel.value) && String(yearSel.value) !== String(r.election.academic_year_id)) yearSel.value = r.election.academic_year_id;
        load();
      },
    });
  }

  function remove(e) {
    confirm('ต้องการลบข้อมูลการเลือกตั้งนี้หรือไม่?', {
      title: 'ลบการเลือกตั้ง', okText: 'ลบ', item: e.title, itemSub: `ผู้สมัคร ${e.candidate_count} คน · คะแนนรวม ${e.total_votes}`,
      detail: 'ลบเฉพาะข้อมูลการเลือกตั้ง ตำแหน่งที่แต่งตั้งไปแล้วจะไม่ถูกลบ',
      onConfirm: async () => {
        const r = await API.del('/api/elections/' + e.id); toast(r.message);
        if (viewing === e.id) { viewing = null; document.getElementById('elDetail').hidden = true; }
        load();
      },
    });
  }

  btnAdd.addEventListener('click', () => edit());
})();
