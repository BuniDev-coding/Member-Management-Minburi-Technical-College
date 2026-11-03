/* หน้าสืบค้นข้อมูลสมาชิก */
(function () {
  const { esc, avatar, statusHtml, posBadge, Fmt, options, toast } = UI;
  const url = new URLSearchParams(location.search);
  Layout.init({ active: 'search', title: 'สืบค้นข้อมูล', subtitle: 'ค้นหาและเปิดดูประวัติสมาชิก', onSearch: (q) => { quick = q; form.reset(); run(true); } });
  if (!Auth.require('members.view')) return;

  const form = document.getElementById('searchForm');
  const results = document.getElementById('results');
  const more = document.getElementById('btnMore');
  document.getElementById('icSearch').innerHTML = Icons.search;
  document.getElementById('vGrid').innerHTML = Icons.grid + 'การ์ด';
  document.getElementById('vList').innerHTML = Icons.list + 'ตาราง';

  let quick = url.get('q') || '';   // คำค้นจากช่องค้นหาด้านบน
  let view = 'grid', page = 1, items = [], lastParams = {};

  UI.getMeta().then(meta => {
    form.year_id.innerHTML = options(meta.years, { label: 'name', placeholder: 'ทุกปี', selected: url.get('year_id') });
    form.position_id.innerHTML = options(meta.positions, { placeholder: 'ทุกตำแหน่ง', selected: url.get('position_id') });
    form.department_id.innerHTML = options(meta.departments, { placeholder: 'ทุกแผนก' });
    run(true);
  });

  form.member_no.addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, ''); });
  form.addEventListener('submit', (e) => { e.preventDefault(); quick = ''; run(true); });
  form.addEventListener('reset', () => { setTimeout(() => { quick = ''; run(true); }); });
  more.addEventListener('click', () => { page++; run(false); });
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
    view = b.dataset.view;
    document.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('active', x === b));
    draw();
  }));

  async function run(reset) {
    if (reset) {
      page = 1; items = [];
      lastParams = { q: quick, name: form.name.value.trim(), member_no: form.member_no.value.trim(),
        year_id: form.year_id.value, position_id: form.position_id.value, department_id: form.department_id.value };
      results.innerHTML = UI.loadingHtml('กำลังค้นหา...');
    }
    const btn = document.getElementById('btnSearch');
    UI.setLoading(btn, true);
    try {
      const r = await API.get('/api/members', { ...lastParams, page, per_page: 24, sort: 'position' });
      items = items.concat(r.items);
      const conds = [];
      if (lastParams.q) conds.push(`"${lastParams.q}"`);
      if (lastParams.name) conds.push(`ชื่อ "${lastParams.name}"`);
      if (lastParams.member_no) conds.push(`เลขสมาชิก ${lastParams.member_no}`);
      ['year_id', 'position_id', 'department_id'].forEach(k => {
        const sel = form[k]; if (lastParams[k]) conds.push(sel.options[sel.selectedIndex].text);
      });
      document.getElementById('resultInfo').innerHTML = `พบ <b style="color:var(--primary)">${Fmt.number(r.total)}</b> รายการ${conds.length ? ' · เงื่อนไข: ' + esc(conds.join(', ')) : ''}`;
      more.hidden = page >= r.pages;
      draw();
    } catch (e) {
      results.innerHTML = `<div class="card">${UI.emptyHtml('ค้นหาไม่สำเร็จ', e.message)}</div>`;
    } finally { UI.setLoading(btn, false); }
  }

  function draw() {
    if (!items.length) {
      results.innerHTML = `<div class="card">${UI.emptyHtml('ไม่พบสมาชิกตามเงื่อนไข', 'ลองใช้คำค้นที่สั้นลง หรือล้างตัวกรองบางรายการ')}</div>`;
      return;
    }
    if (view === 'grid') {
      results.innerHTML = `<div class="result-grid">${items.map(m => `
        <div class="result-card">
          ${avatar(m)}
          <h4>${esc(m.full_name)}</h4>
          <div>${posBadge(m.position, m.position_color)}</div>
          <div class="meta mono">${esc(m.member_no)}</div>
          <div class="meta">${esc(m.department || 'ไม่ระบุแผนก')} · ปีการศึกษา ${esc(m.academic_year || '-')}</div>
          <a class="btn btn-primary btn-sm" href="member-view.html?id=${m.id}">${Icons.eye}ดูประวัติ</a>
        </div>`).join('')}</div>`;
    } else {
      results.innerHTML = `<div class="card"><div class="table-wrap"><table class="table">
        <thead><tr><th>ชื่อ - นามสกุล</th><th>เลขสมาชิก</th><th>ตำแหน่ง</th><th>ปีการศึกษา</th><th>แผนกวิชา</th><th>สถานะ</th><th></th></tr></thead>
        <tbody>${items.map(m => `<tr>
          <td><div class="person">${avatar(m)}<div class="p-main">${esc(m.full_name)}</div></div></td>
          <td class="num">${esc(m.member_no)}</td><td>${posBadge(m.position, m.position_color)}</td>
          <td class="num">${esc(m.academic_year || '-')}</td><td>${esc(m.department || '-')}</td><td>${statusHtml(m.status)}</td>
          <td style="text-align:right"><a class="btn btn-sm" href="member-view.html?id=${m.id}">${Icons.eye}ดูประวัติ</a></td></tr>`).join('')}
        </tbody></table></div></div>`;
    }
  }
})();
